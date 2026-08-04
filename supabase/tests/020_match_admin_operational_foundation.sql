begin;

select plan(22);

select has_table(
  'public',
  'therapy_matching_themes',
  'therapies have explicit Match theme links'
);

select has_table(
  'public',
  'therapist_service_matching_themes',
  'therapist services have explicit Match theme links'
);

select has_table(
  'public',
  'therapist_service_matching_interests',
  'therapist services have explicit Match refinement links'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_list_matching_v1(uuid)',
    'EXECUTE'
  ),
  'service role can invoke admin Match listing through Edge Functions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.admin_list_matching_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke admin Match authority directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.admin_upsert_matching_theme_v1(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot mutate Match themes directly'
);

select ok(
  has_table_privilege('service_role', 'public.matching_themes', 'SELECT'),
  'service role can read canonical Match themes inside RPCs'
);

select ok(
  has_table_privilege('service_role', 'public.matching_interests', 'SELECT'),
  'service role can read canonical Match refinements inside RPCs'
);

select is(
  (
    select count(*)::integer
    from public.public_matching_therapy_themes_v
    where therapy_id = '22222222-2222-4222-8222-222222222225'
  ),
  2,
  'seeded Reiki Match projection exposes only its explicit active themes'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_matching_therapy_themes_v'
      and column_name = 'interest_id'
  ),
  'therapy Match projection does not expose refinement links'
);

select throws_ok(
  $$
    select public.admin_list_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_ADMIN_REQUIRED',
  'non-admin actor cannot list admin Match configuration'
);

select ok(
  jsonb_array_length(
    public.admin_list_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000090'
    ) -> 'themes'
  ) >= 10,
  'admin Match listing returns themes with operational contract'
);

select ok(
  (
    public.admin_upsert_matching_theme_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad100000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'name', 'Tema pgTAP',
        'slug', 'tema-pgtap',
        'description', 'Tema criado em teste transacional.',
        'sortOrder', 99,
        'reason', 'Cobertura de auditoria pgTAP.'
      )
    ) -> 'themes'
  ) is not null,
  'admin can create a Match theme through the authority'
);

select ok(
  exists (
    select 1
    from public.therapy_catalog_events
    where entity_type = 'matching_theme'
      and event_type = 'matching_theme_created'
      and request_id = 'ad100000-0000-4000-8000-000000000001'
  ),
  'Match theme creation is audited'
);

select throws_ok(
  $$
    select public.admin_upsert_matching_theme_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad100000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'name', 'Duplicado',
        'slug', 'tema-pgtap',
        'description', 'Slug duplicado em teste.',
        'sortOrder', 100,
        'reason', 'Validar conflito de slug.'
      )
    )
  $$,
  'P0001',
  'ADMIN_MATCHING_SLUG_CONFLICT',
  'admin Match theme slugs are unique'
);

select throws_ok(
  $$
    select public.admin_replace_therapy_matching_themes_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad100000-0000-4000-8000-000000000003',
      '22222222-2222-4222-8222-222222222225',
      array[
        '71000000-0000-4000-8000-000000000001',
        '71000000-0000-4000-8000-000000000002',
        '71000000-0000-4000-8000-000000000003',
        '71000000-0000-4000-8000-000000000004'
      ]::uuid[],
      'Validar limite de temas.'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT',
  'therapy Match links are limited to three themes'
);

select lives_ok(
  $$
    select public.replace_therapist_service_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      array['71000000-0000-4000-8000-000000000009']::uuid[],
      array['72000000-0000-4000-8000-000000000101']::uuid[],
      'ad100000-0000-4000-8000-000000000004'
    )
  $$,
  'therapist can configure own service with a therapy theme and matching refinement'
);

select throws_ok(
  $$
    select public.replace_therapist_service_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      array['71000000-0000-4000-8000-000000000009']::uuid[],
      array['72000000-0000-4000-8000-000000000102']::uuid[],
      'ad100000-0000-4000-8000-000000000005'
    )
  $$,
  'P0001',
  'INVALID_INTEREST_RELATION',
  'service refinement must belong to a selected service theme'
);

select throws_ok(
  $$
    select public.replace_therapist_service_matching_v1(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000001',
      array['71000000-0000-4000-8000-000000000009']::uuid[],
      '{}'::uuid[],
      'ad100000-0000-4000-8000-000000000006'
    )
  $$,
  'P0002',
  'THERAPIST_SERVICE_NOT_FOUND',
  'therapist cannot configure another therapist service'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  exists (
    select 1
    from public.therapist_service_matching_themes
    where therapist_service_id = 'd1000000-0000-4000-8000-000000000001'
  ),
  'therapist can read own service Match themes through RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.therapist_service_matching_themes
  ),
  0,
  'patient cannot enumerate private service Match configuration'
);

reset role;

select ok(
  jsonb_array_length(
    public.get_public_therapy_therapists_v1(
      'reiki',
      array['71000000-0000-4000-8000-000000000009']::uuid[],
      array['72000000-0000-4000-8000-000000000101']::uuid[],
      12
    )
  ) >= 1,
  'public therapist ranking returns valid Reiki professionals for Match context'
);

rollback;
