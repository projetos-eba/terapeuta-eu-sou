-- A therapist-initiated V10 change must leave the patient a full 24-hour
-- response window before the original payment window.  The database remains
-- authoritative so an outdated browser cannot bypass this product rule.
create or replace function public.open_therapist_booking_reschedule_v10(
  p_booking_id uuid,
  p_therapist_user_id uuid,
  p_reason text,
  p_request_id text,
  p_expected_booking_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_existing public.booking_reschedule_requests%rowtype;
  v_request public.booking_reschedule_requests%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_setup public.session_payment_setups%rowtype;
  v_expires_at timestamptz;
begin
  if p_booking_id is null or p_therapist_user_id is null
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
    or length(trim(coalesce(p_reason, ''))) > 500
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_INVALID'
      using errcode = '22023';
  end if;

  select request.* into v_existing
  from public.booking_reschedule_requests request
  where request.request_id = trim(p_request_id)
  for update;
  if found then
    if v_existing.booking_id <> p_booking_id
      or v_existing.requested_by_profile_id <> p_therapist_user_id
      or v_existing.change_kind <> 'therapist_reschedule'
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'bookingId', v_existing.booking_id,
      'bookingVersion', v_existing.booking_version_at_request,
      'expiresAt', v_existing.expires_at,
      'rescheduleRequestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id
  for update;

  select booking.* into v_booking
  from public.bookings booking
  join public.therapist_profiles therapist
    on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id
    and therapist.user_id = p_therapist_user_id
  for update of booking;
  if not found then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_FORBIDDEN'
      using errcode = '42501';
  end if;
  if v_payment.id is null or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_NOT_FOUND'
      using errcode = '23514';
  end if;

  -- Strictly more than 48 hours gives the patient at least 24 hours to
  -- respond before the original T-24 payment window opens.
  if v_booking.starts_at <= now() + interval '48 hours' then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_MINIMUM_NOTICE'
      using errcode = '23514';
  end if;

  select schedule.* into v_schedule
  from public.session_payment_schedules schedule
  where schedule.session_payment_id = v_payment.id
  order by schedule.created_at desc
  limit 1
  for update;
  select setup.* into v_setup
  from public.session_payment_setups setup
  where setup.id = v_schedule.session_payment_setup_id;

  if v_booking.status <> 'confirmed'
    or (p_expected_booking_version is not null
      and p_expected_booking_version <> v_booking.version)
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_payment.paid_at is not null
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.attempt_count <> 0
    or v_schedule.stripe_payment_intent_id is not null
    or v_schedule.stripe_charge_id is not null
    or v_schedule.lease_owner is not null
    or v_schedule.expected_booking_version <> v_booking.version
    or v_setup.id is null
    or v_setup.status <> 'succeeded'
    or v_setup.superseded_at is not null
    or v_setup.booking_version <> v_schedule.booking_version
    or exists (
      select 1 from public.session_transfer_jobs job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.booking_reschedule_requests request
      where request.booking_id = v_booking.id
        and request.status in ('pending', 'pending_admin_review')
    )
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  -- This deadline is exact: the worker expires the request before claiming
  -- payments, preserving the original booking when no choice is made.
  v_expires_at := v_booking.starts_at - interval '24 hours';

  insert into public.booking_reschedule_requests (
    booking_id, requested_by_profile_id, reason, status, request_id,
    booking_version_at_request, expires_at, change_kind
  ) values (
    v_booking.id, p_therapist_user_id,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    'pending', trim(p_request_id), v_booking.version, v_expires_at,
    'therapist_reschedule'
  ) returning * into v_request;

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, request_id, source,
    previous_status, next_status, payload
  ) values (
    v_booking.id, p_therapist_user_id, 'booking_reschedule_requested',
    trim(p_request_id), 'therapist_precharge_reschedule',
    v_booking.status, v_booking.status,
    jsonb_build_object(
      'changeKind', 'therapist_reschedule',
      'expiresAt', v_request.expires_at,
      'rescheduleRequestId', v_request.id
    )
  ) on conflict do nothing;

  return jsonb_build_object(
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'expiresAt', v_request.expires_at,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.open_therapist_booking_reschedule_v10(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.open_therapist_booking_reschedule_v10(uuid, uuid, text, text, integer)
  to service_role;

comment on function public.open_therapist_booking_reschedule_v10(uuid, uuid, text, text, integer) is
  'Opens a pristine V10 therapist reschedule only more than 48 hours before the original session, with expiry at its original T-24 payment window.';
