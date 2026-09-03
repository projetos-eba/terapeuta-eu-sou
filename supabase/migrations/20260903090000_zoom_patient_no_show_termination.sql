-- A patient no-show is intentionally distinct from therapist absence and from
-- a provider instance closing. It is terminal only after the full T+10 window
-- elapsed without either authoritative patient signal.
alter type public.video_session_control_operation
  add value if not exists 'end_patient_no_show' before 'end_scheduled';

commit;
begin;

alter table public.video_sessions
  drop constraint if exists video_sessions_termination_reason_check,
  add constraint video_sessions_termination_reason_check check (
    termination_reason is null
    or termination_reason in (
      'host_left',
      'scheduled_end',
      'hard_timeout',
      'therapist_absent',
      'provider_ended',
      'manual_end',
      'reconcile_orphan',
      'patient_no_show'
    )
  );

-- The scan deliberately reads only evidence produced by the service-only
-- arrival RPC or by the trusted Zoom webhook. A late therapist must not be
-- considered a no-show signal.
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
          and event.payload ->> 'scheduledStartsAt' = booking.starts_at::text
      )
      or exists (
        select 1
        from public.video_session_participations participation
        join public.video_sessions session on session.id = participation.video_session_id
        where session.booking_id = booking.id
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
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
          and event.payload ->> 'scheduledStartsAt' = booking.starts_at::text
      )
      and not exists (
        select 1
        from public.video_session_participations participation
        where participation.video_session_id = session.id
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
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

create or replace function public.reserve_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 10,
  p_lock_seconds integer default 60
)
returns table (
  id uuid,
  video_session_id uuid,
  booking_id uuid,
  provider_session_id text,
  operation public.video_session_control_operation,
  attempts integer,
  max_attempts integer
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select job.id
    from public.video_session_control_jobs job
    join public.video_sessions session on session.id = job.video_session_id
    join public.bookings booking on booking.id = job.booking_id
    where job.environment = p_environment
      and job.status in ('queued', 'retry')
      and job.next_run_at <= now()
      and coalesce(job.locked_until_at, '-infinity'::timestamptz) <= now()
      and job.attempts < job.max_attempts
      and session.termination_confirmed_at is null
      and session.status not in ('ended', 'canceled')
      and (
        job.operation <> 'end_patient_no_show'
        or pg_catalog.pg_try_advisory_xact_lock(
          pg_catalog.hashtextextended(booking.id::text, 0)
        )
      )
      and (
        (job.operation = 'end_scheduled' and session.scheduled_ends_at <= now())
        or (
          job.operation = 'end_hard_timeout'
          and session.hard_ends_at is not null
          and session.hard_ends_at <= now()
        )
        or (
          job.operation = 'end_patient_no_show'
          and session.status = 'active'
          and session.scheduled_starts_at = booking.starts_at
          and session.scheduled_ends_at = booking.ends_at
          and booking.status = 'confirmed'::public.booking_status
          and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
          and exists (
            select 1 from public.session_payments payment
            where payment.booking_id = booking.id
              and payment.financial_status = 'paid'::public.session_financial_status
          )
          and booking.starts_at + interval '10 minutes' < now()
          and booking.ends_at > now()
          and job.metadata ->> 'bookingVersion' = booking.version::text
          and job.metadata ->> 'scheduledStartsAt' = booking.starts_at::text
          and not exists (
            select 1 from public.booking_events event
            where event.booking_id = booking.id
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = booking.version::text
              and event.payload ->> 'scheduledStartsAt' = booking.starts_at::text
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.video_session_id = session.id
              and participation.participant_role = 'patient'::public.video_session_participant_role
              and participation.event_type = 'session.user_joined'
          )
        )
        or (
          job.operation = 'confirm_end'
          and session.termination_requested_at is not null
          and (
            session.termination_reason = 'manual_end'
            or (session.termination_reason = 'scheduled_end' and session.scheduled_ends_at <= now())
            or (session.termination_reason = 'hard_timeout' and session.hard_ends_at is not null and session.hard_ends_at <= now())
            or (session.termination_reason = 'provider_ended' and session.scheduled_ends_at <= now())
          )
        )
      )
    order by job.next_run_at, job.created_at
    for update of job, session, booking skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs job
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(
          secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))
        ),
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.id, job.video_session_id, job.booking_id, job.operation,
      job.attempts, job.max_attempts
  ),
  fenced as (
    update public.video_sessions session
    set termination_requested_at = case
          when updated.operation = 'confirm_end' then session.termination_requested_at
          else coalesce(session.termination_requested_at, now())
        end,
        termination_reason = case updated.operation
          when 'end_scheduled' then 'scheduled_end'
          when 'end_hard_timeout' then 'hard_timeout'
          when 'end_patient_no_show' then 'patient_no_show'
          else session.termination_reason
        end,
        last_maintenance_at = now(),
        updated_at = now()
    from updated
    where session.id = updated.video_session_id
    returning session.id, session.provider_session_id
  )
  select updated.id, updated.video_session_id, updated.booking_id,
    fenced.provider_session_id, updated.operation, updated.attempts,
    updated.max_attempts
  from updated
  join fenced on fenced.id = updated.video_session_id;
$$;

create or replace function public.mark_video_session_termination_requested_v1(
  p_video_session_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason = 'scheduled_end' then
    update public.video_sessions set termination_reason = 'scheduled_end',
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and scheduled_ends_at <= now()
      and termination_confirmed_at is null;
  elsif p_reason = 'hard_timeout' then
    update public.video_sessions set termination_reason = 'hard_timeout',
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and hard_ends_at is not null
      and hard_ends_at <= now() and termination_confirmed_at is null;
  elsif p_reason = 'patient_no_show' then
    update public.video_sessions session
    set termination_reason = 'patient_no_show',
        termination_requested_at = coalesce(session.termination_requested_at, now()),
        last_maintenance_at = now(), updated_at = now()
    from public.bookings booking
    where session.id = p_video_session_id
      and booking.id = session.booking_id
      and session.status = 'active'
      and session.scheduled_starts_at = booking.starts_at
      and session.scheduled_ends_at = booking.ends_at
      and booking.status = 'confirmed'::public.booking_status
      and booking.starts_at + interval '10 minutes' < now()
      and booking.ends_at > now()
      and session.termination_confirmed_at is null
      and not exists (
        select 1 from public.booking_events event
        where event.booking_id = booking.id
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and event.payload ->> 'scheduledStartsAt' = booking.starts_at::text
      )
      and not exists (
        select 1 from public.video_session_participations participation
        where participation.video_session_id = session.id
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
      );
  elsif p_reason = 'manual_end' then
    update public.video_sessions set last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and termination_reason = 'manual_end'
      and termination_requested_at is not null and termination_confirmed_at is null;
  elsif p_reason = 'provider_ended' then
    update public.video_sessions
    set termination_reason = case when hard_ends_at is not null and hard_ends_at <= now()
          then 'hard_timeout' else 'scheduled_end' end,
        termination_requested_at = coalesce(termination_requested_at, now()),
        last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id
      and (scheduled_ends_at <= now() or (hard_ends_at is not null and hard_ends_at <= now()))
      and termination_confirmed_at is null;
  end if;
end;
$$;

create or replace function public.mark_video_session_termination_confirmed_v1(
  p_video_session_id uuid,
  p_reason text default 'provider_ended'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if p_reason not in ('scheduled_end', 'hard_timeout', 'manual_end', 'provider_ended', 'patient_no_show') then
    return;
  end if;

  select case
      when termination_reason = 'manual_end' and termination_requested_at is not null then 'manual_end'
      when termination_reason = 'patient_no_show' and termination_requested_at is not null then 'patient_no_show'
      when hard_ends_at is not null and hard_ends_at <= now() then 'hard_timeout'
      when scheduled_ends_at <= now() then 'scheduled_end'
      else null
    end
  into v_reason
  from public.video_sessions
  where id = p_video_session_id and status <> 'canceled'
    and termination_confirmed_at is null
  for update;

  if v_reason is null then return; end if;

  update public.video_sessions
  set status = 'ended', actual_ended_at = coalesce(actual_ended_at, now()),
      therapist_present = false, participant_count = 0,
      termination_reason = v_reason,
      termination_requested_at = coalesce(termination_requested_at, now()),
      termination_confirmed_at = coalesce(termination_confirmed_at, now()),
      last_maintenance_at = now(), last_synced_at = now(), updated_at = now()
  where id = p_video_session_id and status <> 'canceled'
    and termination_confirmed_at is null;
end;
$$;

revoke all on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_video_session_control_jobs_v1(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.mark_video_session_termination_requested_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.mark_video_session_termination_confirmed_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) to service_role;
grant execute on function public.reserve_video_session_control_jobs_v1(text, integer, integer) to service_role;
grant execute on function public.mark_video_session_termination_requested_v1(uuid, text) to service_role;
grant execute on function public.mark_video_session_termination_confirmed_v1(uuid, text) to service_role;

comment on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) is
  'Queues patient-no-show only after T+10 without a current-version waiting-room arrival or trusted patient join; therapist absence remains reentrant.';
comment on function public.reserve_video_session_control_jobs_v1(text, integer, integer) is
  'Atomically reserves terminal work and revalidates patient no-show evidence under the same booking advisory lock used by waiting-room arrival.';
comment on function public.mark_video_session_termination_requested_v1(uuid, text) is
  'Creates termination fences only for authorized manual, scheduled, hard-timeout, or verified patient-no-show termination.';
comment on function public.mark_video_session_termination_confirmed_v1(uuid, text) is
  'Confirms logical termination only after an authorized terminal reason, including verified patient no-show.';

commit;
