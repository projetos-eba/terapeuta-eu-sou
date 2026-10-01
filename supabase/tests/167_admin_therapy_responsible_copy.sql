begin;

select plan(6);

select lives_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Esta prática complementar não substitui diagnóstico, tratamento ou acompanhamento profissional de saúde.'
    )
  $$,
  'a responsible note may clarify that the practice does not replace diagnosis or professional care'
);

select lives_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Prática complementar, sem garantia de resultado.'
    )
  $$,
  'a responsible note may state that results are not guaranteed'
);

select lives_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Esta prática não oferece diagnóstico.'
    )
  $$,
  'a responsible boundary may deny an inappropriate claim'
);

select throws_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Esta prática oferece diagnóstico para todas as pessoas.'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_UNSAFE_COPY',
  'an affirmative diagnosis claim remains blocked'
);

select throws_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Uma experiência de resultado garantido.'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_UNSAFE_COPY',
  'a guaranteed outcome remains blocked'
);

select throws_ok(
  $$
    select public.admin_assert_responsible_therapy_text_v1(
      'Esta prática não oferece diagnóstico e garante cura.'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_UNSAFE_COPY',
  'a responsible boundary cannot hide a later affirmative claim'
);

select * from finish();

rollback;
