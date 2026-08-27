begin;

select plan(6);

select ok(
  has_function_privilege(
    'service_role',
    'public.is_therapist_video_session_eligible_v1(uuid)',
    'EXECUTE'
  ),
  'service role can evaluate therapist Zoom eligibility'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.is_therapist_video_session_eligible_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the Zoom eligibility gate directly'
);

delete from public.therapist_verifications
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  public.is_therapist_video_session_eligible_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  false,
  'approved profile without an administrative verification cannot host video'
);

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status,
  reviewed_at
)
values (
  'a9000000-0000-4000-8000-000000000093',
  'c1000000-0000-4000-8000-000000000001',
  'approved',
  now()
);

select is(
  public.is_therapist_video_session_eligible_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  true,
  'complete therapist with approved administrative verification can host video'
);

update public.therapist_profiles
set photo_url = null
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  public.is_therapist_video_session_eligible_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  false,
  'administrative approval does not bypass an incomplete profile'
);

update public.therapist_profiles
set photo_url = 'https://example.test/therapist-complete.jpg'
where id = 'c1000000-0000-4000-8000-000000000001';

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status,
  reviewed_at,
  submitted_at
)
values (
  'a9000000-0000-4000-8000-000000000094',
  'c1000000-0000-4000-8000-000000000001',
  'changes_requested',
  now(),
  now() + interval '1 second'
);

select is(
  public.is_therapist_video_session_eligible_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  false,
  'latest administrative decision must remain approved'
);

select * from finish();

rollback;
