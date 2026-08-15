-- Administrative publication is an explicit, audited lifecycle command.
-- It may enable only the public switches that are intentionally excluded from
-- its readiness precondition; all other publication criteria remain mandatory.

create or replace function public.admin_execute_professional_lifecycle_command_v1(
  p_action text, p_entity_id uuid, p_reason text, p_request_id text,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_audit_id uuid;
  v_entity_type text;
  v_permission text;
  v_previous jsonb;
  v_next jsonb;
  v_replay record;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_id text := nullif(btrim(coalesce(p_request_id, '')), '');
  v_verification public.therapist_verifications%rowtype;
  v_profile public.therapist_profiles%rowtype;
  v_eligibility jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required' using errcode = '42501';
  end if;
  if p_entity_id is null then
    raise exception 'admin command entity id required' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 8 then
    raise exception 'admin command reason must have at least 8 characters' using errcode = '22023';
  end if;
  if v_request_id is null then
    raise exception 'admin command request_id required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_actor_id
      and role = 'admin'::public.user_role
      and auth_deleted_at is null
      and anonymized_at is null
  ) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  if p_action in ('professional.suspend', 'professional.reactivate', 'professional.publish') then
    v_entity_type := 'therapist_profile';
    v_permission := case
      when p_action = 'professional.publish' then 'admin.professionals.verify'
      else 'admin.professionals.suspend'
    end;
  elsif p_action in (
    'verification.approve', 'verification.reject', 'verification.request_changes',
    'verification.pause_review', 'verification.reopen_review'
  ) then
    v_entity_type := 'therapist_verification';
    v_permission := 'admin.professionals.verify';
  else
    raise exception 'unsupported professional lifecycle command: %', p_action using errcode = '22023';
  end if;

  select id, entity_id, previous_state, next_state into v_replay
  from public.admin_audit_events
  where source = 'admin-operation-command'
    and request_id = v_request_id
    and action = p_action
    and entity_type = v_entity_type
  limit 1;

  if found then
    if v_replay.entity_id <> p_entity_id::text then
      raise exception 'admin command request_id reused for a different target' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'ok', true, 'idempotentReplay', true, 'auditEventId', v_replay.id,
      'entityId', p_entity_id, 'entityType', v_entity_type,
      'previousState', v_replay.previous_state, 'nextState', v_replay.next_state,
      'permission', v_permission
    );
  end if;

  if v_entity_type = 'therapist_profile' then
    select * into v_profile from public.therapist_profiles where id = p_entity_id for update;
    if not found then raise exception 'admin command target not found' using errcode = 'P0002'; end if;

    v_previous := jsonb_build_object(
      'id', v_profile.id, 'status', v_profile.status,
      'public_status', v_profile.public_status, 'is_public', v_profile.is_public,
      'is_accepting_bookings', v_profile.is_accepting_bookings
    );

    if p_action = 'professional.suspend' then
      update public.therapist_profiles
      set status = 'suspended', public_status = 'suspended', is_public = false,
          is_accepting_bookings = false,
          metadata = jsonb_set(jsonb_set(coalesce(metadata, '{}'::jsonb), '{adminSuspensionReason}', to_jsonb(v_reason), true), '{adminSuspendedAt}', to_jsonb(now()), true),
          updated_at = now()
      where id = p_entity_id
      returning * into v_profile;
    elsif p_action = 'professional.reactivate' then
      if v_profile.status <> 'suspended' then
        raise exception 'only suspended professionals can be reactivated' using errcode = '22023';
      end if;
      update public.therapist_profiles
      set status = 'approved', public_status = 'unpublished', is_public = false,
          is_accepting_bookings = false,
          metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{adminReactivatedAt}', to_jsonb(now()), true),
          updated_at = now()
      where id = p_entity_id
      returning * into v_profile;
    else
      if v_profile.status <> 'approved' or v_profile.public_status = 'suspended' then
        raise exception 'only approved non-suspended professionals can be published' using errcode = '22023';
      end if;

      v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
      if exists (
        select 1
        from jsonb_array_elements_text(coalesce(v_eligibility -> 'blockers', '[]'::jsonb)) as blocker(code)
        where blocker.code not in ('profile_not_published', 'profile_not_public', 'not_accepting_bookings')
      ) then
        raise exception 'profile does not meet the publication criteria' using errcode = '22023';
      end if;

      update public.therapist_profiles
      set public_status = 'published', is_public = true, is_accepting_bookings = true,
          updated_at = now()
      where id = p_entity_id
      returning * into v_profile;
    end if;

    v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
    v_next := jsonb_build_object(
      'id', v_profile.id, 'status', v_profile.status,
      'public_status', v_profile.public_status, 'is_public', v_profile.is_public,
      'is_accepting_bookings', v_profile.is_accepting_bookings,
      'publicationEligibility', v_eligibility
    );
  else
    select * into v_verification from public.therapist_verifications where id = p_entity_id for update;
    if not found then raise exception 'admin command target not found' using errcode = 'P0002'; end if;
    select * into v_profile from public.therapist_profiles where id = v_verification.therapist_profile_id for update;

    v_previous := jsonb_build_object(
      'id', v_verification.id, 'status', v_verification.status,
      'therapist_profile_id', v_verification.therapist_profile_id,
      'profile_status', v_profile.status,
      'publicationEligibility', public.get_therapist_publication_eligibility_v1(v_profile.id)
    );

    if p_action = 'verification.reopen_review' then
      if v_verification.status not in ('submitted', 'changes_requested', 'rejected') then
        raise exception 'verification cannot enter review from its current status' using errcode = '22023';
      end if;
      update public.therapist_verifications
      set status = 'in_review', reviewed_by = v_actor_id,
          reviewed_at = coalesce(reviewed_at, now()), updated_at = now()
      where id = p_entity_id returning * into v_verification;
      update public.therapist_profiles set status = 'in_review', updated_at = now()
      where id = v_profile.id and status <> 'suspended' returning * into v_profile;
    elsif p_action in ('verification.request_changes', 'verification.pause_review') then
      if v_verification.status <> 'in_review' then
        raise exception 'verification must be in review before requesting changes' using errcode = '22023';
      end if;
      update public.therapist_verifications
      set status = 'changes_requested', reviewed_by = v_actor_id, reviewed_at = now(),
          changes_requested = v_reason, updated_at = now()
      where id = p_entity_id returning * into v_verification;
      update public.therapist_profiles
      set status = 'changes_requested', public_status = 'unpublished', is_public = false,
          is_accepting_bookings = false, updated_at = now()
      where id = v_profile.id and status <> 'suspended' returning * into v_profile;
    elsif p_action = 'verification.approve' then
      if v_verification.status <> 'in_review' then
        raise exception 'verification must be in review before approval' using errcode = '22023';
      end if;
      update public.therapist_verifications
      set status = 'approved', reviewed_by = v_actor_id, reviewed_at = now(),
          changes_requested = null, rejection_reason = null, updated_at = now()
      where id = p_entity_id returning * into v_verification;
      update public.therapist_profiles set status = 'approved', updated_at = now()
      where id = v_profile.id and status <> 'suspended' returning * into v_profile;
    else
      if v_verification.status <> 'in_review' then
        raise exception 'verification must be in review before rejection' using errcode = '22023';
      end if;
      update public.therapist_verifications
      set status = 'rejected', reviewed_by = v_actor_id, reviewed_at = now(),
          rejection_reason = v_reason, updated_at = now()
      where id = p_entity_id returning * into v_verification;
      update public.therapist_profiles
      set status = 'rejected', public_status = 'unpublished', is_public = false,
          is_accepting_bookings = false, updated_at = now()
      where id = v_profile.id and status <> 'suspended' returning * into v_profile;
    end if;

    v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
    v_next := jsonb_build_object(
      'id', v_verification.id, 'status', v_verification.status,
      'therapist_profile_id', v_verification.therapist_profile_id,
      'profile_status', v_profile.status, 'publicationEligibility', v_eligibility
    );
  end if;

  v_audit_id := public.record_admin_audit_event_v1(
    v_actor_id, 'admin', v_permission, p_action, v_entity_type, p_entity_id::text,
    v_previous, v_next, v_reason, v_request_id, p_correlation_id,
    'admin-operation-command'
  );

  return jsonb_build_object(
    'ok', true, 'idempotentReplay', false, 'auditEventId', v_audit_id,
    'entityId', p_entity_id, 'entityType', v_entity_type,
    'previousState', v_previous, 'nextState', v_next, 'permission', v_permission
  );
end;
$$;

-- Keep the paginated list and detail read models correlated without leaking
-- the relationship as a rendered field.
create or replace function public.admin_get_operation_module_v1(
  p_module text, p_limit integer default 12, p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_rows jsonb;
  v_metrics jsonb;
begin
  v_base := public.admin_get_operation_module_v1_internal(p_module, p_limit, p_offset);

  if p_module = 'professionals' then
    select coalesce(jsonb_agg(
      r.row || jsonb_build_object(
        'latest_verification_id', v.id,
        'verification_status', coalesce(v.status::text, 'none'),
        'publication_eligibility', e.value,
        'publication_blockers', e.value -> 'blockers'
      ) order by r.ordinality
    ), '[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_base -> 'rows') with ordinality r(row, ordinality)
    left join lateral (
      select id, status from public.therapist_verifications
      where therapist_profile_id = (r.row ->> 'id')::uuid
      order by submitted_at desc nulls last, created_at desc, id desc
      limit 1
    ) v on true
    cross join lateral (
      select public.get_therapist_publication_eligibility_v1((r.row ->> 'id')::uuid) as value
    ) e;

    select (v_base -> 'metrics') || jsonb_build_object(
      'public-professionals', count(*) filter (where (public.get_therapist_publication_eligibility_v1(id) ->> 'eligible')::boolean)::integer,
      'approved-not-published', count(*) filter (where status = 'approved' and not (public.get_therapist_publication_eligibility_v1(id) ->> 'eligible')::boolean)::integer
    ) into v_metrics from public.therapist_profiles;

    return jsonb_set(jsonb_set(v_base, '{rows}', v_rows), '{metrics}', v_metrics);
  elsif p_module = 'verifications' then
    select coalesce(jsonb_agg(
      r.row || jsonb_build_object(
        'profile_status', p.status,
        'publication_eligibility', e.value,
        'publication_blockers', e.value -> 'blockers'
      ) order by r.ordinality
    ), '[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_base -> 'rows') with ordinality r(row, ordinality)
    join public.therapist_profiles p on p.id = (r.row ->> 'therapist_profile_id')::uuid
    cross join lateral (
      select public.get_therapist_publication_eligibility_v1(p.id) as value
    ) e;

    return jsonb_set(v_base, '{rows}', v_rows);
  end if;

  return v_base;
end;
$$;

create or replace function public.admin_get_operation_detail_v1(
  p_module text, p_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_record jsonb;
  v_profile_id uuid;
  v_eligibility jsonb;
  v_verification_id uuid;
  v_verification_status text;
begin
  v_base := public.admin_get_operation_detail_v1_internal(p_module, p_id);
  v_record := v_base -> 'record';
  if v_record is null or v_record = 'null'::jsonb then return v_base; end if;

  if p_module = 'professionals' then
    v_profile_id := (v_record ->> 'id')::uuid;
    select id, status::text into v_verification_id, v_verification_status
    from public.therapist_verifications
    where therapist_profile_id = v_profile_id
    order by submitted_at desc nulls last, created_at desc, id desc
    limit 1;
  elsif p_module = 'verifications' then
    v_profile_id := (v_record ->> 'therapist_profile_id')::uuid;
  else
    return v_base;
  end if;

  v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile_id);
  v_record := v_record || jsonb_build_object(
    'latest_verification_id', v_verification_id,
    'verification_status', coalesce(v_verification_status, case when p_module = 'verifications' then v_record ->> 'status' else 'none' end),
    'publication_eligibility', v_eligibility,
    'publication_blockers', v_eligibility -> 'blockers'
  );

  return jsonb_set(v_base, '{record}', v_record);
end;
$$;

revoke all on function public.admin_execute_professional_lifecycle_command_v1(text, uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.admin_execute_professional_lifecycle_command_v1(text, uuid, text, text, jsonb, text) to authenticated, service_role;

comment on function public.admin_execute_professional_lifecycle_command_v1(text, uuid, text, text, jsonb, text) is
  'Audited professional lifecycle commands including conditional administrative publication. Publication never bypasses the authoritative eligibility prerequisites.';
