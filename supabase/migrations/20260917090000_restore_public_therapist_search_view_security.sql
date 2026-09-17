begin;

-- The catalog's public entry point is a deliberately narrow definer
-- projection. Its internal implementation aggregates protected review and
-- profile projections, so it cannot run with the anonymous caller's
-- privileges. Keep the implementation private and expose only the safe view.
alter view public.public_therapist_search_internal
  set (security_invoker = false);

alter view public.public_therapist_search
  set (security_invoker = false);

revoke all on public.public_therapist_search_internal
  from public, anon, authenticated, service_role;

revoke all on public.public_therapist_search
  from public, anon, authenticated, service_role;

grant select on public.public_therapist_search
  to anon, authenticated, service_role;

comment on view public.public_therapist_search is
  'Safe public therapist search projection. It exposes only eligible published profiles and is the only anonymous catalog entry point.';

commit;
