-- Keep public Match recommendations aligned with the therapy catalog phase.
-- Current public/detail scope: Reiki, Taro and Constelacao Familiar.

update public.therapies
set slug = 'taro',
    updated_at = now()
where id = '22222222-2222-4222-8222-222222222228'
  and slug = 'tarologia-terapeutica';

update public.therapies
set
  status = 'draft',
  is_public_visible = false,
  is_featured = false,
  updated_at = now()
where slug not in ('reiki', 'taro', 'constelacao-familiar');

update public.matching_therapy_settings
set
  is_visible_in_matching = false,
  updated_at = now()
where therapy_id in (
  select id
  from public.therapies
  where slug not in ('reiki', 'taro', 'constelacao-familiar')
);

update public.matching_therapy_settings
set
  is_visible_in_matching = true,
  updated_at = now()
where therapy_id in (
  select id
  from public.therapies
  where slug in ('reiki', 'taro', 'constelacao-familiar')
    and status = 'published'
    and is_public_visible = true
);

update public.matching_weights
set
  is_active = false,
  updated_at = now()
where therapy_id in (
  select id
  from public.therapies
  where slug not in ('reiki', 'taro', 'constelacao-familiar')
);

create or replace view public.public_matching_therapies_v as
select
  public_therapy_details_v.id,
  public_therapy_details_v.name,
  public_therapy_details_v.slug,
  public_therapy_details_v.short_description,
  public_therapy_details_v.description,
  therapies.status,
  public_therapy_details_v.therapist_count,
  matching_therapy_settings.is_visible_in_matching
from public.public_therapy_details_v
join public.therapies
  on therapies.id = public_therapy_details_v.id
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = public_therapy_details_v.id
where therapies.status = 'published'
  and therapies.is_public_visible = true
  and matching_therapy_settings.is_visible_in_matching = true;

grant select on public.public_matching_therapies_v to anon, authenticated, service_role;

comment on view public.public_matching_therapies_v is
  'Safe public projection for Match candidates. Exposes only therapies with published public detail content and explicit matching activation.';
