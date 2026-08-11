begin;

drop function if exists public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
);

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
  v_inserted integer := 0;
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

    get diagnostics v_inserted = row_count;

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

create or replace function public.admin_get_operation_detail_v1(
  p_module text,
  p_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_audit_entity_type text;
  v_record jsonb;
  v_audit_events jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'admin operation detail id required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  case p_module
    when 'professionals' then
      v_audit_entity_type := 'therapist_profile';

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'user_id', therapist_profiles.user_id,
        'public_name', therapist_profiles.public_name,
        'slug', therapist_profiles.slug,
        'plan', therapist_profiles.plan,
        'status', therapist_profiles.status,
        'public_status', therapist_profiles.public_status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings,
        'accepts_online_sessions', therapist_profiles.accepts_online_sessions,
        'city', therapist_profiles.city,
        'state', therapist_profiles.state,
        'country', therapist_profiles.country,
        'languages', therapist_profiles.languages,
        'service_count', coalesce(service_counts.total, 0),
        'active_service_count', coalesce(service_counts.active_total, 0),
        'future_booking_count', coalesce(booking_counts.future_total, 0),
        'total_booking_count', coalesce(booking_counts.total, 0),
        'connect_status', therapist_connect_accounts.operational_status,
        'next_session_at', next_booking.starts_at,
        'created_at', therapist_profiles.created_at,
        'updated_at', therapist_profiles.updated_at
      )
      into v_record
      from public.therapist_profiles
      left join public.therapist_connect_accounts
        on therapist_connect_accounts.therapist_profile_id =
          therapist_profiles.id
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (
            where therapist_services.status = 'active'::public.service_status
          )::integer as active_total
        from public.therapist_services
        where therapist_services.therapist_profile_id = therapist_profiles.id
          and therapist_services.archived_at is null
      ) service_counts on true
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (where bookings.starts_at >= now())::integer
            as future_total
        from public.bookings
        where bookings.therapist_profile_id = therapist_profiles.id
      ) booking_counts on true
      left join lateral (
        select bookings.starts_at
        from public.bookings
        where bookings.therapist_profile_id = therapist_profiles.id
          and bookings.starts_at >= now()
          and bookings.status not in (
            'cancelled_by_patient'::public.booking_status,
            'cancelled_by_therapist'::public.booking_status,
            'refunded'::public.booking_status
          )
        order by bookings.starts_at asc
        limit 1
      ) next_booking on true
      where therapist_profiles.id = p_id;

    when 'patients' then
      v_audit_entity_type := 'patient_profile';

      select jsonb_build_object(
        'id', patient_profiles.id,
        'user_id', patient_profiles.user_id,
        'display_name', patient_profiles.display_name,
        'account_status', case
          when profiles.auth_deleted_at is not null then 'deleted'
          when profiles.anonymized_at is not null then 'anonymized'
          else 'active'
        end,
        'timezone', patient_profiles.timezone,
        'marketing_consent', patient_profiles.marketing_consent,
        'booking_count', coalesce(booking_counts.total, 0),
        'future_booking_count', coalesce(booking_counts.future_total, 0),
        'ticket_count', coalesce(ticket_counts.total, 0),
        'last_activity_at', greatest(
          patient_profiles.updated_at,
          coalesce(booking_counts.last_activity_at, patient_profiles.updated_at),
          coalesce(ticket_counts.last_activity_at, patient_profiles.updated_at)
        ),
        'created_at', patient_profiles.created_at,
        'updated_at', patient_profiles.updated_at
      )
      into v_record
      from public.patient_profiles
      left join public.profiles
        on profiles.id = patient_profiles.user_id
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (where bookings.starts_at >= now())::integer
            as future_total,
          max(bookings.updated_at) as last_activity_at
        from public.bookings
        where bookings.patient_profile_id = patient_profiles.id
      ) booking_counts on true
      left join lateral (
        select
          count(*)::integer as total,
          max(support_tickets.updated_at) as last_activity_at
        from public.support_tickets
        where support_tickets.requester_profile_id = patient_profiles.user_id
      ) ticket_counts on true
      where patient_profiles.id = p_id;

    when 'sessions' then
      v_audit_entity_type := 'booking';

      select jsonb_build_object(
        'id', bookings.id,
        'status', bookings.status,
        'payment_status', bookings.payment_status,
        'starts_at', bookings.starts_at,
        'ends_at', bookings.ends_at,
        'timezone', bookings.timezone,
        'service_title_snapshot', bookings.service_title_snapshot,
        'service_duration_minutes_snapshot',
          bookings.service_duration_minutes_snapshot,
        'therapist_profile_id', bookings.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'patient_profile_id', bookings.patient_profile_id,
        'patient_name', patient_profiles.display_name,
        'meeting_provider', bookings.meeting_provider,
        'cancelled_at', bookings.cancelled_at,
        'completed_at', bookings.completed_at,
        'created_at', bookings.created_at,
        'updated_at', bookings.updated_at,
        'video_session', video_session_detail.payload
      )
      into v_record
      from public.bookings
      left join public.therapist_profiles
        on therapist_profiles.id = bookings.therapist_profile_id
      left join public.patient_profiles
        on patient_profiles.id = bookings.patient_profile_id
      left join lateral (
        select jsonb_build_object(
          'provider', video_sessions.provider,
          'environment', video_sessions.environment,
          'status', video_sessions.status,
          'scheduled_starts_at', video_sessions.scheduled_starts_at,
          'scheduled_ends_at', video_sessions.scheduled_ends_at,
          'actual_started_at', video_sessions.actual_started_at,
          'actual_ended_at', video_sessions.actual_ended_at,
          'hard_ends_at', video_sessions.hard_ends_at,
          'therapist_token_issued_at', video_sessions.therapist_token_issued_at,
          'therapist_first_joined_at', video_sessions.therapist_first_joined_at,
          'therapist_last_joined_at', video_sessions.therapist_last_joined_at,
          'therapist_last_left_at', video_sessions.therapist_last_left_at,
          'therapist_present', video_sessions.therapist_present,
          'participant_count', video_sessions.participant_count,
          'last_participant_left_at', video_sessions.last_participant_left_at,
          'last_provider_event_at', video_sessions.last_provider_event_at,
          'termination_reason', video_sessions.termination_reason,
          'termination_requested_at', video_sessions.termination_requested_at,
          'termination_confirmed_at', video_sessions.termination_confirmed_at,
          'last_error_code', video_sessions.last_error_code,
          'last_synced_at', video_sessions.last_synced_at,
          'participations', coalesce(participation_rows.rows, '[]'::jsonb),
          'control_jobs', coalesce(job_rows.rows, '[]'::jsonb)
        ) as payload
        from public.video_sessions
        left join lateral (
          select coalesce(
            jsonb_agg(participation_payload order by event_at desc),
            '[]'::jsonb
          ) as rows
          from (
            select
              coalesce(
                video_session_participations.left_at,
                video_session_participations.joined_at,
                video_session_participations.created_at
              ) as event_at,
              jsonb_build_object(
                'participant_role', video_session_participations.participant_role,
                'event_type', video_session_participations.event_type,
                'joined_at', video_session_participations.joined_at,
                'left_at', video_session_participations.left_at,
                'duration_seconds', video_session_participations.duration_seconds,
                'created_at', video_session_participations.created_at
              ) as participation_payload
            from public.video_session_participations
            where video_session_participations.video_session_id = video_sessions.id
            order by coalesce(
              video_session_participations.left_at,
              video_session_participations.joined_at,
              video_session_participations.created_at
            ) desc
            limit 20
          ) sanitized_participations
        ) participation_rows on true
        left join lateral (
          select coalesce(
            jsonb_agg(job_payload order by created_at desc),
            '[]'::jsonb
          ) as rows
          from (
            select
              video_session_control_jobs.created_at,
              jsonb_build_object(
                'environment', video_session_control_jobs.environment,
                'operation', video_session_control_jobs.operation,
                'status', video_session_control_jobs.status,
                'attempts', video_session_control_jobs.attempts,
                'max_attempts', video_session_control_jobs.max_attempts,
                'next_run_at', video_session_control_jobs.next_run_at,
                'locked_until_at', video_session_control_jobs.locked_until_at,
                'last_error_code', video_session_control_jobs.last_error_code,
                'completed_at', video_session_control_jobs.completed_at,
                'created_at', video_session_control_jobs.created_at,
                'updated_at', video_session_control_jobs.updated_at
              ) as job_payload
            from public.video_session_control_jobs
            where video_session_control_jobs.video_session_id = video_sessions.id
            order by video_session_control_jobs.created_at desc
            limit 20
          ) sanitized_jobs
        ) job_rows on true
        where video_sessions.booking_id = bookings.id
      ) video_session_detail on true
      where bookings.id = p_id;

    when 'support' then
      v_audit_entity_type := 'support_ticket';

      select jsonb_build_object(
        'id', support_tickets.id,
        'subject', support_tickets.subject,
        'category', support_tickets.category,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency,
        'source', support_tickets.source,
        'booking_id', support_tickets.booking_id,
        'requester_profile_id', support_tickets.requester_profile_id,
        'requester_role', profiles.role,
        'requester_name', profiles.display_name,
        'created_at', support_tickets.created_at,
        'updated_at', support_tickets.updated_at
      )
      into v_record
      from public.support_tickets
      left join public.profiles
        on profiles.id = support_tickets.requester_profile_id
      where support_tickets.id = p_id;

    when 'reviews' then
      v_audit_entity_type := 'review';

      select jsonb_build_object(
        'id', reviews.id,
        'rating', reviews.rating,
        'status', reviews.status,
        'moderation_reason', reviews.moderation_reason,
        'published_at', reviews.published_at,
        'therapist_profile_id', reviews.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'patient_profile_id', reviews.patient_profile_id,
        'booking_id', reviews.booking_id,
        'created_at', reviews.created_at,
        'updated_at', reviews.updated_at
      )
      into v_record
      from public.reviews
      left join public.therapist_profiles
        on therapist_profiles.id = reviews.therapist_profile_id
      where reviews.id = p_id;

    when 'verifications' then
      v_audit_entity_type := 'therapist_verification';

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'therapist_profile_id', therapist_verifications.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'status', therapist_verifications.status,
        'changes_requested_present',
          nullif(btrim(coalesce(therapist_verifications.changes_requested, '')), '')
            is not null,
        'rejection_reason_present',
          nullif(btrim(coalesce(therapist_verifications.rejection_reason, '')), '')
            is not null,
        'reviewed_by', therapist_verifications.reviewed_by,
        'reviewed_at', therapist_verifications.reviewed_at,
        'submitted_at', therapist_verifications.submitted_at,
        'created_at', therapist_verifications.created_at,
        'updated_at', therapist_verifications.updated_at
      )
      into v_record
      from public.therapist_verifications
      left join public.therapist_profiles
        on therapist_profiles.id =
          therapist_verifications.therapist_profile_id
      where therapist_verifications.id = p_id;

    else
      raise exception 'unsupported admin operation module: %', p_module
        using errcode = '22023';
  end case;

  if v_record is null then
    return jsonb_build_object(
      'auditEvents', '[]'::jsonb,
      'generatedAt', now(),
      'id', p_id,
      'module', p_module,
      'record', null
    );
  end if;

  select coalesce(jsonb_agg(event_payload order by created_at desc), '[]'::jsonb)
  into v_audit_events
  from (
    select
      admin_audit_events.created_at,
      jsonb_build_object(
        'id', admin_audit_events.id,
        'action', admin_audit_events.action,
        'actor_role', admin_audit_events.actor_role,
        'permission', admin_audit_events.permission,
        'reason', admin_audit_events.reason,
        'source', admin_audit_events.source,
        'created_at', admin_audit_events.created_at
      ) as event_payload
    from public.admin_audit_events
    where admin_audit_events.entity_type = v_audit_entity_type
      and admin_audit_events.entity_id = p_id::text
    order by admin_audit_events.created_at desc
    limit 8
  ) events;

  return jsonb_build_object(
    'auditEvents', coalesce(v_audit_events, '[]'::jsonb),
    'generatedAt', now(),
    'id', p_id,
    'module', p_module,
    'record', v_record
  );
end;
$$;

revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) from public;
revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from public;
grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;
grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;

revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

comment on function public.admin_get_operation_detail_v1(text, uuid) is
  'Minimized admin operation detail read model. Validates auth.uid() as admin and returns safe operational DTOs plus sanitized audit event summaries, including Zoom lifecycle aggregates for session details.';

commit;
