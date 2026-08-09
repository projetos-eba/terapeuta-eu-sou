begin;

select plan(31);

select has_column(
  'public',
  'therapies',
  'is_available_for_services',
  'platform therapies expose a canonical service availability flag'
);

select has_column(
  'public',
  'therapist_services',
  'therapy_id',
  'therapist services keep the canonical therapy foreign key'
);

select has_column(
  'public',
  'therapist_services',
  'version',
  'therapist services expose an optimistic version'
);

select has_column(
  'public',
  'therapist_services',
  'position',
  'therapist services expose an ordering position'
);

select col_has_check(
  'public',
  'therapist_services',
  'duration_minutes',
  'service duration has explicit bounds'
);

select col_has_check(
  'public',
  'therapist_services',
  'price_cents',
  'service price is constrained in integer cents'
);

select has_table(
  'public',
  'therapist_service_mutation_requests',
  'service mutations have an idempotency ledger'
);

select has_table(
  'public',
  'therapist_service_events',
  'service lifecycle changes have an audit trail'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_therapist_service_v1(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'service role can invoke service creation through Edge Functions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_therapist_service_v1(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke service creation directly'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.therapist_private_services_v1',
    'SELECT'
  ),
  false,
  'authenticated clients cannot read the private service projection directly'
);

select ok(
  exists (
    select 1
    from public.therapist_service_allowed_catalog_v1
    where therapy_slug = 'reiki'
      and is_available_for_services
  ),
  'published serviceable therapies appear in the creation catalog'
);

select ok(
  not exists (
    select 1
    from public.therapist_service_allowed_catalog_v1
    where therapy_slug = 'cristaloterapia'
  ),
  'deprecated therapies do not appear in the creation catalog'
);

select ok(
  not exists (
    select 1
    from public.public_matching_therapies_v
    where slug = 'aromaterapia'
  ),
  'a published therapy outside Match is not a Match candidate'
);

select ok(
  not exists (
    select 1
    from public.public_therapist_profile_services_v
    where service_id = 'd1000000-0000-4000-8000-000000000021'
  ),
  'paused services do not appear as public reservable services'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    insert into public.therapies (
      category_id,
      name,
      slug,
      short_description,
      status
    )
    values (
      '11111111-1111-4111-8111-111111111117',
      'Livre',
      'livre-pgtap',
      'Nao pode nascer por cliente autenticado.',
      'draft'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot create canonical therapies'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  exists (
    select 1
    from public.therapist_services
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'a therapist can read their own services through table RLS'
);

select ok(
  exists (
    select 1
    from public.therapist_services
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'
      and status = 'active'
      and is_bookable = true
      and online_only = true
  ),
  'a therapist can read another therapist public service gate through table RLS'
);

select throws_ok(
  $$
    update public.therapist_services
    set title = 'Tentativa indevida'
    where id = 'd1000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  null,
  'a therapist cannot update another therapist service directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.therapist_private_services_v1',
    'SELECT'
  ),
  'patients have no direct private service projection grant'
);

reset role;

select ok(
  (
    public.create_therapist_service_v1(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'a6000000-0000-4000-8000-000000000101',
      jsonb_build_object(
        'therapyId', '22222222-2222-4222-8222-222222222225',
        'title', 'Reiki de teste',
        'description', 'Servico criado por RPC transacional.',
        'durationMinutes', 60,
        'priceCents', 12000,
        'currency', 'BRL',
        'deliveryFormat', 'online'
      )
    ) -> 'service' ->> 'serviceId'
  ) is not null,
  'service creation accepts a canonical therapyId'
);

select is(
  public.create_therapist_service_v1(
    'aaaaaaaa-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'therapyId', '22222222-2222-4222-8222-222222222225',
      'title', 'Reiki de teste',
      'description', 'Servico criado por RPC transacional.',
      'durationMinutes', 60,
      'priceCents', 12000,
      'currency', 'BRL',
      'deliveryFormat', 'online'
    )
  ) ->> 'idempotentReplay',
  'true',
  'replaying the same create request is idempotent'
);

select throws_ok(
  $$
    select public.create_therapist_service_v1(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'a6000000-0000-4000-8000-000000000101',
      jsonb_build_object(
        'therapyId', '22222222-2222-4222-8222-222222222225',
        'title', 'Outro payload',
        'description', 'Servico criado por RPC transacional.',
        'durationMinutes', 60,
        'priceCents', 12000,
        'currency', 'BRL',
        'deliveryFormat', 'online'
      )
    )
  $$,
  'P0001',
  'THERAPIST_SERVICE_IDEMPOTENCY_CONFLICT',
  'reusing the same request id with another payload conflicts'
);

select throws_ok(
  $$
    select public.create_therapist_service_v1(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'a6000000-0000-4000-8000-000000000102',
      jsonb_build_object(
        'therapyName', 'Nova terapia livre',
        'title', 'Livre',
        'durationMinutes', 60,
        'priceCents', 12000,
        'currency', 'BRL',
        'deliveryFormat', 'online'
      )
    )
  $$,
  'P0002',
  'THERAPY_NOT_AVAILABLE_FOR_SERVICE',
  'service creation cannot create or infer therapy from free text'
);

select throws_ok(
  $$
    select public.create_therapist_service_v1(
      'aaaaaaaa-0000-4000-8000-000000000002',
      'a6000000-0000-4000-8000-000000000103',
      jsonb_build_object(
        'therapyId', '22222222-2222-4222-8222-222222222224',
        'title', 'Cristaloterapia nova',
        'description', 'Nao deve criar servico novo.',
        'durationMinutes', 60,
        'priceCents', 12000,
        'currency', 'BRL',
        'deliveryFormat', 'online'
      )
    )
  $$,
  'P0001',
  'THERAPY_NOT_AVAILABLE_FOR_SERVICE',
  'deprecated therapies reject new services'
);

select throws_ok(
  $$
    insert into public.therapist_services (
      id,
      therapist_profile_id,
      therapy_id,
      title,
      duration_minutes,
      price_cents,
      currency,
      status,
      online_only,
      delivery_format
    )
    values (
      'd1000000-0000-4000-8000-000000000199',
      'c1000000-0000-4000-8000-000000000002',
      '22222222-2222-4222-8222-222222222225',
      'Formato invalido',
      60,
      12000,
      'BRL',
      'draft',
      false,
      'online'
    )
  $$,
  'P0001',
  'THERAPIST_SERVICE_ONLINE_ONLY',
  'services cannot opt out of online-only delivery'
);

select throws_ok(
  $$
    insert into public.therapist_services (
      id,
      therapist_profile_id,
      therapy_id,
      title,
      duration_minutes,
      price_cents,
      currency,
      status,
      online_only,
      delivery_format
    )
    values (
      'd1000000-0000-4000-8000-000000000198',
      'c1000000-0000-4000-8000-000000000002',
      '22222222-2222-4222-8222-222222222225',
      'Formato invalido',
      60,
      12000,
      'BRL',
      'draft',
      true,
      'hybrid'
    )
  $$,
  'P0001',
  'THERAPIST_SERVICE_ONLINE_ONLY',
  'services cannot use hybrid delivery'
);

select throws_ok(
  $$
    update public.therapist_profiles
    set accepts_online_sessions = false
    where id = 'c1000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'THERAPIST_PROFILE_ONLINE_ONLY',
  'therapist profiles cannot disable online sessions'
);

select throws_ok(
  $$
    select public.get_therapist_sessions_v1(p_modality => 'in_person')
  $$,
  '42501',
  'therapist_access_required',
  'session read model still requires therapist access before filters are applied'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.get_therapist_sessions_v1(p_modality => 'in_person')
  $$,
  '22023',
  'invalid_sessions_modality',
  'session read model rejects legacy in-person modality for therapists'
);

reset role;

select ok(
  exists (
    select 1
    from public.therapist_service_events
    where request_id = 'a6000000-0000-4000-8000-000000000101'
      and event_type = 'service_created'
  ),
  'service creation writes a sanitized audit event'
);

select * from finish();

rollback;
