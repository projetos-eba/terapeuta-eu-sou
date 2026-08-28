begin;

-- Provider lifecycle events are technical signals. A participant leaving, or
-- the provider closing an empty instance, must not terminate the TES encounter
-- while the scheduled booking window is still open.

-- Retire pending legacy work before clearing its unconfirmed fence. Confirmed
-- terminal sessions are deliberately excluded and are never reopened.
update public.video_session_control_jobs as job
set status = 'done'::public.video_session_control_job_status,
    completed_at = coalesce(job.completed_at, now()),
    locked_until_at = null,
    last_error_code = null,
    last_error_message = null,
    metadata = job.metadata || jsonb_build_object(
      'supersededBy', 'reentry_until_scheduled_end',
      'supersededAt', now()
    ),
    updated_at = now()
where job.operation in (
    'end_therapist_absent'::public.video_session_control_operation,
    'reconcile_orphan'::public.video_session_control_operation
  )
  and job.status in (
    'queued'::public.video_session_control_job_status,
    'retry'::public.video_session_control_job_status,
    'processing'::public.video_session_control_job_status
  );

update public.video_sessions
set termination_requested_at = null,
    termination_reason = null,
    updated_at = now()
where status = 'active'::public.video_session_status
  and scheduled_ends_at > now()
  and termination_confirmed_at is null
  and termination_reason in ('therapist_absent', 'reconcile_orphan');

-- The third parameter remains in the public signature for compatibility with
-- deployed callers. It is intentionally ignored: reconnect grace no longer
-- defines the logical lifetime of an encounter.
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

  -- Compatibility-only input: callers may still send the former grace value,
  -- but it no longer authorizes logical termination.
  if p_therapist_absence_grace_seconds is not null then
    null;
  end if;

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
      v_session.id,
      'end_scheduled',
      'scheduled-end:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
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
      v_session.id,
      'end_hard_timeout',
      'hard-timeout:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
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
    select j.id
    from public.video_session_control_jobs j
    join public.video_sessions vs on vs.id = j.video_session_id
    where j.environment = p_environment
      and j.status in ('queued', 'retry')
      and j.next_run_at <= now()
      and coalesce(j.locked_until_at, '-infinity'::timestamptz) <= now()
      and j.attempts < j.max_attempts
      and vs.termination_confirmed_at is null
      and vs.status not in ('ended', 'canceled')
      and (
        (j.operation = 'end_scheduled' and vs.scheduled_ends_at <= now())
        or (
          j.operation = 'end_hard_timeout'
          and vs.hard_ends_at is not null
          and vs.hard_ends_at <= now()
        )
        or (
          j.operation = 'confirm_end'
          and vs.termination_requested_at is not null
          and (
            vs.termination_reason = 'manual_end'
            or (
              vs.termination_reason = 'scheduled_end'
              and vs.scheduled_ends_at <= now()
            )
            or (
              vs.termination_reason = 'hard_timeout'
              and vs.hard_ends_at is not null
              and vs.hard_ends_at <= now()
            )
            or (
              vs.termination_reason = 'provider_ended'
              and vs.scheduled_ends_at <= now()
            )
          )
        )
      )
    order by j.next_run_at, j.created_at
    for update of j, vs skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs j
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(
          secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))
        ),
        updated_at = now()
    from candidates
    where j.id = candidates.id
    returning
      j.id,
      j.video_session_id,
      j.booking_id,
      j.operation,
      j.attempts,
      j.max_attempts
  ),
  fenced as (
    update public.video_sessions vs
    set termination_requested_at = case
          when updated.operation = 'confirm_end'
            then vs.termination_requested_at
          else coalesce(vs.termination_requested_at, now())
        end,
        termination_reason = case updated.operation
          when 'end_scheduled' then 'scheduled_end'
          when 'end_hard_timeout' then 'hard_timeout'
          else vs.termination_reason
        end,
        last_maintenance_at = now(),
        updated_at = now()
    from updated
    where vs.id = updated.video_session_id
    returning vs.id, vs.provider_session_id
  )
  select
    updated.id,
    updated.video_session_id,
    updated.booking_id,
    fenced.provider_session_id,
    updated.operation,
    updated.attempts,
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
    update public.video_sessions
    set termination_reason = 'scheduled_end',
        termination_requested_at = coalesce(termination_requested_at, now()),
        last_maintenance_at = now(),
        updated_at = now()
    where id = p_video_session_id
      and scheduled_ends_at <= now()
      and termination_confirmed_at is null;
  elsif p_reason = 'hard_timeout' then
    update public.video_sessions
    set termination_reason = 'hard_timeout',
        termination_requested_at = coalesce(termination_requested_at, now()),
        last_maintenance_at = now(),
        updated_at = now()
    where id = p_video_session_id
      and hard_ends_at is not null
      and hard_ends_at <= now()
      and termination_confirmed_at is null;
  elsif p_reason = 'manual_end' then
    -- Manual authorization is created only by
    -- authorize_therapist_zoom_manual_end_v1 during the final five minutes.
    update public.video_sessions
    set last_maintenance_at = now(),
        updated_at = now()
    where id = p_video_session_id
      and termination_reason = 'manual_end'
      and termination_requested_at is not null
      and termination_confirmed_at is null;
  elsif p_reason = 'provider_ended' then
    update public.video_sessions
    set termination_reason = case
          when hard_ends_at is not null and hard_ends_at <= now()
            then 'hard_timeout'
          else 'scheduled_end'
        end,
        termination_requested_at = coalesce(termination_requested_at, now()),
        last_maintenance_at = now(),
        updated_at = now()
    where id = p_video_session_id
      and (
        scheduled_ends_at <= now()
        or (hard_ends_at is not null and hard_ends_at <= now())
      )
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
  if p_reason not in (
    'scheduled_end',
    'hard_timeout',
    'manual_end',
    'provider_ended'
  ) then
    return;
  end if;

  select case
      when termination_reason = 'manual_end'
        and termination_requested_at is not null then 'manual_end'
      when hard_ends_at is not null and hard_ends_at <= now() then 'hard_timeout'
      when scheduled_ends_at <= now() then 'scheduled_end'
      else null
    end
  into v_reason
  from public.video_sessions
  where id = p_video_session_id
    and status <> 'canceled'
    and termination_confirmed_at is null
  for update;

  if v_reason is null then
    return;
  end if;

  update public.video_sessions
  set status = 'ended',
      actual_ended_at = coalesce(actual_ended_at, now()),
      therapist_present = false,
      participant_count = 0,
      termination_reason = v_reason,
      termination_requested_at = coalesce(termination_requested_at, now()),
      termination_confirmed_at = coalesce(termination_confirmed_at, now()),
      last_maintenance_at = now(),
      last_synced_at = now(),
      updated_at = now()
  where id = p_video_session_id
    and status <> 'canceled'
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

grant execute on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer)
  to service_role;
grant execute on function public.reserve_video_session_control_jobs_v1(text, integer, integer)
  to service_role;
grant execute on function public.mark_video_session_termination_requested_v1(uuid, text)
  to service_role;
grant execute on function public.mark_video_session_termination_confirmed_v1(uuid, text)
  to service_role;

comment on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) is
  'Queues only scheduled-end and hard-timeout termination. Therapist absence and provider orphaning remain reentrant technical states until the scheduled end.';
comment on function public.reserve_video_session_control_jobs_v1(text, integer, integer) is
  'Atomically reserves only authorized terminal work; legacy absence and orphan jobs are never reservable.';
comment on function public.mark_video_session_termination_requested_v1(uuid, text) is
  'Creates termination fences only for authorized manual end, scheduled end, or hard timeout. Legacy technical reasons are ignored.';
comment on function public.mark_video_session_termination_confirmed_v1(uuid, text) is
  'Confirms logical termination only after authorized manual end, scheduled end, or hard timeout; provider closure alone is nonterminal.';

commit;
