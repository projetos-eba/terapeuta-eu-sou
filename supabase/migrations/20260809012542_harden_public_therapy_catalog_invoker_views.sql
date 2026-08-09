-- H1 hardening: public therapy catalog projections can run as SECURITY
-- INVOKER once the service/profile gates used for therapist counts are
-- available through narrow column grants and RLS. Direct public access to
-- service titles, prices, descriptions and durations remains closed.

grant select (id, status, is_public, is_accepting_bookings)
on public.therapist_profiles
to anon, authenticated, service_role;

grant select (
  therapist_profile_id,
  therapy_id,
  status,
  is_bookable,
  online_only
)
on public.therapist_services
to anon;

drop policy if exists "Public can read public therapist service catalog gates"
on public.therapist_services;

create policy "Public can read public therapist service catalog gates"
on public.therapist_services
for select
to anon, authenticated
using (
  status = 'active'
  and is_bookable = true
  and online_only = true
  and exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = therapist_services.therapist_profile_id
      and therapist_profiles.status = 'approved'
      and therapist_profiles.is_public = true
      and therapist_profiles.is_accepting_bookings = true
  )
  and exists (
    select 1
    from public.therapies
    where therapies.id = therapist_services.therapy_id
      and therapies.status = 'published'
      and therapies.is_public_visible = true
  )
);

alter view public.public_therapies_v
  set (security_invoker = true);

alter view public.public_home_therapies
  set (security_invoker = true);

alter view public.public_matching_therapist_counts
  set (security_invoker = true);

grant select on public.public_therapies_v
to anon, authenticated, service_role;

grant select on public.public_home_therapies
to anon, authenticated, service_role;

grant select on public.public_matching_therapist_counts
to anon, authenticated, service_role;

comment on view public.public_therapies_v is
  'Safe public therapy catalog projection. SECURITY INVOKER by design; public therapist counts are derived only from service/profile gates exposed by explicit RLS.';

comment on view public.public_home_therapies is
  'Safe public home therapy projection derived from public_therapies_v. SECURITY INVOKER by design.';

comment on view public.public_matching_therapist_counts is
  'Safe public Match therapist-count projection derived from public_therapies_v and public matching visibility gates. SECURITY INVOKER by design.';
