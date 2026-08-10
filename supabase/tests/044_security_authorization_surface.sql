begin;

select plan(31);

select ok(
  not exists (
    select 1
    from pg_class as c
    join pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in (
        'therapist_private_services_v1',
        'therapist_service_allowed_catalog_v1',
        'therapist_service_metrics_v1'
      )
      and not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ),
  'private/internal read model views execute with invoker privileges'
);

select ok(
  not exists (
    select 1
    from pg_class as c
    join pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in (
        'public_home_therapists',
        'public_therapist_profile_reviews_v',
        'public_therapist_profile_services_v',
        'public_therapist_profiles_v',
        'public_therapist_search'
      )
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ),
  'public therapist DTO views intentionally remain definer projections'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.oid::regprocedure::text not in (
        'get_public_therapy_therapists_v1(text,uuid[],uuid[],integer)',
        'get_service_available_slots_v1(uuid,timestamp with time zone,timestamp with time zone,integer)',
        'record_public_therapist_metric_events_v1(uuid,jsonb)'
      )
  ),
  'anon can execute only the public catalog/availability/telemetry allowlist'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname like 'admin\_%' escape '\'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot execute admin SECURITY DEFINER RPCs'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'get_private_therapist_advanced_financial_dashboard_v1',
        'get_private_therapist_agenda_revenue_potential_v1',
        'get_private_therapist_connect_account_v1',
        'get_private_therapist_financial_forecast_v1',
        'get_private_therapist_financial_metrics_v1',
        'get_private_therapist_financial_opportunities_v1',
        'get_private_therapist_financial_overview_v1',
        'get_private_therapist_payouts_v1',
        'get_private_therapist_receipts_v1',
        'get_private_therapist_retention_analytics_v1'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot execute private therapist financial RPCs'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n
      on n.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) as acl
      on true
    where n.nspname = 'public'
      and p.prosecdef
      and (
        p.proacl is null
        or (
          acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
        )
      )
  ),
  'SECURITY DEFINER functions do not keep implicit or explicit PUBLIC EXECUTE'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'public_home_therapists',
        'public_therapist_profile_reviews_v',
        'public_therapist_profile_services_v',
        'public_therapist_profiles_v',
        'public_therapist_search'
      )
      and column_name in (
        'auth_deleted_at',
        'documents_metadata',
        'legal_name',
        'metadata',
        'stripe_account_id',
        'stripe_connect_account_id',
        'stripe_customer_id',
        'stripe_subscription_id',
        'storage_bucket',
        'storage_object_path',
        'uploaded_by'
      )
  ),
  'public therapist DTO views exclude private, document, admin and Stripe fields'
);

set local role anon;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);

select ok(
  (select count(*)::integer from public.public_therapist_profiles_v) >= 1,
  'anonymous users can read the safe public therapist profile DTO'
);

select ok(
  (select count(*)::integer from public.public_therapist_profile_services_v) >= 1,
  'anonymous users can read the safe public therapist service DTO'
);

reset role;

select is(
  has_table_privilege('anon', 'public.therapist_private_documents', 'SELECT'),
  false,
  'anonymous users have no SELECT grant on therapist private documents'
);

select ok(
  has_table_privilege('authenticated', 'public.therapist_private_documents', 'SELECT'),
  'authenticated document SELECT remains available only behind RLS'
);

insert into public.therapist_private_documents (
  id,
  therapist_profile_id,
  uploaded_by,
  storage_object_path,
  file_name,
  mime_type,
  file_size_bytes
)
values
  (
    'a7000000-0000-4000-8000-000000000044',
    'c1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001/documentos/security-surface-a.pdf',
    'security-surface-a.pdf',
    'application/pdf',
    2048
  ),
  (
    'a7000000-0000-4000-8000-000000000045',
    'c1000000-0000-4000-8000-000000000002',
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-0000-4000-8000-000000000002/documentos/security-surface-b.pdf',
    'security-surface-b.pdf',
    'application/pdf',
    2048
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.patient_profiles
    where id = 'b1000000-0000-4000-8000-000000000002'
  ),
  0,
  'patient_A cannot read patient_B profile'
);

select is(
  (
    select count(*)::integer
    from public.bookings
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  0,
  'patient_A cannot read patient_B bookings'
);

select throws_ok(
  'select public.admin_get_operation_module_v2(''professionals'', ''{}''::jsonb)',
  '42501',
  'admin permission required',
  'patient cannot read admin operation module'
);

select throws_ok(
  'select public.admin_get_finance_module_v2(''payments'', ''{}''::jsonb)',
  '42501',
  'admin permission required',
  'patient cannot read admin finance module'
);

select is(
  (
    select count(*)::integer
    from public.therapist_private_documents
  ),
  0,
  'patient cannot read therapist private documents'
);

select throws_ok(
  $$
    select public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )
  $$,
  'P0002',
  'PROFILE_NOT_FOUND',
  'patient cannot read private therapist finance'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.therapist_private_documents
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  1,
  'therapist_A reads own private documents'
);

select is(
  (
    select count(*)::integer
    from public.therapist_private_documents
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'
  ),
  0,
  'therapist_A cannot read therapist_B private documents'
);

select throws_ok(
  'select public.admin_get_operation_module_v2(''professionals'', ''{}''::jsonb)',
  '42501',
  'admin permission required',
  'therapist cannot read admin operation module'
);

select throws_ok(
  'select public.admin_execute_operation_command_v2(''verification.pause_review'', ''a9000000-0000-4000-8000-000000000044''::uuid, ''Motivo operacional valido'', ''therapist-forbidden-request'')',
  '42501',
  'admin permission required',
  'therapist cannot execute admin verification command'
);

select is(
  (
    with payload as (
      select public.get_private_therapist_receipts_v1(
        '2038-01-01',
        '2038-01-31',
        null,
        null,
        null,
        1,
        50,
        'America/Sao_Paulo'
      )::text as body
    ),
    other_payment as (
      select coalesce(
        (
          select session_payments.id::text
          from public.session_payments
          where session_payments.therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'
          order by session_payments.created_at desc, session_payments.id desc
          limit 1
        ),
        'no-other-therapist-payment'
      ) as id
    )
    select position(other_payment.id in payload.body)
    from payload, other_payment
  ),
  0,
  'therapist_A financial receipts do not expose therapist_B payment ids'
);

reset role;

set local role anon;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);

select throws_ok(
  'select public.admin_get_operation_module_v2(''professionals'', ''{}''::jsonb)',
  '42501',
  null,
  'anonymous cannot execute admin operation module'
);

select throws_ok(
  $$
    select public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )
  $$,
  '42501',
  null,
  'anonymous cannot execute private therapist finance RPC'
);

reset role;

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status
)
values (
  'a9000000-0000-4000-8000-000000000044',
  'c1000000-0000-4000-8000-000000000002',
  'submitted'::public.therapist_status
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select ok(
  public.admin_get_operation_module_v2(
    'professionals',
    '{"page":1,"pageSize":5}'::jsonb
  ) ? 'page',
  'admin can read operation read models'
);

select ok(
  public.admin_get_finance_module_v2(
    'payments',
    '{"page":1,"pageSize":5}'::jsonb
  ) ? 'page',
  'admin can read finance read models'
);

select lives_ok(
  'select public.admin_execute_operation_command_v2(''verification.pause_review'', ''a9000000-0000-4000-8000-000000000044''::uuid, ''Revisao pausada para ajuste documental'', ''security-surface-pause-1'')',
  'admin can execute audited verification command'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'security-surface-pause-1'
      and action = 'verification.pause_review'
      and entity_type = 'therapist_verification'
  ),
  1,
  'admin command writes one audit event'
);

select is(
  (
    select actor_user_id
    from public.admin_audit_events
    where request_id = 'security-surface-pause-1'
      and action = 'verification.pause_review'
      and entity_type = 'therapist_verification'
  ),
  'aaaaaaaa-0000-4000-8000-000000000090'::uuid,
  'audit event records the admin actor'
);

select is(
  (
    select reason
    from public.admin_audit_events
    where request_id = 'security-surface-pause-1'
      and action = 'verification.pause_review'
      and entity_type = 'therapist_verification'
  ),
  'Revisao pausada para ajuste documental',
  'audit event records mandatory reason'
);

select is(
  (
    select request_id
    from public.admin_audit_events
    where request_id = 'security-surface-pause-1'
      and action = 'verification.pause_review'
      and entity_type = 'therapist_verification'
  ),
  'security-surface-pause-1',
  'audit event records requestId'
);

select * from finish();

rollback;
