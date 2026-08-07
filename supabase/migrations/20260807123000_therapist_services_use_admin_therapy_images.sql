create or replace view public.therapist_service_allowed_catalog_v1 as
select
  therapies.id as therapy_id,
  therapies.name as therapy_name,
  therapies.slug as therapy_slug,
  therapies.short_description,
  therapies.status as therapy_status,
  therapies.is_public_visible,
  therapies.is_available_for_services,
  therapy_categories.id as category_id,
  therapy_categories.name as category_name,
  therapy_categories.slug as category_slug,
  therapy_categories.sort_order as category_sort_order,
  coalesce(
    matching_therapy_settings.is_visible_in_matching,
    false
  ) as is_visible_in_matching,
  therapies.updated_at,
  coalesce(theme_projection.themes, '[]'::jsonb) as matching_themes,
  coalesce(therapy_public_content.hero_image_url, therapies.image_url) as therapy_image_url
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join public.therapy_public_content
  on therapy_public_content.therapy_id = therapies.id
left join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = therapies.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', matching_themes.id,
      'name', matching_themes.name,
      'slug', matching_themes.slug,
      'sortOrder', therapy_matching_themes.sort_order,
      'interests', coalesce(interest_projection.interests, '[]'::jsonb)
    )
    order by therapy_matching_themes.sort_order asc, matching_themes.name asc
  ) as themes
  from public.therapy_matching_themes
  join public.matching_themes
    on matching_themes.id = therapy_matching_themes.theme_id
    and matching_themes.is_active = true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', matching_interests.id,
        'name', matching_interests.name,
        'slug', matching_interests.slug,
        'sortOrder', matching_interests.sort_order,
        'themeId', matching_interests.theme_id
      )
      order by matching_interests.sort_order asc, matching_interests.name asc
    ) as interests
    from public.matching_interests
    where matching_interests.theme_id = matching_themes.id
      and matching_interests.is_active = true
  ) as interest_projection on true
  where therapy_matching_themes.therapy_id = therapies.id
) as theme_projection on true
where therapies.status = 'published'
  and therapies.is_available_for_services = true
  and therapy_categories.is_active = true;

create or replace view public.therapist_private_services_v1 as
select
  service.id as service_id,
  service.therapist_profile_id,
  service.therapy_id,
  therapy.name as therapy_name,
  therapy.slug as therapy_slug,
  therapy.status as therapy_status,
  therapy.is_public_visible as therapy_is_public_visible,
  therapy.is_available_for_services,
  category.id as category_id,
  category.name as category_name,
  category.slug as category_slug,
  service.status,
  service.title,
  service.description,
  service.duration_minutes,
  service.price_cents,
  service.currency,
  service.delivery_format,
  service.online_only,
  service.is_bookable,
  service.position,
  service.version,
  case
    when service.status <> 'active' then false
    when service.is_bookable = false then false
    when therapist.status <> 'approved' then false
    when therapist.is_public = false then false
    when therapist.is_accepting_bookings = false then false
    when therapy.status <> 'published' then false
    when therapy.is_public_visible = false then false
    when category.is_active = false then false
    else true
  end as is_reservable,
  case
    when service.status = 'paused' then 'service_paused'
    when service.status = 'archived' then 'service_archived'
    when service.status <> 'active' then 'service_not_active'
    when service.is_bookable = false then 'service_not_accepting_bookings'
    when therapist.status <> 'approved' then 'therapist_not_approved'
    when therapist.is_public = false then 'therapist_profile_private'
    when therapist.is_accepting_bookings = false then 'therapist_not_accepting_bookings'
    when therapy.status <> 'published' then 'therapy_not_published'
    when therapy.is_public_visible = false then 'therapy_not_public'
    when category.is_active = false then 'category_inactive'
    else null
  end as blocking_reason,
  coalesce(metrics.favorite_count, 0)::integer as favorite_count,
  coalesce(metrics.booking_count, 0)::integer as booking_count,
  coalesce(metrics.bookings_last_30_days, 0)::integer as bookings_last_30_days,
  metrics.booking_count_delta_percent,
  service.created_at,
  service.updated_at,
  service.archived_at,
  coalesce(therapy_public_content.hero_image_url, therapy.image_url) as therapy_image_url
from public.therapist_services as service
join public.therapist_profiles as therapist
  on therapist.id = service.therapist_profile_id
join public.therapies as therapy
  on therapy.id = service.therapy_id
join public.therapy_categories as category
  on category.id = therapy.category_id
left join public.therapy_public_content
  on therapy_public_content.therapy_id = therapy.id
left join public.therapist_service_metrics_v1 as metrics
  on metrics.service_id = service.id;

create or replace function public.service_row_to_private_json_v1(
  p_service_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.therapist_private_services_v1%rowtype;
  v_matching jsonb;
begin
  select *
    into v_service
  from public.therapist_private_services_v1
  where service_id = p_service_id;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'themeIds', coalesce(jsonb_agg(distinct service_theme.theme_id) filter (where service_theme.theme_id is not null), '[]'::jsonb),
    'interestIds', coalesce(jsonb_agg(distinct service_interest.interest_id) filter (where service_interest.interest_id is not null), '[]'::jsonb)
  )
    into v_matching
  from public.therapist_services as service
  left join public.therapist_service_matching_themes as service_theme
    on service_theme.therapist_service_id = service.id
  left join public.therapist_service_matching_interests as service_interest
    on service_interest.therapist_service_id = service.id
  where service.id = p_service_id;

  return jsonb_build_object(
    'serviceId', v_service.service_id,
    'therapyId', v_service.therapy_id,
    'therapy', jsonb_build_object(
      'id', v_service.therapy_id,
      'name', v_service.therapy_name,
      'slug', v_service.therapy_slug,
      'imageUrl', v_service.therapy_image_url,
      'status', v_service.therapy_status,
      'isPubliclyVisible', v_service.therapy_is_public_visible,
      'isAvailableForServices', v_service.is_available_for_services
    ),
    'category', jsonb_build_object(
      'id', v_service.category_id,
      'name', v_service.category_name,
      'slug', v_service.category_slug
    ),
    'matching', coalesce(v_matching, jsonb_build_object('themeIds', '[]'::jsonb, 'interestIds', '[]'::jsonb)),
    'status', v_service.status,
    'title', v_service.title,
    'description', v_service.description,
    'durationMinutes', v_service.duration_minutes,
    'priceCents', v_service.price_cents,
    'currency', v_service.currency,
    'deliveryFormat', v_service.delivery_format,
    'onlineOnly', v_service.online_only,
    'isBookable', v_service.is_bookable,
    'position', v_service.position,
    'version', v_service.version,
    'isReservable', v_service.is_reservable,
    'blockingReason', v_service.blocking_reason,
    'metrics', jsonb_build_object(
      'bookingCount', v_service.booking_count,
      'bookingsLast30Days', v_service.bookings_last_30_days,
      'bookingCountDeltaPercent', v_service.booking_count_delta_percent
    ),
    'createdAt', v_service.created_at,
    'updatedAt', v_service.updated_at,
    'archivedAt', v_service.archived_at
  );
end;
$$;

create or replace function public.list_therapist_service_catalog_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'serviceLimit', public.therapist_service_limit_for_plan_v1(v_therapist.plan),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'therapyId', catalog.therapy_id,
            'name', catalog.therapy_name,
            'slug', catalog.therapy_slug,
            'imageUrl', catalog.therapy_image_url,
            'shortDescription', catalog.short_description,
            'category', jsonb_build_object(
              'id', catalog.category_id,
              'name', catalog.category_name,
              'slug', catalog.category_slug
            ),
            'status', catalog.therapy_status,
            'isPubliclyVisible', catalog.is_public_visible,
            'isAvailableForServices', catalog.is_available_for_services,
            'isVisibleInMatching', catalog.is_visible_in_matching,
            'matchingThemes', catalog.matching_themes
          )
          order by catalog.category_sort_order, catalog.therapy_name
        ),
        '[]'::jsonb
      )
      from public.therapist_service_allowed_catalog_v1 as catalog
    )
  );
end;
$$;

grant select on public.therapist_service_allowed_catalog_v1
  to service_role;
grant select on public.therapist_private_services_v1
  to service_role;

revoke all on function public.service_row_to_private_json_v1(uuid) from public;
revoke all on function public.list_therapist_service_catalog_v1(uuid) from public;
grant execute on function public.service_row_to_private_json_v1(uuid)
  to service_role;
grant execute on function public.list_therapist_service_catalog_v1(uuid)
  to authenticated, service_role;
