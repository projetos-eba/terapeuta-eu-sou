-- H1 hardening: therapy slug redirects are intentionally public and their base
-- table already has explicit SELECT grants plus anon/authenticated RLS.
-- Running this projection as SECURITY INVOKER removes a definer-view finding
-- without exposing any additional admin/private columns.

alter view public.public_therapy_slug_redirects_v
  set (security_invoker = true);

grant select on public.public_therapy_slug_redirects_v
to anon, authenticated, service_role;

comment on view public.public_therapy_slug_redirects_v is
  'Public safe projection for canonical therapy slug redirects. SECURITY INVOKER by design; base table exposes only redirect rows through explicit public RLS.';
