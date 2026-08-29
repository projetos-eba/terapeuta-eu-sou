begin;

select plan(22);

select hasnt_table(
  'public',
  'therapy_categories',
  'the retired therapy category table is not recreated'
);

select hasnt_column(
  'public',
  'therapies',
  'category_id',
  'therapies no longer have a category foreign key'
);

select hasnt_column(
  'public',
  'therapy_catalog_requests',
  'suggested_category_id',
  'therapy requests no longer store a suggested category'
);

create temporary table recovery_theme_ids
on commit drop
as
select id, row_number() over (order by sort_order, name, id) as position
from public.matching_themes
where is_active
order by sort_order, name, id
limit 4;

select ok(
  (
    public.admin_upsert_therapy_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'name', 'Terapia Temas Recovery',
        'slug', 'terapia-temas-recovery',
        'themeIds', (select jsonb_agg(id order by position) from recovery_theme_ids where position <= 1),
        'shortDescription', 'Rascunho seguro para validar temas.',
        'description', 'Conteúdo editorial responsável para a recuperação do catálogo.',
        'isPubliclyVisible', false,
        'isAvailableForServices', false,
        'isVisibleInMatching', false,
        'reason', 'Criar fixture de recuperação com um tema.'
      )
    ) ->> 'therapyId'
  ) is not null,
  'admin creates a therapy with one active Match theme'
);

select is(
  (
    select count(*)::integer
    from public.therapy_matching_themes
    where therapy_id = (select id from public.therapies where slug = 'terapia-temas-recovery')
  ),
  1,
  'one selected theme is stored atomically'
);

select lives_ok(
  $$
    select public.admin_upsert_therapy_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'therapyId', (select id from public.therapies where slug = 'terapia-temas-recovery'),
        'name', 'Terapia Temas Recovery',
        'slug', 'terapia-temas-recovery',
        'themeIds', (select jsonb_agg(id order by position) from recovery_theme_ids where position <= 2),
        'shortDescription', 'Rascunho seguro para validar temas.',
        'description', 'Conteúdo editorial responsável para a recuperação do catálogo.',
        'reason', 'Atualizar fixture de recuperação com dois temas.'
      )
    )
  $$,
  'admin edits a therapy with two active Match themes'
);

select is(
  (
    select count(*)::integer
    from public.therapy_matching_themes
    where therapy_id = (select id from public.therapies where slug = 'terapia-temas-recovery')
  ),
  2,
  'two selected themes replace the prior set atomically'
);

select lives_ok(
  $$
    select public.admin_upsert_therapy_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000003',
      jsonb_build_object(
        'therapyId', (select id from public.therapies where slug = 'terapia-temas-recovery'),
        'name', 'Terapia Temas Recovery',
        'slug', 'terapia-temas-recovery',
        'themeIds', (select jsonb_agg(id order by position) from recovery_theme_ids where position <= 3),
        'shortDescription', 'Rascunho seguro para validar temas.',
        'description', 'Conteúdo editorial responsável para a recuperação do catálogo.',
        'reason', 'Atualizar fixture de recuperação com três temas.'
      )
    )
  $$,
  'admin edits a therapy with three active Match themes'
);

select is(
  (
    select count(*)::integer
    from public.therapy_matching_themes
    where therapy_id = (select id from public.therapies where slug = 'terapia-temas-recovery')
  ),
  3,
  'three selected themes are stored without duplication'
);

select throws_ok(
  $$
    select public.admin_upsert_therapy_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000004',
      '{"name":"Sem tema","slug":"sem-tema-recovery","themeIds":[],"shortDescription":"Resumo seguro.","reason":"Validar ausência de temas."}'::jsonb
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT',
  'admin rejects a therapy without a Match theme'
);

select throws_ok(
  format(
    $sql$
      select public.admin_upsert_therapy_draft_v1(
        'aaaaaaaa-0000-4000-8000-000000000090',
        '10400000-0000-4000-8000-000000000005',
        jsonb_build_object(
          'name', 'Tema duplicado',
          'slug', 'tema-duplicado-recovery',
          'themeIds', jsonb_build_array('%s', '%s'),
          'shortDescription', 'Resumo seguro para duplicação.',
          'reason', 'Validar duplicação de temas.'
        )
      )
    $sql$,
    (select id from recovery_theme_ids where position = 1),
    (select id from recovery_theme_ids where position = 1)
  ),
  'P0001',
  'ADMIN_THERAPY_CATALOG_INVALID_THEME',
  'admin rejects duplicated Match themes'
);

select throws_ok(
  format(
    $sql$
      select public.admin_upsert_therapy_draft_v1(
        'aaaaaaaa-0000-4000-8000-000000000090',
        '10400000-0000-4000-8000-000000000006',
        jsonb_build_object(
          'name', 'Temas em excesso',
          'slug', 'temas-em-excesso-recovery',
          'themeIds', %L::jsonb,
          'shortDescription', 'Resumo seguro para excesso.',
          'reason', 'Validar limite de temas.'
        )
      )
    $sql$,
    (select jsonb_agg(id order by position)::text from recovery_theme_ids)
  ),
  'P0001',
  'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT',
  'admin rejects more than three Match themes'
);

insert into public.matching_themes (name, slug, description, sort_order, is_active)
values (
  'Tema inativo recovery',
  'tema-inativo-recovery',
  'Fixture inativa para validar o fechamento do contrato.',
  1001,
  false
);

select throws_ok(
  format(
    $sql$
      select public.admin_upsert_therapy_draft_v1(
        'aaaaaaaa-0000-4000-8000-000000000090',
        '10400000-0000-4000-8000-000000000007',
        jsonb_build_object(
          'name', 'Tema inativo',
          'slug', 'tema-inativo-admin-recovery',
          'themeIds', jsonb_build_array('%s'),
          'shortDescription', 'Resumo seguro para tema inativo.',
          'reason', 'Validar tema inativo no Admin.'
        )
      )
    $sql$,
    (select id from public.matching_themes where slug = 'tema-inativo-recovery')
  ),
  'P0001',
  'ADMIN_THERAPY_CATALOG_INVALID_THEME',
  'admin rejects an inactive Match theme'
);

create temporary table reiki_availability_before
on commit drop
as
select
  therapy.id,
  therapy.is_public_visible,
  therapy.is_available_for_services,
  settings.is_visible_in_matching
from public.therapies therapy
join public.matching_therapy_settings settings on settings.therapy_id = therapy.id
where therapy.slug = 'reiki';

select lives_ok(
  $$
    select public.admin_transition_therapy_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000008',
      (select id from public.therapies where slug = 'reiki'),
      'unpublish',
      'Validar despublicação preservando disponibilidade.',
      '{}'::jsonb
    )
  $$,
  'admin can unpublish a published therapy'
);

select is(
  (select status::text from public.therapies where slug = 'reiki'),
  'draft',
  'unpublishing immediately changes only the editorial status'
);

select results_eq(
  $$
    select therapy.is_public_visible, therapy.is_available_for_services, settings.is_visible_in_matching
    from public.therapies therapy
    join public.matching_therapy_settings settings on settings.therapy_id = therapy.id
    where therapy.slug = 'reiki'
  $$,
  $$
    select is_public_visible, is_available_for_services, is_visible_in_matching
    from reiki_availability_before
  $$,
  'unpublishing preserves all configured availability flags'
);

select lives_ok(
  $$
    select public.admin_transition_therapy_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      '10400000-0000-4000-8000-000000000009',
      (select id from public.therapies where slug = 'reiki'),
      'publish',
      'Validar republicação preservando disponibilidade.',
      '{}'::jsonb
    )
  $$,
  'admin can republish the therapy'
);

select is(
  (select status::text from public.therapies where slug = 'reiki'),
  'published',
  'republishing restores public eligibility through editorial status'
);

select results_eq(
  $$
    select therapy.is_public_visible, therapy.is_available_for_services, settings.is_visible_in_matching
    from public.therapies therapy
    join public.matching_therapy_settings settings on settings.therapy_id = therapy.id
    where therapy.slug = 'reiki'
  $$,
  $$
    select is_public_visible, is_available_for_services, is_visible_in_matching
    from reiki_availability_before
  $$,
  'republishing preserves the configured availability matrix'
);

update public.therapies
set status = 'published',
    is_public_visible = true
where slug = 'terapia-temas-recovery';

delete from public.therapy_matching_themes link
where link.therapy_id = (select id from public.therapies where slug = 'terapia-temas-recovery')
  and link.sort_order > (
    select min(kept.sort_order)
    from public.therapy_matching_themes kept
    where kept.therapy_id = link.therapy_id
  );

select throws_ok(
  format(
    'update public.matching_themes set is_active = false where id = %L',
    (
      select link.theme_id
      from public.therapy_matching_themes link
      join public.therapies therapy on therapy.id = link.therapy_id
      join public.matching_themes theme on theme.id = link.theme_id and theme.is_active
      where therapy.slug = 'terapia-temas-recovery'
      order by link.sort_order
      limit 1
    )
  ),
  'P0001',
  'ADMIN_MATCHING_THEME_DEACTIVATION_BLOCKED',
  'deactivating a theme is blocked when an operational therapy would lose its last active classification'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.admin_list_therapy_catalog_v1('aaaaaaaa-0000-4000-8000-000000000090') -> 'items'
    ) item(value)
    where value ->> 'slug' = 'reiki'
      and jsonb_typeof(value #> '{publicContent,benefits}') = 'array'
      and jsonb_typeof(value #> '{publicContent,highlights}') = 'array'
      and jsonb_typeof(value -> 'history') = 'array'
      and value ? 'impact'
  ),
  'admin catalog restores benefits, highlights, history and impact'
);

select ok(
  (select count(*) from public.public_therapist_search) > 0
  and (select count(*) from public.public_therapist_search)
    = (select count(distinct therapist_profile_id) from public.public_therapist_search),
  'public therapist search returns eligible therapists without duplicate profiles'
);

select * from finish();

rollback;
