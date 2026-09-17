begin;

-- The discovery card must use the same published "Minha essência" copy as
-- the public profile. Keep it appended to the projection so existing view
-- consumers retain their column order.
create or replace view public.public_therapist_search_internal
with (security_invoker = true) as
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
  coalesce(care_tags.items, theme_summary.theme_names, array[service_summary.therapy_name]) as tags,
  next_slot.next_slot_at,
  coalesce(review_summary.average_rating, 0) as average_rating,
  coalesce(review_summary.review_count, 0) as review_count,
  coalesce(session_summary.completed_session_count, 0)::integer as completed_session_count,
  review_quote.review_quote,
  coalesce((therapist.metadata->>'has_intro_video')::boolean, false) as has_video,
  coalesce(
    therapist.metadata->>'highlight',
    case when therapist.plan in ('premium', 'premium_plus') then 'Destaque TES' else 'Perfil Verificado' end
  ) as highlight,
  case
    when therapist.metadata->>'highlight_tone' in ('featured', 'verified')
      then therapist.metadata->>'highlight_tone'
    when therapist.plan in ('premium', 'premium_plus') then 'featured'
    else 'verified'
  end as highlight_tone,
  concat_ws(
    ' ',
    therapist.public_name,
    therapist.headline,
    therapist.bio,
    profile_content.essence_body,
    therapist.city,
    therapist.state,
    service_summary.service_title,
    service_summary.service_description,
    service_summary.therapy_name,
    array_to_string(theme_summary.theme_names, ' '),
    array_to_string(care_tags.items, ' ')
  ) as search_text,
  therapist.updated_at,
  schedule_timezone.timezone as schedule_timezone,
  profile_content.essence_body as therapist_essence
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
  where service.therapist_profile_id = therapist.id
    and service.status = 'active'
    and service.is_bookable
    and service.online_only
    and service.archived_at is null
    and therapy.status = 'published'
    and therapy.is_public_visible
    and public.therapy_has_active_matching_theme_v1(therapy.id)
  order by service.price_cents, service.title, service.id
  limit 1
) service_summary on true
left join lateral (
  select
    array_agg(theme_row.name order by theme_row.sort_order, theme_row.name) as theme_names,
    array_agg(theme_row.slug order by theme_row.sort_order, theme_row.name) as theme_slugs
  from (
    select distinct theme.id, theme.name, theme.slug, link.sort_order
    from public.therapy_matching_themes link
    join public.matching_themes theme
      on theme.id = link.theme_id
     and theme.is_active
    where link.therapy_id = service_summary.therapy_id
  ) theme_row
) theme_summary on true
left join lateral (
  select array_agg(tag.value order by tag.value) as items
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(therapist.metadata->'care_tags') = 'array'
        then therapist.metadata->'care_tags'
      else '[]'::jsonb
    end
  ) tag(value)
) care_tags on true
left join lateral (
  select content.essence_body
  from public.public_therapist_profile_content_v content
  where content.slug = therapist.slug
  limit 1
) profile_content on true
left join lateral (
  select round(avg(review.rating), 1) as average_rating, count(*)::integer as review_count
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
  select min((slot.value->>'startsAt')::timestamptz) as next_slot_at
  from public.therapist_services candidate
  join public.therapies candidate_therapy on candidate_therapy.id = candidate.therapy_id
  cross join lateral pg_catalog.generate_series(
    now(),
    now() + interval '30 days',
    interval '5 days'
  ) slot_window(range_start)
  cross join lateral jsonb_array_elements(
    coalesce(
      public.get_service_available_slots_v1(
        candidate.id,
        slot_window.range_start,
        least(slot_window.range_start + interval '5 days', now() + interval '31 days'),
        500
      )->'slots',
      '[]'::jsonb
    )
  ) slot(value)
  where candidate.therapist_profile_id = therapist.id
    and candidate.status = 'active'
    and candidate.is_bookable
    and candidate.online_only
    and candidate.archived_at is null
    and candidate_therapy.status = 'published'
    and candidate_therapy.is_public_visible
    and public.therapy_has_active_matching_theme_v1(candidate_therapy.id)
    and public.is_public_service_booking_eligible_v1(candidate.id)
) next_slot on true
left join lateral (
  select settings.timezone
  from public.therapist_schedule_settings settings
  where settings.therapist_profile_id = therapist.id
  limit 1
) schedule_timezone on true
where therapist.status = 'approved'
  and therapist.is_public
  and therapist.is_accepting_bookings
  and therapist.accepts_online_sessions;

create or replace view public.public_therapist_search
with (security_invoker = true) as
select internal.*
from public.public_therapist_search_internal internal
where public.is_therapist_publication_eligible_v1(internal.therapist_profile_id);

revoke all on public.public_therapist_search
  from public, anon, authenticated, service_role;
grant select on public.public_therapist_search
  to anon, authenticated, service_role;

commit;
