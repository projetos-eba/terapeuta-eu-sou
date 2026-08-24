begin;

select plan(7);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_therapist_profile_media_draft_v1(uuid,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute the media draft RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_therapist_profile_media_draft_v1(uuid,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the media draft RPC directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.save_therapist_profile_media_draft_v1(uuid,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'service_role can execute the media draft RPC'
);

select lives_ok(
  format(
    $$select public.save_therapist_profile_media_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000006',
      '78000000-0000-4000-8000-000000000006',
      %s,
      'photo',
      'https://example.test/storage/v1/object/public/therapist-public-media/aaaaaaaa-0000-4000-8000-000000000006/profile/photo-11111111-1111-4111-8111-111111111111.jpg'
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000006')
  ),
  'a valid photo media URL creates or updates a draft without full profile validation'
);
select is(
  (
    select profile_payload ->> 'photoUrl'
    from public.therapist_profile_content_versions
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000006'
      and status = 'draft'
  ),
  'https://example.test/storage/v1/object/public/therapist-public-media/aaaaaaaa-0000-4000-8000-000000000006/profile/photo-11111111-1111-4111-8111-111111111111.jpg',
  'the media URL is stored in the private draft payload'
);
select is(
  (
    public.save_therapist_profile_media_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000006',
      '78000000-0000-4000-8000-000000000006',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000006'),
      'photo',
      'https://example.test/storage/v1/object/public/therapist-public-media/aaaaaaaa-0000-4000-8000-000000000006/profile/photo-11111111-1111-4111-8111-111111111111.jpg'
    )->>'idempotentReplay'
  ),
  'true',
  'repeating the same media request is idempotent'
);
select is(
  (
    select count(*)::integer
    from public.therapist_profile_events
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000006'
      and event_type = 'profile_media_draft_saved'
  ),
  1,
  'media draft persistence records one auditable event'
);

select * from finish();
rollback;
