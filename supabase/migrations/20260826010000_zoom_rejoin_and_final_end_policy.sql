begin;

create or replace function public.record_patient_zoom_waiting_room_arrival_v1(
  p_booking_id uuid,
  p_patient_profile_id uuid,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_arrived_at timestamptz;
  v_request_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_booking_id::text, 0)
  );

  select
    booking.id,
    booking.patient_profile_id,
    booking.starts_at,
    booking.ends_at,
    booking.version,
    booking.status,
    booking.meeting_provider,
    patient.user_id as patient_user_id,
    payment.financial_status
  into v_booking
  from public.bookings booking
  join public.patient_profiles patient
    on patient.id = booking.patient_profile_id
  left join public.session_payments payment
    on payment.booking_id = booking.id
  where booking.id = p_booking_id
  limit 1;

  if not found then
    raise exception 'ZOOM_BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_booking.patient_profile_id is distinct from p_patient_profile_id then
    raise exception 'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED'
      using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed'::public.booking_status
    or v_booking.meeting_provider not in ('zoom', 'zoom_video_sdk')
    or v_booking.financial_status is distinct from 'paid'::public.session_financial_status
    or v_now < v_booking.starts_at - interval '15 minutes'
    or v_now >= v_booking.ends_at then
    return jsonb_build_object(
      'arrivedAt', null,
      'entitled', false,
      'recorded', false
    );
  end if;

  select min(event.created_at)
  into v_arrived_at
  from public.booking_events event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and event.payload ->> 'scheduledStartsAt' = v_booking.starts_at::text;

  if v_arrived_at is not null then
    return jsonb_build_object(
      'arrivedAt', v_arrived_at,
      'entitled', true,
      'recorded', false
    );
  end if;

  if v_now > v_booking.starts_at + interval '10 minutes' then
    return jsonb_build_object(
      'arrivedAt', null,
      'entitled', false,
      'recorded', false
    );
  end if;

  v_request_id := left(
    'zoom-waiting-room:' || v_booking.id::text || ':v' || v_booking.version::text ||
      ':' || floor(extract(epoch from v_booking.starts_at) * 1000)::bigint::text,
    160
  );

  insert into public.booking_events (
    booking_id,
    actor_profile_id,
    event_type,
    payload,
    request_id,
    source
  ) values (
    v_booking.id,
    v_booking.patient_user_id,
    'zoom_waiting_room_entered',
    jsonb_build_object(
      'bookingVersion', v_booking.version,
      'scheduledStartsAt', v_booking.starts_at::text,
      'source', 'authenticated_waiting_room'
    ),
    v_request_id,
    'zoom-video-session-access'
  )
  on conflict (booking_id, event_type, request_id)
    where request_id is not null
  do nothing;

  select min(event.created_at)
  into v_arrived_at
  from public.booking_events event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and event.payload ->> 'scheduledStartsAt' = v_booking.starts_at::text;

  return jsonb_build_object(
    'arrivedAt', v_arrived_at,
    'entitled', v_arrived_at is not null,
    'recorded', v_arrived_at is not null
  );
end;
$$;

create or replace function public.authorize_therapist_zoom_manual_end_v1(
  p_booking_id uuid,
  p_therapist_profile_id uuid,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_booking_id::text, 0)
  );

  select
    booking.id as booking_id,
    booking.therapist_profile_id,
    booking.ends_at,
    booking.status as booking_status,
    payment.financial_status,
    video_session.id as video_session_id,
    video_session.status as video_session_status,
    video_session.provider_session_id,
    video_session.termination_confirmed_at,
    video_session.actual_ended_at,
    video_session.termination_reason,
    video_session.termination_requested_at
  into v_session
  from public.bookings booking
  left join public.session_payments payment
    on payment.booking_id = booking.id
  left join public.video_sessions video_session
    on video_session.booking_id = booking.id
  where booking.id = p_booking_id
  limit 1;

  if not found then
    raise exception 'ZOOM_BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_session.therapist_profile_id is distinct from p_therapist_profile_id then
    raise exception 'ZOOM_FINAL_END_THERAPIST_REQUIRED'
      using errcode = '42501';
  end if;

  if v_session.termination_confirmed_at is not null
    or v_session.video_session_status in ('ended', 'canceled') then
    if v_session.actual_ended_at is null
      or v_session.actual_ended_at < v_session.ends_at - interval '5 minutes' then
      return jsonb_build_object(
        'alreadyEnded', true,
        'allowed', false,
        'reason', 'EARLY_PROVIDER_END',
        'serverNow', v_now
      );
    end if;

    return jsonb_build_object(
      'alreadyEnded', true,
      'allowed', true,
      'providerSessionId', null,
      'serverNow', v_now,
      'videoSessionId', v_session.video_session_id
    );
  end if;

  if v_now < v_session.ends_at - interval '5 minutes' then
    return jsonb_build_object(
      'alreadyEnded', false,
      'allowed', false,
      'availableAt', v_session.ends_at - interval '5 minutes',
      'reason', 'FINAL_END_TOO_EARLY',
      'serverNow', v_now
    );
  end if;

  if v_now >= v_session.ends_at then
    return jsonb_build_object(
      'alreadyEnded', false,
      'allowed', false,
      'reason', 'TOO_LATE',
      'serverNow', v_now
    );
  end if;

  if v_session.booking_status <> 'confirmed'::public.booking_status
    or v_session.financial_status is distinct from 'paid'::public.session_financial_status
    or v_session.video_session_status <> 'active'::public.video_session_status
    or v_session.video_session_id is null
    or v_session.provider_session_id is null then
    return jsonb_build_object(
      'alreadyEnded', false,
      'allowed', false,
      'reason', 'VIDEO_SESSION_NOT_READY',
      'serverNow', v_now
    );
  end if;

  if v_session.termination_reason = 'manual_end'
    and v_session.termination_requested_at is not null
    and v_session.termination_requested_at > v_now - interval '15 seconds' then
    return jsonb_build_object(
      'alreadyEnded', false,
      'allowed', false,
      'reason', 'FINAL_END_IN_PROGRESS',
      'serverNow', v_now
    );
  end if;

  update public.video_sessions
  set termination_reason = 'manual_end',
      termination_requested_at = v_now,
      updated_at = v_now
  where id = v_session.video_session_id
    and termination_confirmed_at is null;

  return jsonb_build_object(
    'alreadyEnded', false,
    'allowed', true,
    'providerSessionId', v_session.provider_session_id,
    'serverNow', v_now,
    'videoSessionId', v_session.video_session_id
  );
end;
$$;

create or replace function public.build_video_session_access_state_v1(
  p_booking_status public.booking_status,
  p_financial_status public.session_financial_status,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_video_session_status public.video_session_status,
  p_video_session_ready boolean,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_available_from timestamptz := p_starts_at - interval '15 minutes';
  v_available_until timestamptz := p_ends_at;
  v_allowed boolean := false;
  v_reason text;
begin
  if p_booking_status in (
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'no_show_patient',
    'no_show_therapist',
    'refunded'
  ) then
    v_reason := 'BOOKING_CANCELLED';
  elsif p_financial_status is distinct from 'paid' then
    v_reason := 'PAYMENT_NOT_CONFIRMED';
  elsif p_now < v_available_from then
    v_reason := 'TOO_EARLY';
  elsif p_now >= v_available_until then
    v_reason := 'TOO_LATE';
  elsif p_video_session_status in ('ended', 'canceled') then
    v_reason := 'TOO_LATE';
  elsif p_video_session_status = 'failed' then
    v_reason := 'UNKNOWN';
  elsif not coalesce(p_video_session_ready, false) then
    v_reason := 'VIDEO_SESSION_NOT_READY';
  else
    v_allowed := true;
    v_reason := null;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'availableFrom', v_available_from,
    'availableUntil', v_available_until,
    'scheduledStartsAt', p_starts_at,
    'scheduledEndsAt', p_ends_at,
    'serverNow', p_now,
    'videoSessionStatus', coalesce(p_video_session_status::text, 'not_available')
  );
end;
$$;

create or replace function public.session_attendance_state_v1(
  p_booking_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_patient_joined boolean := false;
  v_therapist_joined boolean := false;
  v_closed boolean := false;
begin
  select
    vs.id,
    vs.status::text as status,
    vs.scheduled_starts_at,
    vs.scheduled_ends_at,
    vs.actual_ended_at
  into v_session
  from public.video_sessions vs
  where vs.booking_id = p_booking_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'available', false,
      'bothJoined', false,
      'patientJoined', false,
      'therapistJoined', false,
      'sessionClosed', false,
      'sessionEndsAt', null,
      'sessionStartedAt', null,
      'sessionEndedAt', null
    );
  end if;

  select exists (
    select 1
    from public.video_session_participations participation
    where participation.video_session_id = v_session.id
      and participation.participant_role = 'patient'::public.video_session_participant_role
      and participation.event_type = 'session.user_joined'
  ) into v_patient_joined;

  select exists (
    select 1
    from public.video_session_participations participation
    where participation.video_session_id = v_session.id
      and participation.participant_role = 'therapist'::public.video_session_participant_role
      and participation.event_type = 'session.user_joined'
  ) into v_therapist_joined;

  v_closed := p_now >= v_session.scheduled_ends_at
    or (
      v_session.status in ('ended', 'canceled', 'failed')
      and v_session.actual_ended_at is not null
      and v_session.actual_ended_at >= v_session.scheduled_ends_at - interval '5 minutes'
    );

  return jsonb_build_object(
    'available', true,
    'bothJoined', v_patient_joined and v_therapist_joined,
    'patientJoined', v_patient_joined,
    'therapistJoined', v_therapist_joined,
    'sessionClosed', v_closed,
    'sessionEndsAt', v_session.scheduled_ends_at,
    'sessionStartedAt', v_session.scheduled_starts_at,
    'sessionEndedAt', v_session.actual_ended_at
  );
end;
$$;

revoke all on function public.record_patient_zoom_waiting_room_arrival_v1(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_patient_zoom_waiting_room_arrival_v1(uuid, uuid, timestamptz)
  to service_role;

revoke all on function public.authorize_therapist_zoom_manual_end_v1(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.authorize_therapist_zoom_manual_end_v1(uuid, uuid, timestamptz)
  to service_role;

comment on function public.record_patient_zoom_waiting_room_arrival_v1(uuid, uuid, timestamptz) is
  'Records one authoritative patient waiting-room arrival per booking version between T-15 and T+10, preserving re-entry until the scheduled end.';

comment on function public.authorize_therapist_zoom_manual_end_v1(uuid, uuid, timestamptz) is
  'Authorizes an idempotent therapist-owned final Zoom termination only during the last five scheduled minutes.';

comment on function public.session_attendance_state_v1(uuid, timestamptz) is
  'Returns trusted bilateral attendance and treats a provider end as final only in the last five scheduled minutes or at the scheduled end.';

commit;
