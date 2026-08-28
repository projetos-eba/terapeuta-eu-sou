begin;

select plan(2);

update public.therapist_profiles
set photo_url = 'http://legacy.example.test/ana-photo.png'
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  public.save_therapist_profile_draft_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000951',
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
    jsonb_build_object(
      'publicName', 'Ana Oliveira',
      'photoUrl', 'http://legacy.example.test/ana-photo.png'
    )
  ) -> 'editor' -> 'draft' -> 'fields' ->> 'photoUrl',
  'http://legacy.example.test/ana-photo.png',
  'a pre-existing HTTP profile photo can be retained in a draft'
);

select throws_ok(
  $$
    select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000952',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
      jsonb_build_object(
        'publicName', 'Ana Oliveira',
        'photoUrl', 'http://new-host.example.test/not-allowed.png'
      )
    )
  $$,
  'P0001',
  'VALIDATION_ERROR: photoUrl',
  'a new HTTP profile photo remains rejected'
);

select * from finish();

rollback;
