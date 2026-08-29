-- Stage 1: Match themes become the sole active classification of therapies.
-- This migration intentionally leaves the legacy physical relation in place so
-- production can be observed before the explicit RESTRICT-only drop in stage 2.

-- Remove only projections whose old columns represented the retired contract.
-- Dependent functions are recreated below before stage 2 removes the table.
drop view if exists public.therapist_service_allowed_catalog_v1;
drop view if exists public.therapist_private_services_v1;

create or replace function public.therapy_has_active_matching_theme_v1(
  p_therapy_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.therapy_matching_themes therapy_theme
    join public.matching_themes theme
      on theme.id = therapy_theme.theme_id
     and theme.is_active
    where therapy_theme.therapy_id = p_therapy_id
  )
$$;

create or replace function public.validate_platform_therapy_for_service_v1(
  p_therapy_id uuid
)
returns public.therapies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapy public.therapies%rowtype;
begin
  select * into v_therapy from public.therapies where id = p_therapy_id;
  if not found or not public.therapy_has_active_matching_theme_v1(p_therapy_id) then
    raise exception 'THERAPY_NOT_AVAILABLE_FOR_SERVICE' using errcode = 'P0002';
  end if;
  if v_therapy.status = 'archived' then raise exception 'THERAPY_ARCHIVED' using errcode = 'P0001'; end if;
  if v_therapy.status <> 'published' or not v_therapy.is_available_for_services then
    raise exception 'THERAPY_NOT_AVAILABLE_FOR_SERVICE' using errcode = 'P0001';
  end if;
  return v_therapy;
end;
$$;

create or replace function public.get_therapist_publication_eligibility_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select * from public.therapist_profiles where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (where s.status = 'active' and s.is_bookable and s.online_only)::integer as online_bookable,
      count(*) filter (where s.status = 'active' and s.is_bookable and s.online_only and t.status = 'published' and t.is_public_visible)::integer as published_therapy,
      count(*) filter (where s.status = 'active' and s.is_bookable and s.online_only and t.status = 'published' and t.is_public_visible and public.therapy_has_active_matching_theme_v1(t.id))::integer as eligible
    from public.therapist_services s
    join public.therapies t on t.id = s.therapy_id
    where s.therapist_profile_id = p_therapist_profile_id and s.archived_at is null
  )
  select jsonb_build_object(
    'eligible', coalesce(p.status = 'approved'::public.therapist_status and p.public_status = 'published' and p.is_public and p.is_accepting_bookings and p.accepts_online_sessions and coalesce(s.eligible, 0) > 0, false),
    'blockers', coalesce((select jsonb_agg(code order by position) from unnest(array[
      case when p.id is null then 'profile_not_found' end,
      case when p.id is not null and p.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
      case when p.id is not null and p.public_status <> 'published' then 'profile_not_published' end,
      case when p.id is not null and not p.is_public then 'profile_not_public' end,
      case when p.id is not null and not p.is_accepting_bookings then 'not_accepting_bookings' end,
      case when p.id is not null and not p.accepts_online_sessions then 'online_sessions_disabled' end,
      case when p.id is not null and coalesce(s.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
      case when p.id is not null and coalesce(s.online_bookable, 0) > 0 and coalesce(s.published_therapy, 0) = 0 then 'therapy_not_public' end,
      case when p.id is not null and coalesce(s.published_therapy, 0) > 0 and coalesce(s.eligible, 0) = 0 then 'therapy_without_active_theme' end
    ]) with ordinality as blockers(code, position) where code is not null), '[]'::jsonb),
    'eligibleServiceCount', coalesce(s.eligible, 0)
  ) from profile p full join services s on true
$$;

create or replace function public.is_public_service_booking_eligible_v1(p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.therapist_services s
    join public.therapies t on t.id = s.therapy_id
    where s.id = p_service_id and s.status = 'active' and s.is_bookable and s.online_only
      and t.status = 'published' and t.is_public_visible
      and public.therapy_has_active_matching_theme_v1(t.id)
      and public.is_therapist_publication_eligible_v1(s.therapist_profile_id)
  )
$$;

create or replace view public.therapist_service_allowed_catalog_v1 as
select
  therapy.id as therapy_id, therapy.name as therapy_name, therapy.slug as therapy_slug,
  therapy.short_description, therapy.status as therapy_status, therapy.is_public_visible,
  therapy.is_available_for_services,
  coalesce(settings.is_visible_in_matching, false) as is_visible_in_matching,
  therapy.updated_at,
  coalesce(themes.items, '[]'::jsonb) as matching_themes,
  coalesce(content.hero_image_url, therapy.image_url) as therapy_image_url
from public.therapies therapy
left join public.therapy_public_content content on content.therapy_id = therapy.id
left join public.matching_therapy_settings settings on settings.therapy_id = therapy.id
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', theme.id, 'name', theme.name, 'slug', theme.slug,
    'sortOrder', link.sort_order,
    'interests', coalesce(interests.items, '[]'::jsonb)
  ) order by link.sort_order, theme.name) as items
  from public.therapy_matching_themes link
  join public.matching_themes theme on theme.id = link.theme_id and theme.is_active
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', interest.id, 'name', interest.name, 'slug', interest.slug, 'sortOrder', interest.sort_order, 'themeId', interest.theme_id) order by interest.sort_order, interest.name) as items
    from public.matching_interests interest where interest.theme_id = theme.id and interest.is_active
  ) interests on true
  where link.therapy_id = therapy.id
) themes on true
where therapy.status = 'published' and therapy.is_available_for_services
  and public.therapy_has_active_matching_theme_v1(therapy.id);

create or replace view public.therapist_private_services_v1 as
select
  service.id as service_id, service.therapist_profile_id, service.therapy_id,
  therapy.name as therapy_name, therapy.slug as therapy_slug, therapy.status as therapy_status,
  therapy.is_public_visible as therapy_is_public_visible, therapy.is_available_for_services,
  service.status, service.title, service.description, service.duration_minutes, service.price_cents,
  service.currency, service.delivery_format, service.online_only, service.is_bookable,
  service.position, service.version,
  case when service.status <> 'active' or not service.is_bookable or therapist.status <> 'approved' or not therapist.is_public or not therapist.is_accepting_bookings or therapy.status <> 'published' or not therapy.is_public_visible or not public.therapy_has_active_matching_theme_v1(therapy.id) then false else true end as is_reservable,
  case when service.status = 'paused' then 'service_paused' when service.status = 'archived' then 'service_archived' when service.status <> 'active' then 'service_not_active' when not service.is_bookable then 'service_not_accepting_bookings' when therapist.status <> 'approved' then 'therapist_not_approved' when not therapist.is_public then 'therapist_profile_private' when not therapist.is_accepting_bookings then 'therapist_not_accepting_bookings' when therapy.status <> 'published' then 'therapy_not_published' when not therapy.is_public_visible then 'therapy_not_public' when not public.therapy_has_active_matching_theme_v1(therapy.id) then 'therapy_without_active_theme' else null end as blocking_reason,
  coalesce(metrics.favorite_count, 0)::integer as favorite_count, coalesce(metrics.booking_count, 0)::integer as booking_count,
  coalesce(metrics.bookings_last_30_days, 0)::integer as bookings_last_30_days, metrics.booking_count_delta_percent,
  service.created_at, service.updated_at, service.archived_at,
  coalesce(content.hero_image_url, therapy.image_url) as therapy_image_url
from public.therapist_services service
join public.therapist_profiles therapist on therapist.id = service.therapist_profile_id
join public.therapies therapy on therapy.id = service.therapy_id
left join public.therapy_public_content content on content.therapy_id = therapy.id
left join public.therapist_service_metrics_v1 metrics on metrics.service_id = service.id;

create or replace function public.service_row_to_private_json_v1(p_service_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_service public.therapist_private_services_v1%rowtype; v_matching jsonb;
begin
  select * into v_service from public.therapist_private_services_v1 where service_id = p_service_id;
  if not found then return null; end if;
  select jsonb_build_object('themeIds', coalesce(jsonb_agg(distinct st.theme_id) filter (where st.theme_id is not null), '[]'::jsonb), 'interestIds', coalesce(jsonb_agg(distinct si.interest_id) filter (where si.interest_id is not null), '[]'::jsonb)) into v_matching
  from public.therapist_services s left join public.therapist_service_matching_themes st on st.therapist_service_id=s.id left join public.therapist_service_matching_interests si on si.therapist_service_id=s.id where s.id=p_service_id;
  return jsonb_build_object('serviceId',v_service.service_id,'therapyId',v_service.therapy_id,'therapy',jsonb_build_object('id',v_service.therapy_id,'name',v_service.therapy_name,'slug',v_service.therapy_slug,'imageUrl',v_service.therapy_image_url,'status',v_service.therapy_status,'isPubliclyVisible',v_service.therapy_is_public_visible,'isAvailableForServices',v_service.is_available_for_services),'matching',coalesce(v_matching,jsonb_build_object('themeIds','[]'::jsonb,'interestIds','[]'::jsonb)),'status',v_service.status,'title',v_service.title,'description',v_service.description,'durationMinutes',v_service.duration_minutes,'priceCents',v_service.price_cents,'currency',v_service.currency,'deliveryFormat',v_service.delivery_format,'onlineOnly',v_service.online_only,'isBookable',v_service.is_bookable,'position',v_service.position,'version',v_service.version,'isReservable',v_service.is_reservable,'blockingReason',v_service.blocking_reason,'metrics',jsonb_build_object('bookingCount',v_service.booking_count,'bookingsLast30Days',v_service.bookings_last_30_days,'bookingCountDeltaPercent',v_service.booking_count_delta_percent),'createdAt',v_service.created_at,'updatedAt',v_service.updated_at,'archivedAt',v_service.archived_at);
end; $$;

create or replace function public.list_therapist_service_catalog_v1(p_actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);
  return jsonb_build_object('contractVersion',1,'therapistProfileId',v_therapist.id,'plan',v_therapist.plan,'serviceLimit',public.therapist_service_limit_for_plan_v1(v_therapist.plan),'items',coalesce((select jsonb_agg(jsonb_build_object('therapyId',c.therapy_id,'name',c.therapy_name,'slug',c.therapy_slug,'imageUrl',c.therapy_image_url,'shortDescription',c.short_description,'status',c.therapy_status,'isPubliclyVisible',c.is_public_visible,'isAvailableForServices',c.is_available_for_services,'isVisibleInMatching',c.is_visible_in_matching,'matchingThemes',c.matching_themes) order by c.therapy_name) from public.therapist_service_allowed_catalog_v1 c),'[]'::jsonb));
end; $$;

-- The public catalog contract exposes ordered themes.  A therapy is visible only
-- with at least one active theme; Match visibility itself remains separate.
drop view if exists public.public_matching_therapies_v;
drop view if exists public.public_therapy_details_v;
drop view if exists public.public_home_therapies;
drop view if exists public.public_therapies_v;

create view public.public_therapies_v with (security_invoker = true) as
with therapist_counts as (
  select service.therapy_id, count(distinct service.therapist_profile_id)::integer as therapist_count
  from public.therapist_services service
  join public.therapist_profiles therapist on therapist.id = service.therapist_profile_id
  where service.status = 'active' and service.is_bookable and service.online_only
    and public.is_public_service_booking_eligible_v1(service.id)
  group by service.therapy_id
)
select therapy.id, therapy.slug, therapy.name, therapy.short_description, therapy.description,
  therapy.image_url, therapy.status, therapy.published_at, therapy.popularity_score,
  therapy.created_at, therapy.updated_at, coalesce(therapist_counts.therapist_count,0) as therapist_count,
  (therapy.popularity_score >= 80 or therapy.is_featured) as is_popular,
  (therapy.published_at is not null and therapy.published_at >= now() - interval '45 days') as is_new,
  lower(unaccent(concat_ws(' ', therapy.name, therapy.short_description, therapy.description, array_to_string(theme_names.names,' '), array_to_string(therapy.search_aliases,' ')))) as search_text,
  therapy.is_featured, theme_names.names as theme_names, theme_names.slugs as theme_slugs
from public.therapies therapy
left join therapist_counts on therapist_counts.therapy_id = therapy.id
join lateral (
  select array_agg(theme.name order by link.sort_order, theme.name) as names,
    array_agg(theme.slug order by link.sort_order, theme.name) as slugs
  from public.therapy_matching_themes link join public.matching_themes theme on theme.id=link.theme_id and theme.is_active
  where link.therapy_id=therapy.id
) theme_names on true
where therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id);

create view public.public_therapy_details_v with (security_invoker = true) as
select catalog.id, catalog.slug, catalog.name, catalog.short_description, catalog.description,
  coalesce(content.hero_image_url,catalog.image_url) as hero_image_url, catalog.image_url,
  catalog.therapist_count, catalog.theme_slugs, catalog.theme_names, content.subtitle,
  content.introduction, content.complementary_description, coalesce(content.safety_note,therapy.safety_note) as safety_note,
  content.seo_title, content.seo_description, coalesce(content.approach_label,catalog.theme_names[1]) as approach_label,
  coalesce(content.approach_icon_key,'sparkles') as approach_icon_key,
  coalesce(content.visual_theme_key::text,'energy') as visual_theme_key, coalesce(content.hero_focal_point,'center') as hero_focal_point,
  coalesce(highlights.items,'[]'::jsonb) as highlights, coalesce(benefits.items,'[]'::jsonb) as benefits,
  catalog.published_at, catalog.updated_at
from public.public_therapies_v catalog join public.therapies therapy on therapy.id=catalog.id
left join public.therapy_public_content content on content.therapy_id=catalog.id
left join lateral (select jsonb_agg(jsonb_build_object('title',h.title,'iconKey',h.icon_key) order by h.sort_order) as items from public.therapy_highlights h where h.therapy_id=catalog.id) highlights on true
left join lateral (select jsonb_agg(jsonb_build_object('title',b.title,'description',b.description,'iconKey',b.icon_key) order by b.sort_order) as items from public.therapy_benefits b where b.therapy_id=catalog.id) benefits on true
where therapy.archived_at is null;

create view public.public_home_therapies with (security_invoker = true) as
select id, name, slug, slug as href_slug, short_description, is_featured,
  theme_names[1] as theme_name, theme_slugs[1] as theme_slug, updated_at
from public.public_therapies_v;

create view public.public_matching_therapies_v with (security_invoker = true) as
select detail.id, detail.name, detail.slug, detail.short_description, detail.description,
  detail.image_url, therapy.status, detail.therapist_count, settings.is_visible_in_matching
from public.public_therapy_details_v detail
join public.therapies therapy on therapy.id=detail.id
join public.matching_therapy_settings settings on settings.therapy_id=detail.id
where therapy.status='published' and therapy.is_public_visible and therapy.archived_at is null and settings.is_visible_in_matching;

grant select on public.public_therapies_v, public.public_therapy_details_v, public.public_matching_therapies_v, public.public_home_therapies to anon, authenticated, service_role;

create or replace view public.public_home_therapists_internal as
select therapist.id, therapist.slug, therapist.public_name, therapist.headline, therapist.photo_url,
  therapist.accepts_online_sessions, summary.service_title, summary.service_price_from_cents,
  reviews.average_rating, reviews.review_count, therapist.updated_at
from public.therapist_profiles therapist
join lateral (
  select service.title as service_title, service.price_cents as service_price_from_cents
  from public.therapist_services service join public.therapies therapy on therapy.id=service.therapy_id
  where service.therapist_profile_id=therapist.id and service.status='active' and service.is_bookable and service.online_only
    and therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id)
  order by service.position, service.price_cents, therapy.name, service.title, service.id limit 1
) summary on true
left join lateral (select round(avg(review.rating),1) as average_rating, count(*)::integer as review_count from public.public_therapist_profile_reviews_v_internal review where review.therapist_slug=therapist.slug) reviews on true
where therapist.status='approved' and therapist.is_public and therapist.is_accepting_bookings and therapist.accepts_online_sessions;

create or replace view public.public_matching_therapist_counts as
select therapy.id as therapy_id, count(distinct service.therapist_profile_id)::integer as therapist_count
from public.therapies therapy
join public.matching_therapy_settings settings on settings.therapy_id=therapy.id and settings.is_visible_in_matching
left join public.therapist_services service on service.therapy_id=therapy.id and service.archived_at is null and service.status='active' and service.is_bookable and service.online_only and public.is_public_service_booking_eligible_v1(service.id)
where therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id)
group by therapy.id;

create or replace view public.public_therapist_profile_services_v_internal as
select therapist.slug as therapist_slug, service.id as service_id, service.title as service_title,
  service.description, service.duration_minutes, service.price_cents, service.currency,
  therapy.id as therapy_id, therapy.name as therapy_name, therapy.slug as therapy_slug,
  row_number() over (partition by therapist.id order by service.position,service.price_cents,therapy.name,service.title,service.id) as sort_order,
  coalesce(settings.buffer_before_minutes,10) as buffer_before_minutes,
  coalesce(settings.buffer_after_minutes,10) as buffer_after_minutes,
  coalesce(settings.min_notice_minutes,120) as min_notice_minutes,
  coalesce(settings.max_days_ahead,30) as max_days_ahead,
  coalesce(settings.interval_minutes,30) as interval_minutes,
  coalesce(rules.items,'[]'::jsonb) as availability_rules,
  coalesce(exceptions.items,'[]'::jsonb) as availability_exceptions,
  coalesce(conflicts.items,'[]'::jsonb) as booking_conflicts
from public.therapist_profiles therapist
join public.therapist_services service on service.therapist_profile_id=therapist.id
join public.therapies therapy on therapy.id=service.therapy_id
left join public.therapist_service_booking_settings settings on settings.service_id=service.id
left join lateral (select jsonb_agg(jsonb_build_object('dayOfWeek',rule.day_of_week,'endTime',rule.end_time::text,'isActive',rule.is_active,'serviceId',rule.service_id,'startTime',rule.start_time::text,'timezone',rule.timezone) order by rule.day_of_week,rule.start_time) as items from public.availability_rules rule where rule.therapist_profile_id=therapist.id and (rule.service_id is null or rule.service_id=service.id) and rule.is_active) rules on true
left join lateral (select jsonb_agg(jsonb_build_object('endsAt',exception.ends_at,'isAvailable',exception.is_available,'serviceId',exception.service_id,'startsAt',exception.starts_at)) as items from public.availability_exceptions exception where exception.therapist_profile_id=therapist.id and (exception.service_id is null or exception.service_id=service.id) and exception.ends_at>=now()) exceptions on true
left join lateral (select jsonb_agg(jsonb_build_object('endsAt',booking.ends_at,'serviceId',booking.service_id,'startsAt',booking.starts_at,'status',booking.status)) as items from public.bookings booking where booking.therapist_profile_id=therapist.id and booking.service_id=service.id and booking.ends_at>=now() and booking.status in ('pending_payment','confirmed','completed')) conflicts on true
where therapist.status='approved' and therapist.is_public and therapist.is_accepting_bookings and therapist.accepts_online_sessions
  and service.status='active' and service.is_bookable and service.online_only
  and therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id);

create or replace view public.public_therapist_search_internal as
select therapist.id as therapist_profile_id, therapist.slug, therapist.public_name,
  therapist.headline as therapist_headline, therapist.bio as therapist_bio, therapist.photo_url,
  therapist.city, therapist.state, summary.service_id, summary.service_title, summary.service_description,
  summary.service_price_cents, summary.duration_minutes, summary.therapy_id, summary.therapy_name, summary.therapy_slug,
  themes.theme_names, themes.theme_slugs,
  coalesce(tags.items,themes.theme_names,array[summary.therapy_name]) as tags,
  null::timestamptz as next_slot_at, 0::numeric as average_rating, 0::integer as review_count,
  0::integer as completed_session_count, null::text as review_quote,
  coalesce((therapist.metadata->>'has_intro_video')::boolean,false) as has_video,
  coalesce(therapist.metadata->>'highlight',case when therapist.plan in ('premium','premium_plus') then 'Destaque TES' else 'Perfil Verificado' end) as highlight,
  case when therapist.metadata->>'highlight_tone' in ('featured','verified') then therapist.metadata->>'highlight_tone' when therapist.plan in ('premium','premium_plus') then 'featured' else 'verified' end as highlight_tone,
  concat_ws(' ',therapist.public_name,therapist.headline,therapist.bio,therapist.city,therapist.state,summary.service_title,summary.service_description,summary.therapy_name,array_to_string(themes.theme_names,' '),array_to_string(tags.items,' ')) as search_text,
  therapist.updated_at, timezone.timezone as schedule_timezone
from public.therapist_profiles therapist
join lateral (select service.id as service_id,service.title as service_title,service.description as service_description,service.price_cents as service_price_cents,service.duration_minutes,therapy.id as therapy_id,therapy.name as therapy_name,therapy.slug as therapy_slug from public.therapist_services service join public.therapies therapy on therapy.id=service.therapy_id where service.therapist_profile_id=therapist.id and service.status='active' and service.is_bookable and service.online_only and therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id) order by service.price_cents,service.title limit 1) summary on true
left join lateral (select array_agg(theme.name order by link.sort_order,theme.name) as theme_names,array_agg(theme.slug order by link.sort_order,theme.name) as theme_slugs from public.therapy_matching_themes link join public.matching_themes theme on theme.id=link.theme_id and theme.is_active where link.therapy_id=summary.therapy_id) themes on true
left join lateral (select array_agg(tag.value order by tag.value) as items from jsonb_array_elements_text(case when jsonb_typeof(therapist.metadata->'care_tags')='array' then therapist.metadata->'care_tags' else '[]'::jsonb end) tag(value)) tags on true
left join lateral (select settings.timezone from public.therapist_schedule_settings settings where settings.therapist_profile_id=therapist.id limit 1) timezone on true
where therapist.status='approved' and therapist.is_public and therapist.is_accepting_bookings and therapist.accepts_online_sessions;

create or replace function public.admin_validate_therapy_publishable_v1(p_therapy_id uuid)
returns void language plpgsql stable set search_path = '' as $$
declare v_row record;
begin
  select t.*, coalesce(c.hero_image_url,t.image_url) as effective_image_url, c.introduction,
    (select count(*) from public.therapy_highlights h where h.therapy_id=t.id) as highlight_count,
    (select count(*) from public.therapy_benefits b where b.therapy_id=t.id) as benefit_count
  into v_row from public.therapies t left join public.therapy_public_content c on c.therapy_id=t.id where t.id=p_therapy_id;
  if v_row.id is null then raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND'; end if;
  if v_row.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'ADMIN_THERAPY_CATALOG_INVALID_SLUG'; end if;
  if coalesce(v_row.short_description,'')='' or coalesce(v_row.introduction,v_row.description,'')='' or coalesce(v_row.effective_image_url,'')='' or v_row.highlight_count<1 or v_row.benefit_count<1 then raise exception 'ADMIN_THERAPY_CATALOG_INCOMPLETE_PUBLIC_CONTENT'; end if;
  perform public.ensure_therapy_has_matching_theme_for_publish_v1(p_therapy_id);
end; $$;

-- Require exactly 1..3 active canonical themes for every admin draft save.
create or replace function public.admin_upsert_therapy_draft_with_matching_v1(p_actor_user_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_theme_ids uuid[]; v_result jsonb; v_therapy_id uuid;
begin
  if not (p_payload ? 'themeIds') or jsonb_typeof(p_payload->'themeIds') <> 'array' then raise exception 'ADMIN_THERAPY_CATALOG_THEME_REQUIRED'; end if;
  select coalesce(array_agg(value::uuid order by ordinality),'{}'::uuid[]) into v_theme_ids from jsonb_array_elements_text(p_payload->'themeIds') with ordinality items(value,ordinality);
  if cardinality(v_theme_ids)<1 or cardinality(v_theme_ids)>3 then raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT'; end if;
  v_result := public.admin_upsert_therapy_draft_v1(p_actor_user_id,p_request_id,p_payload - 'categoryId');
  v_therapy_id := (v_result->>'therapyId')::uuid;
  return jsonb_build_object('contractVersion',1,'therapyId',v_therapy_id,'catalog',public.admin_replace_therapy_matching_themes_v1(p_actor_user_id,p_request_id,v_therapy_id,v_theme_ids,p_payload->>'reason'));
end; $$;

create or replace function public.admin_upsert_therapy_draft_v1(p_actor_user_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_therapy_id uuid:=nullif(p_payload->>'therapyId','')::uuid; v_name text:=trim(coalesce(p_payload->>'name','')); v_slug text:=trim(coalesce(p_payload->>'slug','')); v_short text:=trim(coalesce(p_payload->>'shortDescription','')); v_now timestamptz:=now();
begin
  v_actor:=public.admin_get_actor_profile_v1(p_actor_user_id);
  if p_request_id is null or v_name='' or v_slug='' or v_short='' then raise exception 'ADMIN_THERAPY_CATALOG_INVALID_PAYLOAD'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'ADMIN_THERAPY_CATALOG_INVALID_SLUG'; end if;
  if v_therapy_id is null then
    insert into public.therapies(name,slug,short_description,description,status,is_public_visible,is_available_for_services,is_featured,image_url,search_aliases,calendar_color_key,created_by_profile_id,updated_by_profile_id)
    values(v_name,v_slug,v_short,nullif(p_payload->>'description',''),'draft',coalesce((p_payload->>'isPubliclyVisible')::boolean,false),coalesce((p_payload->>'isAvailableForServices')::boolean,false),coalesce((p_payload->>'isFeatured')::boolean,false),nullif(p_payload->>'imageUrl',''),coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload->'aliases','[]'::jsonb)) value where trim(value)<>''),'{}'::text[]),coalesce(nullif(p_payload->>'calendarColorKey',''),'neutral'),v_actor.id,v_actor.id) returning id into v_therapy_id;
  else
    update public.therapies set name=v_name,slug=v_slug,short_description=v_short,description=nullif(p_payload->>'description',''),is_public_visible=coalesce((p_payload->>'isPubliclyVisible')::boolean,is_public_visible),is_available_for_services=coalesce((p_payload->>'isAvailableForServices')::boolean,is_available_for_services),is_featured=coalesce((p_payload->>'isFeatured')::boolean,is_featured),image_url=nullif(p_payload->>'imageUrl',''),updated_by_profile_id=v_actor.id,updated_at=v_now where id=v_therapy_id;
    if not found then raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND'; end if;
  end if;
  insert into public.therapy_public_content(therapy_id,hero_image_url,subtitle,introduction,complementary_description,safety_note,seo_title,seo_description,approach_label,approach_icon_key,visual_theme_key,hero_focal_point)
  values(v_therapy_id,nullif(p_payload#>>'{publicContent,heroImageUrl}',''),nullif(p_payload#>>'{publicContent,subtitle}',''),nullif(p_payload#>>'{publicContent,introduction}',''),nullif(p_payload#>>'{publicContent,complementaryDescription}',''),nullif(p_payload#>>'{publicContent,safetyNote}',''),nullif(p_payload#>>'{publicContent,seoTitle}',''),nullif(p_payload#>>'{publicContent,seoDescription}',''),nullif(p_payload#>>'{publicContent,approachLabel}',''),nullif(p_payload#>>'{publicContent,approachIconKey}',''),coalesce(nullif(p_payload#>>'{publicContent,visualThemeKey}',''),'energy')::public.therapy_visual_theme_key,coalesce(nullif(p_payload#>>'{publicContent,heroFocalPoint}',''),'center'))
  on conflict(therapy_id) do update set hero_image_url=excluded.hero_image_url,subtitle=excluded.subtitle,introduction=excluded.introduction,complementary_description=excluded.complementary_description,safety_note=excluded.safety_note,seo_title=excluded.seo_title,seo_description=excluded.seo_description,approach_label=excluded.approach_label,approach_icon_key=excluded.approach_icon_key,visual_theme_key=excluded.visual_theme_key,hero_focal_point=excluded.hero_focal_point,updated_at=v_now;
  insert into public.matching_therapy_settings(therapy_id,is_visible_in_matching) values(v_therapy_id,coalesce((p_payload->>'isVisibleInMatching')::boolean,false)) on conflict(therapy_id) do update set is_visible_in_matching=excluded.is_visible_in_matching,updated_at=v_now;
  return jsonb_build_object('contractVersion',1,'therapyId',v_therapy_id,'catalog',public.admin_list_therapy_catalog_v1(p_actor_user_id));
end; $$;

create or replace function public.admin_list_therapy_catalog_v1(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_get_actor_profile_v1(p_actor_user_id);
  return jsonb_build_object('contractVersion',1,
    'matchingThemes',coalesce((select jsonb_agg(jsonb_build_object('id',theme.id,'name',theme.name,'slug',theme.slug,'imageUrl',theme.image_url,'sortOrder',theme.sort_order) order by theme.sort_order,theme.name) from public.matching_themes theme where theme.is_active),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',therapy.id,'name',therapy.name,'slug',therapy.slug,'status',therapy.status,'isPubliclyVisible',therapy.is_public_visible,'isAvailableForServices',therapy.is_available_for_services,'isVisibleInMatching',coalesce(settings.is_visible_in_matching,false),'matchingThemeIds',coalesce(themes.ids,'[]'::jsonb),'hasPublishedMatchWeights',false,'isFeatured',therapy.is_featured,'publishedAt',therapy.published_at,'deprecatedAt',therapy.deprecated_at,'archivedAt',therapy.archived_at,'replacementTherapyId',therapy.replacement_therapy_id,'shortDescription',therapy.short_description,'description',therapy.description,'imageUrl',therapy.image_url,'aliases',therapy.search_aliases,'calendarColorKey',therapy.calendar_color_key,'publicContent',jsonb_build_object('subtitle',content.subtitle,'introduction',content.introduction,'complementaryDescription',content.complementary_description,'safetyNote',coalesce(content.safety_note,therapy.safety_note),'seoTitle',content.seo_title,'seoDescription',content.seo_description,'heroImageUrl',content.hero_image_url,'approachLabel',content.approach_label,'approachIconKey',content.approach_icon_key,'visualThemeKey',content.visual_theme_key,'heroFocalPoint',content.hero_focal_point,'highlights','[]'::jsonb,'benefits','[]'::jsonb),'history','[]'::jsonb,'impact',jsonb_build_object('activeServiceCount',0,'futureBookingCount',0,'isAvailableForServices',therapy.is_available_for_services,'isPubliclyVisible',therapy.is_public_visible,'isVisibleInMatching',coalesce(settings.is_visible_in_matching,false),'publicProfileCount',0,'serviceCount',0,'therapistCount',0),'updatedAt',therapy.updated_at) order by therapy.name) from public.therapies therapy left join public.matching_therapy_settings settings on settings.therapy_id=therapy.id left join public.therapy_public_content content on content.therapy_id=therapy.id left join lateral(select jsonb_agg(link.theme_id order by link.sort_order) as ids from public.therapy_matching_themes link where link.therapy_id=therapy.id) themes on true),'[]'::jsonb),
    'requests','[]'::jsonb);
end; $$;

create or replace function public.submit_therapy_catalog_request_v2(p_actor_user_id uuid, p_payload jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles; v_request public.therapy_catalog_requests; v_submission jsonb:=coalesce(p_payload->'submission','{}'::jsonb); v_theme_source jsonb:=coalesce(p_payload->'themeIds',v_submission->'themeIds','[]'::jsonb); v_theme_ids uuid[]; v_name text:=trim(coalesce(p_payload->>'informedName','')); v_description text:=nullif(trim(coalesce(v_submission->>'description','')),''); v_objective text:=nullif(trim(coalesce(v_submission->>'objective','')),''); v_use_cases text:=nullif(trim(coalesce(v_submission->>'useCases','')),''); v_process text:=nullif(trim(coalesce(v_submission->>'sessionProcess','')),'');
begin
  select * into v_profile from public.profiles where id=p_actor_user_id and role='therapist';
  if not found then raise exception 'THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED'; end if;
  select coalesce(array_agg(value::uuid order by ordinality),'{}'::uuid[]) into v_theme_ids from jsonb_array_elements_text(v_theme_source) with ordinality values_list(value,ordinality);
  if p_request_id is null or char_length(v_name) not between 2 and 120 or v_description is null or v_objective is null or v_use_cases is null or v_process is null or cardinality(v_theme_ids) not between 1 and 3 or cardinality(v_theme_ids) <> (select count(*) from public.matching_themes theme where theme.id=any(v_theme_ids) and theme.is_active) then raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD'; end if;
  v_submission:=jsonb_set(v_submission,'{themeIds}',to_jsonb(v_theme_ids),true);
  insert into public.therapy_catalog_requests(requester_profile_id,client_request_id,informed_name,description,justification,submission,submission_version,status) values(p_actor_user_id,p_request_id,v_name,v_description,v_objective,v_submission,2,'submitted') returning * into v_request;
  return jsonb_build_object('contractVersion',2,'idempotentReplay',false,'requestId',v_request.id,'status',v_request.status);
end; $$;

create or replace function public.resubmit_therapy_catalog_request_v2(p_actor_user_id uuid, p_catalog_request_id uuid, p_payload jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.therapy_catalog_requests; v_theme_source jsonb:=coalesce(p_payload->'themeIds',p_payload#>'{submission,themeIds}','[]'::jsonb); v_theme_ids uuid[];
begin
  select * into v_request from public.therapy_catalog_requests where id=p_catalog_request_id and requester_profile_id=p_actor_user_id for update;
  if not found then raise exception 'THERAPY_CATALOG_REQUEST_NOT_FOUND'; end if;
  select coalesce(array_agg(value::uuid order by ordinality),'{}'::uuid[]) into v_theme_ids from jsonb_array_elements_text(v_theme_source) with ordinality values_list(value,ordinality);
  if p_request_id is null or cardinality(v_theme_ids) not between 1 and 3 or cardinality(v_theme_ids) <> (select count(*) from public.matching_themes theme where theme.id=any(v_theme_ids) and theme.is_active) then raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD'; end if;
  update public.therapy_catalog_requests set informed_name=coalesce(nullif(trim(p_payload->>'informedName'),''),informed_name), submission=jsonb_set(coalesce(p_payload->'submission',submission),'{themeIds}',to_jsonb(v_theme_ids),true), submission_version=2, status='submitted', updated_at=now() where id=v_request.id returning * into v_request;
  return jsonb_build_object('contractVersion',2,'idempotentReplay',false,'requestId',v_request.id,'status',v_request.status);
end; $$;

-- Retain the legacy signature only as a compatibility wrapper; it now follows
-- the same theme-only validation as v2 and never reads a category identifier.
create or replace function public.submit_therapy_catalog_request_v1(p_actor_user_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.submit_therapy_catalog_request_v2(
    p_actor_user_id,
    jsonb_build_object(
      'informedName', p_payload->>'informedName',
      'themeIds', coalesce(p_payload->'themeIds', '[]'::jsonb),
      'submission', coalesce(p_payload->'submission', jsonb_build_object(
        'description', p_payload->>'description',
        'objective', p_payload->>'justification',
        'useCases', p_payload->>'useCases',
        'sessionProcess', p_payload->>'sessionProcess'
      ))
    ),
    gen_random_uuid()
  );
end; $$;

create or replace function public.get_public_therapy_therapists_v1(
  p_therapy_slug text,
  p_theme_ids uuid[] default '{}'::uuid[],
  p_interest_ids uuid[] default '{}'::uuid[],
  p_limit integer default 6
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_therapy_id uuid; v_relevant_themes uuid[];
begin
  select therapy.id into v_therapy_id
  from public.therapies therapy
  where therapy.slug=p_therapy_slug and therapy.status='published'
    and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id);
  if v_therapy_id is null then raise exception 'NOT_FOUND'; end if;
  select coalesce(array_agg(distinct link.theme_id),'{}'::uuid[]) into v_relevant_themes
  from public.therapy_matching_themes link join public.matching_themes theme on theme.id=link.theme_id and theme.is_active
  where link.therapy_id=v_therapy_id and link.theme_id=any(coalesce(p_theme_ids,'{}'::uuid[]));
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', profile.slug, 'public_name', profile.public_name,
      'photo_url', profile.photo_url, 'therapist_headline', profile.headline,
      'service_description', service.description, 'tags', coalesce(tags.items,array[therapy.name]),
      'average_rating', null, 'review_count', 0, 'completed_session_count', 0,
      'next_slot_at', null, 'service_id', service.id,
      'matching_interest_count', coalesce(interest_match.count,0),
      'matching_service_theme_count', coalesce(theme_match.count,0)
    ) order by coalesce(theme_match.count,0) desc, service.position, service.price_cents, profile.slug)
    from public.therapist_services service
    join public.therapist_profiles profile on profile.id=service.therapist_profile_id
    join public.therapies therapy on therapy.id=service.therapy_id
    left join lateral (select array_agg(value order by value) as items from jsonb_array_elements_text(case when jsonb_typeof(profile.metadata->'care_tags')='array' then profile.metadata->'care_tags' else '[]'::jsonb end) value) tags on true
    left join lateral (select count(*)::integer as count from public.therapist_service_matching_interests service_interest where service_interest.therapist_service_id=service.id and service_interest.interest_id=any(coalesce(p_interest_ids,'{}'::uuid[]))) interest_match on true
    left join lateral (select count(*)::integer as count from public.therapist_service_matching_themes service_theme where service_theme.therapist_service_id=service.id and service_theme.theme_id=any(v_relevant_themes)) theme_match on true
    where service.therapy_id=v_therapy_id and service.archived_at is null and service.status='active' and service.is_bookable and service.online_only
      and public.is_public_service_booking_eligible_v1(service.id)
    limit least(greatest(coalesce(p_limit,6),1),24)
  ),'[]'::jsonb);
end; $$;

comment on function public.therapy_has_active_matching_theme_v1(uuid) is
  'Canonical eligibility primitive after retirement of therapy categories.';
