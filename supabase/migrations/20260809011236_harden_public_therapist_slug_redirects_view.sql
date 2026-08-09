-- H1 hardening: therapist slug redirects are part of the public profile
-- lookup surface, but the base table also stores an internal profile FK.
-- Keep the public DTO narrow and make the view honor base-table RLS.

revoke all on public.therapist_profile_slug_history
from public, anon, authenticated;

grant select (old_slug, current_slug)
on public.therapist_profile_slug_history
to anon, authenticated, service_role;

grant select (id, status, is_public)
on public.therapist_profiles
to anon, authenticated, service_role;

drop policy if exists "Public can read approved public therapist profile gates"
on public.therapist_profiles;

create policy "Public can read approved public therapist profile gates"
on public.therapist_profiles
for select
to anon, authenticated
using (
  status = 'approved'
  and is_public = true
);

drop policy if exists "Public can read approved therapist slug redirects"
on public.therapist_profile_slug_history;

create policy "Public can read approved therapist slug redirects"
on public.therapist_profile_slug_history
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = therapist_profile_slug_history.therapist_profile_id
      and therapist_profiles.status = 'approved'
      and therapist_profiles.is_public = true
  )
);

alter view public.public_therapist_slug_redirects_v
  set (security_invoker = true);

grant select on public.public_therapist_slug_redirects_v
to anon, authenticated, service_role;

comment on view public.public_therapist_slug_redirects_v is
  'Public safe projection for therapist profile slug redirects. SECURITY INVOKER by design; base-table RLS limits redirects to approved public therapist profiles and only old/current slug columns are granted publicly.';
