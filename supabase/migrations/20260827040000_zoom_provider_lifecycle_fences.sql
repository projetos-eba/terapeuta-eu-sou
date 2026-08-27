begin;

-- A sessão remota do Zoom termina quando o último participante sai. Antes do
-- fim agendado, isso não representa encerramento lógico: permite reentrada e
-- deixa o watchdog aplicar a grace de ausência do terapeuta.
create or replace function public.apply_zoom_video_session_event_v1(
  p_session_name text,
  p_provider_session_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_environment text,
  p_provider_user_id text,
  p_provider_user_key text,
  p_duration_seconds integer,
  p_max_duration_minutes integer,
  p_after_ends_minutes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.video_sessions%rowtype;
  v_role public.video_session_participant_role :=
    'unknown'::public.video_session_participant_role;
  v_correlation text;
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_hard_ends_at timestamptz;
  v_session_name text := nullif(btrim(coalesce(p_session_name, '')), '');
  v_provider_session_id text := nullif(btrim(coalesce(p_provider_session_id, '')), '');
  v_provider_user_id text := nullif(btrim(coalesce(p_provider_user_id, '')), '');
  v_provider_user_key text := nullif(btrim(coalesce(p_provider_user_key, '')), '');
  v_match_count integer := 0;
  v_closed_at timestamptz;
  v_provider_hash text;
begin
  if p_environment is not null
     and p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment'
      using errcode = '22023';
  end if;

  if v_session_name is null and v_provider_session_id is null then
    return;
  end if;

  with candidates as (
    select
      (
        case
          when v_session_name is not null
            and lower(vs.session_name) = lower(v_session_name)
            then 2
          else 0
        end
        +
        case
          when v_provider_session_id is not null
            and vs.provider_session_id = v_provider_session_id
            then 1
          else 0
        end
      ) as match_score
    from public.video_sessions vs
    where (p_environment is null or vs.environment = p_environment)
      and (
        (v_session_name is not null and lower(vs.session_name) = lower(v_session_name))
        or (
          v_provider_session_id is not null
          and vs.provider_session_id = v_provider_session_id
        )
      )
  )
  select count(*)
    into v_match_count
  from candidates
  where match_score = (select max(match_score) from candidates);

  if coalesce(v_match_count, 0) <> 1 then
    return;
  end if;

  select *
    into v_session
  from public.video_sessions vs
  where (p_environment is null or vs.environment = p_environment)
    and (
      (v_session_name is not null and lower(vs.session_name) = lower(v_session_name))
      or (
        v_provider_session_id is not null
        and vs.provider_session_id = v_provider_session_id
      )
    )
  order by
    (
      case
        when v_session_name is not null
          and lower(vs.session_name) = lower(v_session_name)
          then 2
        else 0
      end
      +
      case
        when v_provider_session_id is not null
          and vs.provider_session_id = v_provider_session_id
          then 1
        else 0
      end
    ) desc,
    vs.updated_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if v_provider_session_id is not null
     and v_session.provider_session_id is not null
     and v_session.provider_session_id <> v_provider_session_id then
    return;
  end if;

  -- Provider end closes an instance, not necessarily the TES encounter. Keep
  -- a watermark and opaque retired-instance identities in existing metadata.
  v_closed_at := (v_session.metadata ->> 'zoom_provider_closed_at')::timestamptz;
  v_provider_hash := case when v_provider_session_id is not null then
    encode(extensions.digest(v_provider_session_id, 'sha256'), 'hex') end;
  if v_session.status in ('ended', 'canceled')
     or v_session.termination_confirmed_at is not null then return; end if;
  if v_closed_at is not null and (
    v_event_at < v_closed_at or v_provider_session_id is null
    or coalesce(v_session.metadata -> 'zoom_closed_provider_hashes', '[]'::jsonb) ? v_provider_hash
  ) then return; end if;
  if p_event_type in ('session.started', 'session.user_joined', 'session.user_left')
     and (v_session.termination_requested_at is not null
       or v_event_at >= v_session.scheduled_ends_at
       or (v_session.hard_ends_at is not null and v_event_at >= v_session.hard_ends_at))
  then return; end if;

  if p_max_duration_minutes is not null then
    if p_max_duration_minutes < 1 or p_max_duration_minutes > 240 then
      raise exception 'invalid_zoom_video_session_max_duration_minutes'
        using errcode = '22023';
    end if;

    v_hard_ends_at := coalesce(v_session.actual_started_at, v_event_at)
      + make_interval(mins => p_max_duration_minutes);
  end if;

  if v_provider_user_key like 'tes-v1-t-%' then
    v_role := 'therapist'::public.video_session_participant_role;
  elsif v_provider_user_key like 'tes-v1-p-%' then
    v_role := 'patient'::public.video_session_participant_role;
  end if;

  if p_event_type = 'session.started' then
    update public.video_sessions
    set status = 'active',
        actual_started_at = coalesce(actual_started_at, v_event_at),
        hard_ends_at = coalesce(hard_ends_at, v_hard_ends_at),
        provider_session_id = coalesce(provider_session_id, v_provider_session_id),
        last_provider_event_at = greatest(
          coalesce(last_provider_event_at, '-infinity'::timestamptz),
          v_event_at
        ),
        last_synced_at = now(),
        updated_at = now()
    where id = v_session.id
      and status not in ('ended', 'canceled');
  elsif p_event_type = 'session.ended' then
    if v_session.status in ('ready', 'active')
       and v_session.termination_requested_at is null
       and v_session.termination_confirmed_at is null
       and v_event_at < v_session.scheduled_ends_at
       and (v_session.hard_ends_at is null or v_event_at < v_session.hard_ends_at) then
      update public.video_sessions
      set provider_session_id = null,
          metadata = metadata || jsonb_build_object(
            'zoom_provider_closed_at', v_event_at,
            'zoom_closed_provider_hashes',
              coalesce(metadata -> 'zoom_closed_provider_hashes', '[]'::jsonb)
              || case when v_provider_hash is null then '[]'::jsonb
                 else jsonb_build_array(v_provider_hash) end
          ),
          therapist_last_left_at = case
            when therapist_present then greatest(
              coalesce(therapist_last_left_at, '-infinity'::timestamptz),
              v_event_at
            )
            else therapist_last_left_at
          end,
          therapist_present = false,
          participant_count = 0,
          last_participant_left_at = greatest(
            coalesce(last_participant_left_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status in ('ready', 'active')
        and termination_requested_at is null
        and termination_confirmed_at is null;
    else
      update public.video_sessions
      set status = 'ended',
          actual_ended_at = coalesce(actual_ended_at, v_event_at),
          provider_session_id = coalesce(provider_session_id, v_provider_session_id),
          therapist_present = false,
          participant_count = 0,
          termination_reason = coalesce(termination_reason, 'provider_ended'),
          termination_confirmed_at = coalesce(termination_confirmed_at, v_event_at),
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status <> 'canceled';
    end if;
  end if;

  if p_event_type in ('session.user_joined', 'session.user_left') then
    v_correlation := coalesce(
      v_provider_user_key,
      v_provider_user_id,
      encode(extensions.digest(v_session.id::text || p_event_type, 'sha256'::text), 'hex')
    );

    insert into public.video_session_participations (
      video_session_id,
      booking_id,
      participant_correlation_key,
      provider_user_id,
      provider_user_key,
      participant_role,
      event_type,
      joined_at,
      left_at,
      duration_seconds,
      metadata
    )
    select
      v_session.id,
      v_session.booking_id,
      v_correlation,
      v_provider_user_id,
      v_provider_user_key,
      v_role,
      p_event_type,
      case when p_event_type = 'session.user_joined' then v_event_at else null end,
      case when p_event_type = 'session.user_left' then v_event_at else null end,
      p_duration_seconds,
      jsonb_build_object('source', 'zoom_video_webhook', 'provider_hash', v_provider_hash)
    where not exists (
      select 1
      from public.video_session_participations existing
      where existing.video_session_id = v_session.id
        and existing.participant_correlation_key = v_correlation
        and existing.event_type = p_event_type
        and coalesce(existing.joined_at, existing.left_at) = v_event_at
    );

    update public.video_sessions
    set status = case
          when v_role = 'therapist'
            and p_event_type = 'session.user_joined'
            and public.video_sessions.status not in ('ended', 'canceled')
            then 'active'::public.video_session_status
          else public.video_sessions.status
        end,
        actual_started_at = case
          when v_role = 'therapist'
            and p_event_type = 'session.user_joined'
            and public.video_sessions.status not in ('ended', 'canceled')
            then coalesce(public.video_sessions.actual_started_at, v_event_at)
          else public.video_sessions.actual_started_at
        end,
        hard_ends_at = case
          when v_role = 'therapist'
            and p_event_type = 'session.user_joined'
            then coalesce(public.video_sessions.hard_ends_at, v_hard_ends_at)
          else public.video_sessions.hard_ends_at
        end,
        provider_session_id = coalesce(public.video_sessions.provider_session_id, v_provider_session_id),
        therapist_first_joined_at = aggregates.therapist_first_joined_at,
        therapist_last_joined_at = aggregates.therapist_last_joined_at,
        therapist_last_left_at = greatest(public.video_sessions.therapist_last_left_at, aggregates.therapist_last_left_at),
        therapist_present = aggregates.therapist_present,
        participant_count = aggregates.active_participant_count,
        last_participant_left_at = greatest(public.video_sessions.last_participant_left_at, aggregates.last_participant_left_at),
        last_provider_event_at = greatest(
          coalesce(public.video_sessions.last_provider_event_at, '-infinity'::timestamptz),
          v_event_at
        ),
        last_synced_at = now(),
        updated_at = now()
    from (
      with latest_events as (
        select distinct on (vsp.participant_correlation_key)
          vsp.participant_correlation_key,
          vsp.participant_role,
          vsp.event_type,
          coalesce(vsp.left_at, vsp.joined_at, vsp.created_at) as event_at
        from public.video_session_participations vsp
        where vsp.video_session_id = v_session.id
          and (v_closed_at is null or (
            coalesce(vsp.left_at, vsp.joined_at, vsp.created_at) >= v_closed_at
            and vsp.metadata ->> 'provider_hash' = v_provider_hash
          ))
        order by
          vsp.participant_correlation_key,
          coalesce(vsp.left_at, vsp.joined_at, vsp.created_at) desc,
          case when vsp.event_type = 'session.user_left' then 0 else 1 end
      )
      select
        coalesce(
          bool_or(
            latest_events.participant_role = 'therapist'::public.video_session_participant_role
            and latest_events.event_type = 'session.user_joined'
          ),
          false
        ) as therapist_present,
        count(*) filter (
          where latest_events.event_type = 'session.user_joined'
        )::integer as active_participant_count,
        (
          select min(vsp.joined_at)
          from public.video_session_participations vsp
          where vsp.video_session_id = v_session.id
            and vsp.participant_role = 'therapist'::public.video_session_participant_role
            and vsp.event_type = 'session.user_joined'
        ) as therapist_first_joined_at,
        (
          select max(vsp.joined_at)
          from public.video_session_participations vsp
          where vsp.video_session_id = v_session.id
            and vsp.participant_role = 'therapist'::public.video_session_participant_role
            and vsp.event_type = 'session.user_joined'
        ) as therapist_last_joined_at,
        (
          select max(vsp.left_at)
          from public.video_session_participations vsp
          where vsp.video_session_id = v_session.id
            and vsp.participant_role = 'therapist'::public.video_session_participant_role
            and vsp.event_type = 'session.user_left'
        ) as therapist_last_left_at,
        (
          select max(vsp.left_at)
          from public.video_session_participations vsp
          where vsp.video_session_id = v_session.id
            and vsp.event_type = 'session.user_left'
        ) as last_participant_left_at
      from latest_events
    ) as aggregates
    where public.video_sessions.id = v_session.id
      and public.video_sessions.status not in ('ended', 'canceled');
  end if;
end;
$$;

-- Both overloads stay backend-only; do not rely on inherited default ACLs.
revoke all on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer) to service_role;
grant execute on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer) to service_role;
-- Reconcile technical closure only after grace. Reserve + termination fence is
-- atomic under the session row lock, so a stale job cannot close a rejoined host.
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
      jsonb_build_object('source', 'maintenance_due_scan', 'reconnectGraceSeconds', greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
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
      jsonb_build_object('source', 'maintenance_due_scan', 'reconnectGraceSeconds', greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
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
      and (provider_session_id is not null or metadata ->> 'zoom_provider_closed_at' is null)
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
      jsonb_build_object('source', 'maintenance_due_scan', 'reconnectGraceSeconds', greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
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
      and (
        (metadata ->> 'zoom_provider_closed_at' is null and actual_started_at < now() - interval '10 minutes')
        or (metadata ->> 'zoom_provider_closed_at' is not null and
          coalesce(therapist_last_left_at, (metadata ->> 'zoom_provider_closed_at')::timestamptz)
          <= now() - make_interval(secs => greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600))))
      )
      and termination_confirmed_at is null
    order by actual_started_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'reconcile_orphan',
      'reconcile-orphan:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan', 'reconnectGraceSeconds', greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
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
        vs.termination_requested_at is not null
        or (j.operation = 'end_scheduled' and vs.scheduled_ends_at <= now())
        or (j.operation = 'end_hard_timeout' and vs.hard_ends_at <= now())
        or (j.operation = 'end_therapist_absent' and not vs.therapist_present
          and vs.therapist_last_left_at <= now() - make_interval(secs => coalesce((j.metadata ->> 'reconnectGraceSeconds')::integer, 120)))
        or (j.operation = 'reconcile_orphan' and vs.provider_session_id is null
          and ((vs.metadata ->> 'zoom_provider_closed_at' is null and vs.actual_started_at < now() - interval '10 minutes')
            or coalesce(vs.therapist_last_left_at, (vs.metadata ->> 'zoom_provider_closed_at')::timestamptz)
              <= now() - make_interval(secs => coalesce((j.metadata ->> 'reconnectGraceSeconds')::integer, 120))))
        or j.operation = 'confirm_end'
      )
    order by j.next_run_at, j.created_at
    for update of j, vs skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs j
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))),
        updated_at = now()
    from candidates
    where j.id = candidates.id
    returning j.id, j.video_session_id, j.booking_id, j.operation, j.attempts, j.max_attempts
  ),
  fenced as (
    update public.video_sessions vs
    set termination_requested_at = coalesce(vs.termination_requested_at, now()),
        termination_reason = coalesce(vs.termination_reason, case updated.operation
          when 'end_scheduled' then 'scheduled_end'
          when 'end_hard_timeout' then 'hard_timeout'
          when 'end_therapist_absent' then 'therapist_absent'
          when 'reconcile_orphan' then 'reconcile_orphan'
          else 'manual_end' end),
        last_maintenance_at = now(), updated_at = now()
    from updated where vs.id = updated.video_session_id
    returning vs.id, vs.provider_session_id
  )
  select
    updated.id,
    updated.video_session_id,
    updated.booking_id,
    vs.provider_session_id,
    updated.operation,
    updated.attempts,
    updated.max_attempts
  from updated
  join fenced vs on vs.id = updated.video_session_id;
$$;


revoke all on function public.enqueue_due_video_session_control_jobs_v1(text,integer,integer) from public, anon, authenticated;
revoke all on function public.reserve_video_session_control_jobs_v1(text,integer,integer) from public, anon, authenticated;
grant execute on function public.enqueue_due_video_session_control_jobs_v1(text,integer,integer) to service_role;
grant execute on function public.reserve_video_session_control_jobs_v1(text,integer,integer) to service_role;
commit;
