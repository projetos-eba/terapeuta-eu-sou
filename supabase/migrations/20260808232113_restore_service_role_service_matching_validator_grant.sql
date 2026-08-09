-- The service matching validator is an internal helper, but it is also called
-- by replace/update therapist service RPCs executed through the
-- therapist-services-command Edge Function with the service role. Keep it
-- closed to browser roles while allowing the server boundary to complete the
-- transactional service update.
revoke execute on function public.ensure_service_matching_rules_v1(uuid)
  from public;
revoke execute on function public.ensure_service_matching_rules_v1(uuid)
  from anon;
revoke execute on function public.ensure_service_matching_rules_v1(uuid)
  from authenticated;

grant execute on function public.ensure_service_matching_rules_v1(uuid)
  to service_role;

comment on function public.ensure_service_matching_rules_v1(uuid) is
  'SERVICE_ROLE_ONLY validation helper used by therapist service matching mutations; never grant to anon/authenticated.';
