-- H1 hardening: public therapy details must run as invoker and rely on
-- explicit grants/RLS for editorial content instead of SECURITY DEFINER bypass.

grant select (
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
) on public.therapy_public_content to anon;

grant select (
  therapy_id,
  title,
  icon_key,
  sort_order
) on public.therapy_highlights to anon;

grant select (
  therapy_id,
  title,
  description,
  icon_key,
  sort_order
) on public.therapy_benefits to anon;

grant select (
  therapy_id,
  question,
  answer,
  sort_order
) on public.therapy_faqs to anon;

drop policy if exists "Public can read published therapy public content"
  on public.therapy_public_content;
create policy "Public can read published therapy public content"
on public.therapy_public_content
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapies
    where therapies.id = therapy_public_content.therapy_id
      and therapies.status = 'published'::public.therapy_status
      and therapies.is_public_visible is true
      and therapies.archived_at is null
  )
);

drop policy if exists "Public can read published therapy highlights"
  on public.therapy_highlights;
create policy "Public can read published therapy highlights"
on public.therapy_highlights
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapies
    where therapies.id = therapy_highlights.therapy_id
      and therapies.status = 'published'::public.therapy_status
      and therapies.is_public_visible is true
      and therapies.archived_at is null
  )
);

drop policy if exists "Public can read published therapy benefits"
  on public.therapy_benefits;
create policy "Public can read published therapy benefits"
on public.therapy_benefits
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapies
    where therapies.id = therapy_benefits.therapy_id
      and therapies.status = 'published'::public.therapy_status
      and therapies.is_public_visible is true
      and therapies.archived_at is null
  )
);

drop policy if exists "Public can read published therapy faqs"
  on public.therapy_faqs;
create policy "Public can read published therapy faqs"
on public.therapy_faqs
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapies
    where therapies.id = therapy_faqs.therapy_id
      and therapies.status = 'published'::public.therapy_status
      and therapies.is_public_visible is true
      and therapies.archived_at is null
  )
);

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
  public_therapies_v.updated_at
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
  'Public therapy detail DTO. Runs as security_invoker and depends on explicit public editorial grants/RLS.';
