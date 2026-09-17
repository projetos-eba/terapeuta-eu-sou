-- A V10 cancellation must validate against the version frozen on the active
-- schedule. `booking_version` is historical at schedule creation and becomes
-- stale after a pre-charge reschedule; `expected_booking_version` is the
-- concurrency binding maintained by the schedule trigger.
create or replace function public.cancel_uncharged_session_v10(
  p_booking_id uuid,
  p_patient_user_id uuid,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_now timestamptz := now();
begin
  if p_booking_id is null or p_patient_user_id is null
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
    or length(trim(coalesce(p_reason, ''))) not between 1 and 500
  then
    raise exception 'SESSION_PRECHARGE_CANCEL_V10_INVALID' using errcode = '22023';
  end if;

  -- Keep the same lock order as payment reconciliation. A worker that already
  -- claimed the schedule either commits first and is observed below, or waits
  -- until this transaction has atomically canceled the pristine schedule.
  select * into v_payment from public.session_payments
  where booking_id = p_booking_id for update;
  select booking.* into v_booking from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  where booking.id = p_booking_id and patient.user_id = p_patient_user_id
  for update of booking;
  if not found then
    raise exception 'SESSION_PRECHARGE_CANCEL_V10_FORBIDDEN' using errcode = '42501';
  end if;
  if v_payment.id is null or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PRECHARGE_CANCEL_V10_NOT_FOUND' using errcode = '23514';
  end if;

  select * into v_schedule from public.session_payment_schedules
  where session_payment_id = v_payment.id
  order by created_at desc limit 1 for update;

  if v_booking.status = 'cancelled_by_patient'
    and v_payment.financial_status = 'canceled'
    and v_schedule.status = 'canceled'
    and exists (
      select 1 from public.booking_events event
      where event.booking_id = v_booking.id
        and event.event_type = 'booking_status_changed'
        and event.request_id = trim(p_request_id)
        and event.next_status = 'cancelled_by_patient'
    )
  then
    return jsonb_build_object('bookingId', v_booking.id, 'canceled', true,
      'charged', false, 'applied', false);
  end if;

  -- This is the stale-modal guard. Once a claim, attempt, PaymentIntent,
  -- Charge or paid state exists, cancellation cannot retire the schedule.
  if v_payment.financial_status in (
      'processing', 'paid', 'partially_refunded', 'refunded', 'disputed'
    )
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_payment.paid_at is not null
    or (
      v_schedule.id is not null
      and (
        v_schedule.status in (
          'claimed', 'processing', 'requires_customer_action',
          'retry_scheduled', 'paid'
        )
        or v_schedule.attempt_count <> 0
        or v_schedule.stripe_payment_intent_id is not null
        or v_schedule.stripe_charge_id is not null
        or v_schedule.lease_owner is not null
      )
    )
  then
    raise exception 'SESSION_PRECHARGE_CANCEL_V10_PAYMENT_CHANGED'
      using errcode = '23514';
  end if;

  if v_booking.status <> 'confirmed'
    or v_booking.starts_at <= v_now + interval '24 hours'
    or v_payment.financial_status <> 'pending'
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.expected_booking_version is null
    or v_booking.version <> v_schedule.expected_booking_version
    or exists (select 1 from public.session_transfer_jobs job
      where job.session_payment_id = v_payment.id)
    or exists (select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id)
  then
    raise exception 'SESSION_PRECHARGE_CANCEL_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  update public.session_payment_schedules
  set status = 'canceled', canceled_at = v_now,
      lease_owner = null, lease_expires_at = null, updated_at = v_now
  where id = v_schedule.id;

  update public.session_payment_setups
  set status = 'canceled', updated_at = v_now
  where id = v_schedule.session_payment_setup_id and status = 'succeeded';

  update public.session_promotion_reservations
  set status = 'released', released_at = v_now, updated_at = v_now
  where session_payment_id = v_payment.id and status = 'reserved';

  update public.session_payments
  set financial_status = 'canceled', transfer_status = 'not_eligible',
      canceled_at = v_now, updated_at = v_now
  where id = v_payment.id;

  perform public.transition_booking_status_v1(
    v_booking.id, 'cancelled_by_patient', p_patient_user_id,
    trim(p_reason), trim(p_request_id), v_booking.version,
    'request_session_cancellation'
  );
  update public.bookings
  set payment_status = 'cancelled', cancelled_at = v_now, updated_at = v_now
  where id = v_booking.id;

  return jsonb_build_object('bookingId', v_booking.id, 'canceled', true,
    'charged', false, 'applied', true);
end;
$$;

revoke all on function public.cancel_uncharged_session_v10(uuid,uuid,text,text)
from public, anon, authenticated;
grant execute on function public.cancel_uncharged_session_v10(uuid,uuid,text,text)
to service_role;

comment on function public.cancel_uncharged_session_v10(uuid,uuid,text,text) is
  'Cancels only a pristine V10 scheduled charge from freshly locked server state, validates the active schedule version binding, and rejects stale browser decisions after charge processing begins.';
