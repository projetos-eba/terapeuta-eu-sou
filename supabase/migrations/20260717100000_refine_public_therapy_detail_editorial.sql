do $$
begin
  create type public.therapy_visual_theme_key as enum (
    'energy',
    'oracle',
    'systemic'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.therapy_public_content
  add column if not exists approach_label text,
  add column if not exists approach_icon_key text,
  add column if not exists visual_theme_key public.therapy_visual_theme_key not null default 'energy',
  add column if not exists hero_focal_point text not null default 'center';

alter table public.therapy_public_content
  drop constraint if exists therapy_public_content_hero_focal_point_check;

alter table public.therapy_public_content
  add constraint therapy_public_content_hero_focal_point_check
  check (hero_focal_point in ('left', 'center', 'right'));

create table if not exists public.therapy_faqs (
  id uuid primary key default gen_random_uuid(),
  therapy_id uuid not null references public.therapies (id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapy_faqs_unique_sort unique (therapy_id, sort_order)
);

create index if not exists therapy_faqs_therapy_sort_idx
  on public.therapy_faqs (therapy_id, sort_order);

drop trigger if exists set_therapy_faqs_updated_at on public.therapy_faqs;
create trigger set_therapy_faqs_updated_at
before update on public.therapy_faqs
for each row execute function public.set_updated_at();

drop view if exists public.public_therapy_details_v;

create view public.public_therapy_details_v as
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
  coalesce(therapy_public_content.approach_label, public_therapies_v.category_name) as approach_label,
  coalesce(therapy_public_content.approach_icon_key, 'sparkles') as approach_icon_key,
  coalesce(therapy_public_content.visual_theme_key::text, 'energy') as visual_theme_key,
  coalesce(therapy_public_content.hero_focal_point, 'center') as hero_focal_point,
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
    order by therapy_highlights.sort_order asc
  ) as items
  from public.therapy_highlights
  where therapy_highlights.therapy_id = public_therapies_v.id
) as highlights on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'title', therapy_benefits.title,
      'description', therapy_benefits.description,
      'iconKey', therapy_benefits.icon_key
    )
    order by therapy_benefits.sort_order asc
  ) as items
  from public.therapy_benefits
  where therapy_benefits.therapy_id = public_therapies_v.id
) as benefits on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'question', therapy_faqs.question,
      'answer', therapy_faqs.answer
    )
    order by therapy_faqs.sort_order asc
  ) as items
  from public.therapy_faqs
  where therapy_faqs.therapy_id = public_therapies_v.id
) as faqs on true;

grant select on public.public_therapy_details_v to anon, authenticated, service_role;

comment on type public.therapy_visual_theme_key is
  'Safe visual theme keys for public therapy detail pages. CSS classes are mapped in the frontend, never stored in the database.';
comment on table public.therapy_faqs is
  'Public FAQ entries for therapy detail pages, written without cure, diagnosis or guaranteed outcome promises.';
comment on view public.public_therapy_details_v is
  'Safe public projection for /terapias/:slug. Returns only published public therapies with active categories plus editorial content, highlights, benefits and FAQs.';
