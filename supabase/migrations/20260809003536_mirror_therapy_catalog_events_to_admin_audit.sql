-- H2 bridge: mirror existing Therapy Catalog / Match domain events into the
-- centralized append-only admin audit trail in the same transaction.

create or replace function public.admin_audit_json_object_v1(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null then '{}'::jsonb
    when jsonb_typeof(p_value) = 'object' then p_value
    else jsonb_build_object('value', p_value)
  end;
$$;

create or replace function public.admin_permission_for_therapy_catalog_event_v1(
  p_event_type text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_event_type like 'matching_%' then 'admin.matching.manage'
    when p_event_type like 'therapy_matching_%' then 'admin.matching.manage'
    else 'admin.therapies.manage'
  end;
$$;

create or replace function public.mirror_therapy_catalog_event_to_admin_audit_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_role <> 'admin' or new.actor_profile_id is null then
    return new;
  end if;

  perform public.record_admin_audit_event_v1(
    new.actor_profile_id,
    new.actor_role::text,
    public.admin_permission_for_therapy_catalog_event_v1(new.event_type),
    new.event_type,
    new.entity_type,
    new.entity_id::text,
    public.admin_audit_json_object_v1(new.previous_state),
    public.admin_audit_json_object_v1(new.next_state),
    new.reason,
    new.request_id::text,
    new.correlation_id::text,
    'therapy_catalog_events'
  );

  return new;
end;
$$;

drop trigger if exists z95_mirror_therapy_catalog_event_to_admin_audit
on public.therapy_catalog_events;
create trigger z95_mirror_therapy_catalog_event_to_admin_audit
after insert on public.therapy_catalog_events
for each row execute function public.mirror_therapy_catalog_event_to_admin_audit_v1();

revoke all on function public.admin_audit_json_object_v1(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.admin_permission_for_therapy_catalog_event_v1(text)
from public, anon, authenticated, service_role;

revoke all on function public.mirror_therapy_catalog_event_to_admin_audit_v1()
from public, anon, authenticated, service_role;

comment on function public.mirror_therapy_catalog_event_to_admin_audit_v1() is
  'Internal trigger that mirrors admin Therapy Catalog / Match domain events into admin_audit_events. Does not expose secrets or raw request payloads.';
