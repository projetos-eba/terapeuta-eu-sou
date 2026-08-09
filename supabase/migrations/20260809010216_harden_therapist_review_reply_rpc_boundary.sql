-- Move therapist review reply mutation behind a trusted service-role boundary.
-- The legacy RPC resolves auth.uid() and remains used internally by this
-- wrapper, but browser roles must call the Edge Function
-- therapist-reviews-command, which validates the JWT before passing the actor.

create or replace function public.upsert_therapist_review_reply_for_actor_v1(
  p_actor_user_id uuid,
  p_review_id uuid,
  p_body text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_user_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'sub',
      p_actor_user_id::text
    )::text,
    true
  );

  return public.upsert_therapist_review_reply_v1(
    p_review_id,
    p_body,
    p_request_id
  );
end;
$$;

revoke execute on function public.upsert_therapist_review_reply_v1(
  uuid,
  text,
  uuid
) from public;
revoke execute on function public.upsert_therapist_review_reply_v1(
  uuid,
  text,
  uuid
) from anon, authenticated, service_role;

revoke execute on function public.upsert_therapist_review_reply_for_actor_v1(
  uuid,
  uuid,
  text,
  uuid
) from public;
revoke execute on function public.upsert_therapist_review_reply_for_actor_v1(
  uuid,
  uuid,
  text,
  uuid
) from anon, authenticated;
grant execute on function public.upsert_therapist_review_reply_for_actor_v1(
  uuid,
  uuid,
  text,
  uuid
) to service_role;

comment on function public.upsert_therapist_review_reply_v1(uuid, text, uuid) is
  'Internal therapist review reply mutation. Direct browser execution is revoked; use upsert_therapist_review_reply_for_actor_v1 through therapist-reviews-command.';

comment on function public.upsert_therapist_review_reply_for_actor_v1(
  uuid,
  uuid,
  text,
  uuid
) is
  'SERVICE_ROLE_ONLY wrapper for therapist review replies. The actor user id must come from the JWT validated by therapist-reviews-command.';
