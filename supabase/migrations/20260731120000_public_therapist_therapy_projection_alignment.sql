-- Align public therapist and matching projections with canonical therapy IDs.
-- Reversal strategy: restore the previous view definitions from
-- 20260728091000_therapy_service_foundation_phase1.sql and
-- 20260724120000_lock_public_matching_to_published_therapy_details.sql.

drop view if exists public.public_therapist_profile_services_v;

create or replace view public.public_therapist_profile_services_v as
select
  therapist_profiles.slug as therapist_slug,
  therapist_services.id as service_id,
  therapist_services.title as service_title,
  therapist_services.description,
  therapist_services.duration_minutes,
  therapist_services.price_cents,
  therapist_services.currency,
  therapies.id as therapy_id,
  therapies.name as therapy_name,
  therapies.slug as therapy_slug,
  row_number() over (
    partition by therapist_profiles.id
    order by therapist_services.position asc nulls last,
      therapist_services.price_cents asc,
      therapies.name asc,
      therapist_services.title asc,
      therapist_services.id asc
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
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
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
    and (
      availability_rules.service_id is null
      or availability_rules.service_id = therapist_services.id
    )
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
    and (
      availability_exceptions.service_id is null
      or availability_exceptions.service_id = therapist_services.id
    )
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
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true
  and therapist_services.status = 'active'
  and therapist_services.is_bookable = true
  and therapist_services.online_only = true
  and therapies.status = 'published'
  and therapies.is_public_visible = true
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
join lateral (
  select
    therapist_services.title as service_title,
    therapist_services.price_cents as service_price_from_cents
  from public.therapist_services
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  join public.therapy_categories
    on therapy_categories.id = therapies.category_id
  where therapist_services.therapist_profile_id = therapist_profiles.id
    and therapist_services.status = 'active'
    and therapist_services.is_bookable = true
    and therapist_services.online_only = true
    and therapies.status = 'published'
    and therapies.is_public_visible = true
    and therapy_categories.is_active = true
  order by therapist_services.position asc nulls last,
    therapist_services.price_cents asc,
    therapies.name asc,
    therapist_services.title asc,
    therapist_services.id asc
  limit 1
) as service_summary on true
left join lateral (
  select
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  join public.session_payments
    on session_payments.booking_id = bookings.id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and session_payments.financial_status = 'paid'
) as review_summary on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true;

drop view if exists public.public_matching_therapies_v;

create or replace view public.public_matching_therapies_v as
select
  public_therapy_details_v.id,
  public_therapy_details_v.name,
  public_therapy_details_v.slug,
  public_therapy_details_v.short_description,
  public_therapy_details_v.description,
  public_therapy_details_v.image_url,
  therapies.status,
  public_therapy_details_v.therapist_count,
  matching_therapy_settings.is_visible_in_matching
from public.public_therapy_details_v
join public.therapies
  on therapies.id = public_therapy_details_v.id
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = public_therapy_details_v.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and matching_therapy_settings.is_visible_in_matching = true;

grant select on public.public_home_therapists to anon, authenticated, service_role;
grant select on public.public_therapist_profile_services_v to anon, authenticated, service_role;
grant select on public.public_matching_therapies_v to anon, authenticated, service_role;

comment on view public.public_home_therapists is
  'Safe public projection for the public home. Therapists must be approved, public, accepting online bookings and have at least one active public bookable service.';
comment on view public.public_therapist_profile_services_v is
  'Safe public projection for public therapist services with canonical therapy identity and derived availability inputs.';
comment on view public.public_matching_therapies_v is
  'Safe public projection for Match candidates, including canonical therapy image from public detail content.';
