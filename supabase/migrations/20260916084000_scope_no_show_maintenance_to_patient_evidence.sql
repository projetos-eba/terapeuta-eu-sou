-- Both waiting-room roles are recorded; only the patient's timely evidence
-- may invalidate patient-no-show closure. No financial provider calls.
begin;
create or replace function public.enqueue_due_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 50,
  p_therapist_absence_grace_seconds integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_session record;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  -- Compatibility-only input. Therapist reconnect grace remains unrelated to
  -- the no-show rule and never authorizes a terminal transition.
  if p_therapist_absence_grace_seconds is not null then
    null;
  end if;

  -- A queued timeout from a previous booking version, or one invalidated by a
  -- just-recorded patient arrival, must not be retried later.
  update public.video_session_control_jobs job
  set status = 'done'::public.video_session_control_job_status,
      completed_at = coalesce(job.completed_at, now()),
      locked_until_at = null,
      last_error_code = null,
      last_error_message = null,
      metadata = job.metadata || jsonb_build_object(
        'supersededBy', 'patient_arrival_or_booking_change',
        'supersededAt', now()
      ),
      updated_at = now()
  from public.bookings booking
  where job.booking_id = booking.id
    and job.operation = 'end_patient_no_show'::public.video_session_control_operation
    and job.status in (
      'queued'::public.video_session_control_job_status,
      'retry'::public.video_session_control_job_status
    )
    and (
      job.metadata ->> 'bookingVersion' is distinct from booking.version::text
      or job.metadata ->> 'scheduledStartsAt' is distinct from booking.starts_at::text
      or exists (
        select 1
        from public.booking_events event
        where event.booking_id = booking.id
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      or exists (
        select 1
        from public.video_session_participations participation
        join public.video_sessions session on session.id = participation.video_session_id
        where session.booking_id = booking.id
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      )
    );

  for v_session in
    select session.id, booking.version, booking.starts_at
    from public.video_sessions session
    join public.bookings booking on booking.id = session.booking_id
    where session.environment = p_environment
      and session.status = 'active'
      and session.termination_confirmed_at is null
      and booking.status = 'confirmed'::public.booking_status
      and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
      and exists (
        select 1
        from public.session_payments payment
        where payment.booking_id = booking.id
          and payment.financial_status = 'paid'::public.session_financial_status
      )
      and session.scheduled_starts_at = booking.starts_at
      and session.scheduled_ends_at = booking.ends_at
      and booking.starts_at + interval '10 minutes' < now()
      and booking.ends_at > now()
      and not exists (
        select 1
        from public.booking_events event
        where event.booking_id = booking.id
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1
        from public.video_session_participations participation
        where participation.video_session_id = session.id
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      )
    order by booking.starts_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'end_patient_no_show',
      'patient-no-show:' || v_session.id::text || ':v' || v_session.version::text ||
        ':' || floor(extract(epoch from v_session.starts_at) * 1000)::bigint::text,
      now(),
      jsonb_build_object(
        'bookingVersion', v_session.version,
        'scheduledStartsAt', v_session.starts_at::text,
        'source', 'maintenance_due_scan'
      )
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and scheduled_ends_at <= now()
      and termination_confirmed_at is null
    order by scheduled_ends_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id, 'end_scheduled', 'scheduled-end:' || v_session.id::text,
      now(), jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and scheduled_ends_at > now()
      and hard_ends_at is not null
      and hard_ends_at <= now()
      and termination_confirmed_at is null
    order by hard_ends_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id, 'end_hard_timeout', 'hard-timeout:' || v_session.id::text,
      now(), jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) from public, anon, authenticated;
grant execute on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) to service_role;
commit;
