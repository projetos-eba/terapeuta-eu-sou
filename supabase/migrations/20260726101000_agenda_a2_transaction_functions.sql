-- Agenda A2 transactional command surface.
-- These RPCs are service-role only and are intended for authenticated Edge
-- Functions. Browser clients retain read-only RLS access.

create or replace function public.is_valid_timezone_v1(p_timezone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  );
$$;

create or replace function public.is_booking_participant_profile_v1(
  p_booking_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings as booking
    join public.patient_profiles as patient
      on patient.id = booking.patient_profile_id
    join public.therapist_profiles as therapist
      on therapist.id = booking.therapist_profile_id
    where booking.id = p_booking_id
      and p_profile_id in (patient.user_id, therapist.user_id)
  );
$$;

create or replace function public.expire_booking_holds_v1(
  p_now timestamptz default now(),
  p_therapist_profile_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.booking_holds
  set status = 'expired',
      updated_at = p_now
  where status = 'active'
    and expires_at <= p_now
    and (
      p_therapist_profile_id is null
      or therapist_profile_id = p_therapist_profile_id
    );

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

create or replace function public.reserve_booking_hold_v1(
  p_patient_profile_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_idempotency_key text,
  p_ttl_seconds integer default 600
)
returns public.booking_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buffer_after integer;
  v_buffer_before integer;
  v_hold public.booking_holds%rowtype;
  v_max_days_ahead integer;
  v_min_notice_minutes integer;
  v_service public.therapist_services%rowtype;
  v_therapist public.therapist_profiles%rowtype;
begin
  if p_patient_profile_id is null
    or not exists (
      select 1
      from public.patient_profiles
      where id = p_patient_profile_id
    ) then
    raise exception 'PATIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  if p_ttl_seconds not between 60 and 900 then
    raise exception 'INVALID_HOLD_TTL' using errcode = '22023';
  end if;

  if p_starts_at is null
    or p_ends_at is null
    or p_starts_at >= p_ends_at then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  if not public.is_valid_timezone_v1(p_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = '22023';
  end if;

  select *
    into v_hold
  from public.booking_holds
  where idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    if v_hold.patient_profile_id <> p_patient_profile_id
      or v_hold.service_id <> p_service_id
      or v_hold.starts_at <> p_starts_at
      or v_hold.ends_at <> p_ends_at
      or v_hold.timezone <> p_timezone then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    return v_hold;
  end if;

  select *
    into v_service
  from public.therapist_services
  where id = p_service_id;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select *
    into v_therapist
  from public.therapist_profiles
  where id = v_service.therapist_profile_id;

  if v_service.status <> 'active'
    or v_therapist.status <> 'approved'
    or not v_therapist.is_accepting_bookings then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select
    coalesce(settings.buffer_before_minutes, 10),
    coalesce(settings.buffer_after_minutes, 10),
    coalesce(settings.min_notice_minutes, 120),
    coalesce(settings.max_days_ahead, 30)
  into
    v_buffer_before,
    v_buffer_after,
    v_min_notice_minutes,
    v_max_days_ahead
  from (select 1) as anchor
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = v_service.id;

  if p_ends_at <> (
    p_starts_at
    + v_service.duration_minutes * interval '1 minute'
  ) then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  if p_starts_at < now() + v_min_notice_minutes * interval '1 minute'
    or p_starts_at > now() + v_max_days_ahead * interval '1 day' then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_service.therapist_profile_id::text, 0)
  );
  perform public.expire_booking_holds_v1(
    now(),
    v_service.therapist_profile_id
  );

  begin
    insert into public.booking_holds (
      patient_profile_id,
      therapist_profile_id,
      service_id,
      starts_at,
      ends_at,
      timezone,
      status,
      idempotency_key,
      expires_at,
      service_title_snapshot,
      service_duration_minutes_snapshot,
      service_price_cents_snapshot,
      currency_snapshot,
      buffer_before_minutes_snapshot,
      buffer_after_minutes_snapshot,
      snapshot_captured_at
    ) values (
      p_patient_profile_id,
      v_service.therapist_profile_id,
      v_service.id,
      p_starts_at,
      p_ends_at,
      p_timezone,
      'active',
      trim(p_idempotency_key),
      now() + pg_catalog.make_interval(secs => p_ttl_seconds),
      v_service.title,
      v_service.duration_minutes,
      v_service.price_cents,
      upper(v_service.currency),
      v_buffer_before,
      v_buffer_after,
      now()
    )
    returning * into v_hold;
  exception
    when exclusion_violation then
      raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
    when unique_violation then
      select *
        into v_hold
      from public.booking_holds
      where idempotency_key = trim(p_idempotency_key);

      if not found
        or v_hold.patient_profile_id <> p_patient_profile_id
        or v_hold.service_id <> p_service_id
        or v_hold.starts_at <> p_starts_at
        or v_hold.ends_at <> p_ends_at
        or v_hold.timezone <> p_timezone then
        raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
      end if;
  end;

  return v_hold;
end;
$$;

create or replace function public.cancel_booking_hold_v1(
  p_hold_id uuid,
  p_request_id text
)
returns public.booking_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.booking_holds%rowtype;
begin
  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select *
    into v_hold
  from public.booking_holds
  where id = p_hold_id
  for update;

  if not found then
    raise exception 'BOOKING_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_hold.status = 'cancelled' then
    return v_hold;
  end if;

  if v_hold.status <> 'active' then
    raise exception 'INVALID_HOLD_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  update public.booking_holds
  set status = 'cancelled',
      updated_at = now()
  where id = v_hold.id
  returning * into v_hold;

  return v_hold;
end;
$$;

create or replace function public.consume_booking_hold_v1(
  p_hold_id uuid,
  p_idempotency_key text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_booking_id uuid := gen_random_uuid();
  v_hold public.booking_holds%rowtype;
begin
  if length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select *
    into v_hold
  from public.booking_holds
  where id = p_hold_id
  for update;

  if not found then
    raise exception 'BOOKING_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_hold.status = 'consumed' then
    if v_hold.consume_idempotency_key <> trim(p_idempotency_key)
      or v_hold.consumed_booking_id is null then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    select *
      into v_booking
    from public.bookings
    where id = v_hold.consumed_booking_id;

    return v_booking;
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    if v_hold.status = 'active' then
      update public.booking_holds
      set status = 'expired',
          updated_at = now()
      where id = v_hold.id;
    end if;

    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.therapist_services as service
    join public.therapist_profiles as therapist
      on therapist.id = service.therapist_profile_id
    where service.id = v_hold.service_id
      and service.status = 'active'
      and therapist.status = 'approved'
      and therapist.is_accepting_bookings
  ) then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_hold.therapist_profile_id::text, 0)
  );

  update public.booking_holds
  set status = 'consumed',
      consume_idempotency_key = trim(p_idempotency_key),
      updated_at = now()
  where id = v_hold.id
  returning * into v_hold;

  perform pg_catalog.set_config(
    'tes.booking_request_id',
    trim(p_idempotency_key),
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_source',
    'hold_conversion',
    true
  );

  begin
    insert into public.bookings (
      id,
      patient_profile_id,
      therapist_profile_id,
      service_id,
      starts_at,
      ends_at,
      timezone,
      status,
      payment_status,
      service_title_snapshot,
      service_duration_minutes_snapshot,
      service_price_cents_snapshot,
      currency_snapshot,
      buffer_before_minutes_snapshot,
      buffer_after_minutes_snapshot,
      snapshot_captured_at
    ) values (
      v_booking_id,
      v_hold.patient_profile_id,
      v_hold.therapist_profile_id,
      v_hold.service_id,
      v_hold.starts_at,
      v_hold.ends_at,
      v_hold.timezone,
      'draft',
      'not_started',
      v_hold.service_title_snapshot,
      v_hold.service_duration_minutes_snapshot,
      v_hold.service_price_cents_snapshot,
      v_hold.currency_snapshot,
      v_hold.buffer_before_minutes_snapshot,
      v_hold.buffer_after_minutes_snapshot,
      v_hold.snapshot_captured_at
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end;

  update public.booking_holds
  set consumed_booking_id = v_booking.id,
      updated_at = now()
  where id = v_hold.id;

  perform pg_catalog.set_config('tes.booking_request_id', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);

  return v_booking;
end;
$$;

create or replace function public.enqueue_booking_zoom_sync_v1(
  p_booking_id uuid,
  p_operation public.zoom_job_operation,
  p_request_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_environment text;
  v_host_user_id text;
  v_job_id uuid;
  v_meeting_status public.zoom_meeting_status;
begin
  if p_operation not in ('update', 'cancel') then
    raise exception 'INVALID_ZOOM_SYNC_OPERATION' using errcode = '22023';
  end if;

  select environment, zoom_host_user_id, status
    into v_environment, v_host_user_id, v_meeting_status
  from public.zoom_meetings
  where booking_id = p_booking_id;

  if not found or v_meeting_status = 'canceled' then
    return null;
  end if;

  if p_operation = 'update' and not exists (
    select 1
    from public.session_payments
    where booking_id = p_booking_id
      and financial_status = 'paid'
  ) then
    return null;
  end if;

  select public.enqueue_zoom_meeting_job_v1(
    p_booking_id,
    p_operation,
    v_environment,
    left(
      'agenda:' || trim(p_request_id) || ':zoom:' || p_operation::text,
      240
    ),
    pg_catalog.jsonb_build_object(
      'hostUserId', v_host_user_id,
      'requestId', trim(p_request_id),
      'source', 'agenda_a2'
    )
  )
  into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.transition_booking_status_v1(
  p_booking_id uuid,
  p_target_status public.booking_status,
  p_actor_profile_id uuid,
  p_reason text,
  p_request_id text,
  p_expected_version integer default null,
  p_source text default 'agenda_a2'
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_booking public.bookings%rowtype;
  v_existing_status public.booking_status;
begin
  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select next_status
    into v_existing_status
  from public.booking_events
  where booking_id = p_booking_id
    and event_type = 'booking_status_changed'
    and request_id = trim(p_request_id);

  if found then
    if v_existing_status <> p_target_status then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    return v_booking;
  end if;

  select case
      when patient.user_id = p_actor_profile_id then 'patient'
      when therapist.user_id = p_actor_profile_id then 'therapist'
      else null
    end
    into v_actor_role
  from public.patient_profiles as patient
  join public.therapist_profiles as therapist
    on therapist.id = v_booking.therapist_profile_id
  where patient.id = v_booking.patient_profile_id;

  if v_actor_role is null
    and not (
      p_actor_profile_id is null
      and p_source in ('admin', 'system')
    ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_expected_version is not null
    and p_expected_version <> v_booking.version then
    raise exception 'BOOKING_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_target_status in ('pending_payment', 'confirmed', 'refunded') then
    raise exception 'PAYMENT_WORKFLOW_REQUIRED' using errcode = 'P0001';
  end if;

  if p_target_status = 'cancelled_by_patient'
    and v_actor_role <> 'patient' then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_target_status in (
    'cancelled_by_therapist',
    'completed',
    'no_show_patient',
    'no_show_therapist'
  ) and v_actor_role <> 'therapist' then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_target_status in (
    'cancelled_by_patient',
    'cancelled_by_therapist'
  ) and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'CANCELLATION_REASON_REQUIRED' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform pg_catalog.set_config(
    'tes.booking_actor_profile_id',
    coalesce(p_actor_profile_id::text, ''),
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_reason',
    left(coalesce(p_reason, ''), 500),
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_request_id',
    trim(p_request_id),
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_source',
    left(trim(coalesce(p_source, 'agenda_a2')), 80),
    true
  );

  update public.bookings
  set status = p_target_status,
      cancellation_reason = case
        when p_target_status in (
          'cancelled_by_patient',
          'cancelled_by_therapist'
        ) then left(trim(p_reason), 500)
        else cancellation_reason
      end,
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  if p_target_status in (
    'cancelled_by_patient',
    'cancelled_by_therapist'
  ) then
    perform public.enqueue_booking_zoom_sync_v1(
      v_booking.id,
      'cancel',
      p_request_id
    );
  end if;

  perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);

  return v_booking;
end;
$$;

create or replace function public.request_booking_reschedule_v1(
  p_booking_id uuid,
  p_requested_by_profile_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_proposed_timezone text,
  p_reason text,
  p_request_id text,
  p_expires_in_seconds integer default 172800,
  p_expected_booking_version integer default null
)
returns public.booking_reschedule_requests
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

  if p_expires_in_seconds not between 300 and 604800 then
    raise exception 'INVALID_RESCHEDULE_EXPIRY' using errcode = '22023';
  end if;

  if p_proposed_starts_at is null
    or p_proposed_ends_at is null
    or p_proposed_starts_at >= p_proposed_ends_at
    or p_proposed_starts_at <= now() then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  if not public.is_valid_timezone_v1(p_proposed_timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = '22023';
  end if;

  select *
    into v_existing
  from public.booking_reschedule_requests
  where request_id = trim(p_request_id)
  for update;

  if found then
    if v_existing.booking_id <> p_booking_id
      or v_existing.requested_by_profile_id <> p_requested_by_profile_id
      or v_existing.proposed_starts_at <> p_proposed_starts_at
      or v_existing.proposed_ends_at <> p_proposed_ends_at
      or v_existing.proposed_timezone <> p_proposed_timezone then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    return v_existing;
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_booking_participant_profile_v1(
    v_booking.id,
    p_requested_by_profile_id
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  if p_expected_booking_version is not null
    and p_expected_booking_version <> v_booking.version then
    raise exception 'BOOKING_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_proposed_ends_at <> (
    p_proposed_starts_at
    + v_booking.service_duration_minutes_snapshot * interval '1 minute'
  ) then
    raise exception 'INVALID_AVAILABILITY_RANGE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform public.expire_booking_holds_v1(
    now(),
    v_booking.therapist_profile_id
  );

  if exists (
    select 1
    from public.bookings as conflict
    where conflict.therapist_profile_id = v_booking.therapist_profile_id
      and conflict.id <> v_booking.id
      and conflict.status in ('draft', 'pending_payment', 'confirmed')
      and conflict.occupied_during && pg_catalog.tstzrange(
        p_proposed_starts_at
          - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
        p_proposed_ends_at
          + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
        '[)'
      )
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.booking_holds as hold
    where hold.therapist_profile_id = v_booking.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && pg_catalog.tstzrange(
        p_proposed_starts_at
          - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
        p_proposed_ends_at
          + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
        '[)'
      )
  ) then
    raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
  end if;

  begin
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
      booking_version_at_request,
      expires_at
    ) values (
      v_booking.id,
      p_requested_by_profile_id,
      v_booking.starts_at,
      v_booking.ends_at,
      v_booking.timezone,
      p_proposed_starts_at,
      p_proposed_ends_at,
      p_proposed_timezone,
      nullif(left(trim(coalesce(p_reason, '')), 500), ''),
      'pending',
      trim(p_request_id),
      v_booking.version,
      now() + pg_catalog.make_interval(secs => p_expires_in_seconds)
    )
    returning * into v_request;
  exception
    when unique_violation then
      raise exception 'BOOKING_RESCHEDULE_ALREADY_PENDING'
        using errcode = 'P0001';
  end;

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
    p_requested_by_profile_id,
    'booking_reschedule_requested',
    trim(p_request_id),
    'agenda_a2',
    v_booking.status,
    v_booking.status,
    pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'rescheduleRequestId', v_request.id,
        'proposedStartsAt', v_request.proposed_starts_at,
        'proposedEndsAt', v_request.proposed_ends_at,
        'proposedTimezone', v_request.proposed_timezone,
        'reason', v_request.reason,
        'expiresAt', v_request.expires_at
      )
    )
  )
  on conflict do nothing;

  return v_request;
end;
$$;

create or replace function public.expire_booking_reschedule_requests_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.booking_reschedule_requests
  set status = 'expired',
      resolved_at = p_now,
      updated_at = p_now
  where status = 'pending'
    and expires_at <= p_now;

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

create or replace function public.resolve_booking_reschedule_v1(
  p_reschedule_request_id uuid,
  p_resolved_by_profile_id uuid,
  p_resolution text,
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
  v_request public.booking_reschedule_requests%rowtype;
  v_requester_is_patient boolean;
  v_resolver_is_patient boolean;
  v_resolver_is_therapist boolean;
begin
  if p_resolution not in ('accepted', 'rejected', 'cancelled') then
    raise exception 'INVALID_RESCHEDULE_RESOLUTION' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select *
    into v_request
  from public.booking_reschedule_requests
  where id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'BOOKING_RESCHEDULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_request.booking_id
  for update;

  if v_request.status <> 'pending' then
    if v_request.resolution_request_id = trim(p_request_id) then
      return pg_catalog.jsonb_build_object(
        'applied', v_request.status = 'applied',
        'bookingId', v_booking.id,
        'bookingVersion', v_booking.version,
        'rescheduleRequestId', v_request.id,
        'status', v_request.status
      );
    end if;

    raise exception 'BOOKING_RESCHEDULE_ALREADY_RESOLVED'
      using errcode = 'P0001';
  end if;

  if v_request.expires_at <= now() then
    update public.booking_reschedule_requests
    set status = 'expired',
        resolved_by_profile_id = p_resolved_by_profile_id,
        resolution_request_id = trim(p_request_id),
        resolved_at = now(),
        updated_at = now()
    where id = v_request.id;

    return pg_catalog.jsonb_build_object(
      'applied', false,
      'bookingId', v_booking.id,
      'bookingVersion', v_booking.version,
      'reason', 'expired',
      'rescheduleRequestId', v_request.id,
      'status', 'expired'
    );
  end if;

  select
    patient.user_id = v_request.requested_by_profile_id,
    patient.user_id = p_resolved_by_profile_id,
    therapist.user_id = p_resolved_by_profile_id
  into
    v_requester_is_patient,
    v_resolver_is_patient,
    v_resolver_is_therapist
  from public.patient_profiles as patient
  join public.therapist_profiles as therapist
    on therapist.id = v_booking.therapist_profile_id
  where patient.id = v_booking.patient_profile_id;

  if not coalesce(v_resolver_is_patient, false)
    and not coalesce(v_resolver_is_therapist, false) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_resolution = 'cancelled'
    and p_resolved_by_profile_id <> v_request.requested_by_profile_id then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_resolution in ('accepted', 'rejected') and (
    (v_requester_is_patient and not v_resolver_is_therapist)
    or (not v_requester_is_patient and not v_resolver_is_patient)
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_resolution = 'accepted' then
    if v_booking.status <> 'confirmed' then
      raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
    end if;

    if v_booking.version <> v_request.booking_version_at_request
      or (
        p_expected_booking_version is not null
        and p_expected_booking_version <> v_booking.version
      ) then
      raise exception 'BOOKING_VERSION_CONFLICT' using errcode = '40001';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
    );
    perform public.expire_booking_holds_v1(
      now(),
      v_booking.therapist_profile_id
    );
    perform pg_catalog.set_config(
      'tes.booking_actor_profile_id',
      p_resolved_by_profile_id::text,
      true
    );
    perform pg_catalog.set_config(
      'tes.booking_reason',
      left(coalesce(v_request.reason, ''), 500),
      true
    );
    perform pg_catalog.set_config(
      'tes.booking_request_id',
      trim(p_request_id),
      true
    );
    perform pg_catalog.set_config(
      'tes.booking_source',
      'reschedule_resolution',
      true
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

    update public.booking_reschedule_requests
    set status = 'applied',
        resolved_by_profile_id = p_resolved_by_profile_id,
        resolution_request_id = trim(p_request_id),
        resolved_at = now(),
        applied_at = now(),
        updated_at = now()
    where id = v_request.id
    returning * into v_request;

    perform public.enqueue_booking_zoom_sync_v1(
      v_booking.id,
      'update',
      p_request_id
    );

    perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
    perform pg_catalog.set_config('tes.booking_reason', '', true);
    perform pg_catalog.set_config('tes.booking_request_id', '', true);
    perform pg_catalog.set_config('tes.booking_source', '', true);
  else
    update public.booking_reschedule_requests
    set status = p_resolution,
        resolved_by_profile_id = p_resolved_by_profile_id,
        resolution_request_id = trim(p_request_id),
        resolved_at = now(),
        updated_at = now()
    where id = v_request.id
    returning * into v_request;
  end if;

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
    p_resolved_by_profile_id,
    'booking_reschedule_resolved',
    trim(p_request_id),
    'agenda_a2',
    v_booking.status,
    v_booking.status,
    pg_catalog.jsonb_build_object(
      'rescheduleRequestId', v_request.id,
      'resolution', p_resolution,
      'status', v_request.status
    )
  )
  on conflict do nothing;

  return pg_catalog.jsonb_build_object(
    'applied', v_request.status = 'applied',
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.is_valid_timezone_v1(text) from public;
revoke all on function public.is_booking_participant_profile_v1(uuid, uuid)
from public;
revoke all on function public.expire_booking_holds_v1(timestamptz, uuid)
from public;
revoke all on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) from public;
revoke all on function public.cancel_booking_hold_v1(uuid, text) from public;
revoke all on function public.consume_booking_hold_v1(uuid, text) from public;
revoke all on function public.enqueue_booking_zoom_sync_v1(
  uuid,
  public.zoom_job_operation,
  text
) from public;
revoke all on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) from public;
revoke all on function public.request_booking_reschedule_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer
) from public;
revoke all on function public.expire_booking_reschedule_requests_v1(
  timestamptz
) from public;
revoke all on function public.resolve_booking_reschedule_v1(
  uuid,
  uuid,
  text,
  text,
  integer
) from public;

grant execute on function public.is_valid_timezone_v1(text) to service_role;
grant execute on function public.is_booking_participant_profile_v1(uuid, uuid)
to service_role;
grant execute on function public.expire_booking_holds_v1(timestamptz, uuid)
to service_role;
grant execute on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) to service_role;
grant execute on function public.cancel_booking_hold_v1(uuid, text)
to service_role;
grant execute on function public.consume_booking_hold_v1(uuid, text)
to service_role;
grant execute on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) to service_role;
grant execute on function public.request_booking_reschedule_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer
) to service_role;
grant execute on function public.expire_booking_reschedule_requests_v1(
  timestamptz
) to service_role;
grant execute on function public.resolve_booking_reschedule_v1(
  uuid,
  uuid,
  text,
  text,
  integer
) to service_role;

comment on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) is
  'Atomically reserves a therapist interval with TTL, snapshots, idempotency, and cross-service conflict protection.';

comment on function public.consume_booking_hold_v1(uuid, text) is
  'Atomically consumes an active hold into one draft booking. Payment creation remains a separate F0 workflow.';

comment on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) is
  'Applies authorized operational booking transitions with optimistic concurrency, audit context, and Zoom cancellation outbox integration.';

comment on function public.resolve_booking_reschedule_v1(
  uuid,
  uuid,
  text,
  text,
  integer
) is
  'Resolves one reschedule request and atomically updates the booking and Zoom outbox when accepted.';
