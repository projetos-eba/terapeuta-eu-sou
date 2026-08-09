-- H1 hardening: the public Match theme projection must only expose therapy
-- theme relations for therapies that are valid public Match candidates.
-- Before this migration, the view filtered only active themes, which could
-- expose catalog theme metadata for draft or Match-hidden therapies.

create or replace view public.public_matching_therapy_themes_v as
select
  therapy_matching_themes.therapy_id,
  therapy_matching_themes.theme_id,
  matching_themes.name as theme_name,
  matching_themes.slug as theme_slug,
  therapy_matching_themes.sort_order
from public.therapy_matching_themes
join public.matching_themes
  on matching_themes.id = therapy_matching_themes.theme_id
join public.therapies
  on therapies.id = therapy_matching_themes.therapy_id
join public.matching_therapy_settings
  on matching_therapy_settings.therapy_id = therapy_matching_themes.therapy_id
where matching_themes.is_active = true
  and therapies.status = 'published'
  and therapies.is_public_visible = true
  and therapies.archived_at is null
  and matching_therapy_settings.is_visible_in_matching = true
  and exists (
    select 1
    from public.matching_weights
    join public.matching_versions
      on matching_versions.id = matching_weights.version_id
    where matching_weights.therapy_id = therapies.id
      and matching_weights.theme_id = therapy_matching_themes.theme_id
      and matching_weights.is_active = true
      and matching_versions.status = 'published'
  );

grant select on public.public_matching_therapy_themes_v
to anon, authenticated, service_role;

comment on view public.public_matching_therapy_themes_v is
  'Safe public Match therapy-theme projection. Exposes only active themes attached to published, public, Match-visible therapies with active weights in the published Match version.';
