do $$
begin
  create type public.matching_version_status as enum (
    'draft',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.matching_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matching_interests (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.matching_themes (id) on delete cascade,
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matching_versions (
  id uuid primary key default gen_random_uuid(),
  status public.matching_version_status not null default 'draft',
  version integer not null unique,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists matching_versions_single_published_idx
on public.matching_versions (status)
where status = 'published';

create table if not exists public.matching_therapy_settings (
  therapy_id uuid primary key references public.therapies (id) on delete cascade,
  is_visible_in_matching boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matching_weights (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.matching_versions (id) on delete cascade,
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  theme_id uuid references public.matching_themes (id) on delete cascade,
  interest_id uuid references public.matching_interests (id) on delete cascade,
  weight numeric(3, 1) not null,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_weights_one_target check (
    (theme_id is not null and interest_id is null)
    or (theme_id is null and interest_id is not null)
  ),
  constraint matching_weights_range check (weight >= 0 and weight <= 5)
);

create unique index if not exists matching_weights_unique_theme_idx
on public.matching_weights (version_id, therapy_id, theme_id)
where theme_id is not null;

create unique index if not exists matching_weights_unique_interest_idx
on public.matching_weights (version_id, therapy_id, interest_id)
where interest_id is not null;

drop trigger if exists set_matching_themes_updated_at on public.matching_themes;
create trigger set_matching_themes_updated_at
before update on public.matching_themes
for each row execute function public.set_updated_at();

drop trigger if exists set_matching_interests_updated_at on public.matching_interests;
create trigger set_matching_interests_updated_at
before update on public.matching_interests
for each row execute function public.set_updated_at();

drop trigger if exists set_matching_versions_updated_at on public.matching_versions;
create trigger set_matching_versions_updated_at
before update on public.matching_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_matching_therapy_settings_updated_at on public.matching_therapy_settings;
create trigger set_matching_therapy_settings_updated_at
before update on public.matching_therapy_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_matching_weights_updated_at on public.matching_weights;
create trigger set_matching_weights_updated_at
before update on public.matching_weights
for each row execute function public.set_updated_at();

create or replace view public.public_matching_config as
select
  matching_versions.id as version_id,
  matching_versions.version,
  matching_themes.id as theme_id,
  matching_themes.name as theme_name,
  matching_themes.slug as theme_slug,
  matching_themes.description as theme_description,
  matching_themes.image_url as theme_image_url,
  matching_themes.sort_order as theme_sort_order,
  matching_interests.id as interest_id,
  matching_interests.name as interest_name,
  matching_interests.slug as interest_slug,
  matching_interests.sort_order as interest_sort_order
from public.matching_versions
join public.matching_themes
  on matching_themes.is_active = true
left join public.matching_interests
  on matching_interests.theme_id = matching_themes.id
  and matching_interests.is_active = true
where matching_versions.status = 'published'
order by matching_themes.sort_order, matching_interests.sort_order;

create or replace view public.public_matching_therapist_counts as
select
  therapies.id as therapy_id,
  count(distinct therapist_profiles.id)::integer as therapist_count
from public.therapies
left join public.therapist_services
  on therapist_services.therapy_id = therapies.id
  and therapist_services.status = 'active'
  and therapist_services.online_only = true
left join public.therapist_profiles
  on therapist_profiles.id = therapist_services.therapist_profile_id
  and therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
group by therapies.id;

grant select on public.public_matching_config to anon, authenticated, service_role;
grant select on public.public_matching_therapist_counts to anon, authenticated, service_role;
grant select on public.matching_themes to anon, authenticated;
grant select on public.matching_interests to anon, authenticated;
grant select on public.matching_versions to anon, authenticated;

alter table public.matching_themes enable row level security;
alter table public.matching_interests enable row level security;
alter table public.matching_versions enable row level security;
alter table public.matching_therapy_settings enable row level security;
alter table public.matching_weights enable row level security;

drop policy if exists "matching themes public active read" on public.matching_themes;
create policy "matching themes public active read"
on public.matching_themes
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "matching interests public active read" on public.matching_interests;
create policy "matching interests public active read"
on public.matching_interests
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.matching_themes
    where matching_themes.id = matching_interests.theme_id
      and matching_themes.is_active = true
  )
);

drop policy if exists "matching versions public published read" on public.matching_versions;
create policy "matching versions public published read"
on public.matching_versions
for select
to anon, authenticated
using (status = 'published');

comment on table public.matching_themes is
  'Temas publicos do Match; substituem o uso ambiguo de therapy_themes na jornada.';
comment on table public.matching_interests is
  'Interesses publicos do Match, cada um pertencendo a exatamente um tema.';
comment on table public.matching_weights is
  'Pesos internos versionados do Match. Nao expor diretamente ao cliente.';
