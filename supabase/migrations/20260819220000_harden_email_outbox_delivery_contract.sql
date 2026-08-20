-- Harden the transactional outbox after the pilot: a logical delivery is
-- identified independently from its domain event, action and recipient.

alter table public.email_action_definitions
  add column if not exists default_template_version text not null default 'v1';

alter table public.email_outbox
  add column if not exists domain_event_id uuid,
  add column if not exists recipient_key text,
  add column if not exists template_version text not null default 'v1',
  add column if not exists template_overrides jsonb not null default '{}'::jsonb,
  add column if not exists sender_profile_id uuid references public.email_sender_profiles(id) on delete restrict,
  add column if not exists review_required boolean not null default false,
  add column if not exists review_reason text;

update public.email_outbox
set domain_event_id = nullif(payload ->> 'catalog_event_id', '')::uuid,
    recipient_key = 'profile:' || recipient_user_id::text
where domain_event_id is null or recipient_key is null;

alter table public.email_outbox
  alter column domain_event_id set not null,
  alter column recipient_key set not null,
  drop constraint if exists email_outbox_idempotency_unique,
  add constraint email_outbox_logical_delivery_unique unique (action_key, domain_event_id, recipient_key),
  add constraint email_outbox_recipient_key_format check (recipient_key ~ '^[a-z][a-z0-9_-]*:[a-z0-9-]+$'),
  add constraint email_outbox_template_overrides_object check (jsonb_typeof(template_overrides) = 'object');

create index if not exists email_outbox_stale_processing_idx
  on public.email_outbox(locked_at, created_at)
  where status = 'processing';

create table if not exists public.email_outbox_test_faults (
  id uuid primary key default gen_random_uuid(),
  action_key text not null references public.email_action_definitions(action_key) on delete cascade,
  recipient_key text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_outbox_test_faults_expiry_check check (expires_at > created_at)
);

create unique index if not exists email_outbox_test_faults_one_active_idx
  on public.email_outbox_test_faults(action_key, recipient_key)
  where consumed_at is null;

alter table public.email_outbox_test_faults enable row level security;
revoke all on public.email_outbox_test_faults from public, anon, authenticated;
grant select, insert, update, delete on public.email_outbox_test_faults to service_role;

create or replace function public.arm_email_outbox_test_fault_v1(
  p_action_key text,
  p_recipient_key text,
  p_expires_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then
    raise exception 'EMAIL_OUTBOX_TEST_FAULT_EXPIRY_INVALID';
  end if;
  delete from public.email_outbox_test_faults
  where action_key = p_action_key and recipient_key = p_recipient_key and consumed_at is null;
  insert into public.email_outbox_test_faults(action_key, recipient_key, expires_at)
  values (p_action_key, p_recipient_key, p_expires_at);
end; $$;

create or replace function public.enqueue_therapy_catalog_email_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action_key text;
  v_enabled boolean;
  v_automatic boolean;
  v_template_version text;
  v_sender_profile_id uuid;
  v_overrides jsonb;
begin
  if new.entity_type <> 'therapy_catalog_request' then return new; end if;
  v_action_key := case
    when new.event_type in ('therapy_request_submitted', 'therapy_request_resubmitted') then 'therapy_catalog_request_submitted'
    when new.event_type in ('therapy_request_under_review', 'therapy_request_needs_information', 'therapy_request_approved', 'therapy_request_merged', 'therapy_request_rejected') then 'therapy_catalog_request_updated'
    else null end;
  if v_action_key is null then return new; end if;

  select
    definition.active and coalesce(setting.enabled, true),
    coalesce(setting.automatic_dispatch_enabled, true),
    definition.default_template_version,
    coalesce(setting.sender_profile_id, default_sender.id),
    jsonb_build_object(
      'subject_override', setting.subject_override,
      'preheader_override', setting.preheader_override,
      'text_override', setting.text_override,
      'html_override', setting.html_override
    )
  into v_enabled, v_automatic, v_template_version, v_sender_profile_id, v_overrides
  from public.email_action_definitions definition
  left join public.email_action_settings setting on setting.action_key = definition.action_key
  left join lateral (
    select sender.id
    from public.email_sender_profiles sender
    where sender.active and sender.is_default
    order by sender.created_at asc
    limit 1
  ) default_sender on true
  where definition.action_key = v_action_key;

  -- Configuration is evaluated when the business event happens. Disabled
  -- automatic actions do not create a delivery that could be revived later.
  if coalesce(v_enabled, false) is false or coalesce(v_automatic, false) is false then
    return new;
  end if;

  insert into public.email_outbox(
    action_key, domain_event_id, related_entity_type, related_entity_id,
    recipient_user_id, recipient_key, idempotency_key, payload,
    template_version, template_overrides, sender_profile_id
  )
  select
    v_action_key, new.id, 'therapy_catalog_request', new.entity_id,
    request.requester_profile_id, 'profile:' || request.requester_profile_id::text,
    new.id::text, jsonb_build_object('catalog_event_id', new.id),
    coalesce(v_template_version, 'v1'), v_overrides, v_sender_profile_id
  from public.therapy_catalog_requests request
  where request.id = new.entity_id
  on conflict (action_key, domain_event_id, recipient_key) do nothing;
  return new;
end; $$;
revoke all on function public.enqueue_therapy_catalog_email_v2() from public;

drop trigger if exists enqueue_therapy_catalog_email on public.therapy_catalog_events;
create trigger enqueue_therapy_catalog_email
after insert on public.therapy_catalog_events
for each row execute function public.enqueue_therapy_catalog_email_v2();

create or replace function public.claim_email_outbox_v1(p_worker_id uuid, p_limit integer default 10)
returns setof public.email_outbox language plpgsql security definer set search_path = '' as $$
begin
  if p_worker_id is null or p_limit < 1 or p_limit > 50 then
    raise exception 'EMAIL_OUTBOX_INVALID_CLAIM';
  end if;

  -- Sending may have completed before a worker crash. A stale lease is never
  -- retried automatically because the provider has no documented idempotency key.
  update public.email_outbox
  set status = 'dead', review_required = true, review_reason = 'delivery_outcome_unknown',
      last_error = 'delivery_outcome_unknown', processed_at = now(), locked_at = null, locked_by = null
  where status = 'processing' and locked_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select id from public.email_outbox
    where status in ('pending', 'retry_pending') and next_attempt_at <= now()
    order by next_attempt_at, created_at
    limit p_limit
    for update skip locked
  )
  update public.email_outbox outbox
  set status = 'processing', attempts = outbox.attempts + 1,
      locked_at = now(), locked_by = p_worker_id
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end; $$;

drop function if exists public.complete_email_outbox_v1(uuid, uuid, public.email_outbox_status, text);
create function public.complete_email_outbox_v1(
  p_outbox_id uuid,
  p_worker_id uuid,
  p_outcome public.email_outbox_status,
  p_last_error text default null,
  p_review_required boolean default false,
  p_review_reason text default null
)
returns public.email_outbox language plpgsql security definer set search_path = '' as $$
declare v_row public.email_outbox;
begin
  if p_outcome not in ('delivered', 'skipped', 'retry_pending', 'dead') then
    raise exception 'EMAIL_OUTBOX_INVALID_OUTCOME';
  end if;

  update public.email_outbox set
    status = case when p_outcome = 'retry_pending' and attempts >= 5 then 'dead'::public.email_outbox_status else p_outcome end,
    next_attempt_at = case when p_outcome = 'retry_pending' and attempts < 5 then now() + make_interval(secs => least(3600, 30 * power(2, attempts - 1)::integer)) else next_attempt_at end,
    last_error = nullif(regexp_replace(coalesce(p_last_error, ''), '[\r\n]+', ' ', 'g'), '')::text,
    review_required = p_review_required or (p_outcome = 'retry_pending' and attempts >= 5),
    review_reason = case when p_review_required then nullif(regexp_replace(coalesce(p_review_reason, ''), '[\r\n]+', ' ', 'g'), '')::text when p_outcome = 'retry_pending' and attempts >= 5 then 'retry_limit_exhausted' else null end,
    locked_at = null, locked_by = null,
    processed_at = case when p_outcome in ('delivered', 'skipped', 'dead') or attempts >= 5 then now() else null end
  where id = p_outbox_id and status = 'processing' and locked_by = p_worker_id
  returning * into v_row;
  if v_row.id is null then raise exception 'EMAIL_OUTBOX_CLAIM_LOST'; end if;
  return v_row;
end; $$;

create or replace function public.consume_email_outbox_test_fault_v1(
  p_action_key text,
  p_recipient_key text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id
  from public.email_outbox_test_faults
  where action_key = p_action_key and recipient_key = p_recipient_key
    and consumed_at is null and expires_at > now()
  order by created_at
  limit 1
  for update skip locked;
  if v_id is null then return false; end if;
  update public.email_outbox_test_faults set consumed_at = now() where id = v_id;
  return true;
end; $$;

revoke all on function public.claim_email_outbox_v1(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_email_outbox_v1(uuid, uuid, public.email_outbox_status, text, boolean, text) from public, anon, authenticated;
revoke all on function public.consume_email_outbox_test_fault_v1(text, text) from public, anon, authenticated;
revoke all on function public.arm_email_outbox_test_fault_v1(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_email_outbox_v1(uuid, integer) to service_role;
grant execute on function public.complete_email_outbox_v1(uuid, uuid, public.email_outbox_status, text, boolean, text) to service_role;
grant execute on function public.consume_email_outbox_test_fault_v1(text, text) to service_role;
grant execute on function public.arm_email_outbox_test_fault_v1(text, text, timestamptz) to service_role;

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_email_outbox_recovery_v1()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_outbox_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_outbox_dispatch_secret';
  if v_url is null or v_secret is null then
    raise exception 'EMAIL_OUTBOX_RECOVERY_CONFIGURATION_MISSING';
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-email-outbox-dispatch-secret', v_secret),
    body := jsonb_build_object('limit', 25)
  );
end; $$;
revoke all on function public.dispatch_email_outbox_recovery_v1() from public, anon, authenticated;
grant execute on function public.dispatch_email_outbox_recovery_v1() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tes-email-outbox-recovery-v1') then
    perform cron.unschedule('tes-email-outbox-recovery-v1');
  end if;
  perform cron.schedule('tes-email-outbox-recovery-v1', '* * * * *', $cron$select public.dispatch_email_outbox_recovery_v1();$cron$);
end;
$$;

comment on table public.email_outbox is 'Transactional e-mail outbox. Logical delivery is action + domain event + opaque recipient key; outbound delivery happens only after commit.';
comment on table public.email_outbox_test_faults is 'One-shot HML-only provider failure control. It never creates business events or deliveries.';
