begin;

-- Recovery migration for the category-retirement deployment.  The physical
-- category objects were already removed in HML, so every repair below is
-- forward-only and keeps Match themes as the sole active classification.

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
    select *
    from public.therapist_profiles
    where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
      )::integer as online_bookable,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
      )::integer as published_therapy,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
          and public.therapy_has_active_matching_theme_v1(therapy.id)
      )::integer as eligible
    from public.therapist_services service
    join public.therapies therapy on therapy.id = service.therapy_id
    where service.therapist_profile_id = p_therapist_profile_id
      and service.archived_at is null
  )
  select jsonb_build_object(
    'eligible', coalesce(
      profile.status = 'approved'::public.therapist_status
      and profile.is_public
      and profile.is_accepting_bookings
      and profile.accepts_online_sessions
      and coalesce(services.eligible, 0) > 0,
      false
    ),
    'blockers', coalesce((
      select jsonb_agg(code order by position)
      from unnest(array[
        case when profile.id is null then 'profile_not_found' end,
        case when profile.id is not null and profile.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
        case when profile.id is not null and not profile.is_public then 'profile_not_public' end,
        case when profile.id is not null and not profile.is_accepting_bookings then 'not_accepting_bookings' end,
        case when profile.id is not null and not profile.accepts_online_sessions then 'online_sessions_disabled' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) > 0 and coalesce(services.published_therapy, 0) = 0 then 'therapy_not_public' end,
        case when profile.id is not null and coalesce(services.published_therapy, 0) > 0 and coalesce(services.eligible, 0) = 0 then 'therapy_without_active_theme' end
      ]) with ordinality as blockers(code, position)
      where code is not null
    ), '[]'::jsonb),
    'eligibleServiceCount', coalesce(services.eligible, 0)
  )
  from profile
  full join services on true
$$;

revoke all on function public.get_therapist_publication_eligibility_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_therapist_publication_eligibility_v1(uuid)
  to service_role;

-- Public catalog counts keep the established SECURITY INVOKER boundary. They
-- use only the narrow service/profile gate columns exposed through public RLS;
-- no private service content or service identifier is needed by the view.
grant select (accepts_online_sessions)
on public.therapist_profiles
to anon, authenticated, service_role;

-- Match themes are now the public catalog classification, not Match-only
-- metadata. Public RLS therefore exposes active links for every eligible
-- public therapy, while the dedicated Match view keeps its stricter settings
-- and published-weight gates.
drop policy if exists "Public can read public therapy matching themes"
on public.therapy_matching_themes;

create policy "Public can read public therapy matching themes"
on public.therapy_matching_themes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matching_themes theme
    where theme.id = therapy_matching_themes.theme_id
      and theme.is_active
  )
  and exists (
    select 1
    from public.therapies therapy
    where therapy.id = therapy_matching_themes.therapy_id
      and therapy.status = 'published'
      and therapy.is_public_visible
      and therapy.archived_at is null
  )
);

create or replace view public.public_therapies_v
with (security_invoker = true) as
with therapist_counts as (
  select
    service.therapy_id,
    count(distinct profile.id)::integer as therapist_count
  from public.therapist_services service
  join public.therapist_profiles profile
    on profile.id = service.therapist_profile_id
  where service.status = 'active'
    and service.is_bookable
    and service.online_only
    and profile.status = 'approved'
    and profile.is_public
    and profile.is_accepting_bookings
    and profile.accepts_online_sessions
  group by service.therapy_id
)
select
  therapy.id,
  therapy.slug,
  therapy.name,
  therapy.short_description,
  therapy.description,
  therapy.image_url,
  therapy.status,
  therapy.published_at,
  therapy.popularity_score,
  therapy.created_at,
  therapy.updated_at,
  coalesce(therapist_counts.therapist_count, 0) as therapist_count,
  (therapy.popularity_score >= 80 or therapy.is_featured) as is_popular,
  (
    therapy.published_at is not null
    and therapy.published_at >= now() - interval '45 days'
  ) as is_new,
  lower(public.unaccent(concat_ws(
    ' ',
    therapy.name,
    therapy.short_description,
    therapy.description,
    array_to_string(theme_names.names, ' '),
    array_to_string(therapy.search_aliases, ' ')
  ))) as search_text,
  therapy.is_featured,
  theme_names.names as theme_names,
  theme_names.slugs as theme_slugs
from public.therapies therapy
left join therapist_counts on therapist_counts.therapy_id = therapy.id
join lateral (
  select
    array_agg(theme.name order by link.sort_order, theme.name) as names,
    array_agg(theme.slug order by link.sort_order, theme.name) as slugs
  from public.therapy_matching_themes link
  join public.matching_themes theme
    on theme.id = link.theme_id
   and theme.is_active
  where link.therapy_id = therapy.id
) theme_names on true
where therapy.status = 'published'
  and therapy.is_public_visible
  and public.therapy_has_active_matching_theme_v1(therapy.id);

alter view public.therapist_private_services_v1
  set (security_invoker = true);
alter view public.therapist_service_allowed_catalog_v1
  set (security_invoker = true);
alter view public.public_matching_therapist_counts
  set (security_invoker = true);

revoke all on
  public.therapist_private_services_v1,
  public.therapist_service_allowed_catalog_v1
from public, anon, authenticated, service_role;
grant select on
  public.therapist_private_services_v1,
  public.therapist_service_allowed_catalog_v1
to service_role;

revoke all on public.public_matching_therapist_counts
  from public, anon, authenticated, service_role;
grant select on public.public_matching_therapist_counts
  to anon, authenticated, service_role;

create or replace function public.admin_list_therapy_catalog_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_get_actor_profile_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'matchingThemes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', theme.id,
          'name', theme.name,
          'slug', theme.slug,
          'imageUrl', theme.image_url,
          'sortOrder', theme.sort_order
        )
        order by theme.sort_order, theme.name
      )
      from public.matching_themes theme
      where theme.is_active
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(item order by item->>'name')
      from (
        select jsonb_build_object(
          'id', therapy.id,
          'name', therapy.name,
          'slug', therapy.slug,
          'status', therapy.status,
          'isPubliclyVisible', therapy.is_public_visible,
          'isAvailableForServices', therapy.is_available_for_services,
          'isVisibleInMatching', coalesce(settings.is_visible_in_matching, false),
          'matchingThemeIds', coalesce(theme_ids.items, '[]'::jsonb),
          'hasPublishedMatchWeights', exists (
            select 1
            from public.matching_weights weight
            join public.matching_versions version on version.id = weight.version_id
            where weight.therapy_id = therapy.id
              and weight.is_active
              and version.status = 'published'
          ),
          'isFeatured', therapy.is_featured,
          'publishedAt', therapy.published_at,
          'deprecatedAt', therapy.deprecated_at,
          'archivedAt', therapy.archived_at,
          'replacementTherapyId', therapy.replacement_therapy_id,
          'shortDescription', therapy.short_description,
          'description', therapy.description,
          'imageUrl', therapy.image_url,
          'aliases', therapy.search_aliases,
          'calendarColorKey', therapy.calendar_color_key,
          'publicContent', jsonb_build_object(
            'subtitle', content.subtitle,
            'introduction', content.introduction,
            'complementaryDescription', content.complementary_description,
            'safetyNote', coalesce(content.safety_note, therapy.safety_note),
            'seoTitle', content.seo_title,
            'seoDescription', content.seo_description,
            'heroImageUrl', content.hero_image_url,
            'approachLabel', content.approach_label,
            'approachIconKey', content.approach_icon_key,
            'visualThemeKey', content.visual_theme_key,
            'heroFocalPoint', content.hero_focal_point,
            'highlights', coalesce(highlights.items, '[]'::jsonb),
            'benefits', coalesce(benefits.items, '[]'::jsonb)
          ),
          'history', coalesce(events.items, '[]'::jsonb),
          'impact', public.admin_therapy_impact_v1(p_actor_user_id, therapy.id),
          'updatedAt', therapy.updated_at
        ) as item
        from public.therapies therapy
        left join public.matching_therapy_settings settings
          on settings.therapy_id = therapy.id
        left join public.therapy_public_content content
          on content.therapy_id = therapy.id
        left join lateral (
          select jsonb_agg(link.theme_id order by link.sort_order) as items
          from public.therapy_matching_themes link
          where link.therapy_id = therapy.id
        ) theme_ids on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('title', highlight.title, 'iconKey', highlight.icon_key)
            order by highlight.sort_order
          ) as items
          from public.therapy_highlights highlight
          where highlight.therapy_id = therapy.id
        ) highlights on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'title', benefit.title,
              'description', benefit.description,
              'iconKey', benefit.icon_key
            )
            order by benefit.sort_order
          ) as items
          from public.therapy_benefits benefit
          where benefit.therapy_id = therapy.id
        ) benefits on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'id', event_row.id,
              'eventType', event_row.event_type,
              'reason', event_row.reason,
              'createdAt', event_row.created_at,
              'actorProfileId', event_row.actor_profile_id
            )
            order by event_row.created_at desc
          ) as items
          from (
            select *
            from public.therapy_catalog_events event
            where event.entity_type = 'therapy'
              and event.entity_id = therapy.id
            order by event.created_at desc
            limit 8
          ) event_row
        ) events on true
      ) rows
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', request.id,
          'informedName', request.informed_name,
          'description', request.description,
          'justification', request.justification,
          'status', request.status,
          'relatedTherapyId', request.related_therapy_id,
          'decision', request.decision,
          'createdAt', request.created_at
        )
        order by request.created_at desc
      )
      from public.therapy_catalog_requests request
      where request.status in ('submitted', 'under_review', 'needs_information')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_therapy_catalog_v1(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_therapy_catalog_v1(uuid) to service_role;

create or replace function public.admin_upsert_therapy_draft_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_therapy_id uuid;
  v_existing public.therapies;
  v_old_slug text;
  v_old_state jsonb;
  v_slug text;
  v_name text;
  v_short_description text;
  v_now timestamptz := now();
  v_next_state jsonb;
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_input_count integer := 0;
  v_valid_theme_count integer := 0;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);
  v_therapy_id := nullif(p_payload->>'therapyId', '')::uuid;
  v_name := trim(coalesce(p_payload->>'name', ''));
  v_slug := trim(coalesce(p_payload->>'slug', ''));
  v_short_description := trim(coalesce(p_payload->>'shortDescription', ''));

  if p_payload ? 'faqs' then
    raise exception 'ADMIN_THERAPY_CATALOG_FAQ_REMOVED';
  end if;

  if p_request_id is null
    or v_name = ''
    or v_slug = ''
    or v_short_description = ''
    or jsonb_typeof(p_payload->'themeIds') <> 'array' then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text, ordinality
    from jsonb_array_elements_text(p_payload->'themeIds')
      with ordinality as item(value, ordinality)
  ), validated as (
    select id_text::uuid as id, ordinality
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce(array_agg(validated.id order by validated.ordinality), '{}'::uuid[]),
    count(distinct theme.id)::integer
  into v_theme_input_count, v_theme_ids, v_valid_theme_count
  from validated
  left join public.matching_themes theme
    on theme.id = validated.id
   and theme.is_active;

  if v_theme_input_count < 1 or v_theme_input_count > 3 then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT';
  end if;

  if cardinality(v_theme_ids) <> v_theme_input_count
    or v_valid_theme_count <> v_theme_input_count then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_THEME';
  end if;

  perform public.admin_assert_therapy_content_lengths_v1(p_payload);

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_SLUG';
  end if;

  perform public.admin_assert_responsible_therapy_text_v1(
    concat_ws(
      ' ',
      v_name,
      v_short_description,
      p_payload->>'description',
      p_payload#>>'{publicContent,introduction}',
      p_payload#>>'{publicContent,complementaryDescription}',
      p_payload#>>'{publicContent,safetyNote}'
    )
  );

  if v_therapy_id is not null then
    select * into v_existing
    from public.therapies
    where id = v_therapy_id
    for update;

    if v_existing.id is null then
      raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
    end if;

    v_old_slug := v_existing.slug;
    v_old_state := to_jsonb(v_existing);

    if exists (
      select 1
      from public.therapies
      where slug = v_slug and id <> v_therapy_id
    ) then
      raise exception 'ADMIN_THERAPY_CATALOG_SLUG_CONFLICT';
    end if;

    update public.therapies
    set
      name = v_name,
      slug = v_slug,
      short_description = v_short_description,
      description = nullif(p_payload->>'description', ''),
      image_url = nullif(p_payload->>'imageUrl', ''),
      search_aliases = coalesce(array(
        select trim(value)::text
        from jsonb_array_elements_text(coalesce(p_payload->'aliases', '[]'::jsonb)) value
        where trim(value) <> ''
      ), '{}'::text[]),
      is_public_visible = coalesce((p_payload->>'isPubliclyVisible')::boolean, is_public_visible),
      is_available_for_services = coalesce((p_payload->>'isAvailableForServices')::boolean, is_available_for_services),
      is_featured = coalesce((p_payload->>'isFeatured')::boolean, is_featured),
      calendar_color_key = coalesce(nullif(p_payload->>'calendarColorKey', ''), calendar_color_key),
      updated_by_profile_id = v_actor.id,
      updated_at = v_now
    where id = v_therapy_id;

    if v_old_slug <> v_slug then
      insert into public.therapy_slug_redirects (
        old_slug, current_slug, therapy_id, created_by_profile_id
      ) values (
        v_old_slug, v_slug, v_therapy_id, v_actor.id
      )
      on conflict (old_slug) do update set
        current_slug = excluded.current_slug,
        therapy_id = excluded.therapy_id,
        created_by_profile_id = excluded.created_by_profile_id;
    end if;
  else
    if exists (select 1 from public.therapies where slug = v_slug) then
      raise exception 'ADMIN_THERAPY_CATALOG_SLUG_CONFLICT';
    end if;

    insert into public.therapies (
      name,
      slug,
      short_description,
      description,
      status,
      is_public_visible,
      is_available_for_services,
      is_featured,
      image_url,
      search_aliases,
      calendar_color_key,
      created_by_profile_id,
      updated_by_profile_id
    ) values (
      v_name,
      v_slug,
      v_short_description,
      nullif(p_payload->>'description', ''),
      'draft',
      coalesce((p_payload->>'isPubliclyVisible')::boolean, false),
      coalesce((p_payload->>'isAvailableForServices')::boolean, false),
      coalesce((p_payload->>'isFeatured')::boolean, false),
      nullif(p_payload->>'imageUrl', ''),
      coalesce(array(
        select trim(value)::text
        from jsonb_array_elements_text(coalesce(p_payload->'aliases', '[]'::jsonb)) value
        where trim(value) <> ''
      ), '{}'::text[]),
      coalesce(nullif(p_payload->>'calendarColorKey', ''), 'neutral'),
      v_actor.id,
      v_actor.id
    )
    returning id into v_therapy_id;

    v_old_state := null;
  end if;

  insert into public.therapy_public_content (
    therapy_id,
    hero_image_url,
    subtitle,
    introduction,
    complementary_description,
    safety_note,
    seo_title,
    seo_description,
    approach_label,
    approach_icon_key,
    visual_theme_key,
    hero_focal_point
  ) values (
    v_therapy_id,
    nullif(p_payload#>>'{publicContent,heroImageUrl}', ''),
    nullif(p_payload#>>'{publicContent,subtitle}', ''),
    nullif(p_payload#>>'{publicContent,introduction}', ''),
    nullif(p_payload#>>'{publicContent,complementaryDescription}', ''),
    nullif(p_payload#>>'{publicContent,safetyNote}', ''),
    nullif(p_payload#>>'{publicContent,seoTitle}', ''),
    nullif(p_payload#>>'{publicContent,seoDescription}', ''),
    nullif(p_payload#>>'{publicContent,approachLabel}', ''),
    nullif(p_payload#>>'{publicContent,approachIconKey}', ''),
    coalesce(nullif(p_payload#>>'{publicContent,visualThemeKey}', ''), 'energy')::public.therapy_visual_theme_key,
    coalesce(nullif(p_payload#>>'{publicContent,heroFocalPoint}', ''), 'center')
  )
  on conflict (therapy_id) do update set
    hero_image_url = excluded.hero_image_url,
    subtitle = excluded.subtitle,
    introduction = excluded.introduction,
    complementary_description = excluded.complementary_description,
    safety_note = excluded.safety_note,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    approach_label = excluded.approach_label,
    approach_icon_key = excluded.approach_icon_key,
    visual_theme_key = excluded.visual_theme_key,
    hero_focal_point = excluded.hero_focal_point,
    updated_at = v_now;

  insert into public.matching_therapy_settings (therapy_id, is_visible_in_matching)
  values (
    v_therapy_id,
    coalesce((p_payload->>'isVisibleInMatching')::boolean, false)
  )
  on conflict (therapy_id) do update set
    is_visible_in_matching = excluded.is_visible_in_matching,
    updated_at = v_now;

  if p_payload ? 'highlights' then
    delete from public.therapy_highlights where therapy_id = v_therapy_id;
    insert into public.therapy_highlights (therapy_id, title, icon_key, sort_order)
    select
      v_therapy_id,
      trim(item->>'title'),
      coalesce(nullif(trim(item->>'iconKey'), ''), 'sparkles'),
      ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'highlights', '[]'::jsonb))
      with ordinality as items(item, ordinality)
    where trim(item->>'title') <> '';
  end if;

  if p_payload ? 'benefits' then
    delete from public.therapy_benefits where therapy_id = v_therapy_id;
    insert into public.therapy_benefits (therapy_id, title, description, icon_key, sort_order)
    select
      v_therapy_id,
      trim(item->>'title'),
      nullif(trim(item->>'description'), ''),
      coalesce(nullif(trim(item->>'iconKey'), ''), 'sparkles'),
      ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'benefits', '[]'::jsonb))
      with ordinality as items(item, ordinality)
    where trim(item->>'title') <> '';
  end if;

  select to_jsonb(therapy.*) into v_next_state
  from public.therapies therapy
  where therapy.id = v_therapy_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id
  ) values (
    v_actor.id,
    v_actor.role,
    'therapy',
    v_therapy_id,
    case when v_old_state is null then 'therapy_draft_created' else 'therapy_edited' end,
    v_old_state,
    v_next_state,
    nullif(p_payload->>'reason', ''),
    p_request_id
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapyId', v_therapy_id,
    'catalog', public.admin_replace_therapy_matching_themes_v1(
      p_actor_user_id,
      p_request_id,
      v_therapy_id,
      v_theme_ids,
      p_payload->>'reason'
    )
  );
end;
$$;

create or replace function public.admin_upsert_therapy_draft_with_matching_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.admin_upsert_therapy_draft_v1(
    p_actor_user_id,
    p_request_id,
    p_payload
  );
end;
$$;

revoke all on function public.admin_upsert_therapy_draft_v1(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_therapy_draft_with_matching_v1(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_upsert_therapy_draft_v1(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.admin_upsert_therapy_draft_with_matching_v1(uuid, uuid, jsonb)
  to service_role;

create or replace function public.ensure_operational_therapy_has_active_theme_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_therapy_id uuid := coalesce(new.therapy_id, old.therapy_id);
begin
  if exists (
    select 1
    from public.therapies therapy
    left join public.matching_therapy_settings settings
      on settings.therapy_id = therapy.id
    where therapy.id = v_therapy_id
      and (
        (
          therapy.status = 'published'
          and (
            therapy.is_public_visible
            or therapy.is_available_for_services
            or coalesce(settings.is_visible_in_matching, false)
          )
        )
        or exists (
          select 1
          from public.therapist_services service
          where service.therapy_id = therapy.id
            and service.status = 'active'
            and service.archived_at is null
        )
      )
      and not public.therapy_has_active_matching_theme_v1(therapy.id)
  ) then
    raise exception 'ADMIN_THERAPY_CATALOG_THEME_REQUIRED';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists ensure_operational_therapy_has_active_theme
  on public.therapy_matching_themes;
create constraint trigger ensure_operational_therapy_has_active_theme
after insert or update or delete on public.therapy_matching_themes
deferrable initially deferred
for each row
execute function public.ensure_operational_therapy_has_active_theme_v1();

create or replace function public.prevent_operational_theme_deactivation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1
    from public.therapy_matching_themes candidate
    join public.therapies therapy on therapy.id = candidate.therapy_id
    left join public.matching_therapy_settings settings
      on settings.therapy_id = therapy.id
    where candidate.theme_id = old.id
      and (
        (
          therapy.status = 'published'
          and (
            therapy.is_public_visible
            or therapy.is_available_for_services
            or coalesce(settings.is_visible_in_matching, false)
          )
        )
        or exists (
          select 1
          from public.therapist_services service
          where service.therapy_id = therapy.id
            and service.status = 'active'
            and service.archived_at is null
        )
      )
      and not exists (
        select 1
        from public.therapy_matching_themes sibling
        join public.matching_themes sibling_theme
          on sibling_theme.id = sibling.theme_id
         and sibling_theme.is_active
        where sibling.therapy_id = candidate.therapy_id
          and sibling.theme_id <> old.id
      )
  ) then
    raise exception 'ADMIN_MATCHING_THEME_DEACTIVATION_BLOCKED';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_operational_theme_deactivation
  on public.matching_themes;
create trigger prevent_operational_theme_deactivation
before update of is_active on public.matching_themes
for each row
execute function public.prevent_operational_theme_deactivation_v1();

revoke all on function public.ensure_operational_therapy_has_active_theme_v1()
  from public, anon, authenticated;
revoke all on function public.prevent_operational_theme_deactivation_v1()
  from public, anon, authenticated;

create or replace function public.admin_transition_therapy_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_therapy_id uuid,
  p_action text,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_old public.therapies;
  v_next public.therapies;
  v_impact jsonb;
begin
  v_actor := public.admin_get_actor_profile_v1(p_actor_user_id);

  select * into v_old
  from public.therapies
  where id = p_therapy_id
  for update;

  if v_old.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_NOT_FOUND';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'ADMIN_THERAPY_CATALOG_REASON_REQUIRED';
  end if;

  v_impact := public.admin_therapy_impact_v1(p_actor_user_id, p_therapy_id);

  if p_action = 'review' then
    update public.therapies
    set status = 'in_review',
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'publish' then
    perform public.admin_validate_therapy_publishable_v1(p_therapy_id);
    update public.therapies
    set status = 'published',
        published_at = now(),
        archived_at = null,
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'unpublish' then
    update public.therapies
    set status = 'draft',
        published_at = null,
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'deprecate' then
    update public.therapies
    set status = 'deprecated',
        is_available_for_services = false,
        replacement_therapy_id = nullif(p_payload->>'replacementTherapyId', '')::uuid,
        deprecated_at = now(),
        metadata = metadata || jsonb_build_object(
          'admin_message', nullif(p_payload->>'adminMessage', '')
        ),
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  elsif p_action = 'archive' then
    if (v_impact->>'activeServiceCount')::integer > 0
      or (v_impact->>'futureBookingCount')::integer > 0 then
      raise exception 'ADMIN_THERAPY_CATALOG_ARCHIVE_BLOCKED_BY_USAGE';
    end if;

    update public.therapies
    set status = 'archived',
        is_public_visible = false,
        is_available_for_services = false,
        archived_at = now(),
        updated_by_profile_id = v_actor.id,
        updated_at = now()
    where id = p_therapy_id;
  else
    raise exception 'ADMIN_THERAPY_CATALOG_INVALID_ACTION';
  end if;

  if p_action in ('deprecate', 'archive') then
    update public.matching_therapy_settings
    set is_visible_in_matching = false,
        updated_at = now()
    where therapy_id = p_therapy_id;
  end if;

  select * into v_next
  from public.therapies
  where id = p_therapy_id;

  insert into public.therapy_catalog_events (
    actor_profile_id,
    actor_role,
    entity_type,
    entity_id,
    event_type,
    previous_state,
    next_state,
    reason,
    request_id,
    metadata
  ) values (
    v_actor.id,
    v_actor.role,
    'therapy',
    p_therapy_id,
    'therapy_' || p_action,
    to_jsonb(v_old),
    to_jsonb(v_next),
    p_reason,
    p_request_id,
    jsonb_build_object('impactBefore', v_impact)
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapyId', p_therapy_id,
    'impactBefore', v_impact,
    'catalog', public.admin_list_therapy_catalog_v1(p_actor_user_id)
  );
end;
$$;

revoke all on function public.admin_transition_therapy_v1(uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_transition_therapy_v1(uuid, uuid, uuid, text, text, jsonb)
  to service_role;

create or replace function public.submit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_therapist_profile_id uuid;
  v_existing public.therapy_catalog_requests;
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
  v_description text := nullif(trim(coalesce(v_submission->>'description', '')), '');
  v_objective text := nullif(trim(coalesce(v_submission->>'objective', '')), '');
  v_use_cases text := nullif(trim(coalesce(v_submission->>'useCases', '')), '');
  v_process text := nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '');
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_count integer := 0;
begin
  select * into v_profile
  from public.profiles
  where id = p_actor_user_id and role = 'therapist';

  if v_profile.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED';
  end if;

  select * into v_existing
  from public.therapy_catalog_requests
  where requester_profile_id = p_actor_user_id
    and client_request_id = p_request_id;

  if v_existing.id is not null then
    return jsonb_build_object(
      'contractVersion', 2,
      'idempotentReplay', true,
      'requestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) value
  ), validated as (
    select distinct id_text::uuid as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce(array_agg(theme.id order by theme.sort_order, theme.name), '{}'::uuid[]),
    coalesce(array_agg(theme.name order by theme.sort_order, theme.name), '{}'::text[]),
    count(theme.id)::integer
  into v_theme_input_count, v_theme_ids, v_theme_names, v_valid_theme_count
  from validated
  join public.matching_themes theme on theme.id = validated.id and theme.is_active;

  if p_request_id is null
    or char_length(v_name) not between 2 and 120
    or v_description is null
    or v_objective is null
    or v_use_cases is null
    or v_process is null
    or v_theme_input_count not between 1 and 3
    or v_valid_theme_count <> v_theme_input_count then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
  v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);

  select id into v_therapist_profile_id
  from public.therapist_profiles
  where user_id = p_actor_user_id
  limit 1;

  insert into public.therapy_catalog_requests (
    requester_profile_id,
    requester_therapist_profile_id,
    client_request_id,
    informed_name,
    description,
    justification,
    submission,
    submission_version,
    status
  ) values (
    p_actor_user_id,
    v_therapist_profile_id,
    p_request_id,
    v_name,
    v_description,
    v_objective,
    v_submission,
    2,
    'submitted'
  )
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, next_state, request_id
  ) values (
    v_profile.id,
    v_profile.role,
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_submitted',
    jsonb_build_object('status', 'submitted', 'informedName', v_name),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação recebida',
    'Recebemos sua sugestão de terapia. Você será avisado quando houver uma atualização.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2,
    'idempotentReplay', false,
    'requestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

create or replace function public.resubmit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_catalog_request_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
  v_theme_source jsonb := coalesce(p_payload->'themeIds', v_submission->'themeIds', '[]'::jsonb);
  v_theme_ids uuid[] := '{}'::uuid[];
  v_theme_names text[] := '{}'::text[];
  v_theme_input_count integer := 0;
  v_valid_theme_count integer := 0;
begin
  select * into v_request
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
    and requester_profile_id = p_actor_user_id
  for update;

  if v_request.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.therapy_catalog_events event
    where event.entity_type = 'therapy_catalog_request'
      and event.entity_id = v_request.id
      and event.event_type = 'therapy_request_resubmitted'
      and event.request_id = p_request_id
  ) then
    return jsonb_build_object(
      'contractVersion', 2,
      'idempotentReplay', true,
      'requestId', v_request.id,
      'status', v_request.status
    );
  end if;

  if v_request.status <> 'needs_information' then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_EDITABLE';
  end if;

  if jsonb_typeof(v_theme_source) <> 'array' then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  with raw as (
    select trim(value) as id_text
    from jsonb_array_elements_text(v_theme_source) value
  ), validated as (
    select distinct id_text::uuid as id
    from raw
    where id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  select
    (select count(*) from raw),
    coalesce(array_agg(theme.id order by theme.sort_order, theme.name), '{}'::uuid[]),
    coalesce(array_agg(theme.name order by theme.sort_order, theme.name), '{}'::text[]),
    count(theme.id)::integer
  into v_theme_input_count, v_theme_ids, v_theme_names, v_valid_theme_count
  from validated
  join public.matching_themes theme on theme.id = validated.id and theme.is_active;

  if p_request_id is null
    or char_length(v_name) not between 2 and 120
    or nullif(trim(coalesce(v_submission->>'description', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'objective', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'useCases', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '') is null
    or v_theme_input_count not between 1 and 3
    or v_valid_theme_count <> v_theme_input_count then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  v_submission := jsonb_set(v_submission, '{themeIds}', to_jsonb(v_theme_ids), true);
  v_submission := jsonb_set(v_submission, '{themeNames}', to_jsonb(v_theme_names), true);

  update public.therapy_catalog_requests
  set
    informed_name = v_name,
    description = nullif(trim(coalesce(v_submission->>'description', '')), ''),
    justification = nullif(trim(coalesce(v_submission->>'objective', '')), ''),
    submission = v_submission,
    submission_version = 2,
    status = 'submitted',
    decision = null,
    resubmitted_at = now(),
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, previous_state, next_state, request_id
  ) values (
    p_actor_user_id,
    'therapist',
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_resubmitted',
    jsonb_build_object('status', 'needs_information'),
    jsonb_build_object('status', 'submitted'),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação atualizada',
    'Recebemos as informações adicionais da sua sugestão de terapia.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2,
    'idempotentReplay', false,
    'requestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid)
  to service_role;
grant execute on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid)
  to service_role;

create or replace function public.get_public_therapy_therapists_v1(
  p_therapy_slug text,
  p_theme_ids uuid[] default '{}'::uuid[],
  p_interest_ids uuid[] default '{}'::uuid[],
  p_limit integer default 6
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapy_id uuid;
  v_relevant_theme_ids uuid[];
  v_relevant_interest_ids uuid[];
begin
  select therapy.id into v_therapy_id
  from public.therapies therapy
  where therapy.slug = p_therapy_slug
    and therapy.status = 'published'
    and therapy.is_public_visible
    and public.therapy_has_active_matching_theme_v1(therapy.id);

  if v_therapy_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct link.theme_id), '{}'::uuid[])
    into v_relevant_theme_ids
  from public.therapy_matching_themes link
  join public.matching_themes theme
    on theme.id = link.theme_id
   and theme.is_active
  where link.therapy_id = v_therapy_id
    and link.theme_id = any(coalesce(p_theme_ids, '{}'::uuid[]));

  select coalesce(array_agg(distinct interest.id), '{}'::uuid[])
    into v_relevant_interest_ids
  from public.matching_interests interest
  where interest.id = any(coalesce(p_interest_ids, '{}'::uuid[]))
    and interest.theme_id = any(v_relevant_theme_ids)
    and interest.is_active;

  return coalesce((
    with eligible_services as (
      select
        profile.id as therapist_profile_id,
        profile.slug,
        profile.public_name,
        profile.headline as therapist_headline,
        profile.photo_url,
        profile.plan,
        service.id as service_id,
        service.title as service_title,
        service.description as service_description,
        service.position,
        service.price_cents,
        coalesce(tags.items, array[therapy.name]) as tags,
        coalesce(interest_matches.matching_interest_count, 0)::integer as matching_interest_count,
        coalesce(theme_matches.matching_service_theme_count, 0)::integer as matching_service_theme_count,
        review_summary.average_rating,
        coalesce(review_summary.review_count, 0)::integer as review_count,
        coalesce(session_summary.completed_session_count, 0)::integer as completed_session_count,
        next_slot.next_slot_at
      from public.therapist_services service
      join public.therapist_profiles profile
        on profile.id = service.therapist_profile_id
      join public.therapies therapy
        on therapy.id = service.therapy_id
      left join lateral (
        select array_agg(tag.value order by tag.value) as items
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(profile.metadata->'care_tags') = 'array'
              then profile.metadata->'care_tags'
            else '[]'::jsonb
          end
        ) tag(value)
      ) tags on true
      left join lateral (
        select count(distinct service_interest.interest_id)::integer as matching_interest_count
        from public.therapist_service_matching_interests service_interest
        where service_interest.therapist_service_id = service.id
          and service_interest.interest_id = any(v_relevant_interest_ids)
      ) interest_matches on true
      left join lateral (
        select count(distinct service_theme.theme_id)::integer as matching_service_theme_count
        from public.therapist_service_matching_themes service_theme
        where service_theme.therapist_service_id = service.id
          and service_theme.theme_id = any(v_relevant_theme_ids)
      ) theme_matches on true
      left join lateral (
        select
          round(avg(review.rating)::numeric, 1) as average_rating,
          count(*)::integer as review_count
        from public.public_therapist_profile_reviews_v_internal review
        where review.therapist_slug = profile.slug
      ) review_summary on true
      left join lateral (
        select count(*)::integer as completed_session_count
        from public.bookings booking
        where booking.therapist_profile_id = profile.id
          and booking.status = 'completed'
          and booking.payment_status = 'paid'
      ) session_summary on true
      left join lateral (
        select min((slot.value->>'startsAt')::timestamptz) as next_slot_at
        from jsonb_array_elements(
          coalesce(
            public.get_service_available_slots_v1(
              service.id,
              now(),
              now() + interval '31 days',
              1
            )->'slots',
            '[]'::jsonb
          )
        ) slot(value)
      ) next_slot on true
      where service.therapy_id = v_therapy_id
        and service.archived_at is null
        and service.status = 'active'
        and service.is_bookable
        and service.online_only
        and therapy.status = 'published'
        and therapy.is_public_visible
        and public.therapy_has_active_matching_theme_v1(therapy.id)
        and public.is_public_service_booking_eligible_v1(service.id)
        and public.is_therapist_publication_eligible_v1(profile.id)
    ), selected_service as (
      select
        eligible_services.*,
        row_number() over (
          partition by therapist_profile_id
          order by
            matching_interest_count desc,
            matching_service_theme_count desc,
            position asc nulls last,
            price_cents,
            service_title,
            service_id
        ) as service_rank
      from eligible_services
    ), ranked as (
      select *
      from selected_service
      where service_rank = 1
      order by
        case when cardinality(v_relevant_interest_ids) > 0 then matching_interest_count else 0 end desc,
        matching_service_theme_count desc,
        case when cardinality(v_relevant_theme_ids) > 0 then
          case plan when 'premium_plus' then 2 when 'premium' then 1 else 0 end
        else 0 end desc,
        next_slot_at asc nulls last,
        average_rating desc nulls last,
        review_count desc,
        slug
      limit least(greatest(coalesce(p_limit, 6), 1), 24)
    )
    select jsonb_agg(
      jsonb_build_object(
        'slug', slug,
        'public_name', public_name,
        'photo_url', photo_url,
        'therapist_headline', therapist_headline,
        'service_description', service_description,
        'tags', tags,
        'average_rating', average_rating,
        'review_count', review_count,
        'completed_session_count', completed_session_count,
        'next_slot_at', next_slot_at,
        'service_id', service_id,
        'matching_interest_count', matching_interest_count,
        'matching_service_theme_count', matching_service_theme_count
      )
      order by
        case when cardinality(v_relevant_interest_ids) > 0 then matching_interest_count else 0 end desc,
        matching_service_theme_count desc,
        case when cardinality(v_relevant_theme_ids) > 0 then
          case plan when 'premium_plus' then 2 when 'premium' then 1 else 0 end
        else 0 end desc,
        next_slot_at asc nulls last,
        average_rating desc nulls last,
        review_count desc,
        slug
    )
    from ranked
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.get_public_therapy_therapists_v1(text, uuid[], uuid[], integer)
  to anon, authenticated, service_role;

create or replace view public.public_matching_therapist_counts as
select
  catalog.id as therapy_id,
  catalog.therapist_count
from public.public_therapies_v catalog
join public.matching_therapy_settings settings
  on settings.therapy_id = catalog.id
 and settings.is_visible_in_matching
where catalog.status = 'published';

alter view public.public_matching_therapist_counts
  set (security_invoker = true);
revoke all on public.public_matching_therapist_counts
  from public, anon, authenticated, service_role;
grant select on public.public_matching_therapist_counts
  to anon, authenticated, service_role;

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
    therapist.city,
    therapist.state,
    service_summary.service_title,
    service_summary.service_description,
    service_summary.therapy_name,
    array_to_string(theme_summary.theme_names, ' '),
    array_to_string(care_tags.items, ' ')
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

create or replace view public.public_therapist_search as
select internal.*
from public.public_therapist_search_internal internal
where public.is_therapist_publication_eligible_v1(internal.therapist_profile_id);

revoke all on public.public_therapist_search
  from public, anon, authenticated, service_role;
grant select on public.public_therapist_search
  to anon, authenticated, service_role;

commit;
