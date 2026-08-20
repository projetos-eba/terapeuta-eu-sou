do $$ begin
  create type public.email_outbox_status as enum ('pending', 'processing', 'retry_pending', 'delivered', 'skipped', 'dead');
exception when duplicate_object then null; end $$;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  action_key text not null references public.email_action_definitions(action_key) on delete restrict,
  related_entity_type text not null,
  related_entity_id uuid not null,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  locked_at timestamptz,
  locked_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_outbox_idempotency_unique unique (action_key, idempotency_key),
  constraint email_outbox_entity_check check (related_entity_type = 'therapy_catalog_request'),
  constraint email_outbox_payload_minimal check (jsonb_typeof(payload) = 'object' and payload ? 'catalog_event_id')
);

create index if not exists email_outbox_dispatch_idx on public.email_outbox(status, next_attempt_at, created_at);
create index if not exists email_outbox_related_entity_idx on public.email_outbox(related_entity_type, related_entity_id);
drop trigger if exists set_email_outbox_updated_at on public.email_outbox;
create trigger set_email_outbox_updated_at before update on public.email_outbox for each row execute function public.set_updated_at();

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select, insert, update, delete on public.email_outbox to service_role;

create or replace function public.enqueue_therapy_catalog_email_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action_key text;
begin
  if new.entity_type <> 'therapy_catalog_request' then return new; end if;
  v_action_key := case
    when new.event_type in ('therapy_request_submitted', 'therapy_request_resubmitted') then 'therapy_catalog_request_submitted'
    when new.event_type in ('therapy_request_under_review', 'therapy_request_needs_information', 'therapy_request_approved', 'therapy_request_merged', 'therapy_request_rejected') then 'therapy_catalog_request_updated'
    else null end;
  if v_action_key is null then return new; end if;
  insert into public.email_outbox(action_key, related_entity_type, related_entity_id, recipient_user_id, idempotency_key, payload)
  select v_action_key, 'therapy_catalog_request', new.entity_id, request.requester_profile_id, new.id::text,
    jsonb_build_object('catalog_event_id', new.id)
  from public.therapy_catalog_requests request where request.id = new.entity_id
  on conflict (action_key, idempotency_key) do nothing;
  return new;
end; $$;
revoke all on function public.enqueue_therapy_catalog_email_v1() from public;

drop trigger if exists enqueue_therapy_catalog_email on public.therapy_catalog_events;
create trigger enqueue_therapy_catalog_email after insert on public.therapy_catalog_events for each row execute function public.enqueue_therapy_catalog_email_v1();

create or replace function public.claim_email_outbox_v1(p_worker_id uuid, p_limit integer default 10)
returns setof public.email_outbox language plpgsql security definer set search_path = '' as $$
begin
  if p_worker_id is null or p_limit < 1 or p_limit > 50 then raise exception 'EMAIL_OUTBOX_INVALID_CLAIM'; end if;
  return query with candidates as (
    select id from public.email_outbox
    where status in ('pending', 'retry_pending') and next_attempt_at <= now()
    order by next_attempt_at, created_at limit p_limit for update skip locked
  ) update public.email_outbox outbox set status = 'processing', attempts = outbox.attempts + 1, locked_at = now(), locked_by = p_worker_id
    from candidates where outbox.id = candidates.id returning outbox.*;
end; $$;

create or replace function public.complete_email_outbox_v1(p_outbox_id uuid, p_worker_id uuid, p_outcome public.email_outbox_status, p_last_error text default null)
returns public.email_outbox language plpgsql security definer set search_path = '' as $$
declare v_row public.email_outbox;
begin
  if p_outcome not in ('delivered', 'skipped', 'retry_pending', 'dead') then raise exception 'EMAIL_OUTBOX_INVALID_OUTCOME'; end if;
  update public.email_outbox set
    status = case when p_outcome = 'retry_pending' and attempts >= 5 then 'dead'::public.email_outbox_status else p_outcome end,
    next_attempt_at = case when p_outcome = 'retry_pending' and attempts < 5 then now() + make_interval(secs => least(3600, 30 * power(2, attempts - 1)::integer)) else next_attempt_at end,
    last_error = nullif(regexp_replace(coalesce(p_last_error, ''), '[\r\n]+', ' ', 'g'), '')::text,
    locked_at = null, locked_by = null,
    processed_at = case when p_outcome in ('delivered', 'skipped', 'dead') or attempts >= 5 then now() else null end
  where id = p_outbox_id and status = 'processing' and locked_by = p_worker_id
  returning * into v_row;
  if v_row.id is null then raise exception 'EMAIL_OUTBOX_CLAIM_LOST'; end if;
  return v_row;
end; $$;

revoke all on function public.claim_email_outbox_v1(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_email_outbox_v1(uuid, uuid, public.email_outbox_status, text) from public, anon, authenticated;
grant execute on function public.claim_email_outbox_v1(uuid, integer) to service_role;
grant execute on function public.complete_email_outbox_v1(uuid, uuid, public.email_outbox_status, text) to service_role;

comment on table public.email_outbox is 'Transactional email outbox. It stores only delivery references and bounded sanitized state; providers are dispatched after commit.';
