-- Keep therapist discovery and the public agenda on the same availability source.
-- The previous search projection looked only at the next weekly rule. That made
-- a rule appear available even when the authoritative slot engine removed it
-- because of notice, buffers, exceptions, bookings or active holds.

create or replace view public.public_therapist_search_internal as
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
  coalesce(
    care_tags.tags,
    theme_summary.theme_names,
    array[service_summary.therapy_name]
  ) as tags,
  next_slot.next_slot_at,
  coalesce(review_summary.average_rating, 0) as average_rating,
  coalesce(review_summary.review_count, 0)::integer as review_count,
  coalesce(session_summary.completed_session_count, 0)::integer as completed_session_count,
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
  therapist_profiles.updated_at,
  schedule_timezone.timezone as schedule_timezone
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
    and therapist_services.is_bookable = true
    and therapist_services.online_only = true
    and therapies.status = 'published'
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
  join public.bookings
    on bookings.id = reviews.booking_id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as review_summary on true
left join lateral (
  select count(*) as completed_session_count
  from public.bookings
  where bookings.therapist_profile_id = therapist_profiles.id
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
) as session_summary on true
left join lateral (
  select reviews.comment as review_quote
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  where reviews.therapist_profile_id = therapist_profiles.id
    and reviews.status = 'published'
    and bookings.status = 'completed'
    and bookings.payment_status = 'paid'
    and reviews.comment is not null
    and length(trim(reviews.comment)) >= 12
  order by reviews.published_at desc nulls last, reviews.created_at desc
  limit 1
) as review_quote on true
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
  ) as slot(value)
) as next_slot on true
left join lateral (
  select settings.timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = therapist_profiles.id
  limit 1
) as schedule_timezone on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and therapist_profiles.is_accepting_bookings = true
  and therapist_profiles.accepts_online_sessions = true;

create or replace view public.public_therapist_search as
select i.*
from public.public_therapist_search_internal as i
where public.is_therapist_publication_eligible_v1(i.therapist_profile_id);

comment on view public.public_therapist_search_internal is
  'Private implementation projection for therapist discovery. next_slot_at is derived from the authoritative public slot engine and schedule_timezone is the canonical therapist schedule timezone.';

comment on view public.public_therapist_search is
  'Safe public projection for therapist search. The selected service and next slot use the same eligibility and availability contracts as the public agenda.';
