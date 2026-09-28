-- A patient may leave the embedded Checkout during the authoritative
-- five-minute initial hold. Resuming that exact Checkout is safe; creating a
-- replacement Checkout is not. Keep this capability separate from the
-- terminal payment-retry flow, which has its own slot-reclaim safeguards.

create or replace function public.get_session_payment_checkout_resume_v1(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.session_payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_found');
  end if;

  select payment.* into v_payment
  from public.session_payments as payment
  where payment.booking_id = v_booking.id
  for update;

  if not found
    or v_booking.status <> 'pending_payment'
    or v_booking.payment_status <> 'pending'
    or v_booking.starts_at <= now()
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or nullif(trim(v_payment.stripe_checkout_session_id), '') is null
  then
    return jsonb_build_object('allowed', false, 'reason', 'checkout_not_resumable');
  end if;

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = v_payment.stripe_checkout_session_id
  order by attempt.created_at desc, attempt.id desc
  limit 1
  for update;

  if v_attempt.id is null
    or v_attempt.attempt_kind <> 'initial_hold'
    or v_attempt.status not in ('checkout_created', 'waiting_payment')
    or v_attempt.reservation_expires_at is null
    or v_attempt.reservation_expires_at <= now()
    or v_attempt.stripe_payment_intent_id is not null
    or v_attempt.authorization_received_at is not null
    or v_attempt.slot_claimed_at is not null
    or exists (
      select 1
      from public.session_payment_setups as setup
      where setup.session_payment_id = v_payment.id
        and setup.superseded_at is null
        and setup.status not in ('canceled', 'superseded')
    )
    or exists (
      select 1
      from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    or exists (
      select 1
      from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1
      from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
    or exists (
      select 1
      from public.session_refunds as refund
      where refund.session_payment_id = v_payment.id
        and refund.status not in ('failed', 'canceled')
    )
    or exists (
      select 1
      from public.session_disputes as dispute
      where dispute.session_payment_id = v_payment.id
    )
  then
    return jsonb_build_object('allowed', false, 'reason', 'checkout_not_resumable');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'bookingVersion', v_booking.version,
    'paymentDueAt', v_payment.payment_due_at,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'reservationExpiresAt', v_attempt.reservation_expires_at,
    'sessionPaymentId', v_payment.id,
    'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id
  );
end;
$$;

revoke all on function public.get_session_payment_checkout_resume_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_session_payment_checkout_resume_v1(uuid)
  to service_role;

comment on function public.get_session_payment_checkout_resume_v1(uuid) is
  'Revalidates an active V10 initial Checkout for server-side continuation without creating a payment, SetupIntent, schedule or replacement Checkout.';

create or replace function public.get_patient_reservation_retry_context_v1(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'bookingId', booking.id,
    'serviceId', booking.service_id,
    'serviceLabel', booking.service_title_snapshot,
    'durationMinutes', booking.service_duration_minutes_snapshot,
    'priceCents', booking.service_price_cents_snapshot,
    'startsAt', booking.starts_at,
    'timezone', booking.timezone,
    'bookingStatus', booking.status,
    'financialStatus', payment.financial_status,
    'canRetry', continuation.mode is not null,
    'continuationMode', continuation.mode,
    'therapist', jsonb_build_object(
      'slug', therapist.slug,
      'name', therapist.public_name,
      'headline', coalesce(therapist.headline, 'Profissional TES'),
      'avatarUrl', therapist.photo_url,
      'isVerified', therapist.status = 'approved'
    )
  ) into v_result
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
  join public.session_payments as payment
    on payment.booking_id = booking.id
  left join lateral (
    select current_attempt.*
    from public.session_payment_attempts as current_attempt
    where current_attempt.session_payment_id = payment.id
      and current_attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
    order by current_attempt.created_at desc, current_attempt.id desc
    limit 1
  ) as attempt on true
  left join lateral (
    select public.get_session_payment_retry_slot_eligibility_v1(
      booking.id,
      now()
    ) as decision
  ) as retry_eligibility on true
  left join lateral (
    select case
      when booking.status = 'pending_payment'
        and booking.payment_status = 'pending'
        and booking.starts_at > now()
        and payment.payment_flow_version = 'v10'
        and payment.financial_status = 'pending'
        and payment.stripe_payment_intent_id is null
        and payment.stripe_charge_id is null
        and nullif(trim(payment.stripe_checkout_session_id), '') is not null
        and attempt.id is not null
        and attempt.attempt_kind = 'initial_hold'
        and attempt.status in ('checkout_created', 'waiting_payment')
        and attempt.reservation_expires_at > now()
        and attempt.stripe_payment_intent_id is null
        and attempt.authorization_received_at is null
        and attempt.slot_claimed_at is null
        and not exists (
          select 1 from public.session_payment_setups as setup
          where setup.session_payment_id = payment.id
            and setup.superseded_at is null
            and setup.status not in ('canceled', 'superseded')
        )
        and not exists (
          select 1 from public.session_payment_schedules as schedule
          where schedule.session_payment_id = payment.id
            and schedule.status not in ('canceled', 'superseded')
        )
        and not exists (
          select 1 from public.session_transfer_jobs as job
          where job.session_payment_id = payment.id
        )
        and not exists (
          select 1 from public.stripe_transfers as transfer
          where transfer.session_payment_id = payment.id
        )
        and not exists (
          select 1 from public.session_refunds as refund
          where refund.session_payment_id = payment.id
            and refund.status not in ('failed', 'canceled')
        )
        and not exists (
          select 1 from public.session_disputes as dispute
          where dispute.session_payment_id = payment.id
        )
        then 'resume_existing_checkout'
      when booking.status = 'cancelled_by_payment'
        and payment.financial_status in ('failed', 'canceled')
        and coalesce((retry_eligibility.decision ->> 'allowed')::boolean, false)
        then 'payment_retry'
      else null
    end as mode
  ) as continuation on true
  where booking.id = p_booking_id
    and patient.user_id = auth.uid();

  return v_result;
end;
$$;

create or replace function public.get_patient_reservation_retry_contexts_v1(
  p_booking_ids uuid[]
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      context.value ->> 'bookingId',
      jsonb_build_object(
        'bookingId', context.value ->> 'bookingId',
        'canRetry', context.value -> 'canRetry',
        'continuationMode', context.value -> 'continuationMode'
      )
    ),
    '{}'::jsonb
  )
  from unnest(coalesce(p_booking_ids, '{}'::uuid[])) as requested(booking_id)
  cross join lateral (
    select public.get_patient_reservation_retry_context_v1(
      requested.booking_id
    ) as value
  ) as context
  where context.value is not null;
$$;

revoke all on function public.get_patient_reservation_retry_context_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_patient_reservation_retry_context_v1(uuid)
  to authenticated, service_role;
revoke all on function public.get_patient_reservation_retry_contexts_v1(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_patient_reservation_retry_contexts_v1(uuid[])
  to authenticated, service_role;

comment on function public.get_patient_reservation_retry_context_v1(uuid) is
  'Returns an authenticated patient-owned payment continuation only when the current Checkout may be resumed safely or a terminal booking may enter the established retry flow.';
comment on function public.get_patient_reservation_retry_contexts_v1(uuid[]) is
  'Returns authenticated patient-owned payment continuation availability in one read without exposing Checkout or Stripe identifiers.';
