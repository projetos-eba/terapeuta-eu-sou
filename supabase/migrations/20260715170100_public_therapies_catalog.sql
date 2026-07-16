create extension if not exists unaccent;

alter table public.therapies
  add column if not exists image_url text,
  add column if not exists published_at timestamptz,
  add column if not exists popularity_score integer not null default 0,
  add column if not exists search_aliases text[] not null default '{}'::text[],
  add column if not exists is_public_visible boolean not null default true;

create index if not exists therapies_public_catalog_idx
  on public.therapies (status, is_public_visible, published_at desc, popularity_score desc);

create index if not exists therapies_category_public_idx
  on public.therapies (category_id, status, is_public_visible);

drop policy if exists "Active therapies are readable" on public.therapies;
create policy "Public therapies are readable"
on public.therapies
for select
using (status in ('active', 'published') and is_public_visible = true);

create or replace view public.public_therapies_v as
with therapist_counts as (
  select
    therapist_services.therapy_id,
    count(distinct therapist_profiles.id)::integer as therapist_count
  from public.therapist_services
  join public.therapist_profiles
    on therapist_profiles.id = therapist_services.therapist_profile_id
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  where therapist_profiles.status = 'approved'
    and therapist_profiles.is_public = true
    and therapist_profiles.is_accepting_bookings = true
    and therapist_services.status = 'active'
    and therapist_services.online_only = true
    and therapies.status in ('active', 'published')
    and therapies.is_public_visible = true
  group by therapist_services.therapy_id
)
select
  therapies.id,
  therapies.slug,
  therapies.name,
  therapies.short_description,
  therapies.description,
  therapies.image_url,
  therapies.status,
  therapies.published_at,
  therapies.popularity_score,
  therapies.created_at,
  therapies.updated_at,
  therapy_categories.id as category_id,
  therapy_categories.slug as category_slug,
  therapy_categories.name as category_name,
  therapy_categories.sort_order as category_sort_order,
  coalesce(therapist_counts.therapist_count, 0)::integer as therapist_count,
  (therapies.popularity_score >= 80 or therapies.is_featured = true) as is_popular,
  (
    therapies.published_at is not null
    and therapies.published_at >= now() - interval '45 days'
  ) as is_new,
  lower(
    public.unaccent(
      concat_ws(
        ' ',
        therapies.name,
        therapies.short_description,
        therapies.description,
        therapy_categories.name,
        array_to_string(therapies.search_aliases, ' ')
      )
    )
  ) as search_text
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join therapist_counts
  on therapist_counts.therapy_id = therapies.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and therapy_categories.is_active = true;

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
where therapies.status in ('active', 'published')
  and therapies.is_public_visible = true
  and therapy_categories.is_active = true;

create or replace view public.public_therapist_search as
select
  therapist_profiles.id as therapist_profile_id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.headline as therapist_headline,
  therapist_profiles.bio as therapist_bio,
  therapist_profiles.photo_url,
  therapist_profiles.city,
  therapist_profiles.state,
  service_summary.service_id,
  service_summary.service_title,
  service_summary.service_description,
  service_summary.service_price_cents,
  service_summary.duration_minutes,
  service_summary.therapy_id,
  service_summary.therapy_name,
  service_summary.therapy_slug,
  theme_summary.theme_names,
  theme_summary.theme_slugs,
  coalesce(care_tags.tags, theme_summary.theme_names, array[service_summary.therapy_name]) as tags,
  next_slot.next_slot_at,
  coalesce(review_summary.average_rating, 0) as average_rating,
  coalesce(review_summary.review_count, 0)::integer as review_count,
  review_quote.review_quote,
  coalesce((therapist_profiles.metadata ->> 'has_intro_video')::boolean, false) as has_video,
  coalesce(
    therapist_profiles.metadata ->> 'highlight',
    case
      when therapist_profiles.plan in ('premium', 'premium_plus') then 'Destaque TES'
      else 'Perfil Verificado'
    end
  ) as highlight,
  case
    when therapist_profiles.metadata ->> 'highlight_tone' in ('featured', 'verified')
      then therapist_profiles.metadata ->> 'highlight_tone'
    when therapist_profiles.plan in ('premium', 'premium_plus') then 'featured'
    else 'verified'
  end as highlight_tone,
  concat_ws(
    ' ',
    therapist_profiles.public_name,
    therapist_profiles.headline,
    therapist_profiles.bio,
    therapist_profiles.city,
    therapist_profiles.state,
    service_summary.service_title,
    service_summary.service_description,
    service_summary.therapy_name,
    array_to_string(theme_summary.theme_names, ' '),
    array_to_string(care_tags.tags, ' ')
  ) as search_text,
  therapist_profiles.updated_at
from public.therapist_profiles
join lateral (
  select
    therapist_services.id as service_id,
    therapist_services.title as service_title,
    therapist_services.description as service_description,
    therapist_services.price_cents as service_price_cents,
    therapist_services.duration_minutes,
    therapies.id as therapy_id,
    therapies.name as therapy_name,
    therapies.slug as therapy_slug
  from public.therapist_services
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  join public.therapy_categories
    on therapy_categories.id = therapies.category_id
  where therapist_services.therapist_profile_id = therapist_profiles.id
    and therapist_services.status = 'active'
    and therapist_services.online_only = true
    and therapies.status in ('active', 'published')
    and therapies.is_public_visible = true
    and therapy_categories.is_active = true
  order by therapist_services.price_cents asc, therapist_services.title asc
  limit 1
) as service_summary on true
left join lateral (
  select
    array_agg(distinct therapy_themes.name order by therapy_themes.name) as theme_names,
    array_agg(distinct therapy_themes.slug order by therapy_themes.slug) as theme_slugs
  from public.therapy_theme_weights
  join public.therapy_themes
    on therapy_themes.id = coalesce(
      therapy_theme_weights.theme_id,
      therapy_theme_weights.subtheme_id
    )
  where therapy_theme_weights.therapy_id = service_summary.therapy_id
    and therapy_theme_weights.is_active = true
    and therapy_themes.is_active = true
) as theme_summary on true
left join lateral (
  select array_agg(tag.value order by tag.value) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist_profiles.metadata -> 'care_tags') = 'array'
        then therapist_profiles.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) as tag(value)
) as care_tags on true
left join lateral (
  select
    round(avg(reviews.rating)::numeric, 1) as average_rating,
    count(*) as review_count
  from public.reviews
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
) as review_summary on true
left join lateral (
  select reviews.comment as review_quote
  from public.reviews
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and reviews.comment is not null
    and length(trim(reviews.comment)) >= 12
  order by reviews.published_at desc nulls last, reviews.created_at desc
  limit 1
) as review_quote on true
left join lateral (
  select
    ((timezone(next_rule.timezone, now())::date + next_rule.days_ahead) + next_rule.start_time) at time zone next_rule.timezone as next_slot_at
  from (
    select
      availability_rules.start_time,
      availability_rules.timezone,
      case
        when raw_rule.raw_days_ahead = 0
          and availability_rules.start_time <= timezone(availability_rules.timezone, now())::time
          then 7
        else raw_rule.raw_days_ahead
      end as days_ahead
    from public.availability_rules
    cross join lateral (
      select ((availability_rules.day_of_week - extract(dow from timezone(availability_rules.timezone, now()))::integer + 7) % 7)::integer as raw_days_ahead
    ) as raw_rule
    where availability_rules.therapist_profile_id = therapist_profiles.id
      and (
        availability_rules.service_id is null
        or availability_rules.service_id = service_summary.service_id
      )
      and availability_rules.is_active = true
    order by days_ahead asc, availability_rules.start_time asc
    limit 1
  ) as next_rule
) as next_slot on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true;

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
  and therapies.status in ('active', 'published')
  and therapies.is_public_visible = true;

grant select on public.public_therapies_v to anon, authenticated, service_role;
grant select on public.public_home_therapies to anon, authenticated, service_role;
grant select on public.public_therapist_search to anon, authenticated, service_role;
grant select on public.public_therapist_profile_services_v to anon, authenticated, service_role;

comment on view public.public_therapies_v is
  'Safe public projection for /terapias. Exposes published therapy catalog fields, category, public therapist count and editorial flags only.';
