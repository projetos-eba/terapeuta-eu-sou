-- Keep therapy-catalog request payloads bounded consistently with the therapist form.
-- Existing requests are preserved; an over-limit legacy request must be adjusted before resubmission.

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
  v_aliases text := nullif(trim(coalesce(v_submission->>'aliases', '')), '');
  v_description text := nullif(trim(coalesce(v_submission->>'description', '')), '');
  v_objective text := nullif(trim(coalesce(v_submission->>'objective', '')), '');
  v_use_cases text := nullif(trim(coalesce(v_submission->>'useCases', '')), '');
  v_process text := nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '');
  v_training_description text := nullif(trim(coalesce(v_submission->>'trainingDescription', '')), '');
  v_practice_duration text := nullif(trim(coalesce(v_submission->>'practiceDuration', '')), '');
  v_safety_notes text := nullif(trim(coalesce(v_submission->>'safetyNotes', '')), '');
  v_reference_url text := nullif(trim(coalesce(v_submission->>'referenceUrl', '')), '');
  v_additional_information text := nullif(trim(coalesce(v_submission->>'additionalInformation', '')), '');
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_count integer := 0;
begin
  select * into v_profile
  from public.profiles
  where id = p_actor_user_id and role = 'therapist';

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

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) value
  ), validated as (
    select distinct id_text::uuid as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce(array_agg(theme.id order by theme.sort_order, theme.name), '{}'::uuid[]),
    coalesce(array_agg(theme.name order by theme.sort_order, theme.name), '{}'::text[]),
    count(theme.id)::integer
  into v_theme_input_count, v_theme_ids, v_theme_names, v_valid_theme_count
  from validated
  join public.matching_themes theme on theme.id = validated.id and theme.is_active;

  if p_request_id is null
    or char_length(v_name) not between 2 and 30
    or v_description is null or char_length(v_description) > 600
    or v_objective is null or char_length(v_objective) > 180
    or v_use_cases is null or char_length(v_use_cases) > 600
    or v_process is null or char_length(v_process) > 800
    or (v_aliases is not null and char_length(v_aliases) > 80)
    or (v_training_description is not null and char_length(v_training_description) > 120)
    or (v_practice_duration is not null and char_length(v_practice_duration) > 50)
    or (v_safety_notes is not null and char_length(v_safety_notes) > 600)
    or (v_reference_url is not null and char_length(v_reference_url) > 500)
    or (v_additional_information is not null and char_length(v_additional_information) > 500)
    or v_theme_input_count not between 1 and 3
    or v_valid_theme_count <> v_theme_input_count then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
  v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);

  select id into v_therapist_profile_id
  from public.therapist_profiles
  where user_id = p_actor_user_id
  limit 1;

  insert into public.therapy_catalog_requests (
    requester_profile_id, requester_therapist_profile_id, client_request_id,
    informed_name, description, justification, submission, submission_version, status
  ) values (
    p_actor_user_id, v_therapist_profile_id, p_request_id,
    v_name, v_description, v_objective, v_submission, 2, 'submitted'
  )
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, next_state, request_id
  ) values (
    v_profile.id, v_profile.role, 'therapy_catalog_request', v_request.id,
    'therapy_request_submitted',
    jsonb_build_object('status', 'submitted', 'informedName', v_name), p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id, 'therapy_catalog_request', 'Solicitação recebida',
    'Recebemos sua sugestão de terapia. Você será avisado quando houver uma atualização.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2, 'idempotentReplay', false,
    'requestId', v_request.id, 'status', v_request.status
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
  v_aliases text := nullif(trim(coalesce(v_submission->>'aliases', '')), '');
  v_description text := nullif(trim(coalesce(v_submission->>'description', '')), '');
  v_objective text := nullif(trim(coalesce(v_submission->>'objective', '')), '');
  v_use_cases text := nullif(trim(coalesce(v_submission->>'useCases', '')), '');
  v_process text := nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '');
  v_training_description text := nullif(trim(coalesce(v_submission->>'trainingDescription', '')), '');
  v_practice_duration text := nullif(trim(coalesce(v_submission->>'practiceDuration', '')), '');
  v_safety_notes text := nullif(trim(coalesce(v_submission->>'safetyNotes', '')), '');
  v_reference_url text := nullif(trim(coalesce(v_submission->>'referenceUrl', '')), '');
  v_additional_information text := nullif(trim(coalesce(v_submission->>'additionalInformation', '')), '');
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_count integer := 0;
begin
  select * into v_request
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
    and requester_profile_id = p_actor_user_id
  for update;

  if v_request.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.therapy_catalog_events event
    where event.entity_type = 'therapy_catalog_request'
      and event.entity_id = v_request.id
      and event.event_type = 'therapy_request_resubmitted'
      and event.request_id = p_request_id
  ) then
    return jsonb_build_object(
      'contractVersion', 2, 'idempotentReplay', true,
      'requestId', v_request.id, 'status', v_request.status
    );
  end if;

  if v_request.status <> 'needs_information' then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_EDITABLE';
  end if;

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) value
  ), validated as (
    select distinct id_text::uuid as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce(array_agg(theme.id order by theme.sort_order, theme.name), '{}'::uuid[]),
    coalesce(array_agg(theme.name order by theme.sort_order, theme.name), '{}'::text[]),
    count(theme.id)::integer
  into v_theme_input_count, v_theme_ids, v_theme_names, v_valid_theme_count
  from validated
  join public.matching_themes theme on theme.id = validated.id and theme.is_active;

  if p_request_id is null
    or char_length(v_name) not between 2 and 30
    or v_description is null or char_length(v_description) > 600
    or v_objective is null or char_length(v_objective) > 180
    or v_use_cases is null or char_length(v_use_cases) > 600
    or v_process is null or char_length(v_process) > 800
    or (v_aliases is not null and char_length(v_aliases) > 80)
    or (v_training_description is not null and char_length(v_training_description) > 120)
    or (v_practice_duration is not null and char_length(v_practice_duration) > 50)
    or (v_safety_notes is not null and char_length(v_safety_notes) > 600)
    or (v_reference_url is not null and char_length(v_reference_url) > 500)
    or (v_additional_information is not null and char_length(v_additional_information) > 500)
    or v_theme_input_count not between 1 and 3
    or v_valid_theme_count <> v_theme_input_count then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
  v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);

  update public.therapy_catalog_requests
  set
    informed_name = v_name,
    description = v_description,
    justification = v_objective,
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
    p_actor_user_id, 'therapist', 'therapy_catalog_request', v_request.id,
    'therapy_request_resubmitted', jsonb_build_object('status', 'needs_information'),
    jsonb_build_object('status', 'submitted'), p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id, 'therapy_catalog_request', 'Solicitação atualizada',
    'Recebemos as informações adicionais da sua sugestão de terapia.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2, 'idempotentReplay', false,
    'requestId', v_request.id, 'status', v_request.status
  );
end;
$$;

revoke all on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)
  to service_role;
grant execute on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid)
  to service_role;
