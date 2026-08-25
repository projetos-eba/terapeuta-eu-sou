-- Resolve the public theme projection through a narrowly scoped function.
-- Theme weights and editorial reasons remain private; only names for an
-- already published/public therapy are returned.
create or replace function public.get_public_therapy_theme_names_v1(
  p_therapy_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct themes.name order by themes.name),
    '{}'::text[]
  )
  from public.therapies as therapies
  join public.therapy_theme_weights as weights
    on weights.therapy_id = therapies.id
  join public.therapy_themes as themes
    on themes.id = coalesce(weights.theme_id, weights.subtheme_id)
  where therapies.id = p_therapy_id
    and therapies.status = 'published'::public.therapy_status
    and therapies.is_public_visible = true
    and therapies.archived_at is null
    and weights.is_active = true
    and themes.is_active = true;
$$;

revoke all on function public.get_public_therapy_theme_names_v1(uuid)
from public, anon, authenticated;
grant execute on function public.get_public_therapy_theme_names_v1(uuid)
to anon, authenticated, service_role;

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
  public.get_public_therapy_theme_names_v1(public_therapies_v.id) as theme_names
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
where therapies.archived_at is null;

grant select on public.public_therapy_details_v
  to anon, authenticated, service_role;

comment on view public.public_therapy_details_v is
  'Public therapy detail DTO with safe theme names for public therapist service cards.';
