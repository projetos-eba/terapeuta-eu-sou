-- Client restrictions are independent of Auth, account-editable metadata and
-- existing contracts. Only new INSERTs are guarded; updates/payment/session
-- recovery and idempotent reads of existing bookings are intentionally intact.
create table public.patient_booking_restrictions (
  patient_profile_id uuid primary key references public.patient_profiles(id) on delete cascade,
  suspended_at timestamptz,
  suspended_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.patient_booking_restrictions enable row level security;
revoke all on table public.patient_booking_restrictions from public, anon, authenticated, service_role;
grant select on table public.patient_booking_restrictions to service_role;

create function public.enforce_patient_booking_restriction_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- The admin command acquires only this namespaced lock, never agenda locks.
  -- Run after existing INSERT validations without changing their lock order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tes:patient-booking-restriction:' || new.patient_profile_id::text, 0));
  if exists (select 1 from public.patient_booking_restrictions
    where patient_profile_id = new.patient_profile_id and suspended_at is not null) then
    raise exception 'PATIENT_BOOKING_SUSPENDED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger z98_enforce_patient_booking_restriction
before insert on public.booking_holds for each row
execute function public.enforce_patient_booking_restriction_v1();
create trigger z98_enforce_patient_booking_restriction
before insert on public.bookings for each row
execute function public.enforce_patient_booking_restriction_v1();
revoke all on function public.enforce_patient_booking_restriction_v1() from public, anon, authenticated;

create function public.admin_execute_patient_booking_command_v1(
  p_action text, p_entity_id uuid, p_reason text, p_request_id text,
  p_correlation_id text default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request text := btrim(coalesce(p_request_id, ''));
  v_event public.admin_audit_events%rowtype;
  v_previous jsonb;
  v_next jsonb;
  v_suspended_at timestamptz;
  v_audit uuid;
begin
  if v_actor is null or not exists (select 1 from public.profiles
    where id = v_actor and role = 'admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('patient.suspend', 'patient.reactivate') then
    raise exception 'unsupported admin patient command' using errcode = '22023';
  end if;
  if length(v_reason) not between 8 and 1000 then
    raise exception 'admin command reason invalid' using errcode = '22023';
  end if;
  if length(v_request) not between 8 and 128 then
    raise exception 'admin command request_id invalid' using errcode = '22023';
  end if;
  if p_correlation_id is not null and length(btrim(p_correlation_id)) not between 1 and 128 then
    raise exception 'admin command correlation_id invalid' using errcode = '22023';
  end if;
  -- Serialize identical requests across targets as well as per-client changes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tes:patient-booking-command-request:' || v_request, 0));
  select * into v_event from public.admin_audit_events
  where source = 'admin-patient-booking-command' and request_id = v_request
  order by created_at, id limit 1;
  if found then
    if v_event.actor_user_id is distinct from v_actor or v_event.entity_id is distinct from p_entity_id::text
      or v_event.action <> p_action or v_event.reason is distinct from v_reason then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true, 'auditEventId', v_event.id,
      'entityId', p_entity_id, 'entityType', 'patient_profile',
      'previousState', v_event.previous_state, 'nextState', v_event.next_state);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tes:patient-booking-restriction:' || p_entity_id::text, 0));
  if not exists (select 1 from public.patient_profiles p join public.profiles u on u.id = p.user_id
    where p.id = p_entity_id and u.role = 'patient'::public.user_role
      and u.auth_deleted_at is null and u.anonymized_at is null) then
    raise exception 'active patient target not found' using errcode = 'P0002';
  end if;
  select suspended_at into v_suspended_at from public.patient_booking_restrictions
  where patient_profile_id = p_entity_id;
  v_previous := jsonb_build_object('accountStatus', case when v_suspended_at is null then 'active' else 'suspended' end);
  if (p_action = 'patient.suspend' and v_suspended_at is not null)
    or (p_action = 'patient.reactivate' and v_suspended_at is null) then
    raise exception 'patient booking state transition invalid' using errcode = '22023';
  end if;
  insert into public.patient_booking_restrictions (patient_profile_id, suspended_at, suspended_by)
  values (p_entity_id, case when p_action = 'patient.suspend' then now() end,
    case when p_action = 'patient.suspend' then v_actor end)
  on conflict (patient_profile_id) do update
  set suspended_at = excluded.suspended_at, suspended_by = excluded.suspended_by, updated_at = now();
  v_next := jsonb_build_object('accountStatus', case when p_action = 'patient.suspend' then 'suspended' else 'active' end);
  v_audit := public.record_admin_audit_event_v1(v_actor, 'admin', 'admin.patients.suspend',
    p_action, 'patient_profile', p_entity_id::text, v_previous, v_next,
    v_reason, v_request, p_correlation_id, 'admin-patient-booking-command');
  return jsonb_build_object('ok', true, 'auditEventId', v_audit, 'entityId', p_entity_id,
    'entityType', 'patient_profile', 'previousState', v_previous, 'nextState', v_next);
end;
$$;
revoke all on function public.admin_execute_patient_booking_command_v1(text,uuid,text,text,text)
from public, anon, authenticated;

-- Compatibility facades delegate every other module to its exact prior body.
alter function public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text)
rename to admin_execute_operation_command_v2_before_patient_restrictions;
create function public.admin_execute_operation_command_v2(
  p_action text, p_entity_id uuid, p_reason text, p_request_id text,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_action in ('patient.suspend', 'patient.reactivate') then
    return public.admin_execute_patient_booking_command_v1(p_action,p_entity_id,p_reason,p_request_id,p_correlation_id);
  end if;
  return public.admin_execute_operation_command_v2_before_patient_restrictions(
    p_action,p_entity_id,p_reason,p_request_id,p_payload,p_correlation_id);
end;
$$;
revoke all on function public.admin_execute_operation_command_v2_before_patient_restrictions(text,uuid,text,text,jsonb,text)
from public, anon, authenticated, service_role;
revoke all on function public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text) from public, anon;
grant execute on function public.admin_execute_operation_command_v2(text,uuid,text,text,jsonb,text) to authenticated, service_role;

alter function public.admin_get_operation_detail_v1(text,uuid)
rename to admin_get_operation_detail_v1_before_patient_restrictions;
create function public.admin_get_operation_detail_v1(p_module text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_contact jsonb; v_status text;
begin
  -- Retains the live Admin guard, audit reader and all existing detail fields.
  v_base := public.admin_get_operation_detail_v1_before_patient_restrictions(p_module,p_id);
  if p_module <> 'patients' or v_base->'record' is null or v_base->'record' = 'null'::jsonb then
    return v_base;
  end if;
  select jsonb_build_object(
    'email', u.email, 'phone', p.phone,
    'phoneCountryCode', p.phone_country_code,
    'postalCode', p.metadata #>> '{account,address,postalCode}',
    'street', p.metadata #>> '{account,address,street}',
    'streetNumber', p.metadata #>> '{account,address,streetNumber}',
    'complement', p.metadata #>> '{account,address,complement}',
    'neighborhood', p.metadata #>> '{account,address,neighborhood}',
    'city', p.metadata #>> '{account,address,city}',
    'state', p.metadata #>> '{account,address,state}'
  ), case when u.auth_deleted_at is not null then 'deleted'
    when u.anonymized_at is not null then 'anonymized'
    when r.suspended_at is not null then 'suspended' else 'active' end
  into v_contact, v_status
  from public.patient_profiles p left join public.profiles u on u.id=p.user_id
  left join public.patient_booking_restrictions r on r.patient_profile_id=p.id
  where p.id=p_id;
  return jsonb_set(v_base,'{record}',(v_base->'record') || jsonb_build_object(
    'private_contact',v_contact,'account_status',v_status,'booking_management_available',true));
end;
$$;
revoke all on function public.admin_get_operation_detail_v1_before_patient_restrictions(text,uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_detail_v1(text,uuid) from public, anon;
grant execute on function public.admin_get_operation_detail_v1(text,uuid) to authenticated, service_role;

alter function public.admin_get_operation_module_v2(text,jsonb)
rename to admin_get_operation_module_v2_before_patient_restrictions;
create function public.admin_get_operation_module_v2(p_module text,p_query jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page integer := 1;
  v_size integer := 12;
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_status text := nullif(btrim(coalesce(p_query->>'status','')),'');
  v_sort text := coalesce(nullif(btrim(p_query->>'sort'),''),'recent');
  v_metrics jsonb;
  v_rows jsonb;
  v_total integer;
begin
  if p_module is distinct from 'patients' then
    return public.admin_get_operation_module_v2_before_patient_restrictions(p_module,p_query);
  end if;
  if auth.uid() is null or not exists (select 1 from public.profiles
    where id=auth.uid() and role='admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null) then
    raise exception 'admin permission required' using errcode='42501';
  end if;
  if coalesce(p_query->>'page','') ~ '^[0-9]{1,9}$' then
    v_page := greatest((p_query->>'page')::integer,1);
  end if;
  if coalesce(p_query->>'pageSize','') ~ '^[0-9]{1,9}$' then
    v_size := least(greatest((p_query->>'pageSize')::integer,1),50);
  end if;
  select jsonb_build_object(
    'total-patients',count(*)::integer,
    'recent-patients',count(*) filter (where p.created_at >= now()-interval '30 days')::integer,
    'previous-patients',count(*) filter (where p.created_at >= now()-interval '60 days' and p.created_at < now()-interval '30 days')::integer,
    'active-patients',count(*) filter (where u.auth_deleted_at is null and u.anonymized_at is null and r.suspended_at is null)::integer,
    'suspended-patients',count(*) filter (where u.auth_deleted_at is null and u.anonymized_at is null and r.suspended_at is not null)::integer,
    'active-patients-percentage',case when count(*)=0 then 0 else round(
      100.0*count(*) filter (where u.auth_deleted_at is null and u.anonymized_at is null and r.suspended_at is null)/count(*),1) end
  ) into v_metrics
  from public.patient_profiles p left join public.profiles u on u.id=p.user_id
  left join public.patient_booking_restrictions r on r.patient_profile_id=p.id;

  with identities as (
    select p.*,case when u.auth_deleted_at is not null then 'deleted'
      when u.anonymized_at is not null then 'anonymized'
      when r.suspended_at is not null then 'suspended' else 'active' end as account_status
    from public.patient_profiles p left join public.profiles u on u.id=p.user_id
    left join public.patient_booking_restrictions r on r.patient_profile_id=p.id
  ), filtered as (
    select * from identities p where (v_status is null or p.account_status=v_status)
      and (v_search is null or lower(concat_ws(' ',p.id::text,p.user_id::text,p.display_name,p.account_status,p.timezone))
        like '%' || lower(v_search) || '%')
  ), page_rows as (
    select * from filtered p order by
      case when v_sort='name' then lower(p.display_name) end asc nulls last,
      case when v_sort='status' then p.account_status end asc nulls last,
      case when v_sort='oldest' then p.created_at end asc,
      p.updated_at desc,p.id
    limit v_size offset ((v_page::bigint-1)*v_size)
  ), payloads as (
    select p.*,jsonb_build_object('id',p.id,'user_id',p.user_id,'display_name',p.display_name,
      'account_status',p.account_status,'timezone',p.timezone,
      'booking_count',coalesce(b.total,0),'ticket_count',coalesce(t.total,0),
      'last_activity_at',greatest(p.updated_at,b.last_activity_at,t.last_activity_at),
      'created_at',p.created_at,'updated_at',p.updated_at) as payload
    from page_rows p left join lateral (
      select count(*)::integer as total,max(updated_at) as last_activity_at
      from public.bookings where patient_profile_id=p.id
    ) b on true left join lateral (
      select count(*)::integer as total,max(updated_at) as last_activity_at
      from public.support_tickets where requester_profile_id=p.user_id
    ) t on true
  ) select (select count(*)::integer from filtered),coalesce(jsonb_agg(payload order by
    case when v_sort='name' then lower(display_name) end asc nulls last,
    case when v_sort='status' then account_status end asc nulls last,
    case when v_sort='oldest' then created_at end asc,updated_at desc,id),'[]'::jsonb)
  into v_total,v_rows from payloads;
  return jsonb_build_object('module',p_module,'generatedAt',now(),'metrics',v_metrics,
    'filtersApplied',jsonb_build_object('search',v_search,'status',v_status,'sort',v_sort),
    'page',jsonb_build_object('page',v_page,'pageSize',v_size,'total',v_total,
      'hasNext',(v_page::bigint*v_size)<v_total),'rows',v_rows);
end;
$$;
revoke all on function public.admin_get_operation_module_v2_before_patient_restrictions(text,jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_module_v2(text,jsonb) from public, anon;
grant execute on function public.admin_get_operation_module_v2(text,jsonb) to authenticated, service_role;

comment on table public.patient_booking_restrictions is
'Admin-owned restriction on NEW bookings only. No Auth ban, cancellation, financial or session-access effect.';
