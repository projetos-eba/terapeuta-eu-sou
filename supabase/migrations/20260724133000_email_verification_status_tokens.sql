create table if not exists public.email_verification_status_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  recipient_role public.user_role not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_status_tokens_hash_idx
on public.email_verification_status_tokens (token_hash);

create index if not exists email_verification_status_tokens_user_idx
on public.email_verification_status_tokens (user_id);

create index if not exists email_verification_status_tokens_expires_idx
on public.email_verification_status_tokens (expires_at);

alter table public.email_verification_status_tokens enable row level security;

grant all on public.email_verification_status_tokens to service_role;

comment on table public.email_verification_status_tokens is
  'Opaque polling tokens for email verification status. Only SHA-256 token hashes are stored; no email or raw token is persisted.';
