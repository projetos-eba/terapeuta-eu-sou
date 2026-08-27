begin;

-- Public entry points remain their existing eligibility wrappers. Only their
-- private implementation projections change the source of rating aggregates.
-- This preserves the public DTOs, grants and publication predicate.

create or replace view public.public_home_therapists_internal as
select
  therapist.id,
  therapist.slug,
  therapist.public_name,
  therapist.headline,
  therapist.photo_url,
  therapist.accepts_online_sessions,
  service_summary.service_title,
  service_summary.service_price_from_cents,
  review_summary.average_rating,
  review_summary.review_count,
  therapist.updated_at
from public.therapist_profiles therapist
join lateral (
  select
    service.title as service_title,
    service.price_cents as service_price_from_cents
  from public.therapist_services service
  join public.therapies therapy on therapy.id = service.therapy_id
  join public.therapy_categories category on category.id = therapy.category_id
  where service.therapist_profile_id = therapist.id
    and service.status = 'active'
    and service.is_bookable = true
    and service.online_only = true
    and therapy.status = 'published'
    and therapy.is_public_visible = true
    and category.is_active = true
  order by
    service.position asc nulls last,
    service.price_cents asc,
    therapy.name asc,
    service.title asc,
    service.id asc
  limit 1
) service_summary on true
left join lateral (
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.public_therapist_profile_reviews_v_internal review
  where review.therapist_slug = therapist.slug
) review_summary on true
where therapist.status = 'approved'
  and therapist.is_public = true
  and therapist.is_accepting_bookings = true
  and therapist.accepts_online_sessions = true;

create or replace view public.public_therapist_profiles_v_internal as
select
  therapist.id,
  therapist.slug,
  therapist.public_name,
  therapist.plan,
  therapist.bio,
  therapist.photo_url,
  therapist.city,
  therapist.state,
  therapist.is_accepting_bookings,
  therapist.accepts_online_sessions,
  true as is_verified,
  coalesce(content.short_intro, therapist.headline) as short_intro,
  coalesce(content.short_intro, therapist.headline) as published_headline,
  coalesce(tags.tags, array[]::text[]) as tags,
  coalesce(content.video_url, therapist.metadata ->> 'video_url') as video_url,
  coalesce(content.video_provider, 'external') as video_provider,
  coalesce(content.video_thumbnail_url, '/home/tablet-video-session.png')
    as video_thumbnail_url,
  coalesce(content.video_title, 'Um convite para você') as video_title,
  case
    when therapist.plan = 'premium_plus'
      then array['Perfil verificado', 'Terapeuta Plus']::text[]
    else array['Perfil verificado']::text[]
  end as badges,
  review_summary.average_rating,
  review_summary.review_count,
  coalesce(session_summary.sessions_completed, 0)::integer as sessions_completed,
  therapist.updated_at
from public.therapist_profiles therapist
left join lateral (
  select *
  from public.therapist_profile_content_versions content_version
  where content_version.therapist_profile_id = therapist.id
    and content_version.status = 'published'
  order by content_version.published_at desc nulls last, content_version.created_at desc
  limit 1
) content on true
left join lateral (
  select coalesce(array_agg(tag.value order by tag.value), array[]::text[]) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist.metadata -> 'care_tags') = 'array'
        then therapist.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) tag(value)
) tags on true
left join lateral (
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.public_therapist_profile_reviews_v_internal review
  where review.therapist_slug = therapist.slug
) review_summary on true
left join lateral (
  select count(*) as sessions_completed
  from public.bookings booking
  join public.session_payments payment on payment.booking_id = booking.id
  where booking.therapist_profile_id = therapist.id
    and booking.status = 'completed'
    and payment.financial_status = 'paid'
) session_summary on true
where therapist.status = 'approved'
  and therapist.is_public = true
  and exists (
    select 1
    from public.therapist_services service
    join public.therapies therapy on therapy.id = service.therapy_id
    where service.therapist_profile_id = therapist.id
      and service.status = 'active'
      and service.is_bookable = true
      and service.online_only = true
      and therapy.status = 'published'
      and therapy.is_public_visible = true
  );

create or replace view public.public_therapist_search_internal as
select
  therapist.id as therapist_profile_id,
  therapist.slug,
  therapist.public_name,
  therapist.headline as therapist_headline,
  therapist.bio as therapist_bio,
  therapist.photo_url,
  therapist.city,
  therapist.state,
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
  coalesce(session_summary.completed_session_count, 0)::integer as completed_session_count,
  review_quote.review_quote,
  coalesce((therapist.metadata ->> 'has_intro_video')::boolean, false) as has_video,
  coalesce(
    therapist.metadata ->> 'highlight',
    case when therapist.plan in ('premium', 'premium_plus')
      then 'Destaque TES' else 'Perfil Verificado' end
  ) as highlight,
  case
    when therapist.metadata ->> 'highlight_tone' in ('featured', 'verified')
      then therapist.metadata ->> 'highlight_tone'
    when therapist.plan in ('premium', 'premium_plus') then 'featured'
    else 'verified'
  end as highlight_tone,
  concat_ws(
    ' ', therapist.public_name, therapist.headline, therapist.bio,
    therapist.city, therapist.state, service_summary.service_title,
    service_summary.service_description, service_summary.therapy_name,
    array_to_string(theme_summary.theme_names, ' '),
    array_to_string(care_tags.tags, ' ')
  ) as search_text,
  therapist.updated_at,
  schedule_timezone.timezone as schedule_timezone
from public.therapist_profiles therapist
join lateral (
  select
    service.id as service_id,
    service.title as service_title,
    service.description as service_description,
    service.price_cents as service_price_cents,
    service.duration_minutes,
    therapy.id as therapy_id,
    therapy.name as therapy_name,
    therapy.slug as therapy_slug
  from public.therapist_services service
  join public.therapies therapy on therapy.id = service.therapy_id
  join public.therapy_categories category on category.id = therapy.category_id
  where service.therapist_profile_id = therapist.id
    and service.status = 'active'
    and service.is_bookable = true
    and service.online_only = true
    and therapy.status = 'published'
    and therapy.is_public_visible = true
    and category.is_active = true
  order by service.price_cents asc, service.title asc
  limit 1
) service_summary on true
left join lateral (
  select
    array_agg(distinct theme.name order by theme.name) as theme_names,
    array_agg(distinct theme.slug order by theme.slug) as theme_slugs
  from public.therapy_theme_weights weight
  join public.therapy_themes theme
    on theme.id = coalesce(weight.theme_id, weight.subtheme_id)
  where weight.therapy_id = service_summary.therapy_id
    and weight.is_active = true
    and theme.is_active = true
) theme_summary on true
left join lateral (
  select array_agg(tag.value order by tag.value) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist.metadata -> 'care_tags') = 'array'
        then therapist.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) tag(value)
) care_tags on true
left join lateral (
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.public_therapist_profile_reviews_v_internal review
  where review.therapist_slug = therapist.slug
) review_summary on true
left join lateral (
  select count(*) as completed_session_count
  from public.bookings booking
  where booking.therapist_profile_id = therapist.id
    and booking.status = 'completed'
    and booking.payment_status = 'paid'
) session_summary on true
left join lateral (
  select review.body as review_quote
  from public.public_therapist_profile_reviews_v_internal review
  where review.therapist_slug = therapist.slug
    and review.body <> ''
    and length(trim(review.body)) >= 12
  order by review.published_at desc nulls last, review.id desc
  limit 1
) review_quote on true
left join lateral (
  select min((slot.value ->> 'startsAt')::timestamptz) as next_slot_at
  from jsonb_array_elements(
    coalesce(
      public.get_service_available_slots_v1(
        service_summary.service_id,
        now(),
        now() + interval '31 days',
        1
      ) -> 'slots',
      '[]'::jsonb
    )
  ) slot(value)
) next_slot on true
left join lateral (
  select settings.timezone
  from public.therapist_schedule_settings settings
  where settings.therapist_profile_id = therapist.id
  limit 1
) schedule_timezone on true
where therapist.status = 'approved'
  and therapist.is_public = true
  and therapist.is_accepting_bookings = true
  and therapist.accepts_online_sessions = true;

comment on view public.public_home_therapists_internal is
  'Private home therapist DTO. Rating aggregates use canonical published relationship reviews.';
comment on view public.public_therapist_profiles_v_internal is
  'Private therapist profile DTO. Rating aggregates use canonical published relationship reviews.';
comment on view public.public_therapist_search_internal is
  'Private therapist search DTO. Rating aggregates and quote use canonical published relationship reviews; next_slot_at remains derived from the authoritative public slot engine.';

commit;
