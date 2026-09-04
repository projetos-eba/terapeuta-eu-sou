-- Restoring an archived therapist service must clear the archival marker.
-- The existing activate command is also the authoritative unarchive transition.
create or replace function public.transition_therapist_service_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_service_id uuid,
  p_expected_version bigint,
  p_action text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_service public.therapist_services%rowtype;
  v_previous_status public.service_status;
  v_next_status public.service_status;
  v_event_type text;
  v_payload_hash text := encode(
    extensions.digest(
      jsonb_build_object(
        'serviceId', p_service_id,
        'expectedVersion', p_expected_version,
        'action', p_action
      )::text,
      'sha256'
    ),
    'hex'
  );
  v_response jsonb;
begin
  if p_action not in ('activate', 'pause', 'archive') then
    raise exception 'THERAPIST_SERVICE_INVALID_ACTION' using errcode = 'P0001';
  end if;

  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  v_response := public.get_therapist_service_request_replay_v1(
    v_therapist.id,
    p_request_id,
    p_action,
    v_payload_hash
  );

  if v_response is not null then
    return v_response;
  end if;

  select *
    into v_service
  from public.therapist_services
  where id = p_service_id
    and therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'THERAPIST_SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_service.version <> p_expected_version then
    raise exception 'THERAPIST_SERVICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  v_previous_status := v_service.status;

  if p_action = 'activate' then
    perform public.validate_platform_therapy_for_service_v1(v_service.therapy_id);
    perform public.ensure_therapist_service_limit_v1(
      v_therapist.id,
      v_therapist.plan,
      v_service.id
    );
    perform public.ensure_no_duplicate_therapist_service_v1(
      v_therapist.id,
      v_service.therapy_id,
      v_service.id
    );
    v_next_status := 'active';
    v_event_type := 'service_activated';
  elsif p_action = 'pause' then
    v_next_status := 'paused';
    v_event_type := 'service_paused';
  else
    v_next_status := 'archived';
    v_event_type := 'service_archived';
  end if;

  update public.therapist_services
  set
    status = v_next_status,
    is_bookable = p_action = 'activate',
    archived_at = case
      when p_action = 'archive' then now()
      when p_action = 'activate' and v_previous_status = 'archived' then null
      else archived_at
    end,
    updated_at = now()
  where id = v_service.id
  returning * into v_service;

  insert into public.therapist_service_events (
    therapist_profile_id,
    service_id,
    actor_user_id,
    event_type,
    request_id,
    previous_status,
    next_status,
    previous_version,
    resulting_version
  )
  values (
    v_therapist.id,
    v_service.id,
    p_actor_user_id,
    v_event_type,
    p_request_id,
    v_previous_status,
    v_service.status,
    p_expected_version,
    v_service.version
  );

  v_response := jsonb_build_object(
    'contractVersion', 1,
    'idempotentReplay', false,
    'service', public.service_row_to_private_json_v1(v_service.id)
  );

  return public.store_therapist_service_request_v1(
    v_therapist.id,
    p_request_id,
    p_action,
    v_payload_hash,
    v_service.id,
    v_response
  );
end;
$$;

comment on function public.transition_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) is
  'Transiciona servicos do terapeuta; ativar um servico arquivado tambem remove archived_at.';
