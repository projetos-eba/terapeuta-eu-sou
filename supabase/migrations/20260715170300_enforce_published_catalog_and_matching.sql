update public.therapies
set
  status = 'published',
  published_at = coalesce(published_at, now()),
  is_public_visible = true,
  updated_at = now()
where status = 'active'
  and is_public_visible = true
  and exists (
    select 1
    from public.therapy_categories
    where therapy_categories.id = therapies.category_id
      and therapy_categories.is_active = true
  );

drop policy if exists "Public therapies are readable" on public.therapies;
create policy "Public therapies are readable"
on public.therapies
for select
using (status = 'published' and is_public_visible = true);

create or replace view public.public_therapies_v as
with therapist_counts as (
  select
    therapist_services.therapy_id,
    count(distinct therapist_profiles.id)::integer as therapist_count
  from public.therapist_services
  join public.therapist_profiles
    on therapist_profiles.id = therapist_services.therapist_profile_id
  join public.therapies
    on therapies.id = therapist_services.therapy_id
  where therapist_profiles.status = 'approved'
    and therapist_profiles.is_public = true
    and therapist_profiles.is_accepting_bookings = true
    and therapist_services.status = 'active'
    and therapist_services.online_only = true
    and therapies.status = 'published'
    and therapies.is_public_visible = true
  group by therapist_services.therapy_id
)
select
  therapies.id,
  therapies.slug,
  therapies.name,
  therapies.short_description,
  therapies.description,
  therapies.image_url,
  therapies.status,
  therapies.published_at,
  therapies.popularity_score,
  therapies.created_at,
  therapies.updated_at,
  therapy_categories.id as category_id,
  therapy_categories.slug as category_slug,
  therapy_categories.name as category_name,
  therapy_categories.sort_order as category_sort_order,
  coalesce(therapist_counts.therapist_count, 0)::integer as therapist_count,
  (therapies.popularity_score >= 80 or therapies.is_featured = true) as is_popular,
  (
    therapies.published_at is not null
    and therapies.published_at >= now() - interval '45 days'
  ) as is_new,
  lower(
    public.unaccent(
      concat_ws(
        ' ',
        therapies.name,
        therapies.short_description,
        therapies.description,
        therapy_categories.name,
        array_to_string(therapies.search_aliases, ' ')
      )
    )
  ) as search_text,
  therapies.is_featured
from public.therapies
join public.therapy_categories
  on therapy_categories.id = therapies.category_id
left join therapist_counts
  on therapist_counts.therapy_id = therapies.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and therapy_categories.is_active = true;

create or replace view public.public_home_therapies as
select
  public_therapies_v.id,
  public_therapies_v.name,
  public_therapies_v.slug,
  public_therapies_v.slug as href_slug,
  public_therapies_v.short_description,
  public_therapies_v.is_featured,
  public_therapies_v.category_name,
  public_therapies_v.category_slug,
  public_therapies_v.updated_at
from public.public_therapies_v;

create or replace view public.public_matching_therapist_counts as
select
  public_therapies_v.id as therapy_id,
  public_therapies_v.therapist_count
from public.public_therapies_v
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = public_therapies_v.id
  and matching_therapy_settings.is_visible_in_matching = true;

grant select on public.public_therapies_v to anon, authenticated, service_role;
grant select on public.public_home_therapies to anon, authenticated, service_role;
grant select on public.public_matching_therapist_counts to anon, authenticated, service_role;

comment on view public.public_therapies_v is
  'Safe public projection for catalog surfaces. Exposes only published, public therapies linked to active categories.';
comment on table public.matching_therapy_settings is
  'Per-therapy activation for the Match engine. A therapy must also be published to appear in public matching results.';
