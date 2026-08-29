begin;

select plan(24);

select has_function(
  'public',
  'mirror_therapy_catalog_event_to_admin_audit_v1',
  array[]::text[],
  'therapy catalog audit mirror trigger function exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.mirror_therapy_catalog_event_to_admin_audit_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the audit mirror trigger directly'
);

select is(
  public.admin_permission_for_therapy_catalog_event_v1('matching_theme_created'),
  'admin.matching.manage',
  'matching events map to matching manage permission'
);

select is(
  public.admin_permission_for_therapy_catalog_event_v1('therapy_published'),
  'admin.therapies.manage',
  'therapy events map to therapy manage permission'
);

select is(
  public.admin_audit_json_object_v1(null::jsonb),
  '{}'::jsonb,
  'null audit state is normalized to an object'
);

select is(
  public.admin_audit_json_object_v1('[]'::jsonb),
  jsonb_build_object('value', '[]'::jsonb),
  'array audit state is wrapped in an object'
);

select ok(
  (
    public.admin_upsert_matching_theme_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'ad300000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'name', 'Tema auditoria central',
        'slug', 'tema-auditoria-central',
        'description', 'Tema criado para validar auditoria central.',
        'sortOrder', 101,
        'reason', 'Validacao de auditoria central.'
      )
    ) -> 'themes'
  ) is not null,
  'admin matching mutation succeeds'
);

select is(
  (
    select count(*)::integer
    from public.therapy_catalog_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and event_type = 'matching_theme_created'
  ),
  1,
  'domain event is persisted for the matching mutation'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and action = 'matching_theme_created'
      and source = 'therapy_catalog_events'
  ),
  1,
  'matching mutation is mirrored into centralized admin audit'
);

select is(
  (
    select permission
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and action = 'matching_theme_created'
  ),
  'admin.matching.manage',
  'matching audit event records the required permission'
);

select is(
  (
    select entity_type
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and action = 'matching_theme_created'
  ),
  'matching_theme',
  'matching audit event keeps the domain entity type'
);

select is(
  (
    select actor_user_id
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and action = 'matching_theme_created'
  ),
  'aaaaaaaa-0000-4000-8000-000000000090'::uuid,
  'central audit stores the admin actor'
);

select ok(
  (
    select jsonb_typeof(previous_state)
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000001'
      and action = 'matching_theme_created'
  ) = 'object',
  'central audit previous state is always an object'
);

select ok(
  (
    public.submit_therapy_catalog_request_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      jsonb_build_object(
        'informedName', 'Terapia solicitada sem auditoria admin',
        'description', 'Descrição responsável para análise administrativa.',
        'justification', 'Validar que terapeuta nao cria evento admin.',
        'useCases', 'Acolhimento e organização da experiência.',
        'sessionProcess', 'Sessão online conduzida com escuta responsável.',
        'themeIds', jsonb_build_array(
          (select id from public.matching_themes where is_active order by sort_order, name limit 1)
        )
      )
    ) ->> 'status'
  ) = 'submitted',
  'therapist request event succeeds'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where next_state @> jsonb_build_object(
      'informedName',
      'Terapia solicitada sem auditoria admin'
    )
  ),
  0,
  'non-admin catalog request is not mirrored to admin audit'
);

insert into public.therapy_catalog_events (
  actor_profile_id,
  actor_role,
  entity_type,
  entity_id,
  event_type,
  previous_state,
  next_state,
  reason,
  request_id
)
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  'admin',
  'therapy',
  (select id from public.therapies where slug = 'reiki'),
  'therapy_matching_themes_replaced',
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('themeId', gen_random_uuid())),
  'Validar estado array.',
  'ad300000-0000-4000-8000-000000000002'
);

select is(
  (
    select permission
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000002'
  ),
  'admin.matching.manage',
  'therapy matching replacement maps to matching permission'
);

select is(
  (
    select previous_state
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000002'
  ),
  jsonb_build_object('value', '[]'::jsonb),
  'array previous_state is wrapped before central audit insert'
);

select ok(
  (
    select jsonb_typeof(next_state)
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000002'
  ) = 'object',
  'array next_state is wrapped before central audit insert'
);

insert into public.therapy_catalog_events (
  actor_profile_id,
  actor_role,
  entity_type,
  entity_id,
  event_type,
  next_state,
  request_id
)
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  'admin',
  'therapy',
  (select id from public.therapies where slug = 'aromaterapia'),
  'therapy_edited',
  jsonb_build_object('slug', 'aromaterapia'),
  'ad300000-0000-4000-8000-000000000003'
);

select is(
  (
    select permission
    from public.admin_audit_events
    where request_id = 'ad300000-0000-4000-8000-000000000003'
  ),
  'admin.therapies.manage',
  'therapy edit maps to therapy manage permission'
);

select throws_ok(
  $$
    update public.admin_audit_events
    set reason = 'Tentativa de editar evento espelhado.'
    where request_id = 'ad300000-0000-4000-8000-000000000003'
  $$,
  '23514',
  'admin audit events are append-only',
  'mirrored admin audit events remain append-only'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_audit_json_object_v1(jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute audit normalization helper directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.admin_audit_json_object_v1(jsonb)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute audit normalization helper directly'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'z95_mirror_therapy_catalog_event_to_admin_audit'
      and not tgisinternal
  ),
  'therapy catalog event mirror trigger exists'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where source = 'therapy_catalog_events'
      and request_id like 'ad300000-%'
  ),
  3,
  'only admin events from this test were mirrored centrally'
);

select * from finish();

rollback;
