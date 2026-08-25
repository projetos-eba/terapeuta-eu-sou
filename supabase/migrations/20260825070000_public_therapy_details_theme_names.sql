-- Expose only the public therapy theme names needed by public therapist
-- service cards. The source tables are already public editorial projections;
-- no therapist-private matching rows are exposed here.
create or replace view public.public_therapy_details_v
with (security_invoker = true) as
select
  public_therapies_v.id,
  public_therapies_v.slug,
  public_therapies_v.name,
  public_therapies_v.short_description,
  public_therapies_v.description,
  coalesce(
    therapy_public_content.hero_image_url,
    public_therapies_v.image_url
  ) as hero_image_url,
  public_therapies_v.image_url,
  public_therapies_v.therapist_count,
  public_therapies_v.category_slug,
  public_therapies_v.category_name,
  therapy_public_content.subtitle,
  therapy_public_content.introduction,
  therapy_public_content.complementary_description,
  coalesce(
    therapy_public_content.safety_note,
    therapies.safety_note
  ) as safety_note,
  therapy_public_content.seo_title,
  therapy_public_content.seo_description,
  coalesce(
    therapy_public_content.approach_label,
    public_therapies_v.category_name
  ) as approach_label,
  coalesce(
    therapy_public_content.approach_icon_key,
    'sparkles'::text
  ) as approach_icon_key,
  coalesce(
    therapy_public_content.visual_theme_key::text,
    'energy'::text
  ) as visual_theme_key,
  coalesce(
    therapy_public_content.hero_focal_point,
    'center'::text
  ) as hero_focal_point,
  coalesce(highlights.items, '[]'::jsonb) as highlights,
  coalesce(benefits.items, '[]'::jsonb) as benefits,
  coalesce(faqs.items, '[]'::jsonb) as faqs,
  public_therapies_v.published_at,
  public_therapies_v.updated_at,
  coalesce(theme_summary.theme_names, '{}'::text[]) as theme_names
from public.public_therapies_v
join public.therapies
  on therapies.id = public_therapies_v.id
left join public.therapy_public_content
  on therapy_public_content.therapy_id = public_therapies_v.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'title', therapy_highlights.title,
      'iconKey', therapy_highlights.icon_key
    )
    order by therapy_highlights.sort_order
  ) as items
  from public.therapy_highlights
  where therapy_highlights.therapy_id = public_therapies_v.id
) highlights on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'title', therapy_benefits.title,
      'description', therapy_benefits.description,
      'iconKey', therapy_benefits.icon_key
    )
    order by therapy_benefits.sort_order
  ) as items
  from public.therapy_benefits
  where therapy_benefits.therapy_id = public_therapies_v.id
) benefits on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question', therapy_faqs.question,
      'answer', therapy_faqs.answer
    )
    order by therapy_faqs.sort_order
  ) as items
  from public.therapy_faqs
  where therapy_faqs.therapy_id = public_therapies_v.id
) faqs on true
left join lateral (
  select array_agg(distinct therapy_themes.name order by therapy_themes.name) as theme_names
  from public.therapy_theme_weights
  join public.therapy_themes
    on therapy_themes.id = coalesce(
      therapy_theme_weights.theme_id,
      therapy_theme_weights.subtheme_id
    )
  where therapy_theme_weights.therapy_id = public_therapies_v.id
    and therapy_theme_weights.is_active = true
    and therapy_themes.is_active = true
) theme_summary on true
where therapies.archived_at is null;

grant select on public.public_therapy_details_v
  to anon, authenticated, service_role;

comment on view public.public_therapy_details_v is
  'Public therapy detail DTO with safe theme names for public therapist service cards.';
