begin;

select plan(6);

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
        jsonb_build_object('introduction', repeat('i', 1000))
      )
    )
  $$,
  'a 1000-character public introduction is accepted'
);

select throws_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object(
        'publicContent',
        jsonb_build_object('introduction', repeat('i', 1001))
      )
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_INTRODUCTION_TOO_LONG',
  'a public introduction above 1000 characters is rejected'
);

select lives_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object(
        'publicContent',
        jsonb_build_object('complementaryDescription', repeat('c', 1000))
      )
    )
  $$,
  'a 1000-character complementary description is accepted'
);

select throws_ok(
  $$
    select public.admin_assert_therapy_content_lengths_v1(
      jsonb_build_object(
        'publicContent',
        jsonb_build_object('complementaryDescription', repeat('c', 1001))
      )
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_COMPLEMENTARY_DESCRIPTION_TOO_LONG',
  'a complementary description above 1000 characters is rejected'
);

select * from finish();

rollback;
