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
      'reconcile_orphan'
    )
  );

create index if not exists video_sessions_scheduled_end_idx
on public.video_sessions (environment, status, scheduled_ends_at)
where termination_confirmed_at is null;

create or replace function public.synchronize_video_session_watchdog_v1(
  p_session_name text,
  p_provider_session_id text,
  p_environment text,
  p_max_duration_minutes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_match_count integer := 0;
  v_session_name text := nullif(btrim(coalesce(p_session_name, '')), '');
  v_provider_session_id text := nullif(btrim(coalesce(p_provider_session_id, '')), '');
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  if p_max_duration_minutes is null
     or p_max_duration_minutes < 1
     or p_max_duration_minutes > 240 then
    raise exception 'invalid_zoom_video_session_max_duration_minutes'
      using errcode = '22023';
  end if;

  if v_session_name is null and v_provider_session_id is null then
    return;
  end if;

  select count(*), (array_agg(id order by updated_at desc))[1]
    into v_match_count, v_session_id
  from public.video_sessions
  where environment = p_environment
    and (
      (v_session_name is not null and lower(session_name) = lower(v_session_name))
      or (
        v_provider_session_id is not null
        and provider_session_id = v_provider_session_id
      )
    );

  if v_match_count <> 1 then
    return;
  end if;

  update public.video_sessions
  set hard_ends_at = actual_started_at + make_interval(mins => p_max_duration_minutes),
      updated_at = now()
  where id = v_session_id
    and actual_started_at is not null
    and status not in ('ended', 'canceled');
end;
$$;

update public.video_sessions
set hard_ends_at = actual_started_at + interval '240 minutes',
    updated_at = now()
where status = 'active'
  and actual_started_at is not null
  and termination_confirmed_at is null;

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

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and scheduled_ends_at > now()
      and therapist_present = false
      and therapist_last_left_at is not null
      and therapist_last_left_at
        <= now() - make_interval(secs => greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
      and termination_confirmed_at is null
    order by therapist_last_left_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'end_therapist_absent',
      'therapist-absent:' || v_session.id::text,
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
      and provider_session_id is null
      and actual_started_at < now() - interval '10 minutes'
      and termination_confirmed_at is null
    order by actual_started_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'reconcile_orphan',
      'reconcile-orphan:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.mark_video_session_termination_requested_v1(
  p_video_session_id uuid,
  p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.video_sessions
  set termination_reason = case
        when p_reason in (
          'scheduled_end',
          'hard_timeout',
          'therapist_absent',
          'manual_end',
          'reconcile_orphan',
          'provider_ended'
        ) then p_reason
        else 'manual_end'
      end,
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(),
      updated_at = now()
  where id = p_video_session_id
    and termination_confirmed_at is null;
$$;

create or replace function public.mark_video_session_termination_confirmed_v1(
  p_video_session_id uuid,
  p_reason text default 'provider_ended'
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.video_sessions
  set status = 'ended',
      actual_ended_at = coalesce(actual_ended_at, now()),
      therapist_present = false,
      participant_count = 0,
      termination_reason = coalesce(
        termination_reason,
        case
          when p_reason in (
            'scheduled_end',
            'hard_timeout',
            'therapist_absent',
            'manual_end',
            'reconcile_orphan',
            'provider_ended'
          ) then p_reason
          else 'provider_ended'
        end
      ),
      termination_confirmed_at = coalesce(termination_confirmed_at, now()),
      last_maintenance_at = now(),
      last_synced_at = now(),
      updated_at = now()
  where id = p_video_session_id
    and status <> 'canceled';
$$;

revoke all on function public.synchronize_video_session_watchdog_v1(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.synchronize_video_session_watchdog_v1(text, text, text, integer)
  to service_role;

revoke all on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer)
  to service_role;

revoke all on function public.mark_video_session_termination_requested_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_video_session_termination_requested_v1(uuid, text)
  to service_role;

revoke all on function public.mark_video_session_termination_confirmed_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_video_session_termination_confirmed_v1(uuid, text)
  to service_role;

comment on function public.synchronize_video_session_watchdog_v1(text, text, text, integer) is
  'Recalculates the internal orphan-session watchdog from actual provider start plus the validated runtime duration. It does not define booking duration or join windows.';

comment on function public.enqueue_due_video_session_control_jobs_v1(text, integer, integer) is
  'Queues scheduled booking termination independently from the configurable orphan-session watchdog and therapist absence recovery.';

commit;
