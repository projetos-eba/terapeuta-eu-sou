-- The server-side document center derives readiness from the therapist's
-- private identity record. Keep that read in the Edge Function and grant only
-- the minimum table privilege required by its service-role client.
--
-- Browser clients continue to use the authenticated RPCs and RLS policies;
-- this grant does not expose identity data in any public projection or DTO.
grant select on public.therapist_private_identity to service_role;
