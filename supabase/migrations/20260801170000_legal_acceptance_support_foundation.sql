-- Legal launch foundation: document versions, immutable acceptances and support ticket creation.

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null,
  title text not null,
  audience text[] not null default array[]::text[],
  version text not null,
  content_hash text not null,
  canonical_path text,
  language text not null default 'pt-BR',
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by text,
  effective_at timestamptz,
  published_at timestamptz,
  superseded_at timestamptz,
  requires_new_acceptance boolean not null default false,
  change_summary text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_document_versions_key_not_blank check (length(trim(document_key)) > 0),
  constraint legal_document_versions_title_not_blank check (length(trim(title)) > 0),
  constraint legal_document_versions_version_not_blank check (length(trim(version)) > 0),
  constraint legal_document_versions_hash_not_blank check (length(trim(content_hash)) > 0),
  constraint legal_document_versions_language check (language = 'pt-BR'),
  constraint legal_document_versions_status check (
    status in (
      'draft',
      'legal_review',
      'approved',
      'scheduled',
      'published',
      'superseded',
      'withdrawn'
    )
  ),
  constraint legal_document_versions_published_complete check (
    status <> 'published'
    or (
      approved_at is not null
      and approved_by is not null
      and effective_at is not null
      and published_at is not null
      and canonical_path is not null
    )
  ),
  constraint legal_document_versions_unique unique (document_key, version)
);

create unique index if not exists legal_document_versions_one_published_idx
on public.legal_document_versions (document_key)
where status = 'published';

create index if not exists legal_document_versions_status_effective_idx
on public.legal_document_versions (document_key, status, effective_at desc);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  actor_role text not null,
  document_version_id uuid not null references public.legal_document_versions (id) on delete restrict,
  document_key text not null,
  document_version text not null,
  content_hash text not null,
  context text not null,
  booking_id uuid references public.bookings (id) on delete restrict,
  request_id uuid not null,
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  superseded_at timestamptz,
  constraint legal_acceptances_actor_role check (
    actor_role in ('patient', 'therapist', 'admin')
  ),
  constraint legal_acceptances_context check (
    context in (
      'patient_signup',
      'therapist_signup',
      'reservation_checkout',
      'new_acceptance'
    )
  ),
  constraint legal_acceptances_document_key_not_blank check (length(trim(document_key)) > 0),
  constraint legal_acceptances_version_not_blank check (length(trim(document_version)) > 0),
  constraint legal_acceptances_hash_not_blank check (length(trim(content_hash)) > 0),
  constraint legal_acceptances_request_unique unique (
    profile_id,
    document_version_id,
    context,
    request_id
  )
);

create index if not exists legal_acceptances_profile_created_idx
on public.legal_acceptances (profile_id, accepted_at desc);

create index if not exists legal_acceptances_booking_idx
on public.legal_acceptances (booking_id)
where booking_id is not null;

drop trigger if exists set_legal_document_versions_updated_at
on public.legal_document_versions;
create trigger set_legal_document_versions_updated_at
before update on public.legal_document_versions
for each row execute function public.set_updated_at();

create or replace function public.prevent_published_legal_document_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'published'
    and (
      new.document_key is distinct from old.document_key
      or new.title is distinct from old.title
      or new.audience is distinct from old.audience
      or new.version is distinct from old.version
      or new.content_hash is distinct from old.content_hash
      or new.canonical_path is distinct from old.canonical_path
      or new.language is distinct from old.language
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.effective_at is distinct from old.effective_at
      or new.published_at is distinct from old.published_at
      or new.requires_new_acceptance is distinct from old.requires_new_acceptance
      or new.change_summary is distinct from old.change_summary
      or new.source_reference is distinct from old.source_reference
    )
  then
    raise exception 'published legal document versions are immutable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists a10_prevent_published_legal_document_mutation
on public.legal_document_versions;
create trigger a10_prevent_published_legal_document_mutation
before update on public.legal_document_versions
for each row execute function public.prevent_published_legal_document_mutation_v1();

create or replace function public.prevent_legal_acceptance_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (
      new.profile_id is distinct from old.profile_id
      or new.actor_role is distinct from old.actor_role
      or new.document_version_id is distinct from old.document_version_id
      or new.document_key is distinct from old.document_key
      or new.document_version is distinct from old.document_version
      or new.content_hash is distinct from old.content_hash
      or new.context is distinct from old.context
      or new.booking_id is distinct from old.booking_id
      or new.request_id is distinct from old.request_id
      or new.evidence is distinct from old.evidence
      or new.accepted_at is distinct from old.accepted_at
    )
  then
    raise exception 'legal acceptances are immutable'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'legal acceptances cannot be deleted'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists a10_prevent_legal_acceptance_update
on public.legal_acceptances;
create trigger a10_prevent_legal_acceptance_update
before update on public.legal_acceptances
for each row execute function public.prevent_legal_acceptance_mutation_v1();

drop trigger if exists a10_prevent_legal_acceptance_delete
on public.legal_acceptances;
create trigger a10_prevent_legal_acceptance_delete
before delete on public.legal_acceptances
for each row execute function public.prevent_legal_acceptance_mutation_v1();

alter table public.bookings
  add column if not exists legal_terms_version_id uuid references public.legal_document_versions (id) on delete restrict,
  add column if not exists legal_privacy_version_id uuid references public.legal_document_versions (id) on delete restrict,
  add column if not exists legal_cancellation_policy_version_id uuid references public.legal_document_versions (id) on delete restrict,
  add column if not exists legal_acceptance_recorded_at timestamptz;

alter table public.support_tickets
  add column if not exists request_id uuid,
  add column if not exists correlation_id uuid,
  add column if not exists diagnostic_context jsonb not null default '{}'::jsonb,
  add column if not exists source text not null default 'message_center',
  add column if not exists urgency text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_requester_request_unique'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_requester_request_unique
      unique (requester_profile_id, request_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_source_valid'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_source_valid
      check (source in ('message_center', 'encounter_detail', 'waiting_room', 'public_help'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_urgency_valid'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_urgency_valid
      check (urgency in ('normal', 'high', 'critical'));
  end if;
end $$;

create index if not exists support_tickets_booking_created_idx
on public.support_tickets (booking_id, created_at desc)
where booking_id is not null;

create index if not exists support_tickets_status_priority_idx
on public.support_tickets (status, priority, created_at desc);

create or replace function public.register_legal_acceptance_v1(
  p_profile_id uuid,
  p_actor_role text,
  p_document_key text,
  p_context text,
  p_request_id uuid,
  p_booking_id uuid default null,
  p_evidence jsonb default '{}'::jsonb
)
returns public.legal_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.legal_document_versions%rowtype;
  v_acceptance public.legal_acceptances%rowtype;
begin
  if p_profile_id is null
    or p_request_id is null
    or length(trim(coalesce(p_document_key, ''))) = 0
  then
    raise exception 'invalid legal acceptance request'
      using errcode = '22023';
  end if;

  select *
    into v_document
  from public.legal_document_versions
  where document_key = p_document_key
    and status = 'published'
    and effective_at <= now()
  order by effective_at desc, published_at desc
  limit 1;

  if not found then
    raise exception 'published legal document not found: %', p_document_key
      using errcode = 'P0002';
  end if;

  insert into public.legal_acceptances (
    profile_id,
    actor_role,
    document_version_id,
    document_key,
    document_version,
    content_hash,
    context,
    booking_id,
    request_id,
    evidence
  )
  values (
    p_profile_id,
    p_actor_role,
    v_document.id,
    v_document.document_key,
    v_document.version,
    v_document.content_hash,
    p_context,
    p_booking_id,
    p_request_id,
    coalesce(p_evidence, '{}'::jsonb)
  )
  on conflict (profile_id, document_version_id, context, request_id)
  do update set revoked_at = public.legal_acceptances.revoked_at
  returning * into v_acceptance;

  return v_acceptance;
end;
$$;

alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

drop policy if exists "Published legal documents are public"
on public.legal_document_versions;
create policy "Published legal documents are public"
on public.legal_document_versions
for select
to anon, authenticated
using (status = 'published' and effective_at <= now());

drop policy if exists "Profiles can read own legal acceptances"
on public.legal_acceptances;
create policy "Profiles can read own legal acceptances"
on public.legal_acceptances
for select
to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "Profiles can create own support tickets"
on public.support_tickets;
create policy "Profiles can create own support tickets"
on public.support_tickets
for insert
to authenticated
with check (
  requester_profile_id = (select auth.uid())
  and length(trim(category)) > 0
  and length(trim(subject)) > 0
);

grant select on public.legal_document_versions to anon, authenticated;
grant select on public.legal_acceptances to authenticated;
grant insert on public.legal_acceptances to service_role;
grant insert on public.support_tickets to authenticated;

revoke all on function public.prevent_published_legal_document_mutation_v1()
from public;
revoke all on function public.prevent_legal_acceptance_mutation_v1()
from public;
revoke all on function public.register_legal_acceptance_v1(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb
)
from public;

grant execute on function public.register_legal_acceptance_v1(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb
)
to service_role;

comment on table public.legal_document_versions is
  'Versioned registry of approved legal documents. Published versions are immutable.';

comment on table public.legal_acceptances is
  'Immutable evidence of user acceptance for a server-selected legal document version.';
