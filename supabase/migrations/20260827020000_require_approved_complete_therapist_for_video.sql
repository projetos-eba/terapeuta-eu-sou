create or replace function public.is_therapist_video_session_eligible_v1(
  p_therapist_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    profile.status = 'approved'::public.therapist_status
    and coalesce(
      (
        public.therapist_profile_completeness_json_m1(profile.id)
          ->> 'percent'
      )::integer = 100,
      false
    )
    and coalesce(latest_verification.status = 'approved'::public.therapist_status, false),
    false
  )
  from public.therapist_profiles as profile
  left join lateral (
    select verification.status
    from public.therapist_verifications as verification
    where verification.therapist_profile_id = profile.id
    order by
      verification.submitted_at desc nulls last,
      verification.created_at desc,
      verification.id desc
    limit 1
  ) as latest_verification on true
  where profile.id = p_therapist_profile_id
$$;

revoke all on function public.is_therapist_video_session_eligible_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_therapist_video_session_eligible_v1(uuid)
  to service_role;

comment on function public.is_therapist_video_session_eligible_v1(uuid) is
  'Fail-closed Zoom gate: requires a 100 percent complete therapist profile and the latest administrative verification to be approved.';
