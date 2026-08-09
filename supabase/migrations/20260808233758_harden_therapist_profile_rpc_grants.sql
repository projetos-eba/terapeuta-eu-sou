-- Therapist profile M1 mutations are executed through the authenticated
-- Edge Function boundary (`therapist-profile-command`). The browser must not
-- invoke these SECURITY DEFINER helpers or commands directly through the Data
-- API, because the actor is represented as a function argument after JWT
-- validation by the server boundary.

revoke execute on function public.get_therapist_profile_actor_m1(uuid)
  from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_validate_payload_m1(
  jsonb,
  public.therapist_plan
) from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_content_json_m1(uuid)
  from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_capabilities_json_m1(
  public.therapist_plan
) from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_derived_json_m1(uuid)
  from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_completeness_json_m1(uuid)
  from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_published_fields_m1(
  public.therapist_profiles
) from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_request_replay_m1(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_store_request_m1(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated, service_role;

revoke execute on function public.therapist_profile_replace_children_m1(
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;

revoke execute on function public.get_private_therapist_profile_editor_v1(uuid)
  from public, anon, authenticated, service_role;

revoke execute on function public.save_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint,
  jsonb
) from public, anon, authenticated, service_role;

revoke execute on function public.discard_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint
) from public, anon, authenticated, service_role;

revoke execute on function public.publish_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint
) from public, anon, authenticated, service_role;

revoke execute on function public.unpublish_therapist_profile_v1(
  uuid,
  uuid,
  bigint
) from public, anon, authenticated, service_role;

grant execute on function public.get_private_therapist_profile_editor_v1(uuid)
  to service_role;
grant execute on function public.save_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint,
  jsonb
) to service_role;
grant execute on function public.discard_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint
) to service_role;
grant execute on function public.publish_therapist_profile_draft_v1(
  uuid,
  uuid,
  bigint
) to service_role;
grant execute on function public.unpublish_therapist_profile_v1(
  uuid,
  uuid,
  bigint
) to service_role;

comment on function public.get_private_therapist_profile_editor_v1(uuid) is
  'SERVICE_ROLE_ONLY private profile editor read model. The Edge Function derives the therapist actor from JWT before calling it.';
comment on function public.save_therapist_profile_draft_v1(uuid, uuid, bigint, jsonb) is
  'SERVICE_ROLE_ONLY therapist profile draft command. Browser calls must go through therapist-profile-command.';
comment on function public.discard_therapist_profile_draft_v1(uuid, uuid, bigint) is
  'SERVICE_ROLE_ONLY therapist profile draft discard command. Browser calls must go through therapist-profile-command.';
comment on function public.publish_therapist_profile_draft_v1(uuid, uuid, bigint) is
  'SERVICE_ROLE_ONLY therapist profile publish command. Browser calls must go through therapist-profile-command.';
comment on function public.unpublish_therapist_profile_v1(uuid, uuid, bigint) is
  'SERVICE_ROLE_ONLY therapist profile unpublish command. Browser calls must go through therapist-profile-command.';
