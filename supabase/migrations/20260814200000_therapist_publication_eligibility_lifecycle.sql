-- Canonical publication eligibility for therapist discovery, profile and booking.
-- Approval is an administrative decision; publication is a derived public state.

create or replace function public.get_therapist_publication_eligibility_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select * from public.therapist_profiles where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (where s.status = 'active' and s.is_bookable and s.online_only)::integer as online_bookable,
      count(*) filter (
        where s.status = 'active' and s.is_bookable and s.online_only
          and t.status = 'published' and t.is_public_visible
      )::integer as published_therapy,
      count(*) filter (
        where s.status = 'active' and s.is_bookable and s.online_only
          and t.status = 'published' and t.is_public_visible and c.is_active
      )::integer as eligible
    from public.therapist_services s
    join public.therapies t on t.id = s.therapy_id
    join public.therapy_categories c on c.id = t.category_id
    where s.therapist_profile_id = p_therapist_profile_id
      and s.archived_at is null
  )
  select jsonb_build_object(
    'eligible', coalesce(
      p.status = 'approved'::public.therapist_status
      and p.public_status = 'published'
      and p.is_public
      and p.is_accepting_bookings
      and p.accepts_online_sessions
      and coalesce(s.eligible, 0) > 0,
      false
    ),
    'blockers', coalesce((
      select jsonb_agg(code order by position)
      from unnest(array[
        case when p.id is null then 'profile_not_found' end,
        case when p.id is not null and p.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
        case when p.id is not null and p.public_status <> 'published' then 'profile_not_published' end,
        case when p.id is not null and not p.is_public then 'profile_not_public' end,
        case when p.id is not null and not p.is_accepting_bookings then 'not_accepting_bookings' end,
        case when p.id is not null and not p.accepts_online_sessions then 'online_sessions_disabled' end,
        case when p.id is not null and coalesce(s.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
        case when p.id is not null and coalesce(s.online_bookable, 0) > 0 and coalesce(s.published_therapy, 0) = 0 then 'therapy_not_public' end,
        case when p.id is not null and coalesce(s.published_therapy, 0) > 0 and coalesce(s.eligible, 0) = 0 then 'therapy_category_inactive' end
      ]) with ordinality as blockers(code, position)
      where code is not null
    ), '[]'::jsonb),
    'eligibleServiceCount', coalesce(s.eligible, 0)
  )
  from profile p
  full join services s on true
$$;

create or replace function public.is_therapist_publication_eligible_v1(
  p_therapist_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((public.get_therapist_publication_eligibility_v1(p_therapist_profile_id) ->> 'eligible')::boolean, false)
$$;

create or replace function public.is_public_service_booking_eligible_v1(p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.therapist_services s
    join public.therapies t on t.id = s.therapy_id
    join public.therapy_categories c on c.id = t.category_id
    where s.id = p_service_id
      and s.status = 'active' and s.is_bookable and s.online_only
      and t.status = 'published' and t.is_public_visible and c.is_active
      and public.is_therapist_publication_eligible_v1(s.therapist_profile_id)
  )
$$;

revoke all on function public.get_therapist_publication_eligibility_v1(uuid) from public, anon, authenticated;
revoke all on function public.is_public_service_booking_eligible_v1(uuid) from public;
revoke all on function public.is_therapist_publication_eligible_v1(uuid) from public;
grant execute on function public.is_therapist_publication_eligible_v1(uuid), public.is_public_service_booking_eligible_v1(uuid) to anon, authenticated, service_role;
grant execute on function public.get_therapist_publication_eligibility_v1(uuid), public.is_public_service_booking_eligible_v1(uuid) to service_role;

-- Preserve historical view definitions as private implementation views and make
-- every public entry point pass through the single eligibility predicate.
alter view public.public_therapist_search rename to public_therapist_search_internal;
create view public.public_therapist_search as
select i.* from public.public_therapist_search_internal i
where public.is_therapist_publication_eligible_v1(i.therapist_profile_id);

alter view public.public_home_therapists rename to public_home_therapists_internal;
create view public.public_home_therapists as
select i.* from public.public_home_therapists_internal i
where public.is_therapist_publication_eligible_v1(i.id);

alter view public.public_therapist_profiles_v rename to public_therapist_profiles_v_internal;
create view public.public_therapist_profiles_v as
select i.* from public.public_therapist_profiles_v_internal i
where public.is_therapist_publication_eligible_v1(i.id);

alter view public.public_therapist_profile_services_v rename to public_therapist_profile_services_v_internal;
create view public.public_therapist_profile_services_v as
select i.*
from public.public_therapist_profile_services_v_internal i
join public.therapist_profiles p on p.slug = i.therapist_slug
where public.is_public_service_booking_eligible_v1(i.service_id)
  and public.is_therapist_publication_eligible_v1(p.id);

alter view public.public_therapist_profile_content_v rename to public_therapist_profile_content_v_internal;
create view public.public_therapist_profile_content_v as
select i.*
from public.public_therapist_profile_content_v_internal i
where public.is_therapist_publication_eligible_v1(i.therapist_profile_id);

alter view public.public_therapist_profile_reviews_v rename to public_therapist_profile_reviews_v_internal;
create view public.public_therapist_profile_reviews_v as
select i.*
from public.public_therapist_profile_reviews_v_internal i
join public.therapist_profiles p on p.slug = i.therapist_slug
where public.is_therapist_publication_eligible_v1(p.id);

alter view public.public_therapist_slug_redirects_v rename to public_therapist_slug_redirects_v_internal;
create view public.public_therapist_slug_redirects_v as
select i.*
from public.public_therapist_slug_redirects_v_internal i
join public.therapist_profile_slug_history h on h.old_slug = i.old_slug and h.current_slug = i.current_slug
where public.is_therapist_publication_eligible_v1(h.therapist_profile_id);

grant select on public.public_therapist_search, public.public_home_therapists,
  public.public_therapist_profiles_v, public.public_therapist_profile_services_v,
  public.public_therapist_profile_content_v, public.public_therapist_profile_reviews_v,
  public.public_therapist_slug_redirects_v to anon, authenticated, service_role;
revoke all on public.public_therapist_search_internal, public.public_home_therapists_internal,
  public.public_therapist_profiles_v_internal, public.public_therapist_profile_services_v_internal,
  public.public_therapist_profile_content_v_internal, public.public_therapist_profile_reviews_v_internal,
  public.public_therapist_slug_redirects_v_internal from public, anon, authenticated;

-- Align invoker RLS gates used by public catalog counts and slug lookup.
drop policy if exists "Public can read public therapist service catalog gates" on public.therapist_services;
create policy "Public can read public therapist service catalog gates"
on public.therapist_services for select to anon, authenticated
using (status = 'active' and is_bookable and online_only and public.is_public_service_booking_eligible_v1(id));

drop policy if exists "Public can read approved public therapist profile gates" on public.therapist_profiles;
create policy "Public can read approved public therapist profile gates"
on public.therapist_profiles for select to anon, authenticated
using (public.is_therapist_publication_eligible_v1(id));

drop policy if exists "Public can read approved therapist slug redirects" on public.therapist_profile_slug_history;
create policy "Public can read approved therapist slug redirects"
on public.therapist_profile_slug_history for select to anon, authenticated
using (public.is_therapist_publication_eligible_v1(therapist_profile_id));

-- The slot engine and the transactional hold now use the same service predicate.
alter function public.get_service_available_slots_v1(uuid, timestamptz, timestamptz, integer)
  rename to get_service_available_slots_v1_internal;
create function public.get_service_available_slots_v1(
  p_service_id uuid, p_range_start timestamptz default null,
  p_range_end timestamptz default null, p_limit integer default 200
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_public_service_booking_eligible_v1(p_service_id) then
    return null;
  end if;
  return public.get_service_available_slots_v1_internal(p_service_id, p_range_start, p_range_end, p_limit);
end;
$$;

alter function public.reserve_booking_hold_v1(uuid, uuid, timestamptz, timestamptz, text, text, integer)
  rename to reserve_booking_hold_v1_internal;
create or replace function public.reserve_booking_hold_v1(
  p_patient_profile_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_ends_at timestamptz, p_timezone text, p_idempotency_key text,
  p_ttl_seconds integer default 600
)
returns public.booking_holds
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_public_service_booking_eligible_v1(p_service_id) then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  return public.reserve_booking_hold_v1_internal(
    p_patient_profile_id, p_service_id, p_starts_at, p_ends_at, p_timezone, p_idempotency_key, p_ttl_seconds
  );
end;
$$;

-- Explicit administrative state machine. Approval never force-enables public
-- switches; the returned eligibility makes a pending publication visible.
create or replace function public.admin_execute_professional_lifecycle_command_v1(
  p_action text, p_entity_id uuid, p_reason text, p_request_id text,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid(); v_audit_id uuid; v_entity_type text;
  v_permission text; v_previous jsonb; v_next jsonb; v_replay record;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_id text := nullif(btrim(coalesce(p_request_id, '')), '');
  v_verification public.therapist_verifications%rowtype;
  v_profile public.therapist_profiles%rowtype;
  v_eligibility jsonb;
begin
  if v_actor_id is null then raise exception 'admin authentication required' using errcode = '42501'; end if;
  if v_reason is null or length(v_reason) < 8 then raise exception 'admin command reason must have at least 8 characters' using errcode = '22023'; end if;
  if v_request_id is null then raise exception 'admin command request_id required' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = v_actor_id and role = 'admin'::public.user_role and auth_deleted_at is null and anonymized_at is null) then raise exception 'admin permission required' using errcode = '42501'; end if;
  if p_action in ('professional.suspend','professional.reactivate') then
    v_entity_type := 'therapist_profile'; v_permission := 'admin.professionals.suspend';
  elsif p_action in ('verification.approve','verification.reject','verification.request_changes','verification.pause_review','verification.reopen_review') then
    v_entity_type := 'therapist_verification'; v_permission := 'admin.professionals.verify';
  else raise exception 'unsupported professional lifecycle command: %', p_action using errcode = '22023'; end if;

  select id, entity_id, previous_state, next_state into v_replay
  from public.admin_audit_events
  where source = 'admin-operation-command' and request_id = v_request_id
    and action = p_action and entity_type = v_entity_type
  limit 1;
  if found then
    if v_replay.entity_id <> p_entity_id::text then raise exception 'admin command request_id reused for a different target' using errcode = '22023'; end if;
    return jsonb_build_object('ok', true, 'idempotentReplay', true, 'auditEventId', v_replay.id, 'entityId', p_entity_id, 'entityType', v_entity_type, 'previousState', v_replay.previous_state, 'nextState', v_replay.next_state, 'permission', v_permission);
  end if;

  if v_entity_type = 'therapist_profile' then
    select * into v_profile from public.therapist_profiles where id = p_entity_id for update;
    if not found then raise exception 'admin command target not found' using errcode = 'P0002'; end if;
    v_previous := jsonb_build_object('id',v_profile.id,'status',v_profile.status,'public_status',v_profile.public_status,'is_public',v_profile.is_public,'is_accepting_bookings',v_profile.is_accepting_bookings);
    if p_action = 'professional.suspend' then
      update public.therapist_profiles set status='suspended', public_status='suspended', is_public=false, is_accepting_bookings=false, metadata=jsonb_set(jsonb_set(coalesce(metadata,'{}'::jsonb),'{adminSuspensionReason}',to_jsonb(v_reason),true),'{adminSuspendedAt}',to_jsonb(now()),true), updated_at=now() where id=p_entity_id returning * into v_profile;
    else
      if v_profile.status <> 'suspended' then raise exception 'only suspended professionals can be reactivated' using errcode = '22023'; end if;
      update public.therapist_profiles set status='approved', public_status='unpublished', is_public=false, is_accepting_bookings=false, metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{adminReactivatedAt}',to_jsonb(now()),true), updated_at=now() where id=p_entity_id returning * into v_profile;
    end if;
    v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
    v_next := jsonb_build_object('id',v_profile.id,'status',v_profile.status,'public_status',v_profile.public_status,'is_public',v_profile.is_public,'is_accepting_bookings',v_profile.is_accepting_bookings,'publicationEligibility',v_eligibility);
  else
    select * into v_verification from public.therapist_verifications where id = p_entity_id for update;
    if not found then raise exception 'admin command target not found' using errcode = 'P0002'; end if;
    select * into v_profile from public.therapist_profiles where id=v_verification.therapist_profile_id for update;
    v_previous := jsonb_build_object('id',v_verification.id,'status',v_verification.status,'therapist_profile_id',v_verification.therapist_profile_id,'profile_status',v_profile.status,'publicationEligibility',public.get_therapist_publication_eligibility_v1(v_profile.id));
    if p_action = 'verification.reopen_review' then
      if v_verification.status not in ('submitted','changes_requested','rejected') then raise exception 'verification cannot enter review from its current status' using errcode = '22023'; end if;
      update public.therapist_verifications set status='in_review', reviewed_by=v_actor_id, reviewed_at=coalesce(reviewed_at,now()), updated_at=now() where id=p_entity_id returning * into v_verification;
      update public.therapist_profiles set status='in_review', updated_at=now() where id=v_profile.id and status <> 'suspended' returning * into v_profile;
    elsif p_action in ('verification.request_changes','verification.pause_review') then
      if v_verification.status <> 'in_review' then raise exception 'verification must be in review before requesting changes' using errcode = '22023'; end if;
      update public.therapist_verifications set status='changes_requested', reviewed_by=v_actor_id, reviewed_at=now(), changes_requested=v_reason, updated_at=now() where id=p_entity_id returning * into v_verification;
      update public.therapist_profiles set status='changes_requested', public_status='unpublished', is_public=false, is_accepting_bookings=false, updated_at=now() where id=v_profile.id and status <> 'suspended' returning * into v_profile;
    elsif p_action = 'verification.approve' then
      if v_verification.status <> 'in_review' then raise exception 'verification must be in review before approval' using errcode = '22023'; end if;
      update public.therapist_verifications set status='approved', reviewed_by=v_actor_id, reviewed_at=now(), changes_requested=null, rejection_reason=null, updated_at=now() where id=p_entity_id returning * into v_verification;
      update public.therapist_profiles set status='approved', updated_at=now() where id=v_profile.id and status <> 'suspended' returning * into v_profile;
    else
      if v_verification.status <> 'in_review' then raise exception 'verification must be in review before rejection' using errcode = '22023'; end if;
      update public.therapist_verifications set status='rejected', reviewed_by=v_actor_id, reviewed_at=now(), rejection_reason=v_reason, updated_at=now() where id=p_entity_id returning * into v_verification;
      update public.therapist_profiles set status='rejected', public_status='unpublished', is_public=false, is_accepting_bookings=false, updated_at=now() where id=v_profile.id and status <> 'suspended' returning * into v_profile;
    end if;
    v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile.id);
    v_next := jsonb_build_object('id',v_verification.id,'status',v_verification.status,'therapist_profile_id',v_verification.therapist_profile_id,'profile_status',v_profile.status,'publicationEligibility',v_eligibility);
  end if;
  v_audit_id := public.record_admin_audit_event_v1(v_actor_id,'admin',v_permission,p_action,v_entity_type,p_entity_id::text,v_previous,v_next,v_reason,v_request_id,p_correlation_id,'admin-operation-command');
  return jsonb_build_object('ok',true,'idempotentReplay',false,'auditEventId',v_audit_id,'entityId',p_entity_id,'entityType',v_entity_type,'previousState',v_previous,'nextState',v_next,'permission',v_permission);
end;
$$;

create or replace function public.admin_execute_operation_command_v1(p_action text,p_entity_id uuid,p_reason text,p_request_id text,p_payload jsonb default '{}'::jsonb,p_correlation_id text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_action like 'professional.%' or p_action like 'verification.%' then
    return public.admin_execute_professional_lifecycle_command_v1(p_action,p_entity_id,p_reason,p_request_id,p_payload,p_correlation_id);
  end if;
  return public.admin_execute_operation_command_v1_internal(p_action,p_entity_id,p_reason,p_request_id,p_payload,p_correlation_id);
end; $$;

create or replace function public.admin_execute_operation_command_v2(p_action text,p_entity_id uuid,p_reason text,p_request_id text,p_payload jsonb default '{}'::jsonb,p_correlation_id text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_action like 'professional.%' or p_action like 'verification.%' then
    return public.admin_execute_professional_lifecycle_command_v1(p_action,p_entity_id,p_reason,p_request_id,p_payload,p_correlation_id);
  end if;
  return public.admin_execute_operation_command_v2_internal(p_action,p_entity_id,p_reason,p_request_id,p_payload,p_correlation_id);
end; $$;

revoke all on function public.admin_execute_professional_lifecycle_command_v1(text,uuid,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.admin_execute_operation_command_v1(text,uuid,text,text,jsonb,text), public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text) from public, anon;
grant execute on function public.admin_execute_operation_command_v1(text,uuid,text,text,jsonb,text), public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text) to authenticated, service_role;

-- Enrich the existing minimized admin DTOs; no private document fields enter it.
alter function public.admin_get_operation_module_v1(text, integer, integer)
  rename to admin_get_operation_module_v1_internal;
create function public.admin_get_operation_module_v1(p_module text, p_limit integer default 12, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_rows jsonb; v_metrics jsonb;
begin
  v_base := public.admin_get_operation_module_v1_internal(p_module,p_limit,p_offset);
  if p_module = 'professionals' then
    select coalesce(jsonb_agg(r.row || jsonb_build_object('verification_status',coalesce(v.status::text,'none'),'publication_eligibility',e.value,'publication_blockers',e.value->'blockers') order by r.ordinality),'[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_base->'rows') with ordinality r(row, ordinality)
    left join lateral (select status from public.therapist_verifications where therapist_profile_id=(r.row->>'id')::uuid order by submitted_at desc nulls last,created_at desc,id desc limit 1) v on true
    cross join lateral (select public.get_therapist_publication_eligibility_v1((r.row->>'id')::uuid) as value) e;
    select (v_base->'metrics') || jsonb_build_object(
      'public-professionals', count(*) filter (where (public.get_therapist_publication_eligibility_v1(id)->>'eligible')::boolean)::integer,
      'approved-not-published', count(*) filter (where status='approved' and not (public.get_therapist_publication_eligibility_v1(id)->>'eligible')::boolean)::integer
    ) into v_metrics from public.therapist_profiles;
    return jsonb_set(jsonb_set(v_base,'{rows}',v_rows),'{metrics}',v_metrics);
  elsif p_module = 'verifications' then
    select coalesce(jsonb_agg(r.row || jsonb_build_object('profile_status',p.status,'publication_eligibility',e.value,'publication_blockers',e.value->'blockers') order by r.ordinality),'[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_base->'rows') with ordinality r(row, ordinality)
    join public.therapist_profiles p on p.id=(r.row->>'therapist_profile_id')::uuid
    cross join lateral (select public.get_therapist_publication_eligibility_v1(p.id) as value) e;
    return jsonb_set(v_base,'{rows}',v_rows);
  end if;
  return v_base;
end; $$;

alter function public.admin_get_operation_detail_v1(text, uuid)
  rename to admin_get_operation_detail_v1_internal;
create function public.admin_get_operation_detail_v1(p_module text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_record jsonb; v_profile_id uuid; v_eligibility jsonb; v_verification_status text;
begin
  v_base := public.admin_get_operation_detail_v1_internal(p_module,p_id);
  v_record := v_base->'record'; if v_record is null or v_record='null'::jsonb then return v_base; end if;
  if p_module='professionals' then
    v_profile_id := (v_record->>'id')::uuid;
    select status::text into v_verification_status from public.therapist_verifications where therapist_profile_id=v_profile_id order by submitted_at desc nulls last,created_at desc,id desc limit 1;
  elsif p_module='verifications' then v_profile_id := (v_record->>'therapist_profile_id')::uuid;
  else return v_base; end if;
  v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile_id);
  v_record := v_record || jsonb_build_object('publication_eligibility',v_eligibility,'publication_blockers',v_eligibility->'blockers','verification_status',coalesce(v_verification_status,case when p_module='verifications' then v_record->>'status' else 'none' end));
  return jsonb_set(v_base,'{record}',v_record);
end; $$;

revoke all on function public.admin_get_operation_module_v1_internal(text,integer,integer), public.admin_get_operation_detail_v1_internal(text,uuid) from public, anon, authenticated;
revoke all on function public.admin_get_operation_module_v1(text,integer,integer), public.admin_get_operation_detail_v1(text,uuid) from public, anon;
grant execute on function public.admin_get_operation_module_v1(text,integer,integer), public.admin_get_operation_detail_v1(text,uuid) to authenticated, service_role;
