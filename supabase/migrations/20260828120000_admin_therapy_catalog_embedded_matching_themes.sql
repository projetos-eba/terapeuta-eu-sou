-- Keep the administrative therapy editor self-contained. Public Match
-- projections are intentionally restrictive and cannot be used to hydrate
-- draft therapies or the active theme selector.

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
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'slug', slug,
          'isActive', is_active,
          'sortOrder', sort_order
        )
        order by sort_order asc, name asc
      )
      from public.therapy_categories
    ), '[]'::jsonb),
    'matchingThemes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', matching_themes.id,
          'name', matching_themes.name,
          'slug', matching_themes.slug,
          'imageUrl', matching_themes.image_url,
          'sortOrder', matching_themes.sort_order
        )
        order by matching_themes.sort_order asc, matching_themes.name asc
      )
      from public.matching_themes
      where matching_themes.is_active = true
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(item order by item->>'name')
      from (
        select jsonb_build_object(
          'id', therapies.id,
          'name', therapies.name,
          'slug', therapies.slug,
          'categoryId', therapies.category_id,
          'categoryName', therapy_categories.name,
          'categorySlug', therapy_categories.slug,
          'categoryIsActive', therapy_categories.is_active,
          'status', therapies.status,
          'isPubliclyVisible', therapies.is_public_visible,
          'isAvailableForServices', therapies.is_available_for_services,
          'isVisibleInMatching', coalesce(matching_therapy_settings.is_visible_in_matching, false),
          'matchingThemeIds', coalesce(theme_ids.items, '[]'::jsonb),
          'hasPublishedMatchWeights', exists (
            select 1
            from public.matching_weights
            join public.matching_versions
              on matching_versions.id = matching_weights.version_id
            where matching_weights.therapy_id = therapies.id
              and matching_weights.is_active = true
              and matching_versions.status = 'published'
          ),
          'isFeatured', therapies.is_featured,
          'publishedAt', therapies.published_at,
          'deprecatedAt', therapies.deprecated_at,
          'archivedAt', therapies.archived_at,
          'replacementTherapyId', therapies.replacement_therapy_id,
          'shortDescription', therapies.short_description,
          'description', therapies.description,
          'imageUrl', therapies.image_url,
          'aliases', therapies.search_aliases,
          'calendarColorKey', therapies.calendar_color_key,
          'publicContent', jsonb_build_object(
            'subtitle', therapy_public_content.subtitle,
            'introduction', therapy_public_content.introduction,
            'complementaryDescription', therapy_public_content.complementary_description,
            'safetyNote', coalesce(therapy_public_content.safety_note, therapies.safety_note),
            'seoTitle', therapy_public_content.seo_title,
            'seoDescription', therapy_public_content.seo_description,
            'heroImageUrl', therapy_public_content.hero_image_url,
            'approachLabel', therapy_public_content.approach_label,
            'approachIconKey', therapy_public_content.approach_icon_key,
            'visualThemeKey', therapy_public_content.visual_theme_key,
            'heroFocalPoint', therapy_public_content.hero_focal_point,
            'highlights', coalesce(highlights.items, '[]'::jsonb),
            'benefits', coalesce(benefits.items, '[]'::jsonb)
          ),
          'history', coalesce(events.items, '[]'::jsonb),
          'impact', public.admin_therapy_impact_v1(p_actor_user_id, therapies.id),
          'updatedAt', therapies.updated_at
        ) as item
        from public.therapies
        join public.therapy_categories
          on therapy_categories.id = therapies.category_id
        left join public.matching_therapy_settings
          on matching_therapy_settings.therapy_id = therapies.id
        left join public.therapy_public_content
          on therapy_public_content.therapy_id = therapies.id
        left join lateral (
          select jsonb_agg(theme_id order by sort_order asc) as items
          from public.therapy_matching_themes
          where therapy_matching_themes.therapy_id = therapies.id
        ) as theme_ids on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('title', title, 'iconKey', icon_key)
            order by sort_order asc
          ) as items
          from public.therapy_highlights
          where therapy_highlights.therapy_id = therapies.id
        ) as highlights on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object('title', title, 'description', description, 'iconKey', icon_key)
            order by sort_order asc
          ) as items
          from public.therapy_benefits
          where therapy_benefits.therapy_id = therapies.id
        ) as benefits on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'id', event_rows.id,
              'eventType', event_rows.event_type,
              'reason', event_rows.reason,
              'createdAt', event_rows.created_at,
              'actorProfileId', event_rows.actor_profile_id
            )
            order by event_rows.created_at desc
          ) as items
          from (
            select *
            from public.therapy_catalog_events
            where therapy_catalog_events.entity_type = 'therapy'
              and therapy_catalog_events.entity_id = therapies.id
            order by therapy_catalog_events.created_at desc
            limit 8
          ) as event_rows
        ) as events on true
      ) as rows
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', therapy_catalog_requests.id,
          'informedName', therapy_catalog_requests.informed_name,
          'description', therapy_catalog_requests.description,
          'justification', therapy_catalog_requests.justification,
          'status', therapy_catalog_requests.status,
          'relatedTherapyId', therapy_catalog_requests.related_therapy_id,
          'decision', therapy_catalog_requests.decision,
          'createdAt', therapy_catalog_requests.created_at
        )
        order by therapy_catalog_requests.created_at desc
      )
      from public.therapy_catalog_requests
      where therapy_catalog_requests.status in (
        'submitted',
        'under_review',
        'needs_information'
      )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_therapy_catalog_v1(uuid) from public;
grant execute on function public.admin_list_therapy_catalog_v1(uuid)
  to service_role;

comment on function public.admin_list_therapy_catalog_v1(uuid) is
  'Admin catalog contract with active Match themes and canonical therapy-theme links. Public Match projections are not used for administrative editing.';
