create extension if not exists pgcrypto;

do $$
begin
  create type public.email_provider_key as enum ('hostinger_mail_api');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.email_delivery_status as enum ('success', 'error', 'skipped');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.auth_action_purpose as enum ('email_verification', 'password_reset');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.email_action_definitions (
  action_key text primary key,
  category text not null,
  label text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.email_sender_profiles (
  id uuid primary key default gen_random_uuid(),
  provider public.email_provider_key not null default 'hostinger_mail_api',
  mailbox_resource_id text not null unique,
  mailbox_address text not null,
  display_name text not null,
  reply_to_email text,
  active boolean not null default true,
  is_default boolean not null default false,
  last_synced_at timestamptz,
  last_test_at timestamptz,
  last_test_status public.email_delivery_status,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_sender_profiles_mailbox_address_valid check (
    mailbox_address ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint email_sender_profiles_reply_to_valid check (
    reply_to_email is null
    or reply_to_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create unique index if not exists email_sender_profiles_one_active_default_idx
on public.email_sender_profiles (provider)
where active and is_default;

create table if not exists public.email_action_settings (
  action_key text primary key references public.email_action_definitions (action_key) on delete cascade,
  sender_profile_id uuid references public.email_sender_profiles (id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  action_key text not null references public.email_action_definitions (action_key) on delete restrict,
  sender_profile_id uuid references public.email_sender_profiles (id) on delete set null,
  recipient_user_id uuid references public.profiles (id) on delete set null,
  recipient_role public.user_role,
  recipient_email text not null,
  subject text,
  status public.email_delivery_status not null,
  provider_message_id text,
  provider_error_code text,
  error_message text,
  attempt_count integer not null default 0,
  correlation_id text not null,
  related_entity_type text,
  related_entity_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_delivery_logs_attempt_count_non_negative check (attempt_count >= 0)
);

create table if not exists public.auth_action_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.auth_action_purpose not null,
  token_hash text not null unique,
  recipient_email text not null,
  recipient_role public.user_role not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claim_id uuid,
  claim_expires_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_action_tokens_recipient_email_valid check (
    recipient_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create table if not exists public.email_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  action_key text not null,
  identifier_hash text not null,
  ip_hash text,
  outcome text not null default 'accepted',
  created_at timestamptz not null default now()
);

drop trigger if exists set_email_sender_profiles_updated_at on public.email_sender_profiles;
create trigger set_email_sender_profiles_updated_at
before update on public.email_sender_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_email_action_settings_updated_at on public.email_action_settings;
create trigger set_email_action_settings_updated_at
before update on public.email_action_settings
for each row execute function public.set_updated_at();

create index if not exists email_action_definitions_active_idx
on public.email_action_definitions (active);

create index if not exists email_sender_profiles_mailbox_resource_id_idx
on public.email_sender_profiles (mailbox_resource_id);

create index if not exists email_action_settings_action_key_idx
on public.email_action_settings (action_key);

create index if not exists email_delivery_logs_action_created_idx
on public.email_delivery_logs (action_key, created_at desc);

create index if not exists email_delivery_logs_correlation_idx
on public.email_delivery_logs (correlation_id);

create index if not exists email_delivery_logs_recipient_user_idx
on public.email_delivery_logs (recipient_user_id);

create index if not exists auth_action_tokens_hash_idx
on public.auth_action_tokens (token_hash);

create index if not exists auth_action_tokens_user_purpose_idx
on public.auth_action_tokens (user_id, purpose);

create index if not exists auth_action_tokens_expires_idx
on public.auth_action_tokens (expires_at);

create index if not exists email_rate_limit_events_lookup_idx
on public.email_rate_limit_events (action_key, identifier_hash, created_at desc);

create index if not exists email_rate_limit_events_ip_idx
on public.email_rate_limit_events (action_key, ip_hash, created_at desc);

alter table public.email_action_definitions enable row level security;
alter table public.email_sender_profiles enable row level security;
alter table public.email_action_settings enable row level security;
alter table public.email_delivery_logs enable row level security;
alter table public.auth_action_tokens enable row level security;
alter table public.email_rate_limit_events enable row level security;

drop policy if exists "Admins can read email action definitions" on public.email_action_definitions;
create policy "Admins can read email action definitions"
on public.email_action_definitions
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read email sender profiles" on public.email_sender_profiles;
create policy "Admins can read email sender profiles"
on public.email_sender_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read email action settings" on public.email_action_settings;
create policy "Admins can read email action settings"
on public.email_action_settings
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can read email delivery logs" on public.email_delivery_logs;
create policy "Admins can read email delivery logs"
on public.email_delivery_logs
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

grant select on public.email_action_definitions to authenticated, service_role;
grant select on public.email_sender_profiles to authenticated, service_role;
grant select on public.email_action_settings to authenticated, service_role;
grant select on public.email_delivery_logs to authenticated, service_role;
grant all on public.email_action_definitions to service_role;
grant all on public.email_sender_profiles to service_role;
grant all on public.email_action_settings to service_role;
grant all on public.email_delivery_logs to service_role;
grant all on public.auth_action_tokens to service_role;
grant all on public.email_rate_limit_events to service_role;

create or replace function public.claim_auth_action_token(
  p_token_hash text,
  p_purpose public.auth_action_purpose,
  p_claim_id uuid,
  p_claim_lease_seconds integer default 120
)
returns table (
  id uuid,
  user_id uuid,
  recipient_email text,
  recipient_role public.user_role,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.auth_action_tokens token
  set
    claimed_at = now(),
    claim_id = p_claim_id,
    claim_expires_at = now() + make_interval(secs => p_claim_lease_seconds)
  where token.token_hash = p_token_hash
    and token.purpose = p_purpose
    and token.expires_at > now()
    and token.consumed_at is null
    and token.revoked_at is null
    and (
      token.claimed_at is null
      or token.claim_expires_at is null
      or token.claim_expires_at < now()
      or token.claim_id = p_claim_id
    )
  returning
    token.id,
    token.user_id,
    token.recipient_email,
    token.recipient_role,
    token.expires_at;
end;
$$;

create or replace function public.consume_auth_action_token(
  p_token_id uuid,
  p_claim_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.auth_action_tokens
  set consumed_at = now()
  where id = p_token_id
    and claim_id = p_claim_id
    and consumed_at is null
    and revoked_at is null
    and expires_at > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_auth_action_token_claim(
  p_token_id uuid,
  p_claim_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.auth_action_tokens
  set
    claimed_at = null,
    claim_id = null,
    claim_expires_at = null
  where id = p_token_id
    and claim_id = p_claim_id
    and consumed_at is null
    and revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.claim_auth_action_token(text, public.auth_action_purpose, uuid, integer) from public, anon, authenticated;
revoke all on function public.consume_auth_action_token(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_auth_action_token_claim(uuid, uuid) from public, anon, authenticated;

grant execute on function public.claim_auth_action_token(text, public.auth_action_purpose, uuid, integer) to service_role;
grant execute on function public.consume_auth_action_token(uuid, uuid) to service_role;
grant execute on function public.release_auth_action_token_claim(uuid, uuid) to service_role;

comment on table public.email_sender_profiles is
  'Hostinger sender mailboxes synced server-side. No API keys or SMTP passwords are stored.';

comment on table public.email_delivery_logs is
  'Sanitized transactional email audit log. Never store raw tokens, credentials, headers or full HTML bodies.';

comment on table public.auth_action_tokens is
  'One-time auth action tokens. Only SHA-256 token hashes are stored; raw tokens are sent only in links.';
