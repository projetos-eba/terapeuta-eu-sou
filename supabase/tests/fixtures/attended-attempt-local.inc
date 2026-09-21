-- Test-only historical evidence. Include inside BEGIN; every caller rolls back.
-- A late-written historical event must belong to an attempt already in effect
-- at the time of attendance; never disable the real attempt/epoch safeguards.
create or replace function pg_temp.prepare_attended_attempt(p_booking_id uuid)
returns void language plpgsql as $$
begin
  perform public.ensure_video_session_for_paid_booking_v1(
    p_booking_id, 'development', 'pgtap-attended-attempt');
  update public.booking_session_attempts attempt
  set created_at = booking.starts_at - interval '1 day'
  from public.bookings booking
  where booking.id = p_booking_id
    and attempt.id = public.current_session_attempt_id_v1(booking.id);
  update public.video_sessions session
  set scheduled_starts_at = booking.starts_at,
      scheduled_ends_at = booking.ends_at,
      status = 'ended', actual_started_at = booking.starts_at,
      actual_ended_at = booking.ends_at, termination_reason = null,
      termination_requested_at = null, termination_confirmed_at = null,
      metadata = '{}'
  from public.bookings booking
  where booking.id = p_booking_id and session.booking_id = booking.id;
  insert into public.video_session_participations (
    video_session_id, booking_id, participant_correlation_key,
    participant_role, event_type, joined_at, metadata
  )
  select session.id, booking.id, 'pgtap-attendance-' || participant.role,
         participant.role::public.video_session_participant_role,
         'session.user_joined', booking.starts_at + interval '1 minute', '{}'
  from public.video_sessions session
  join public.bookings booking on booking.id = session.booking_id
  cross join (values ('patient'), ('therapist')) participant(role)
  where booking.id = p_booking_id;
end;
$$;
