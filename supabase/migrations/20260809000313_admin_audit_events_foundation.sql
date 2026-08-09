-- H2 foundation: centralized append-only audit trail for administrative
-- commands. Domain-specific event tables remain valid, but critical admin
-- mutations should also record sanitized operational events here.

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  permission text,
  action text not null,
  entity_type text not null,
  entity_id text,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  reason text,
  request_id text,
  correlation_id text,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint admin_audit_events_actor_role_not_blank
    check (length(btrim(actor_role)) between 2 and 64),
  constraint admin_audit_events_permission_not_blank
    check (permission is null or length(btrim(permission)) between 3 and 128),
  constraint admin_audit_events_action_not_blank
    check (length(btrim(action)) between 3 and 128),
  constraint admin_audit_events_entity_type_not_blank
    check (length(btrim(entity_type)) between 2 and 128),
  constraint admin_audit_events_entity_id_not_blank
    check (entity_id is null or length(btrim(entity_id)) between 1 and 256),
  constraint admin_audit_events_reason_length
    check (reason is null or length(reason) <= 1000),
  constraint admin_audit_events_request_id_length
    check (request_id is null or length(btrim(request_id)) between 1 and 128),
  constraint admin_audit_events_correlation_id_length
    check (correlation_id is null or length(btrim(correlation_id)) between 1 and 128),
  constraint admin_audit_events_source_not_blank
    check (length(btrim(source)) between 2 and 128),
  constraint admin_audit_events_previous_state_object
    check (jsonb_typeof(previous_state) = 'object'),
  constraint admin_audit_events_next_state_object
    check (jsonb_typeof(next_state) = 'object')
);

create index if not exists admin_audit_events_actor_created_idx
  on public.admin_audit_events (actor_user_id, created_at desc);

create index if not exists admin_audit_events_entity_created_idx
  on public.admin_audit_events (entity_type, entity_id, created_at desc);

create index if not exists admin_audit_events_action_created_idx
  on public.admin_audit_events (action, created_at desc);

create unique index if not exists admin_audit_events_request_unique_idx
  on public.admin_audit_events (source, request_id, action, entity_type)
  where request_id is not null;

create or replace function public.prevent_admin_audit_event_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'admin audit events are append-only'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'admin audit events cannot be deleted'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists a10_prevent_admin_audit_event_update
on public.admin_audit_events;
create trigger a10_prevent_admin_audit_event_update
before update on public.admin_audit_events
for each row execute function public.prevent_admin_audit_event_mutation_v1();

drop trigger if exists a10_prevent_admin_audit_event_delete
on public.admin_audit_events;
create trigger a10_prevent_admin_audit_event_delete
before delete on public.admin_audit_events
for each row execute function public.prevent_admin_audit_event_mutation_v1();

create or replace function public.record_admin_audit_event_v1(
  p_actor_user_id uuid,
  p_actor_role text,
  p_permission text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_previous_state jsonb,
  p_next_state jsonb,
  p_reason text,
  p_request_id text,
  p_correlation_id text,
  p_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if nullif(btrim(coalesce(p_request_id, '')), '') is not null then
    select admin_audit_events.id
    into v_event_id
    from public.admin_audit_events
    where admin_audit_events.source = coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'admin')
      and admin_audit_events.request_id = nullif(btrim(coalesce(p_request_id, '')), '')
      and admin_audit_events.action = nullif(btrim(coalesce(p_action, '')), '')
      and admin_audit_events.entity_type = nullif(btrim(coalesce(p_entity_type, '')), '')
    limit 1;

    if v_event_id is not null then
      return v_event_id;
    end if;
  end if;

  insert into public.admin_audit_events (
    actor_user_id,
    actor_role,
    permission,
    action,
    entity_type,
    entity_id,
    previous_state,
    next_state,
    reason,
    request_id,
    correlation_id,
    source
  )
  values (
    p_actor_user_id,
    nullif(btrim(coalesce(p_actor_role, '')), ''),
    nullif(btrim(coalesce(p_permission, '')), ''),
    nullif(btrim(coalesce(p_action, '')), ''),
    nullif(btrim(coalesce(p_entity_type, '')), ''),
    nullif(btrim(coalesce(p_entity_id, '')), ''),
    coalesce(p_previous_state, '{}'::jsonb),
    coalesce(p_next_state, '{}'::jsonb),
    nullif(btrim(coalesce(p_reason, '')), ''),
    nullif(btrim(coalesce(p_request_id, '')), ''),
    nullif(btrim(coalesce(p_correlation_id, '')), ''),
    coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'admin')
  )
  returning id into v_event_id;

  return v_event_id;
exception
  when unique_violation then
    if nullif(btrim(coalesce(p_request_id, '')), '') is null then
      raise;
    end if;

    select admin_audit_events.id
    into v_event_id
    from public.admin_audit_events
    where admin_audit_events.source = coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'admin')
      and admin_audit_events.request_id = nullif(btrim(coalesce(p_request_id, '')), '')
      and admin_audit_events.action = nullif(btrim(coalesce(p_action, '')), '')
      and admin_audit_events.entity_type = nullif(btrim(coalesce(p_entity_type, '')), '')
    limit 1;

    if v_event_id is null then
      raise;
    end if;

    return v_event_id;
end;
$$;

alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_audit_events
from public, anon, authenticated, service_role;

grant select on table public.admin_audit_events
to authenticated, service_role;

grant insert on table public.admin_audit_events
to service_role;

drop policy if exists "Admins can read admin audit events"
on public.admin_audit_events;
create policy "Admins can read admin audit events"
on public.admin_audit_events
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "Service role can insert admin audit events"
on public.admin_audit_events;
create policy "Service role can insert admin audit events"
on public.admin_audit_events
for insert
to service_role
with check (true);

revoke all on function public.prevent_admin_audit_event_mutation_v1()
from public, anon, authenticated, service_role;

revoke all on function public.record_admin_audit_event_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_admin_audit_event_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text
) to service_role;

comment on table public.admin_audit_events is
  'Append-only sanitized audit trail for critical administrative commands. Do not store secrets, tokens, raw documents, cookies, Authorization headers or unnecessary sensitive data.';

comment on function public.record_admin_audit_event_v1(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text
) is
  'Service-role-only writer for sanitized admin audit events. Browser roles must not call it directly.';
