begin;

-- A mesma sessão remota pode ser reutilizada pelo Zoom depois que todos saem.
-- O ID do provider, isoladamente, não delimita uma instância. Mantemos uma
-- época interna por abertura confiável para preservar a reentrada e, ao mesmo
-- tempo, impedir que eventos atrasados da época anterior alterem a presença.
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
  v_opened_at timestamptz;
  v_provider_hash text;
  v_current_provider_hash text;
  v_provider_epoch integer := 1;
  v_opened_new_epoch boolean := false;
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

  if v_session.status in ('ended', 'canceled')
     or v_session.termination_confirmed_at is not null then
    return;
  end if;

  if p_event_type in ('session.started', 'session.user_joined', 'session.user_left')
     and (v_session.termination_requested_at is not null
       or v_event_at >= v_session.scheduled_ends_at
       or (v_session.hard_ends_at is not null and v_event_at >= v_session.hard_ends_at))
  then
    return;
  end if;

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

  v_closed_at := (v_session.metadata ->> 'zoom_provider_closed_at')::timestamptz;
  v_opened_at := (v_session.metadata ->> 'zoom_provider_opened_at')::timestamptz;
  v_current_provider_hash := nullif(
    v_session.metadata ->> 'zoom_provider_current_hash',
    ''
  );
  v_provider_hash := case when v_provider_session_id is not null then
    encode(extensions.digest(v_provider_session_id, 'sha256'), 'hex') end;
  v_provider_epoch := case
    when coalesce(v_session.metadata ->> 'zoom_provider_epoch', '') ~ '^[1-9][0-9]*$'
      then (v_session.metadata ->> 'zoom_provider_epoch')::integer
    else 1
  end;

  -- A closing event retires only the current epoch. A subsequent provider
  -- opening/join may legitimately reuse the same provider_session_id.
  if v_session.provider_session_id is null
     and v_provider_session_id is not null
     and p_event_type in ('session.started', 'session.user_joined') then
    if v_closed_at is not null and v_event_at <= v_closed_at then
      return;
    end if;

    if v_closed_at is not null then
      v_provider_epoch := v_provider_epoch + 1;
      v_opened_new_epoch := true;
    end if;
    v_opened_at := v_event_at;
    v_current_provider_hash := v_provider_hash;

    update public.video_sessions
    set provider_session_id = v_provider_session_id,
        status = case
          when p_event_type = 'session.started'
            or (p_event_type = 'session.user_joined'
              and v_role = 'therapist'::public.video_session_participant_role)
            then 'active'::public.video_session_status
          else status
        end,
        actual_started_at = case
          when p_event_type = 'session.started'
            or (p_event_type = 'session.user_joined'
              and v_role = 'therapist'::public.video_session_participant_role)
            then coalesce(actual_started_at, v_event_at)
          else actual_started_at
        end,
        hard_ends_at = case
          when p_event_type = 'session.started'
            or (p_event_type = 'session.user_joined'
              and v_role = 'therapist'::public.video_session_participant_role)
            then coalesce(hard_ends_at, v_hard_ends_at)
          else hard_ends_at
        end,
        metadata = metadata || jsonb_build_object(
          'zoom_provider_epoch', v_provider_epoch,
          'zoom_provider_opened_at', v_opened_at,
          'zoom_provider_current_hash', v_current_provider_hash,
          'zoom_provider_reopened_at', case when v_opened_new_epoch then v_event_at else null end
        ),
        last_provider_event_at = greatest(
          coalesce(last_provider_event_at, '-infinity'::timestamptz),
          v_event_at
        ),
        last_synced_at = now(),
        updated_at = now()
    where id = v_session.id
      and status not in ('ended', 'canceled');
  elsif v_session.provider_session_id is not null
     and v_provider_session_id is not null
     and v_session.provider_session_id <> v_provider_session_id then
    return;
  elsif v_session.provider_session_id is null
     and v_closed_at is not null then
    -- No provider ID after a close cannot be safely associated with a new epoch.
    return;
  end if;

  -- Delayed events from the prior epoch must not clear or revive presence in
  -- the current one, even when Zoom reuses a provider session identifier.
  if v_opened_at is not null and v_event_at < v_opened_at then
    return;
  end if;

  if p_event_type = 'session.started' then
    update public.video_sessions
    set status = 'active',
        actual_started_at = coalesce(actual_started_at, v_event_at),
        hard_ends_at = coalesce(hard_ends_at, v_hard_ends_at),
        provider_session_id = coalesce(provider_session_id, v_provider_session_id),
        metadata = metadata || jsonb_build_object(
          'zoom_provider_epoch', v_provider_epoch,
          'zoom_provider_opened_at', coalesce(v_opened_at, v_event_at),
          'zoom_provider_current_hash', coalesce(v_current_provider_hash, v_provider_hash)
        ),
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
            'zoom_provider_closed_epoch', v_provider_epoch,
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
      jsonb_build_object(
        'source', 'zoom_video_webhook',
        'provider_hash', v_provider_hash,
        'provider_epoch', v_provider_epoch
      )
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
        metadata = public.video_sessions.metadata || jsonb_build_object(
          'zoom_provider_epoch', v_provider_epoch,
          'zoom_provider_opened_at', coalesce(v_opened_at, v_event_at),
          'zoom_provider_current_hash', coalesce(v_current_provider_hash, v_provider_hash)
        ),
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
          and case
            when coalesce(vsp.metadata ->> 'provider_epoch', '') ~ '^[1-9][0-9]*$'
              then (vsp.metadata ->> 'provider_epoch')::integer = v_provider_epoch
            else v_provider_epoch = 1
          end
          and (
            v_opened_at is null
            or coalesce(vsp.left_at, vsp.joined_at, vsp.created_at) >= v_opened_at
          )
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

revoke all on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer) to service_role;
grant execute on function public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer) to service_role;

commit;
