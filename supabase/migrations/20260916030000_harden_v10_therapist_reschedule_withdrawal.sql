-- Keep the V10 therapist withdrawal safe to retry after a network ambiguity.
-- The original command is immutable once deployed; this incremental replacement
-- makes only an exact retry of the same withdrawal idempotent.

create or replace function public.withdraw_therapist_booking_reschedule_v10(
  p_reschedule_request_id uuid,
  p_therapist_user_id uuid,
  p_request_id text,
  p_expected_booking_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.booking_reschedule_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
begin
  if p_reschedule_request_id is null or p_therapist_user_id is null
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_INVALID'
      using errcode = '22023';
  end if;

  select request.* into v_request
  from public.booking_reschedule_requests request
  where request.id = p_reschedule_request_id
  for update;
  if not found or v_request.change_kind <> 'therapist_reschedule'
    or v_request.requested_by_profile_id <> p_therapist_user_id
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_request.status = 'cancelled'
    and v_request.resolution_request_id = trim(p_request_id)
  then
    return jsonb_build_object(
      'applied', true,
      'status', 'cancelled',
      'idempotentReplay', true,
      'rescheduleRequestId', v_request.id
    );
  end if;

  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = v_request.booking_id
  for update;
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = v_request.booking_id
  for update;
  select schedule.* into v_schedule
  from public.session_payment_schedules schedule
  where schedule.session_payment_id = v_payment.id
  order by schedule.created_at desc limit 1
  for update;

  if v_payment.id is null or v_payment.payment_flow_version <> 'v10'
    or v_request.status <> 'pending'
    or v_booking.status <> 'confirmed'
    or (p_expected_booking_version is not null
      and p_expected_booking_version <> v_booking.version)
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.attempt_count <> 0
    or v_schedule.lease_owner is not null
    or v_schedule.expected_booking_version <> v_booking.version
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  return public.resolve_booking_reschedule_v1(
    v_request.id, p_therapist_user_id, 'cancelled', trim(p_request_id),
    v_booking.version
  );
end;
$$;

revoke all on function public.withdraw_therapist_booking_reschedule_v10(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.withdraw_therapist_booking_reschedule_v10(uuid, uuid, text, integer)
  to service_role;

comment on function public.withdraw_therapist_booking_reschedule_v10(uuid, uuid, text, integer) is
  'Withdraws only a pristine V10 therapist reschedule request. An exact completed withdrawal retry is idempotent.';
