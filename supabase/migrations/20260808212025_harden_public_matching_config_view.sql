-- H1 hardening: public_matching_config only depends on published/active
-- matching catalog tables that already have anon/authenticated SELECT grants
-- and RLS predicates. It can therefore use caller privileges instead of owner
-- privileges without broadening base-table access.

alter view public.public_matching_config
set (security_invoker = true);

comment on view public.public_matching_config is
  'Public Match configuration DTO. SECURITY INVOKER: relies on public RLS for published matching versions and active themes/interests.';
