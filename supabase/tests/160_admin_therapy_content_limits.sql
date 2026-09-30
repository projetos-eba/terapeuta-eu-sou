begin;

select plan(4);

select lives_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object('shortDescription', repeat('r', 150))
    )
  $$,
  'a 150-character short summary is accepted'
);

select throws_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object('shortDescription', repeat('r', 151))
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_SHORT_DESCRIPTION_TOO_LONG',
  'a short summary above 150 characters is rejected'
);

select lives_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object(
        'publicContent',
        jsonb_build_object('introduction', repeat('i', 240))
      )
    )
  $$,
  'a 240-character public introduction is accepted'
);

select throws_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object(
        'publicContent',
        jsonb_build_object('introduction', repeat('i', 241))
      )
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_INTRODUCTION_TOO_LONG',
  'a public introduction above 240 characters is rejected'
);

select * from finish();

rollback;
