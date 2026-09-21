-- A late event cannot renew the entitlement after T+10.
begin;
create or replace function public.record_zoom_waiting_room_arrival_v2(
  p_booking_id uuid,
  p_participant_profile_id uuid,
  p_participant_role public.user_role,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_arrived_at timestamptz;
  v_request_id text;
begin
  if p_participant_role not in ('patient'::public.user_role, 'therapist'::public.user_role) then
    raise exception 'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_booking_id::text, 0)
  );

  select booking.*, patient.user_id as patient_user_id,
    therapist.user_id as therapist_user_id, payment.financial_status
  into v_booking
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  left join public.session_payments as payment on payment.booking_id = booking.id
  where booking.id = p_booking_id;

  if not found then
    raise exception 'ZOOM_BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if (p_participant_role = 'patient' and v_booking.patient_profile_id <> p_participant_profile_id)
    or (p_participant_role = 'therapist' and v_booking.therapist_profile_id <> p_participant_profile_id)
  then
    raise exception 'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select min(event.created_at) into v_arrived_at
  from public.booking_events as event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_booking.starts_at
    and coalesce(event.payload ->> 'participantRole', 'patient') = p_participant_role::text
    and event.created_at <= v_booking.starts_at + interval '10 minutes';

  if v_arrived_at is not null then
    return jsonb_build_object('arrivedAt', v_arrived_at, 'entitled', true, 'recorded', false);
  end if;

  if v_booking.status <> 'confirmed'::public.booking_status
    or v_booking.meeting_provider not in ('zoom', 'zoom_video_sdk')
    or v_booking.financial_status is distinct from 'paid'::public.session_financial_status
    or v_now < v_booking.starts_at - interval '15 minutes'
    or v_now > v_booking.starts_at + interval '10 minutes'
    or v_now >= v_booking.ends_at
  then
    return jsonb_build_object('arrivedAt', null, 'entitled', false, 'recorded', false);
  end if;

  v_request_id := left(
    'zoom-waiting-room:' || p_participant_role::text || ':' || v_booking.id::text ||
      ':v' || v_booking.version::text || ':' ||
      floor(extract(epoch from v_booking.starts_at) * 1000)::bigint::text,
    160
  );

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, payload, request_id, source, created_at
  ) values (
    v_booking.id,
    case p_participant_role
      when 'patient' then v_booking.patient_user_id
      else v_booking.therapist_user_id
    end,
    'zoom_waiting_room_entered',
    jsonb_build_object(
      'bookingVersion', v_booking.version,
      'scheduledStartsAt', v_booking.starts_at,
      'participantRole', p_participant_role::text,
      'source', 'authenticated_waiting_room'
    ),
    v_request_id,
    'zoom-video-session-access',
    v_now
  )
  on conflict (booking_id, event_type, request_id)
    where request_id is not null do nothing;

  select min(event.created_at) into v_arrived_at
  from public.booking_events as event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_booking.starts_at
    and coalesce(event.payload ->> 'participantRole', 'patient') = p_participant_role::text
    and event.created_at <= v_booking.starts_at + interval '10 minutes';

  return jsonb_build_object(
    'arrivedAt', v_arrived_at,
    'entitled', v_arrived_at is not null,
    'recorded', v_arrived_at is not null
  );
end;
$$;

commit;
