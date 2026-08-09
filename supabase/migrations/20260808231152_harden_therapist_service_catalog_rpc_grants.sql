-- The therapist service catalog is consumed through the
-- therapist-services-command Edge Function. The function authenticates the
-- therapist from the JWT and calls this RPC with the service role.
--
-- A later catalog-image migration accidentally re-opened this SECURITY DEFINER
-- RPC to the authenticated Data API role. Keep direct browser access closed so
-- p_actor_user_id cannot be supplied by an arbitrary authenticated caller.
revoke execute on function public.list_therapist_service_catalog_v1(uuid)
  from public;
revoke execute on function public.list_therapist_service_catalog_v1(uuid)
  from anon;
revoke execute on function public.list_therapist_service_catalog_v1(uuid)
  from authenticated;

grant execute on function public.list_therapist_service_catalog_v1(uuid)
  to service_role;

comment on function public.list_therapist_service_catalog_v1(uuid) is
  'SERVICE_ROLE_ONLY boundary for therapist-services-command. Do not grant to authenticated; actor comes from JWT in Edge Function, not browser payload.';
