create or replace function public.submit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_therapist_profile_id uuid;
  v_existing public.therapy_catalog_requests;
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
  v_category_text text := nullif(trim(coalesce(p_payload->>'suggestedCategoryId', '')), '');
  v_category_id uuid;
  v_description text := nullif(trim(coalesce(v_submission->>'description', '')), '');
  v_objective text := nullif(trim(coalesce(v_submission->>'objective', '')), '');
  v_use_cases text := nullif(trim(coalesce(v_submission->>'useCases', '')), '');
  v_process text := nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '');
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_uuid_count integer := 0;
  v_theme_has_invalid boolean := false;
begin
  select * into v_profile
  from public.profiles
  where id = p_actor_user_id
    and role = 'therapist';

  if v_profile.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED';
  end if;

  select * into v_existing
  from public.therapy_catalog_requests
  where requester_profile_id = p_actor_user_id
    and client_request_id = p_request_id;

  if v_existing.id is not null then
    return jsonb_build_object(
      'contractVersion', 2,
      'idempotentReplay', true,
      'requestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  if v_category_text is not null then
    if v_category_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
    end if;

    v_category_id := v_category_text::uuid;
  end if;

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) as value
  ),
  validated as (
    select distinct case
      when id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then id_text::uuid
    end as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce((select array_agg(id) from validated), '{}'::uuid[]),
    (select count(*) from validated),
    exists (
      select 1
      from raw
      where id_text = ''
        or id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  into
    v_theme_input_count,
    v_theme_ids,
    v_valid_theme_uuid_count,
    v_theme_has_invalid;

  if p_request_id is null
    or char_length(v_name) < 2
    or char_length(v_name) > 120
    or v_description is null
    or v_objective is null
    or v_use_cases is null
    or v_process is null
    or v_theme_input_count > 3
    or v_theme_has_invalid
    or (v_theme_input_count > 0 and v_valid_theme_uuid_count <> v_theme_input_count)
    or (v_theme_input_count = 0 and v_category_id is null) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  if v_theme_input_count > 0 then
    select
      coalesce(
        array_agg(theme.id order by theme.sort_order asc, theme.name asc),
        '{}'::uuid[]
      ),
      coalesce(
        array_agg(theme.name order by theme.sort_order asc, theme.name asc),
        '{}'::text[]
      )
    into
      v_theme_ids,
      v_theme_names
    from public.matching_themes as theme
    where theme.id = any(v_theme_ids)
      and theme.is_active = true;

    if coalesce(array_length(v_theme_ids, 1), 0) <> v_theme_input_count then
      raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
    end if;

    v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
    v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);
    v_category_id := null;
  elsif not exists (
    select 1 from public.therapy_categories
    where id = v_category_id and is_active = true
  ) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_CATEGORY';
  end if;

  select id into v_therapist_profile_id
  from public.therapist_profiles
  where user_id = p_actor_user_id
  limit 1;

  insert into public.therapy_catalog_requests (
    requester_profile_id,
    requester_therapist_profile_id,
    client_request_id,
    informed_name,
    description,
    suggested_category_id,
    justification,
    submission,
    submission_version,
    status
  ) values (
    p_actor_user_id,
    v_therapist_profile_id,
    p_request_id,
    v_name,
    v_description,
    v_category_id,
    v_objective,
    v_submission,
    2,
    'submitted'
  )
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, next_state, request_id
  ) values (
    v_profile.id,
    v_profile.role,
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_submitted',
    jsonb_build_object('status', 'submitted', 'informedName', v_name),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação recebida',
    'Recebemos sua sugestão de terapia. Você será avisado quando houver uma atualização.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2,
    'idempotentReplay', false,
    'requestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

create or replace function public.resubmit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_catalog_request_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
  v_category_text text := nullif(trim(coalesce(p_payload->>'suggestedCategoryId', '')), '');
  v_category_id uuid;
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_uuid_count integer := 0;
  v_theme_has_invalid boolean := false;
begin
  select * into v_request
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
    and requester_profile_id = p_actor_user_id
  for update;

  if v_request.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'needs_information' then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_EDITABLE';
  end if;

  if v_category_text is not null then
    if v_category_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
    end if;

    v_category_id := v_category_text::uuid;
  end if;

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) as value
  ),
  validated as (
    select distinct case
      when id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then id_text::uuid
    end as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce((select array_agg(id) from validated), '{}'::uuid[]),
    (select count(*) from validated),
    exists (
      select 1
      from raw
      where id_text = ''
        or id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  into
    v_theme_input_count,
    v_theme_ids,
    v_valid_theme_uuid_count,
    v_theme_has_invalid;

  if p_request_id is null
    or char_length(v_name) < 2
    or char_length(v_name) > 120
    or nullif(trim(coalesce(v_submission->>'description', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'objective', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'useCases', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '') is null
    or v_theme_input_count > 3
    or v_theme_has_invalid
    or (v_theme_input_count > 0 and v_valid_theme_uuid_count <> v_theme_input_count)
    or (v_theme_input_count = 0 and v_category_id is null) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  if v_theme_input_count > 0 then
    select
      coalesce(
        array_agg(theme.id order by theme.sort_order asc, theme.name asc),
        '{}'::uuid[]
      ),
      coalesce(
        array_agg(theme.name order by theme.sort_order asc, theme.name asc),
        '{}'::text[]
      )
    into
      v_theme_ids,
      v_theme_names
    from public.matching_themes as theme
    where theme.id = any(v_theme_ids)
      and theme.is_active = true;

    if coalesce(array_length(v_theme_ids, 1), 0) <> v_theme_input_count then
      raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
    end if;

    v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
    v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);
    v_category_id := null;
  elsif not exists (
    select 1 from public.therapy_categories
    where id = v_category_id and is_active = true
  ) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_CATEGORY';
  end if;

  update public.therapy_catalog_requests
  set
    informed_name = v_name,
    description = nullif(trim(coalesce(v_submission->>'description', '')), ''),
    suggested_category_id = v_category_id,
    justification = nullif(trim(coalesce(v_submission->>'objective', '')), ''),
    submission = v_submission,
    submission_version = 2,
    status = 'submitted',
    decision = null,
    resubmitted_at = now(),
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, previous_state, next_state, request_id
  ) values (
    p_actor_user_id,
    'therapist',
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_resubmitted',
    jsonb_build_object('status', 'needs_information'),
    jsonb_build_object('status', 'submitted'),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação atualizada',
    'Recebemos as informações adicionais da sua sugestão de terapia.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object('contractVersion', 2, 'requestId', v_request.id, 'status', v_request.status);
end;
$$;

do $$
begin
  execute replace(
    pg_get_functiondef('public.get_therapist_metrics_overview_v1(integer)'::regprocedure),
    'if p_period_days not in (30, 90) then',
    'if p_period_days not in (30, 60, 90, 120) then'
  );

  execute replace(
    pg_get_functiondef('public.get_therapist_session_metrics_v1(integer)'::regprocedure),
    'if p_period_days not in (30, 90) then',
    'if p_period_days not in (30, 60, 90, 120) then'
  );

  execute replace(
    pg_get_functiondef('public.get_therapist_interest_metrics_v1(integer)'::regprocedure),
    'if p_period_days not in (30, 90) then',
    'if p_period_days not in (30, 60, 90, 120) then'
  );

  execute replace(
    pg_get_functiondef('public.get_therapist_occupancy_metrics_v2(uuid, text, integer)'::regprocedure),
    'if p_period_days not in (30, 90) then',
    'if p_period_days not in (30, 60, 90, 120) then'
  );

  execute replace(
    pg_get_functiondef('public.get_therapist_metrics_dashboard_v2(integer)'::regprocedure),
    'if p_period_days not in (30, 90) then',
    'if p_period_days not in (30, 60, 90, 120) then'
  );
end;
$$;
