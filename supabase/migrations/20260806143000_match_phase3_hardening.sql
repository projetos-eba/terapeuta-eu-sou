create index if not exists therapy_matching_themes_therapy_theme_idx
  on public.therapy_matching_themes (therapy_id, theme_id);

create index if not exists therapist_services_therapy_status_idx
  on public.therapist_services (therapy_id, status, id);

create or replace function public.admin_replace_therapy_matching_themes_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_therapy_id uuid,
  p_theme_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_theme_count integer;
  v_previous_state jsonb;
  v_next_state jsonb;
  v_removed_theme_ids uuid[];
  v_affected_service_count integer;
  v_affected_theme_link_count integer;
  v_affected_interest_count integer;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  if p_request_id is null or p_therapy_id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_PAYLOAD';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'ADMIN_THERAPY_CATALOG_REASON_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.therapies
    where id = p_therapy_id
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
  end if;

  select count(distinct theme_id)::integer
    into v_theme_count
  from unnest(coalesce(p_theme_ids, '{}'::uuid[])) as theme_id
  join public.matching_themes
    on matching_themes.id = theme_id
    and matching_themes.is_active = true;

  if v_theme_count < 1 or v_theme_count > 3 then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT';
  end if;

  if v_theme_count <> coalesce(array_length(p_theme_ids, 1), 0) then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('themeId', theme_id, 'sortOrder', sort_order) order by sort_order),
    '[]'::jsonb
  )
    into v_previous_state
  from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

  select coalesce(array_agg(previous_theme.theme_id), '{}'::uuid[])
    into v_removed_theme_ids
  from public.therapy_matching_themes as previous_theme
  where previous_theme.therapy_id = p_therapy_id
    and previous_theme.theme_id <> all(coalesce(p_theme_ids, '{}'::uuid[]));

  if cardinality(v_removed_theme_ids) > 0 then
    select count(distinct service.id)::integer,
           count(distinct service_theme.theme_id)::integer,
           count(distinct service_interest.interest_id)::integer
      into v_affected_service_count,
           v_affected_theme_link_count,
           v_affected_interest_count
    from public.therapist_services as service
    left join public.therapist_service_matching_themes as service_theme
      on service_theme.therapist_service_id = service.id
      and service_theme.theme_id = any(v_removed_theme_ids)
    left join public.therapist_service_matching_interests as service_interest
      on service_interest.therapist_service_id = service.id
    left join public.matching_interests as interest
      on interest.id = service_interest.interest_id
      and interest.theme_id = any(v_removed_theme_ids)
    where service.therapy_id = p_therapy_id
      and service.status in ('draft', 'active', 'paused')
      and (
        service_theme.theme_id is not null
        or interest.id is not null
      );

    if coalesce(v_affected_service_count, 0) > 0 then
      insert into public.therapy_catalog_events (
        actor_profile_id,
        actor_role,
        entity_type,
        entity_id,
        event_type,
        previous_state,
        next_state,
        reason,
        request_id,
        metadata
      )
      values (
        v_actor.id,
        v_actor.role,
        'therapy',
        p_therapy_id,
        'therapy_matching_theme_removal_blocked',
        v_previous_state,
        jsonb_build_object('themeIds', coalesce(to_jsonb(p_theme_ids), '[]'::jsonb)),
        nullif(p_reason, ''),
        p_request_id,
        jsonb_build_object(
          'source', 'match_phase3_hardening',
          'removedThemeIds', to_jsonb(v_removed_theme_ids),
          'affectedServiceCount', v_affected_service_count,
          'affectedThemeLinkCount', v_affected_theme_link_count,
          'affectedInterestCount', v_affected_interest_count
        )
      );

      raise exception 'ADMIN_THERAPY_CATALOG_MATCHING_THEME_REMOVAL_BLOCKED';
    end if;
  end if;

  delete from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

  insert into public.therapy_matching_themes (
    therapy_id,
    theme_id,
    sort_order
  )
  select
    p_therapy_id,
    theme_id,
    ordinality::integer
  from unnest(p_theme_ids) with ordinality as themes(theme_id, ordinality);

  select coalesce(
    jsonb_agg(jsonb_build_object('themeId', theme_id, 'sortOrder', sort_order) order by sort_order),
    '[]'::jsonb
  )
    into v_next_state
  from public.therapy_matching_themes
  where therapy_id = p_therapy_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id,
    metadata
  )
  values (
    v_actor.id,
    v_actor.role,
    'therapy',
    p_therapy_id,
    'therapy_matching_themes_replaced',
    v_previous_state,
    v_next_state,
    nullif(p_reason, ''),
    p_request_id,
    jsonb_build_object(
      'source', 'match_phase3_hardening',
      'removedThemeIds', to_jsonb(v_removed_theme_ids)
    )
  );

  return public.admin_list_therapy_catalog_v1(p_actor_user_id);
end;
$$;
