begin;

select plan(20);

select has_table(
  'public',
  'therapy_catalog_requests',
  'therapists can request review for a missing canonical therapy'
);

select has_table(
  'public',
  'therapy_catalog_events',
  'admin therapy catalog changes have an audit trail'
);

select has_table(
  'public',
  'therapy_slug_redirects',
  'therapy slug changes have persistent redirects'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_list_therapy_catalog_v1(uuid)',
    'EXECUTE'
  ),
  'service role can invoke admin catalog list through Edge Functions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.admin_list_therapy_catalog_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke admin catalog authority directly'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select ok(
  exists (select 1 from public.therapies where slug = 'reiki'),
  'admin can read canonical therapies through explicit RLS'
);

select ok(
  exists (select 1 from public.therapy_public_content),
  'admin can read editorial therapy content through explicit RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    update public.therapies
    set name = 'Tentativa indevida'
    where slug = 'reiki'
  $$,
  '42501',
  null,
  'therapist cannot mutate canonical therapy directly'
);

reset role;

select ok(
  jsonb_array_length(
    public.admin_list_therapy_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000090'
    ) -> 'items'
  ) >= 3,
  'admin catalog lists canonical therapies'
);

select throws_ok(
  $$
    select public.admin_list_therapy_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_ADMIN_REQUIRED',
  'non-admin actor cannot list admin catalog'
);

select ok(
  (
    public.admin_upsert_therapy_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'name', 'Terapia Admin Teste',
        'slug', 'terapia-admin-teste',
        'themeIds', jsonb_build_array(
          (select id from public.matching_themes where is_active order by sort_order, name limit 1)
        ),
        'shortDescription', 'Rascunho administrativo seguro.',
        'description', 'Conteudo editorial sem promessa de resultado.',
        'isPubliclyVisible', false,
        'isAvailableForServices', false,
        'isVisibleInMatching', false,
        'reason', 'Criacao de fixture pgTAP.'
      )
    ) ->> 'therapyId'
  ) is not null,
  'admin can create a draft therapy through the authority'
);

select ok(
  exists (
    select 1
    from public.therapy_catalog_events
    where event_type = 'therapy_draft_created'
      and request_id = 'ad000000-0000-4000-8000-000000000001'
  ),
  'admin draft creation is audited'
);

select throws_ok(
  $$
    select public.admin_transition_therapy_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad000000-0000-4000-8000-000000000002',
      (select id from public.therapies where slug = 'terapia-admin-teste'),
      'publish',
      'Tentativa de publicar incompleto.',
      '{}'::jsonb
    )
  $$,
  'P0001',
  'ADMIN_THERAPY_CATALOG_INCOMPLETE_PUBLIC_CONTENT',
  'publication validates minimum public content'
);

select ok(
  (
    public.admin_transition_therapy_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad000000-0000-4000-8000-000000000003',
      (select id from public.therapies where slug = 'reiki'),
      'deprecate',
      'Teste de descontinuacao preservando historico.',
      '{}'::jsonb
    ) -> 'impactBefore' ->> 'serviceCount'
  )::integer >= 1,
  'deprecation reports existing linked services'
);

select ok(
  exists (
    select 1
    from public.therapist_services
    join public.therapies
      on therapies.id = therapist_services.therapy_id
    where therapies.slug = 'reiki'
  ),
  'deprecation does not delete existing services'
);

select ok(
  not exists (
    select 1
    from public.therapist_service_allowed_catalog_v1
    where therapy_slug = 'reiki'
  ),
  'deprecated therapy leaves new service creation catalog'
);

select ok(
  not exists (
    select 1
    from public.public_matching_therapies_v
    where slug = 'reiki'
  ),
  'deprecated therapy leaves Match candidates'
);

select ok(
  (
    public.submit_therapy_catalog_request_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia solicitada pgTAP',
        'description', 'Descrição responsável para análise.',
        'justification', 'Solicitacao de fixture.',
        'useCases', 'Acolhimento e organização da experiência.',
        'sessionProcess', 'Sessão online conduzida com escuta responsável.',
        'themeIds', jsonb_build_array(
          (select id from public.matching_themes where is_active order by sort_order, name limit 1)
        )
      )
    ) ->> 'status'
  ) = 'submitted',
  'therapist can submit a missing therapy request through server authority'
);

select ok(
  (
    public.admin_decide_therapy_catalog_request_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad000000-0000-4000-8000-000000000004',
      (
        select id
        from public.therapy_catalog_requests
        where informed_name = 'Terapia solicitada pgTAP'
        limit 1
      ),
      'rejected',
      'Fora do recorte atual.',
      null
    ) ->> 'requestId'
  ) is not null,
  'admin can decide a therapy catalog request'
);

select ok(
  exists (
    select 1
    from public.therapy_catalog_events
    where event_type = 'therapy_request_rejected'
  ),
  'request decision is audited'
);

select *
from finish();

rollback;
