-- V10: therapist-led agenda actions may only touch a pristine, uncharged
-- reservation.  They never fall through to the V9 agenda transaction, because
-- that transaction cannot replace or retire the immutable V10 charge schedule.

create or replace function public.cancel_therapist_uncharged_session_v10(
  p_booking_id uuid,
  p_therapist_user_id uuid,
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
  if p_booking_id is null or p_therapist_user_id is null
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
    or length(trim(coalesce(p_reason, ''))) > 500
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_INVALID'
      using errcode = '22023';
  end if;

  -- Keep the same payment -> booking -> schedule order used by the V10
  -- charge worker and the patient pre-charge cancellation command.
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
    raise exception 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_FORBIDDEN'
      using errcode = '42501';
  end if;
  if v_payment.id is null or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_NOT_FOUND'
      using errcode = '23514';
  end if;

  select schedule.* into v_schedule
  from public.session_payment_schedules schedule
  where schedule.session_payment_id = v_payment.id
  order by schedule.created_at desc
  limit 1
  for update;

  if v_booking.status = 'cancelled_by_therapist'
    and v_payment.financial_status = 'canceled'
    and v_schedule.status = 'canceled'
    and exists (
      select 1 from public.booking_events event
      where event.booking_id = v_booking.id
        and event.event_type = 'booking_status_changed'
        and event.request_id = trim(p_request_id)
        and event.next_status = 'cancelled_by_therapist'
    )
  then
    return jsonb_build_object(
      'applied', false,
      'bookingId', v_booking.id,
      'canceled', true,
      'charged', false
    );
  end if;

  -- A stale dialog must never cancel after the worker has claimed a schedule
  -- or after Stripe has seen any payment object.
  if v_payment.financial_status in (
      'processing', 'paid', 'partially_refunded', 'refunded', 'disputed'
    )
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_payment.paid_at is not null
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.attempt_count <> 0
    or v_schedule.stripe_payment_intent_id is not null
    or v_schedule.stripe_charge_id is not null
    or v_schedule.lease_owner is not null
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_PAYMENT_CHANGED'
      using errcode = '23514';
  end if;

  if v_booking.status <> 'confirmed'
    or v_booking.starts_at <= v_now + interval '24 hours'
    or v_payment.financial_status <> 'pending'
    or v_schedule.expected_booking_version <> v_booking.version
    or exists (
      select 1 from public.session_transfer_jobs job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    raise exception 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  update public.session_payment_schedules
  set status = 'canceled', canceled_at = v_now,
      lease_owner = null, lease_expires_at = null, updated_at = v_now
  where id = v_schedule.id;

  update public.session_payment_setups
  set status = 'canceled', updated_at = v_now
  where id = v_schedule.session_payment_setup_id
    and status = 'succeeded';

  update public.session_promotion_reservations
  set status = 'released', released_at = v_now, updated_at = v_now
  where session_payment_id = v_payment.id
    and status = 'reserved';

  update public.session_payments
  set financial_status = 'canceled', transfer_status = 'not_eligible',
      canceled_at = v_now, updated_at = v_now
  where id = v_payment.id;

  perform public.transition_booking_status_v1(
    v_booking.id,
    'cancelled_by_therapist'::public.booking_status,
    p_therapist_user_id,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    trim(p_request_id),
    v_booking.version,
    'therapist_precharge_cancellation'
  );

  update public.bookings
  set payment_status = 'cancelled', cancelled_at = v_now, updated_at = v_now
  where id = v_booking.id;

  return jsonb_build_object(
    'applied', true,
    'bookingId', v_booking.id,
    'canceled', true,
    'charged', false
  );
end;
$$;

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
    or v_booking.starts_at <= now() + interval '24 hours'
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

  -- A decision never remains open into the charge window.  The payment worker
  -- also skips a still-pending decision, so a delayed expiry worker fails safe.
  v_expires_at := least(
    now() + interval '48 hours',
    v_booking.starts_at - interval '24 hours'
  );
  if v_expires_at <= now() then
    raise exception 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

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

-- A pending therapist decision must fence the charge worker.  When its normal
-- expiry marks it expired, the original schedule becomes claimable again.
create or replace function public.claim_due_session_payment_schedules_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
begin
  if p_now is null or p_worker_id is null
    or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_CLAIM_V10_INVALID' using errcode = '22023';
  end if;

  with exhausted as (
    select s.id from public.session_payment_schedules s
    where s.status in ('claimed', 'processing')
      and s.attempt_count >= 4 and s.lease_expires_at <= p_now
    for update skip locked
  ), failed as (
    update public.session_payment_schedules s
    set status = 'failed', lease_owner = null, lease_expires_at = null,
        last_error_code = 'worker_lease_exhausted', last_failed_at = p_now,
        updated_at = p_now
    from exhausted where s.id = exhausted.id
    returning s.id
  )
  insert into public.session_charge_incidents_v10 (schedule_id, code)
  select id, 'worker_lease_exhausted' from failed
  on conflict (schedule_id) do update
    set code = excluded.code, status = 'open', resolved_at = null, updated_at = p_now;

  with candidates as (
    select s.id
    from public.session_payment_schedules s
    join public.session_payments p on p.id = s.session_payment_id
    join public.session_payment_setups setup on setup.id = s.session_payment_setup_id
    join public.bookings b on b.id = s.booking_id
    where s.status in ('scheduled', 'retry_scheduled', 'claimed', 'processing')
      and s.attempt_count < 4
      and coalesce(s.next_retry_at, s.due_at) <= p_now
      and (s.lease_expires_at is null or s.lease_expires_at <= p_now)
      and p.payment_flow_version = 'v10'
      and p.financial_status in ('pending', 'processing')
      and p.gross_amount_cents > 0
      and p.booking_id = s.booking_id and p.payment_due_at = s.due_at
      and setup.session_payment_id = p.id and setup.booking_id = b.id
      and setup.booking_version = s.booking_version
      and setup.stripe_environment = s.stripe_environment
      and setup.status = 'succeeded' and setup.superseded_at is null
      and setup.stripe_payment_method_id is not null
      and b.version = s.expected_booking_version and b.status = 'confirmed'
      and b.starts_at > p_now
      and not exists (
        select 1 from public.booking_reschedule_requests request
        where request.booking_id = b.id
          and request.status = 'pending'
          and request.change_kind = 'therapist_reschedule'
      )
    order by coalesce(s.next_retry_at, s.due_at), s.id
    limit p_limit
    for update of s skip locked
  ), claimed as (
    update public.session_payment_schedules s
    set status = 'claimed', attempt_count = s.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        claimed_at = p_now, updated_at = p_now
    from candidates where s.id = candidates.id
    returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'scheduleId', s.id, 'bookingId', s.booking_id,
      'bookingVersion', s.booking_version,
      'sessionPaymentId', s.session_payment_id, 'setupId', setup.id,
      'stripeEnvironment', s.stripe_environment,
      'stripeCustomerId', setup.stripe_customer_id,
      'stripePaymentMethodId', setup.stripe_payment_method_id,
      'amountCents', p.gross_amount_cents, 'currency', p.currency,
      'idempotencyKey', s.idempotency_key,
      'requestFingerprint', s.request_fingerprint,
      'attemptCount', s.attempt_count, 'leaseExpiresAt', s.lease_expires_at
    ) order by s.due_at, s.id), '[]'::jsonb)
  into v_claims
  from claimed s
  join public.session_payment_setups setup on setup.id = s.session_payment_setup_id
  join public.session_payments p on p.id = s.session_payment_id;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

revoke all on function public.cancel_therapist_uncharged_session_v10(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.open_therapist_booking_reschedule_v10(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.resolve_therapist_booking_reschedule_v10(uuid, uuid, text, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.withdraw_therapist_booking_reschedule_v10(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.cancel_therapist_uncharged_session_v10(uuid, uuid, text, text) to service_role;
grant execute on function public.open_therapist_booking_reschedule_v10(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.resolve_therapist_booking_reschedule_v10(uuid, uuid, text, timestamptz, timestamptz, text, text, integer) to service_role;
grant execute on function public.withdraw_therapist_booking_reschedule_v10(uuid, uuid, text, integer) to service_role;

comment on function public.cancel_therapist_uncharged_session_v10(uuid, uuid, text, text) is
  'Cancels only a pristine V10 scheduled charge on behalf of the assigned therapist; any charged or leased state requires support.';
