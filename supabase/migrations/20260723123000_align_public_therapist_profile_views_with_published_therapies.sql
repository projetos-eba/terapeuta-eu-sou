-- Align public therapist profile views with the current public catalog status.
-- The therapy catalog now exposes public entries with status = 'published'.

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
      and therapies.status = 'published'
      and therapies.is_public_visible = true
  );

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
  and therapies.status = 'published'
  and therapies.is_public_visible = true;

grant select on public.public_therapist_profiles_v to anon, authenticated, service_role;
grant select on public.public_therapist_profile_services_v to anon, authenticated, service_role;

comment on view public.public_therapist_profiles_v is
  'Safe public projection for public therapist profile pages. Exposes approved public profiles with published public services only.';

comment on view public.public_therapist_profile_services_v is
  'Safe public projection for public therapist services and derived availability inputs for published therapies.';
