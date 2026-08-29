-- Keep the helper private; the public view invokes the already allow-listed
-- service slot RPC directly so anonymous reads do not require a new SECURITY
-- DEFINER grant.
revoke all on function public.get_public_therapist_next_slot_v1(uuid) from anon, authenticated;

create or replace view public.public_therapist_search_internal as
select therapist.id as therapist_profile_id, therapist.slug, therapist.public_name,
  therapist.headline as therapist_headline, therapist.bio as therapist_bio, therapist.photo_url,
  therapist.city, therapist.state, summary.service_id, summary.service_title, summary.service_description,
  summary.service_price_cents, summary.duration_minutes, summary.therapy_id, summary.therapy_name, summary.therapy_slug,
  themes.theme_names, themes.theme_slugs,
  coalesce(tags.items,themes.theme_names,array[summary.therapy_name]) as tags,
  next_slot.next_slot_at,
  0::numeric as average_rating, 0::integer as review_count,
  0::integer as completed_session_count, null::text as review_quote,
  coalesce((therapist.metadata->>'has_intro_video')::boolean,false) as has_video,
  coalesce(therapist.metadata->>'highlight',case when therapist.plan in ('premium','premium_plus') then 'Destaque TES' else 'Perfil Verificado' end) as highlight,
  case when therapist.metadata->>'highlight_tone' in ('featured','verified') then therapist.metadata->>'highlight_tone' when therapist.plan in ('premium','premium_plus') then 'featured' else 'verified' end as highlight_tone,
  concat_ws(' ',therapist.public_name,therapist.headline,therapist.bio,therapist.city,therapist.state,summary.service_title,summary.service_description,summary.therapy_name,array_to_string(themes.theme_names,' '),array_to_string(tags.items,' ')) as search_text,
  therapist.updated_at, timezone.timezone as schedule_timezone
from public.therapist_profiles therapist
join lateral (
  select service.id as service_id,service.title as service_title,service.description as service_description,service.price_cents as service_price_cents,service.duration_minutes,therapy.id as therapy_id,therapy.name as therapy_name,therapy.slug as therapy_slug
  from public.therapist_services service
  join public.therapies therapy on therapy.id=service.therapy_id
  where service.therapist_profile_id=therapist.id and service.status='active' and service.is_bookable and service.online_only and therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id) and public.is_public_service_booking_eligible_v1(service.id)
  order by service.price_cents,service.title,service.id
  limit 1
) summary on true
left join lateral (
  select array_agg(theme.name order by link.sort_order,theme.name) as theme_names,array_agg(theme.slug order by link.sort_order,theme.name) as theme_slugs
  from public.therapy_matching_themes link join public.matching_themes theme on theme.id=link.theme_id and theme.is_active
  where link.therapy_id=summary.therapy_id
) themes on true
left join lateral (select array_agg(tag.value order by tag.value) as items from jsonb_array_elements_text(case when jsonb_typeof(therapist.metadata->'care_tags')='array' then therapist.metadata->'care_tags' else '[]'::jsonb end) tag(value)) tags on true
left join lateral (select settings.timezone from public.therapist_schedule_settings settings where settings.therapist_profile_id=therapist.id limit 1) timezone on true
left join lateral (
  select min((slot.value ->> 'startsAt')::timestamptz) as next_slot_at
  from public.therapist_services candidate
  join public.therapies candidate_therapy on candidate_therapy.id = candidate.therapy_id
  cross join lateral pg_catalog.generate_series(now(), now() + interval '30 days', interval '5 days') as slot_window(range_start)
  cross join lateral jsonb_array_elements(coalesce(public.get_service_available_slots_v1(candidate.id, slot_window.range_start, least(slot_window.range_start + interval '5 days', now() + interval '31 days'), 500) -> 'slots', '[]'::jsonb)) as slot(value)
  where candidate.therapist_profile_id=therapist.id and candidate.status='active' and candidate.is_bookable and candidate.online_only
    and candidate_therapy.status='published' and candidate_therapy.is_public_visible
    and public.therapy_has_active_matching_theme_v1(candidate_therapy.id)
    and public.is_public_service_booking_eligible_v1(candidate.id)
) next_slot on true
where therapist.status='approved' and therapist.is_public and therapist.is_accepting_bookings and therapist.accepts_online_sessions;

create or replace view public.public_therapist_search as
select i.* from public.public_therapist_search_internal i
where public.is_therapist_publication_eligible_v1(i.therapist_profile_id);

grant select on public.public_therapist_search to anon, authenticated, service_role;
