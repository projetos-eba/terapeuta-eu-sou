begin;

select plan(13);

select ok(
  to_regprocedure(
    'public.sync_therapist_verification_queue_on_publish_v1()'
  ) is not null,
  'profile publication verification sync function exists'
);

select has_trigger(
  'public',
  'therapist_profiles',
  'sync_therapist_verification_queue_on_publish',
  'profile publication installs the verification queue trigger'
);

select has_trigger(
  'public',
  'therapist_verifications',
  'enforce_therapist_verification_transition',
  'verification records enforce their review state machine'
);

select is(
  has_function_privilege(
    'anon',
    'public.sync_therapist_verification_queue_on_publish_v1()',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot invoke the trigger function'
);

delete from public.therapist_verifications
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set
  status = 'draft'::public.therapist_status,
  is_public = false,
  public_status = 'draft',
  updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set
  is_public = true,
  public_status = 'published',
  updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  1,
  'publishing creates one verification queue entry'
);

select is(
  (
    select status::text
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'submitted',
  'new verification waits for analysis'
);

select is(
  (
    select status::text
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'submitted',
  'published profile mirrors the verification queue state'
);

update public.therapist_profiles
set
  is_public = true,
  public_status = 'published',
  updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  1,
  'repeated publication does not duplicate the queue entry'
);

select throws_ok(
  $$
    update public.therapist_verifications
    set status = 'approved'::public.therapist_status
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  $$,
  '22023',
  'invalid therapist verification status transition',
  'a verification cannot be approved before analysis starts'
);

update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_verifications
set
  status = 'changes_requested'::public.therapist_status,
  changes_requested = 'Atualizar o documento enviado.',
  reviewed_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set
  status = 'changes_requested'::public.therapist_status,
  is_public = true,
  public_status = 'published',
  updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select status::text
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'submitted',
  'republishing after requested changes returns the record to the queue'
);

select is(
  (
    select changes_requested
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  null,
  'republishing clears the resolved adjustment reason'
);

update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_verifications
set status = 'approved'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set
  status = 'approved'::public.therapist_status,
  is_public = true,
  public_status = 'published',
  updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select status::text
    from public.therapist_verifications
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'approved',
  'republishing never downgrades an approved verification'
);

select is(
  (
    select status::text
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'approved',
  'republishing never downgrades an approved profile'
);

select * from finish();

rollback;
