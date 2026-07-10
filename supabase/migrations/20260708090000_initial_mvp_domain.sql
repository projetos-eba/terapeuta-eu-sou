create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('patient', 'therapist', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.therapist_plan as enum ('free', 'premium', 'premium_plus');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.therapist_status as enum (
    'draft',
    'submitted',
    'in_review',
    'changes_requested',
    'approved',
    'rejected',
    'suspended'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.therapy_status as enum (
    'draft',
    'active',
    'inactive',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.service_status as enum (
    'draft',
    'active',
    'paused',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.booking_status as enum (
    'draft',
    'pending_payment',
    'confirmed',
    'completed',
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'no_show_patient',
    'no_show_therapist',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'not_started',
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.match_source as enum (
    'journey',
    'therapy_page',
    'therapist_search'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_context as enum (
    'patient_to_therapist',
    'patient_to_support',
    'therapist_to_patient',
    'system'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.review_status as enum (
    'pending',
    'published',
    'hidden',
    'reported',
    'removed'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'patient',
  display_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  birth_date date,
  phone text,
  avatar_url text,
  timezone text not null default 'America/Sao_Paulo',
  marketing_consent boolean not null default false,
  sensitive_data_consent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapist_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan public.therapist_plan not null default 'free',
  status public.therapist_status not null default 'draft',
  slug text not null unique,
  public_name text not null,
  legal_name text,
  headline text,
  bio text,
  photo_url text,
  city text,
  state text,
  country text default 'BR',
  languages text[] not null default array['pt-BR'],
  is_public boolean not null default false,
  is_accepting_bookings boolean not null default false,
  accepts_online_sessions boolean not null default true,
  visibility_flags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapist_verifications (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  status public.therapist_status not null default 'submitted',
  documents_metadata jsonb not null default '{}'::jsonb,
  changes_requested text,
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapy_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapies (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.therapy_categories (id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text,
  status public.therapy_status not null default 'draft',
  is_featured boolean not null default false,
  safety_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapy_themes (
  id uuid primary key default gen_random_uuid(),
  parent_theme_id uuid references public.therapy_themes (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapy_theme_weights (
  id uuid primary key default gen_random_uuid(),
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  theme_id uuid references public.therapy_themes (id) on delete cascade,
  subtheme_id uuid references public.therapy_themes (id) on delete cascade,
  weight numeric(6, 2) not null default 1,
  reason text,
  source public.match_source not null default 'journey',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapy_theme_weights_has_theme check (
    theme_id is not null or subtheme_id is not null
  ),
  constraint therapy_theme_weights_positive_weight check (weight > 0)
);

create table if not exists public.therapist_services (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  therapy_id uuid not null references public.therapies (id) on delete restrict,
  title text not null,
  description text,
  duration_minutes integer not null,
  price_cents integer not null,
  currency char(3) not null default 'BRL',
  status public.service_status not null default 'draft',
  online_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_services_duration_positive check (duration_minutes > 0),
  constraint therapist_services_price_non_negative check (price_cents >= 0)
);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  service_id uuid references public.therapist_services (id) on delete cascade,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Sao_Paulo',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rules_day_of_week check (day_of_week between 0 and 6),
  constraint availability_rules_valid_time check (start_time < end_time)
);

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  service_id uuid references public.therapist_services (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exceptions_valid_range check (starts_at < ends_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  service_id uuid not null references public.therapist_services (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  status public.booking_status not null default 'draft',
  payment_status public.payment_status not null default 'not_started',
  meeting_provider text,
  meeting_url text,
  cancellation_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_range check (starts_at < ends_at)
);

create table if not exists public.pre_checkout_intakes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles (id) on delete set null,
  service_id uuid references public.therapist_services (id) on delete set null,
  objective text not null,
  expectation text,
  initial_context text,
  sensitive_data_acknowledged boolean not null default false,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  provider text not null default 'stripe',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  therapist_amount_cents integer not null default 0,
  currency char(3) not null default 'BRL',
  status public.payment_status not null default 'not_started',
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount_cents >= 0),
  constraint payments_platform_fee_non_negative check (platform_fee_cents >= 0),
  constraint payments_therapist_amount_non_negative check (therapist_amount_cents >= 0)
);

create table if not exists public.favorite_therapists (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorite_therapists_unique_pair unique (
    patient_profile_id,
    therapist_profile_id
  )
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  context public.message_context not null,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.structured_messages (
  id uuid primary key default gen_random_uuid(),
  context public.message_context not null,
  sender_profile_id uuid references public.profiles (id) on delete set null,
  patient_profile_id uuid references public.patient_profiles (id) on delete set null,
  therapist_profile_id uuid references public.therapist_profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  template_id uuid references public.message_templates (id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  rating integer not null,
  comment text,
  status public.review_status not null default 'pending',
  moderation_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5)
);

create table if not exists public.aura_recommendations (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid references public.therapist_profiles (id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  source_rule_key text not null,
  title text not null,
  body text not null,
  plan_required public.therapist_plan not null default 'premium',
  context jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid references public.profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  category text not null,
  subject text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists therapist_profiles_plan_idx on public.therapist_profiles (plan);
create index if not exists therapist_profiles_status_idx on public.therapist_profiles (status);
create index if not exists therapist_profiles_public_idx on public.therapist_profiles (is_public, status);
create index if not exists therapist_verifications_status_idx on public.therapist_verifications (status);
create index if not exists therapies_category_idx on public.therapies (category_id);
create index if not exists therapies_status_idx on public.therapies (status);
create index if not exists therapy_themes_parent_idx on public.therapy_themes (parent_theme_id);
create index if not exists therapy_theme_weights_therapy_idx on public.therapy_theme_weights (therapy_id);
create index if not exists therapy_theme_weights_theme_idx on public.therapy_theme_weights (theme_id);
create index if not exists therapy_theme_weights_subtheme_idx on public.therapy_theme_weights (subtheme_id);
create index if not exists therapist_services_therapist_idx on public.therapist_services (therapist_profile_id);
create index if not exists therapist_services_therapy_idx on public.therapist_services (therapy_id);
create index if not exists therapist_services_status_idx on public.therapist_services (status);
create index if not exists availability_rules_therapist_day_idx on public.availability_rules (therapist_profile_id, day_of_week);
create index if not exists availability_exceptions_therapist_range_idx on public.availability_exceptions (therapist_profile_id, starts_at, ends_at);
create index if not exists bookings_patient_idx on public.bookings (patient_profile_id);
create index if not exists bookings_therapist_idx on public.bookings (therapist_profile_id);
create index if not exists bookings_service_starts_idx on public.bookings (service_id, starts_at);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists favorite_therapists_patient_idx on public.favorite_therapists (patient_profile_id);
create index if not exists structured_messages_booking_idx on public.structured_messages (booking_id);
create index if not exists reviews_therapist_status_idx on public.reviews (therapist_profile_id, status);
create index if not exists aura_recommendations_therapist_idx on public.aura_recommendations (therapist_profile_id, is_active);
create index if not exists support_tickets_requester_idx on public.support_tickets (requester_profile_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

create trigger set_therapist_profiles_updated_at
before update on public.therapist_profiles
for each row execute function public.set_updated_at();

create trigger set_therapist_verifications_updated_at
before update on public.therapist_verifications
for each row execute function public.set_updated_at();

create trigger set_therapy_categories_updated_at
before update on public.therapy_categories
for each row execute function public.set_updated_at();

create trigger set_therapies_updated_at
before update on public.therapies
for each row execute function public.set_updated_at();

create trigger set_therapy_themes_updated_at
before update on public.therapy_themes
for each row execute function public.set_updated_at();

create trigger set_therapy_theme_weights_updated_at
before update on public.therapy_theme_weights
for each row execute function public.set_updated_at();

create trigger set_therapist_services_updated_at
before update on public.therapist_services
for each row execute function public.set_updated_at();

create trigger set_availability_rules_updated_at
before update on public.availability_rules
for each row execute function public.set_updated_at();

create trigger set_availability_exceptions_updated_at
before update on public.availability_exceptions
for each row execute function public.set_updated_at();

create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger set_pre_checkout_intakes_updated_at
before update on public.pre_checkout_intakes
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_message_templates_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

create trigger set_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger set_aura_recommendations_updated_at
before update on public.aura_recommendations
for each row execute function public.set_updated_at();

create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.therapist_profiles enable row level security;
alter table public.therapist_verifications enable row level security;
alter table public.therapy_categories enable row level security;
alter table public.therapies enable row level security;
alter table public.therapy_themes enable row level security;
alter table public.therapy_theme_weights enable row level security;
alter table public.therapist_services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.pre_checkout_intakes enable row level security;
alter table public.payments enable row level security;
alter table public.favorite_therapists enable row level security;
alter table public.message_templates enable row level security;
alter table public.structured_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.aura_recommendations enable row level security;
alter table public.support_tickets enable row level security;

create policy "Profiles can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Patients can read their own patient profile"
on public.patient_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Therapists can read their own therapist profile"
on public.therapist_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Active therapy categories are readable"
on public.therapy_categories
for select
using (is_active = true);

create policy "Active therapies are readable"
on public.therapies
for select
using (status = 'active');

create policy "Active therapy themes are readable"
on public.therapy_themes
for select
using (is_active = true);

grant usage on schema public to anon, authenticated, service_role;

grant select on public.therapy_categories to anon, authenticated, service_role;
grant select on public.therapies to anon, authenticated, service_role;
grant select on public.therapy_themes to anon, authenticated, service_role;
grant select on public.therapy_theme_weights to service_role;

create policy "Patients can read their favorite therapists"
on public.favorite_therapists
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = favorite_therapists.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

create policy "Patients can add their favorite therapists"
on public.favorite_therapists
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = favorite_therapists.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

create policy "Patients can remove their favorite therapists"
on public.favorite_therapists
for delete
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = favorite_therapists.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

comment on table public.therapy_theme_weights is
  'Deterministic matching weights. Keep RLS closed until Edge Function/view strategy is defined.';

comment on table public.therapist_profiles is
  'Operational therapist data. Public listing should use a safe view or Edge Function.';

comment on table public.pre_checkout_intakes is
  'Potentially sensitive intake content. Collect minimum data and avoid logging payloads.';

comment on table public.aura_recommendations is
  'Rule-based recommendations for MVP. No generative AI is used in this schema.';

-- TODO: Add admin policies after admin guard strategy is implemented.
-- TODO: Add public therapist profile and service views before exposing therapist data to anonymous users.
-- TODO: Add booking write policies only through validated Edge Functions.
-- TODO: Add payment policies after Stripe flow and webhook ownership rules are defined.
