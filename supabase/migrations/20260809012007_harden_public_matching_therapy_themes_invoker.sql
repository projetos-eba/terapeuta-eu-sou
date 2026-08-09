-- H1 hardening: the public Match therapy-theme projection can safely run as
-- SECURITY INVOKER when the underlying relation tables expose only the columns
-- needed to reproduce the same public DTO and RLS limits rows to published,
-- public, Match-visible therapies with active weights in a published version.

grant select (therapy_id, theme_id, sort_order)
on public.therapy_matching_themes
to anon, authenticated, service_role;

grant select (therapy_id, is_visible_in_matching)
on public.matching_therapy_settings
to anon, authenticated, service_role;

grant select (version_id, therapy_id, theme_id, is_active)
on public.matching_weights
to anon, authenticated, service_role;

grant select (id, status)
on public.matching_versions
to anon, authenticated, service_role;

drop policy if exists "Public can read visible matching therapy settings"
on public.matching_therapy_settings;

create policy "Public can read visible matching therapy settings"
on public.matching_therapy_settings
for select
to anon, authenticated
using (
  is_visible_in_matching = true
  and exists (
    select 1
    from public.therapies
    where therapies.id = matching_therapy_settings.therapy_id
      and therapies.status = 'published'
      and therapies.is_public_visible = true
      and therapies.archived_at is null
  )
);

drop policy if exists "Public can read active public matching weights"
on public.matching_weights;

create policy "Public can read active public matching weights"
on public.matching_weights
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.matching_versions
    where matching_versions.id = matching_weights.version_id
      and matching_versions.status = 'published'
  )
  and exists (
    select 1
    from public.matching_themes
    where matching_themes.id = matching_weights.theme_id
      and matching_themes.is_active = true
  )
  and exists (
    select 1
    from public.therapies
    join public.matching_therapy_settings
      on matching_therapy_settings.therapy_id = therapies.id
    where therapies.id = matching_weights.therapy_id
      and therapies.status = 'published'
      and therapies.is_public_visible = true
      and therapies.archived_at is null
      and matching_therapy_settings.is_visible_in_matching = true
  )
);

drop policy if exists "Public can read public therapy matching themes"
on public.therapy_matching_themes;

create policy "Public can read public therapy matching themes"
on public.therapy_matching_themes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matching_themes
    where matching_themes.id = therapy_matching_themes.theme_id
      and matching_themes.is_active = true
  )
  and exists (
    select 1
    from public.therapies
    join public.matching_therapy_settings
      on matching_therapy_settings.therapy_id = therapies.id
    where therapies.id = therapy_matching_themes.therapy_id
      and therapies.status = 'published'
      and therapies.is_public_visible = true
      and therapies.archived_at is null
      and matching_therapy_settings.is_visible_in_matching = true
  )
  and exists (
    select 1
    from public.matching_weights
    join public.matching_versions
      on matching_versions.id = matching_weights.version_id
    where matching_weights.therapy_id = therapy_matching_themes.therapy_id
      and matching_weights.theme_id = therapy_matching_themes.theme_id
      and matching_weights.is_active = true
      and matching_versions.status = 'published'
  )
);

alter view public.public_matching_therapy_themes_v
  set (security_invoker = true);

grant select on public.public_matching_therapy_themes_v
to anon, authenticated, service_role;

comment on view public.public_matching_therapy_themes_v is
  'Safe public Match therapy-theme projection. SECURITY INVOKER by design; base-table RLS exposes only active themes attached to published, public, Match-visible therapies with active weights in the published Match version.';
