-- A profile publication made while an administrative review is already active
-- must keep that review in place. Re-queuing it as submitted would regress the
-- verification state and violate the protected transition sequence.
create or replace function public.queue_therapist_profile_review_v1(
  p_therapist_profile_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_verification public.therapist_verifications%rowtype;
  v_review_status public.therapist_status;
begin
  select * into v_profile
  from public.therapist_profiles
  where id = p_therapist_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_profile.status = 'suspended'::public.therapist_status then
    return;
  end if;

  select * into v_verification
  from public.therapist_verifications
  where therapist_profile_id = v_profile.id
  order by submitted_at desc nulls last, created_at desc, id desc
  limit 1
  for update;

  if v_verification.id is null
    or v_verification.status = 'approved'::public.therapist_status
  then
    v_review_status := 'submitted'::public.therapist_status;

    insert into public.therapist_verifications (
      therapist_profile_id,
      status,
      submitted_at
    ) values (
      v_profile.id,
      v_review_status,
      now()
    );
  elsif v_verification.status in (
    'draft'::public.therapist_status,
    'changes_requested'::public.therapist_status,
    'rejected'::public.therapist_status
  ) then
    v_review_status := 'submitted'::public.therapist_status;

    update public.therapist_verifications
    set status = v_review_status,
        changes_requested = null,
        rejection_reason = null,
        reviewed_by = null,
        reviewed_at = null,
        submitted_at = now(),
        updated_at = now()
    where id = v_verification.id;
  elsif v_verification.status in (
    'submitted'::public.therapist_status,
    'in_review'::public.therapist_status
  ) then
    v_review_status := v_verification.status;
  else
    raise exception 'invalid therapist verification status transition'
      using errcode = '22023';
  end if;

  -- A profile under review is never public or bookable. Keep the active
  -- verification state so a publication cannot regress in_review to submitted.
  update public.therapist_profiles
  set status = v_review_status,
      public_status = 'unpublished',
      is_public = false,
      is_accepting_bookings = false,
      updated_at = now()
  where id = v_profile.id;
end;
$$;

revoke all on function public.queue_therapist_profile_review_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.queue_therapist_profile_review_v1(uuid)
  to service_role;

comment on function public.queue_therapist_profile_review_v1(uuid) is
  'Queues eligible profile publications for review without regressing an active submitted or in-review verification.';
