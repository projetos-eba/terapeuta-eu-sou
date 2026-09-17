-- Repairs environments where 20260916020000 was recorded as applied but the
-- patient-resolution RPC was absent from the actual catalog.  The RPC is
-- intentionally recreated in place: no booking, schedule or payment rows are
-- rewritten by this migration.
create or replace function public.resolve_therapist_booking_reschedule_v10(
  p_reschedule_request_id uuid,
  p_patient_user_id uuid,
  p_resolution text,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_proposed_timezone text,
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
  v_setup public.session_payment_setups%rowtype;
  v_patient_user_id uuid;
  v_result jsonb;
  v_due_at timestamptz;
  v_idempotency_key text;
  v_fingerprint text;
  v_new_schedule_id uuid;
  v_now timestamptz := now();
begin
  if p_resolution not in ('reschedule', 'refund')
    or p_reschedule_request_id is null or p_patient_user_id is null
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_INVALID'
      using errcode = '22023';
  end if;

  select request.* into v_request
  from public.booking_reschedule_requests request
  where request.id = p_reschedule_request_id
  for update;
  if not found or v_request.change_kind <> 'therapist_reschedule' then
    raise exception 'BOOKING_RESCHEDULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = v_request.booking_id
  for update;
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = v_request.booking_id
  for update;
  select patient.user_id into v_patient_user_id
  from public.patient_profiles patient
  where patient.id = v_booking.patient_profile_id;
  if v_patient_user_id <> p_patient_user_id then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_FORBIDDEN'
      using errcode = '42501';
  end if;
  if v_payment.id is null or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_NOT_FOUND'
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

  if v_request.status <> 'pending' then
    if v_request.resolution_request_id = trim(p_request_id) then
      return jsonb_build_object(
        'applied', v_request.status = 'applied',
        'bookingId', v_booking.id,
        'bookingVersion', v_booking.version,
        'rescheduleRequestId', v_request.id,
        'status', v_request.status
      );
    end if;
    raise exception 'BOOKING_RESCHEDULE_ALREADY_RESOLVED' using errcode = 'P0001';
  end if;

  if v_request.expires_at <= v_now then
    update public.booking_reschedule_requests
    set status = 'expired', resolved_by_profile_id = p_patient_user_id,
        resolution_request_id = trim(p_request_id), resolved_at = v_now,
        updated_at = v_now
    where id = v_request.id;
    return jsonb_build_object(
      'applied', false,
      'bookingId', v_booking.id,
      'bookingVersion', v_booking.version,
      'rescheduleRequestId', v_request.id,
      'status', 'expired'
    );
  end if;

  if v_booking.status <> 'confirmed'
    or v_booking.starts_at <= v_now + interval '24 hours'
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
    or exists (
      select 1 from public.session_transfer_jobs job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  if p_resolution = 'refund' then
    update public.booking_reschedule_requests
    set status = 'applied', resolved_by_profile_id = p_patient_user_id,
        resolution_request_id = trim(p_request_id), resolved_at = v_now,
        applied_at = v_now, updated_at = v_now
    where id = v_request.id;

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
      v_booking.id, 'cancelled_by_therapist'::public.booking_status,
      v_request.requested_by_profile_id,
      'therapist_requested_cancellation', trim(p_request_id),
      v_booking.version, 'therapist_precharge_reschedule'
    );
    update public.bookings
    set payment_status = 'cancelled', cancelled_at = v_now, updated_at = v_now
    where id = v_booking.id;
    return jsonb_build_object(
      'applied', true, 'bookingId', v_booking.id,
      'canceled', true, 'charged', false,
      'rescheduleRequestId', v_request.id, 'status', 'applied'
    );
  end if;

  if p_proposed_starts_at is null or p_proposed_ends_at is null
    or p_proposed_starts_at >= p_proposed_ends_at
    or p_proposed_starts_at <= v_now
    or not public.is_valid_timezone_v1(p_proposed_timezone)
    or p_proposed_timezone <> v_booking.timezone
    or p_proposed_ends_at <> p_proposed_starts_at
      + v_booking.service_duration_minutes_snapshot * interval '1 minute'
    or p_proposed_starts_at = v_booking.starts_at
    or not exists (
      select 1 from public.list_booking_reschedule_candidates_v1(
        v_booking.id, p_proposed_starts_at,
        p_proposed_ends_at + interval '1 microsecond', v_now, 10
      ) candidate
      where candidate.starts_at = p_proposed_starts_at
        and candidate.ends_at = p_proposed_ends_at
    )
  then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  update public.booking_reschedule_requests
  set proposed_starts_at = p_proposed_starts_at,
      proposed_ends_at = p_proposed_ends_at,
      proposed_timezone = p_proposed_timezone,
      updated_at = v_now
  where id = v_request.id;

  v_result := public.resolve_booking_reschedule_v1(
    v_request.id, p_patient_user_id, 'accepted', trim(p_request_id),
    v_booking.version
  );
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = v_booking.id;
  v_due_at := v_booking.starts_at - interval '24 hours';

  update public.session_payment_schedules
  set status = 'superseded', lease_owner = null, lease_expires_at = null,
      updated_at = v_now
  where id = v_schedule.id;

  perform pg_catalog.set_config(
    'tes.v10_reschedule_payment_id', v_payment.id::text, true
  );
  update public.session_payments
  set payment_due_at = v_due_at, updated_at = v_now
  where id = v_payment.id;
  perform pg_catalog.set_config('tes.v10_reschedule_payment_id', '', true);

  v_idempotency_key := 'tes:v10:session-charge:therapist-reschedule:' || trim(p_request_id);
  v_fingerprint := encode(extensions.digest(concat_ws(':',
    v_schedule.stripe_environment,
    v_payment.id::text,
    v_setup.id::text,
    v_setup.stripe_payment_method_id,
    v_due_at::text,
    v_payment.gross_amount_cents::text,
    v_payment.currency::text,
    v_booking.version::text
  ), 'sha256'), 'hex');

  insert into public.session_payment_schedules (
    booking_id, booking_version, expected_booking_version,
    session_payment_id, session_payment_setup_id, stripe_environment,
    due_at, idempotency_key, request_fingerprint
  ) values (
    v_booking.id, v_setup.booking_version, v_booking.version,
    v_payment.id, v_setup.id, v_schedule.stripe_environment,
    v_due_at, v_idempotency_key, v_fingerprint
  ) returning id into v_new_schedule_id;

  return v_result || jsonb_build_object(
    'applied', true,
    'chargeTiming', case when v_due_at <= v_now then 'immediate' else 'scheduled' end,
    'paymentDueAt', v_due_at,
    'scheduleId', v_new_schedule_id
  );
end;
$$;

revoke all on function public.resolve_therapist_booking_reschedule_v10(
  uuid, uuid, text, timestamptz, timestamptz, text, text, integer
) from public, anon, authenticated;
grant execute on function public.resolve_therapist_booking_reschedule_v10(
  uuid, uuid, text, timestamptz, timestamptz, text, text, integer
) to service_role;

comment on function public.resolve_therapist_booking_reschedule_v10(
  uuid, uuid, text, timestamptz, timestamptz, text, text, integer
) is 'Resolves a pristine V10 therapist reschedule request for its patient, moving the scheduled charge only when the booking remains safe to change.';
