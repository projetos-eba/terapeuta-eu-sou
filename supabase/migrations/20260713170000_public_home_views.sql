create or replace view public.public_home_therapies as
select
  therapies.id,
  therapies.name,
  therapies.slug,
  therapies.slug as href_slug,
  therapies.short_description,
  therapies.is_featured,
  therapy_categories.name as category_name,
  therapy_categories.slug as category_slug,
  therapies.updated_at
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
where therapies.status = 'active'
  and therapy_categories.is_active = true;

create or replace view public.public_home_therapists as
select
  therapist_profiles.id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.headline,
  therapist_profiles.photo_url,
  therapist_profiles.accepts_online_sessions,
  service_summary.service_title,
  service_summary.service_price_from_cents,
  review_summary.average_rating,
  review_summary.review_count,
  therapist_profiles.updated_at
from public.therapist_profiles
left join lateral (
  select
    therapist_services.title as service_title,
    min(therapist_services.price_cents) as service_price_from_cents
  from public.therapist_services
  where therapist_services.therapist_profile_id = therapist_profiles.id
    and therapist_services.status = 'active'
    and therapist_services.online_only = true
  group by therapist_services.title
  order by min(therapist_services.price_cents) asc, therapist_services.title asc
  limit 1
) as service_summary on true
left join lateral (
  select
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.reviews
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
) as review_summary on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true;

create or replace view public.public_home_testimonials as
select
  reviews.id,
  'Paciente TES'::text as author_name,
  reviews.comment as body,
  'Depoimento publicado'::text as context_label,
  reviews.rating,
  reviews.published_at,
  reviews.created_at
from public.reviews
where reviews.status = 'published'
  and reviews.comment is not null
  and length(trim(reviews.comment)) >= 24;

grant select on public.public_home_therapies to anon, authenticated, service_role;
grant select on public.public_home_therapists to anon, authenticated, service_role;
grant select on public.public_home_testimonials to anon, authenticated, service_role;

comment on view public.public_home_therapies is
  'Safe public projection for the public home. Exposes active therapy catalog fields only.';

comment on view public.public_home_therapists is
  'Safe public projection for the public home. Exposes only approved public therapist listing fields and published review aggregates.';

comment on view public.public_home_testimonials is
  'Safe public projection for the public home. Exposes published review comments without patient identifiers.';
