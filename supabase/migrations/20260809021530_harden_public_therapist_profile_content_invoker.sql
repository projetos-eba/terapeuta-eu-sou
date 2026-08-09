-- H1 hardening: public therapist editorial content must run as invoker and
-- rely on explicit public column grants/RLS instead of SECURITY DEFINER bypass.

revoke truncate, references, trigger
  on public.therapist_profiles
  from anon, authenticated;
revoke truncate, references, trigger
  on public.therapist_profile_content_versions
  from anon, authenticated;
revoke truncate, references, trigger
  on public.therapist_profile_guide_items
  from anon, authenticated;
revoke truncate, references, trigger
  on public.therapist_profile_reflections
  from anon, authenticated;

grant select (
  id,
  slug,
  status,
  is_public
) on public.therapist_profiles to anon;

grant select (
  id,
  therapist_profile_id,
  status,
  short_intro,
  essence_body,
  invitation_body,
  experience_years
) on public.therapist_profile_content_versions to anon, authenticated;

grant select (
  content_version_id,
  icon,
  label,
  sort_order,
  is_active
) on public.therapist_profile_guide_items to anon, authenticated;

grant select (
  content_version_id,
  href,
  image_url,
  minutes_to_read,
  title,
  sort_order,
  is_public
) on public.therapist_profile_reflections to anon, authenticated;

drop policy if exists "Public can read published therapist profile content"
  on public.therapist_profile_content_versions;
create policy "Public can read published therapist profile content"
on public.therapist_profile_content_versions
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id =
      therapist_profile_content_versions.therapist_profile_id
      and therapist_profiles.status = 'approved'::public.therapist_status
      and therapist_profiles.is_public is true
  )
);

drop policy if exists "Public can read active therapist profile guide items"
  on public.therapist_profile_guide_items;
create policy "Public can read active therapist profile guide items"
on public.therapist_profile_guide_items
for select
to anon, authenticated
using (
  is_active is true
  and exists (
    select 1
    from public.therapist_profile_content_versions
    join public.therapist_profiles
      on therapist_profiles.id =
        therapist_profile_content_versions.therapist_profile_id
    where therapist_profile_content_versions.id =
      therapist_profile_guide_items.content_version_id
      and therapist_profile_content_versions.status = 'published'
      and therapist_profiles.status = 'approved'::public.therapist_status
      and therapist_profiles.is_public is true
  )
);

drop policy if exists "Public can read public therapist profile reflections"
  on public.therapist_profile_reflections;
create policy "Public can read public therapist profile reflections"
on public.therapist_profile_reflections
for select
to anon, authenticated
using (
  is_public is true
  and exists (
    select 1
    from public.therapist_profile_content_versions
    join public.therapist_profiles
      on therapist_profiles.id =
        therapist_profile_content_versions.therapist_profile_id
    where therapist_profile_content_versions.id =
      therapist_profile_reflections.content_version_id
      and therapist_profile_content_versions.status = 'published'
      and therapist_profiles.status = 'approved'::public.therapist_status
      and therapist_profiles.is_public is true
  )
);

create or replace view public.public_therapist_profile_content_v
with (security_invoker = true) as
select
  therapist_profiles.slug,
  therapist_profile_content_versions.therapist_profile_id,
  therapist_profile_content_versions.short_intro,
  therapist_profile_content_versions.essence_body,
  therapist_profile_content_versions.invitation_body,
  therapist_profile_content_versions.experience_years,
  coalesce(guide_items.items, '[]'::jsonb) as guide_items,
  coalesce(reflections.items, '[]'::jsonb) as reflections
from public.therapist_profiles
join public.therapist_profile_content_versions
  on therapist_profile_content_versions.therapist_profile_id =
    therapist_profiles.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'icon', therapist_profile_guide_items.icon,
      'label', therapist_profile_guide_items.label
    )
    order by therapist_profile_guide_items.sort_order asc
  ) as items
  from public.therapist_profile_guide_items
  where therapist_profile_guide_items.content_version_id =
    therapist_profile_content_versions.id
    and therapist_profile_guide_items.is_active = true
) as guide_items on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'href', therapist_profile_reflections.href,
      'imageUrl', therapist_profile_reflections.image_url,
      'minutesToRead', therapist_profile_reflections.minutes_to_read,
      'title', therapist_profile_reflections.title
    )
    order by therapist_profile_reflections.sort_order asc
  ) as items
  from public.therapist_profile_reflections
  where therapist_profile_reflections.content_version_id =
    therapist_profile_content_versions.id
    and therapist_profile_reflections.is_public = true
) as reflections on true
where therapist_profiles.status = 'approved'::public.therapist_status
  and therapist_profiles.is_public is true
  and therapist_profile_content_versions.status = 'published';

revoke all on public.public_therapist_profile_content_v
  from public, anon, authenticated;
grant select on public.public_therapist_profile_content_v
  to anon, authenticated, service_role;

comment on view public.public_therapist_profile_content_v is
  'Public therapist profile editorial DTO. Runs as security_invoker and depends on explicit public grants/RLS over published profile content.';
