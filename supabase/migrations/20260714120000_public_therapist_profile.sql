create table if not exists public.therapist_profile_content_versions (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  status text not null default 'draft',
  short_intro text,
  essence_body text,
  invitation_body text,
  video_url text,
  video_provider text,
  video_thumbnail_url text,
  video_title text,
  experience_years integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_profile_content_versions_status check (
    status in ('draft', 'published', 'archived', 'in_review')
  ),
  constraint therapist_profile_content_versions_experience check (
    experience_years is null or experience_years >= 0
  )
);

create table if not exists public.therapist_profile_guide_items (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.therapist_profile_content_versions (id) on delete cascade,
  icon text not null default 'sparkles',
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.therapist_profile_reflections (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.therapist_profile_content_versions (id) on delete cascade,
  title text not null,
  excerpt text,
  image_url text,
  href text,
  minutes_to_read integer not null default 3,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_profile_reflections_minutes check (minutes_to_read > 0)
);

create table if not exists public.therapist_profile_slug_history (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  old_slug text not null unique,
  current_slug text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.therapist_service_booking_settings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.therapist_services (id) on delete cascade,
  buffer_before_minutes integer not null default 10,
  buffer_after_minutes integer not null default 10,
  min_notice_minutes integer not null default 120,
  max_days_ahead integer not null default 30,
  interval_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_service_booking_settings_positive check (
    buffer_before_minutes >= 0
    and buffer_after_minutes >= 0
    and min_notice_minutes >= 0
    and max_days_ahead > 0
    and interval_minutes > 0
  )
);

create index if not exists therapist_profile_content_versions_public_idx
  on public.therapist_profile_content_versions (therapist_profile_id, status, published_at desc);

create index if not exists therapist_profile_guide_items_content_idx
  on public.therapist_profile_guide_items (content_version_id, sort_order);

create index if not exists therapist_profile_reflections_content_idx
  on public.therapist_profile_reflections (content_version_id, sort_order);

create trigger set_therapist_profile_content_versions_updated_at
before update on public.therapist_profile_content_versions
for each row execute function public.set_updated_at();

create trigger set_therapist_profile_guide_items_updated_at
before update on public.therapist_profile_guide_items
for each row execute function public.set_updated_at();

create trigger set_therapist_profile_reflections_updated_at
before update on public.therapist_profile_reflections
for each row execute function public.set_updated_at();

create trigger set_therapist_service_booking_settings_updated_at
before update on public.therapist_service_booking_settings
for each row execute function public.set_updated_at();

alter table public.therapist_profile_content_versions enable row level security;
alter table public.therapist_profile_guide_items enable row level security;
alter table public.therapist_profile_reflections enable row level security;
alter table public.therapist_profile_slug_history enable row level security;
alter table public.therapist_service_booking_settings enable row level security;

create or replace view public.public_therapist_profiles_v as
select
  therapist_profiles.id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.plan,
  therapist_profiles.bio,
  therapist_profiles.photo_url,
  therapist_profiles.city,
  therapist_profiles.state,
  therapist_profiles.is_accepting_bookings,
  therapist_profiles.accepts_online_sessions,
  true as is_verified,
  coalesce(content.short_intro, therapist_profiles.headline) as short_intro,
  coalesce(content.short_intro, therapist_profiles.headline) as published_headline,
  coalesce(tags.tags, array[]::text[]) as tags,
  coalesce(
    content.video_url,
    therapist_profiles.metadata ->> 'video_url'
  ) as video_url,
  coalesce(content.video_provider, 'external') as video_provider,
  coalesce(content.video_thumbnail_url, '/home/tablet-video-session.png') as video_thumbnail_url,
  coalesce(content.video_title, 'Um convite para você') as video_title,
  case
    when therapist_profiles.plan = 'premium_plus' then array['Perfil verificado', 'Terapeuta Plus']::text[]
    else array['Perfil verificado']::text[]
  end as badges,
  reviews.average_rating,
  reviews.review_count,
  coalesce(sessions.sessions_completed, 0)::integer as sessions_completed,
  therapist_profiles.updated_at
from public.therapist_profiles
left join lateral (
  select *
  from public.therapist_profile_content_versions
  where therapist_profile_content_versions.therapist_profile_id = therapist_profiles.id
    and therapist_profile_content_versions.status = 'published'
  order by therapist_profile_content_versions.published_at desc nulls last,
    therapist_profile_content_versions.created_at desc
  limit 1
) as content on true
left join lateral (
  select coalesce(array_agg(tag.value order by tag.value), array[]::text[]) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist_profiles.metadata -> 'care_tags') = 'array'
        then therapist_profiles.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) as tag(value)
) as tags on true
left join lateral (
  select
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as reviews on true
left join lateral (
  select count(*) as sessions_completed
  from public.bookings
  where bookings.therapist_profile_id = therapist_profiles.id
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as sessions on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and exists (
    select 1
    from public.therapist_services
    join public.therapies
      on therapies.id = therapist_services.therapy_id
    where therapist_services.therapist_profile_id = therapist_profiles.id
      and therapist_services.status = 'active'
      and therapies.status = 'active'
  );

create or replace view public.public_therapist_profile_content_v as
select
  therapist_profiles.slug,
  therapist_profile_content_versions.therapist_profile_id,
  therapist_profile_content_versions.short_intro,
  therapist_profile_content_versions.essence_body,
  therapist_profile_content_versions.invitation_body,
  therapist_profile_content_versions.experience_years,
  coalesce(guide_items.items, '[]'::jsonb) as guide_items,
  coalesce(reflections.items, '[]'::jsonb) as reflections
from public.therapist_profiles
join public.therapist_profile_content_versions
  on therapist_profile_content_versions.therapist_profile_id = therapist_profiles.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'icon', therapist_profile_guide_items.icon,
      'label', therapist_profile_guide_items.label
    )
    order by therapist_profile_guide_items.sort_order asc
  ) as items
  from public.therapist_profile_guide_items
  where therapist_profile_guide_items.content_version_id = therapist_profile_content_versions.id
    and therapist_profile_guide_items.is_active = true
) as guide_items on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'href', therapist_profile_reflections.href,
      'imageUrl', therapist_profile_reflections.image_url,
      'minutesToRead', therapist_profile_reflections.minutes_to_read,
      'title', therapist_profile_reflections.title
    )
    order by therapist_profile_reflections.sort_order asc
  ) as items
  from public.therapist_profile_reflections
  where therapist_profile_reflections.content_version_id = therapist_profile_content_versions.id
    and therapist_profile_reflections.is_public = true
) as reflections on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profile_content_versions.status = 'published';

create or replace view public.public_therapist_profile_services_v as
select
  therapist_profiles.slug as therapist_slug,
  therapist_services.id as service_id,
  therapist_services.title as service_title,
  therapist_services.description,
  therapist_services.duration_minutes,
  therapist_services.price_cents,
  therapist_services.currency,
  therapies.name as therapy_name,
  therapies.slug as therapy_slug,
  row_number() over (
    partition by therapist_profiles.id
    order by therapist_services.price_cents asc, therapist_services.title asc
  ) as sort_order,
  coalesce(settings.buffer_before_minutes, 10) as buffer_before_minutes,
  coalesce(settings.buffer_after_minutes, 10) as buffer_after_minutes,
  coalesce(settings.min_notice_minutes, 120) as min_notice_minutes,
  coalesce(settings.max_days_ahead, 30) as max_days_ahead,
  coalesce(settings.interval_minutes, 30) as interval_minutes,
  coalesce(rules.items, '[]'::jsonb) as availability_rules,
  coalesce(exceptions.items, '[]'::jsonb) as availability_exceptions,
  coalesce(conflicts.items, '[]'::jsonb) as booking_conflicts
from public.therapist_profiles
join public.therapist_services
  on therapist_services.therapist_profile_id = therapist_profiles.id
join public.therapies
  on therapies.id = therapist_services.therapy_id
left join public.therapist_service_booking_settings as settings
  on settings.service_id = therapist_services.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', availability_rules.day_of_week,
      'endTime', availability_rules.end_time::text,
      'isActive', availability_rules.is_active,
      'serviceId', availability_rules.service_id,
      'startTime', availability_rules.start_time::text,
      'timezone', availability_rules.timezone
    )
    order by availability_rules.day_of_week asc, availability_rules.start_time asc
  ) as items
  from public.availability_rules
  where availability_rules.therapist_profile_id = therapist_profiles.id
    and (availability_rules.service_id is null or availability_rules.service_id = therapist_services.id)
    and availability_rules.is_active = true
) as rules on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'endsAt', availability_exceptions.ends_at,
      'isAvailable', availability_exceptions.is_available,
      'serviceId', availability_exceptions.service_id,
      'startsAt', availability_exceptions.starts_at
    )
  ) as items
  from public.availability_exceptions
  where availability_exceptions.therapist_profile_id = therapist_profiles.id
    and (availability_exceptions.service_id is null or availability_exceptions.service_id = therapist_services.id)
    and availability_exceptions.ends_at >= now()
) as exceptions on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'endsAt', bookings.ends_at,
      'serviceId', bookings.service_id,
      'startsAt', bookings.starts_at,
      'status', bookings.status
    )
  ) as items
  from public.bookings
  where bookings.therapist_profile_id = therapist_profiles.id
    and bookings.service_id = therapist_services.id
    and bookings.ends_at >= now()
    and bookings.status in ('pending_payment', 'confirmed', 'completed')
) as conflicts on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_services.status = 'active'
  and therapist_services.online_only = true
  and therapies.status = 'active';

create or replace view public.public_therapist_profile_reviews_v as
select
  therapist_profiles.slug as therapist_slug,
  reviews.id,
  'Paciente TES'::text as author_label,
  reviews.comment as body,
  'Sessão concluída pela plataforma'::text as patient_context,
  case
    when reviews.published_at >= now() - interval '2 days' then 'Há dois dias'
    when reviews.published_at >= now() - interval '8 days' then 'Há uma semana'
    else 'Experiência compartilhada'
  end as created_label,
  reviews.rating,
  reviews.published_at
from public.reviews
join public.bookings
  on bookings.id = reviews.booking_id
join public.therapist_profiles
  on therapist_profiles.id = reviews.therapist_profile_id
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and reviews.status = 'published'
  and reviews.comment is not null
  and bookings.status = 'completed'
  and bookings.payment_status = 'paid';

create or replace view public.public_therapist_slug_redirects_v as
select
  old_slug,
  current_slug
from public.therapist_profile_slug_history;

grant select on public.public_therapist_profiles_v to anon, authenticated, service_role;
grant select on public.public_therapist_profile_content_v to anon, authenticated, service_role;
grant select on public.public_therapist_profile_services_v to anon, authenticated, service_role;
grant select on public.public_therapist_profile_reviews_v to anon, authenticated, service_role;
grant select on public.public_therapist_slug_redirects_v to anon, authenticated, service_role;

comment on view public.public_therapist_profiles_v is
  'Safe public projection for public therapist profile pages. Exposes approved public profiles only.';

comment on view public.public_therapist_profile_services_v is
  'Safe public projection for public therapist services and derived availability inputs.';

comment on view public.public_therapist_profile_reviews_v is
  'Safe public projection for published reviews linked to paid completed bookings only.';
