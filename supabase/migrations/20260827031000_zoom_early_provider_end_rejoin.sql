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

  if p_max_duration_minutes is not null then
    if p_max_duration_minutes < 1 or p_max_duration_minutes > 240 then
      raise exception 'invalid_zoom_video_session_max_duration_minutes'
        using errcode = '22023';
    end if;

    v_hard_ends_at := least(
      greatest(
        coalesce(v_session.actual_started_at, v_event_at),
        v_session.scheduled_starts_at
      ) + make_interval(mins => p_max_duration_minutes),
      v_session.scheduled_ends_at + make_interval(mins => p_after_ends_minutes)
    );
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
    if v_session.status = 'active'
       and v_session.termination_requested_at is null
       and v_session.termination_confirmed_at is null
       and v_event_at < v_session.scheduled_ends_at then
      update public.video_sessions
      set provider_session_id = null,
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
        and status = 'active'
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
      jsonb_build_object('source', 'zoom_video_webhook')
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
        therapist_last_left_at = aggregates.therapist_last_left_at,
        therapist_present = aggregates.therapist_present,
        participant_count = aggregates.active_participant_count,
        last_participant_left_at = aggregates.last_participant_left_at,
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

create or replace function public.apply_zoom_video_session_event_v1(
  p_session_name text,
  p_provider_session_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_provider_user_id text default null,
  p_provider_user_key text default null,
  p_duration_seconds integer default null,
  p_max_duration_minutes integer default null,
  p_after_ends_minutes integer default 30
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_zoom_video_session_event_v1(
    p_session_name,
    p_provider_session_id,
    p_event_type,
    p_event_at,
    null,
    p_provider_user_id,
    p_provider_user_key,
    p_duration_seconds,
    p_max_duration_minutes,
    p_after_ends_minutes
  );
end;
$$;

commit;
