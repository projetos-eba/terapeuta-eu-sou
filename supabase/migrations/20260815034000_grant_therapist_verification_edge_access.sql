-- The verification lifecycle is private. Browser roles retain no table access;
-- authenticated Edge Functions use service_role after deriving the actor.
grant select, insert, update on table public.therapist_verifications to service_role;

comment on table public.therapist_verifications is
  'Private verification lifecycle. Direct browser access is forbidden; approved Edge Functions use service_role after authorization.';
