-- Allow the server-side matching Edge Function to read internal matching
-- configuration without exposing those tables to the Next.js frontend.

grant select on public.matching_therapy_settings to service_role;
grant select on public.matching_weights to service_role;
