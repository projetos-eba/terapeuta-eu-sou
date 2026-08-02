-- Allow Edge Functions using the service role to preflight published legal
-- document versions before creating session Checkout.

grant select on public.legal_document_versions to service_role;
