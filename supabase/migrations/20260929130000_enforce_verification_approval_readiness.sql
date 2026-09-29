-- Approval is an administrative decision, but its prerequisites must be
-- enforced where the verification state changes. This keeps direct calls and
-- the Admin command on the same canonical readiness rule.

create or replace function public.require_complete_profile_before_approval_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completeness jsonb;
begin
  if old.status is not distinct from new.status
    or new.status <> 'approved'::public.therapist_status
  then
    return new;
  end if;

  v_completeness := public.therapist_profile_completeness_json_m1(
    new.therapist_profile_id
  );

  if coalesce((v_completeness ->> 'percent')::integer, 0) <> 100 then
    raise exception 'THERAPIST_PROFILE_INCOMPLETE' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.availability_rules as rule
    where rule.therapist_profile_id = new.therapist_profile_id
      and rule.is_active
  ) then
    raise exception 'THERAPIST_ACTIVE_AVAILABILITY_REQUIRED'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.require_complete_profile_before_approval_v1() is
  'Rejects verification approval unless canonical profile completeness is 100% and at least one recurring availability rule is active. The rejection occurs before state or audit writes.';
