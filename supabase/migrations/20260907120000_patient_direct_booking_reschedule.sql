-- Patient-initiated reschedules are applied atomically when the authoritative
-- booking availability still accepts the target slot. Therapist-initiated
-- changes continue to use the bilateral proposal lifecycle.

create or replace function public.apply_patient_booking_reschedule_v1(
  p_booking_id uuid,
  p_actor_profile_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_proposed_timezone text,
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
begin
  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  if p_proposed_starts_at is null
    or p_proposed_ends_at is null
    or p_proposed_starts_at >= p_proposed_ends_at
    or p_proposed_starts_at <= now()
  then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  if not public.is_valid_timezone_v1(p_proposed_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-reschedule-request:' || trim(p_request_id),
      0
    )
  );

  select *
  into v_existing
  from public.booking_reschedule_requests
  where request_id = trim(p_request_id)
  for update;

  if found then
    if v_existing.booking_id <> p_booking_id
      or v_existing.requested_by_profile_id <> p_actor_profile_id
      or v_existing.proposed_starts_at <> p_proposed_starts_at
      or v_existing.proposed_ends_at <> p_proposed_ends_at
      or v_existing.proposed_timezone <> p_proposed_timezone
      or v_existing.status <> 'applied'
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    select * into v_booking
    from public.bookings
    where id = v_existing.booking_id;

    return pg_catalog.jsonb_build_object(
      'applied', true,
      'bookingId', v_booking.id,
      'bookingVersion', v_booking.version,
      'rescheduleRequestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  where booking.id = p_booking_id
    and patient.user_id = p_actor_profile_id
  for update of booking;

  if not found then
    raise exception 'BOOKING_ACTOR_NOT_PATIENT' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  if p_expected_booking_version is not null
    and p_expected_booking_version <> v_booking.version
  then
    raise exception 'BOOKING_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_proposed_timezone <> v_booking.timezone
    or p_proposed_ends_at <> p_proposed_starts_at
      + v_booking.service_duration_minutes_snapshot * interval '1 minute'
    or p_proposed_starts_at = v_booking.starts_at
  then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.booking_reschedule_requests as pending
    where pending.booking_id = v_booking.id
      and pending.status = 'pending'
  ) then
    raise exception 'BOOKING_RESCHEDULE_ALREADY_PENDING' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || v_booking.patient_profile_id::text,
      0
    )
  );
  perform public.expire_booking_holds_v1(now(), v_booking.therapist_profile_id);

  insert into public.booking_reschedule_requests (
    booking_id,
    requested_by_profile_id,
    original_starts_at,
    original_ends_at,
    original_timezone,
    proposed_starts_at,
    proposed_ends_at,
    proposed_timezone,
    reason,
    status,
    request_id,
    resolution_request_id,
    resolved_by_profile_id,
    booking_version_at_request,
    expires_at,
    resolved_at,
    applied_at
  ) values (
    v_booking.id,
    p_actor_profile_id,
    v_booking.starts_at,
    v_booking.ends_at,
    v_booking.timezone,
    p_proposed_starts_at,
    p_proposed_ends_at,
    p_proposed_timezone,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    'applied',
    trim(p_request_id),
    trim(p_request_id),
    p_actor_profile_id,
    v_booking.version,
    now(),
    now(),
    now()
  )
  returning * into v_request;

  perform pg_catalog.set_config(
    'tes.booking_actor_profile_id', p_actor_profile_id::text, true
  );
  perform pg_catalog.set_config(
    'tes.booking_reason', left(coalesce(v_request.reason, ''), 500), true
  );
  perform pg_catalog.set_config(
    'tes.booking_request_id', trim(p_request_id), true
  );
  perform pg_catalog.set_config(
    'tes.booking_source', 'reschedule_resolution', true
  );

  begin
    update public.bookings
    set starts_at = v_request.proposed_starts_at,
        ends_at = v_request.proposed_ends_at,
        timezone = v_request.proposed_timezone,
        updated_at = now()
    where id = v_booking.id
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end;

  perform public.sync_booking_video_session_from_agenda_v1(
    v_booking.id,
    'update',
    p_request_id
  );

  perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);

  insert into public.booking_events (
    booking_id,
    actor_profile_id,
    event_type,
    request_id,
    source,
    previous_status,
    next_status,
    payload
  ) values (
    v_booking.id,
    p_actor_profile_id,
    'booking_reschedule_resolved',
    trim(p_request_id),
    'agenda_patient_direct',
    v_booking.status,
    v_booking.status,
    pg_catalog.jsonb_build_object(
      'rescheduleRequestId', v_request.id,
      'resolution', 'accepted',
      'status', 'applied'
    )
  )
  on conflict do nothing;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.apply_patient_booking_reschedule_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.apply_patient_booking_reschedule_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer
) to service_role;

comment on function public.apply_patient_booking_reschedule_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer
) is
  'Atomically applies a patient-initiated reschedule to the same confirmed booking after current authoritative availability, buffer, hold, and patient-conflict validation.';
