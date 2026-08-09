begin;

select plan(32);

select has_table(
  'public',
  'admin_audit_events',
  'admin audit events table exists'
);

select has_function(
  'public',
  'record_admin_audit_event_v1',
  array[
    'uuid',
    'text',
    'text',
    'text',
    'text',
    'text',
    'jsonb',
    'jsonb',
    'text',
    'text',
    'text',
    'text'
  ],
  'admin audit writer function exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_admin_audit_event_v1(uuid,text,text,text,text,text,jsonb,jsonb,text,text,text,text)',
    'EXECUTE'
  ),
  'service_role can execute the admin audit writer'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_admin_audit_event_v1(uuid,text,text,text,text,text,jsonb,jsonb,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the admin audit writer directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.record_admin_audit_event_v1(uuid,text,text,text,text,text,jsonb,jsonb,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute the admin audit writer directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.prevent_admin_audit_event_mutation_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the append-only trigger helper directly'
);

select is(
  has_table_privilege('anon', 'public.admin_audit_events', 'SELECT'),
  false,
  'anon cannot read admin audit events'
);

select is(
  has_table_privilege('authenticated', 'public.admin_audit_events', 'SELECT'),
  true,
  'authenticated role has Data API select grant gated by admin RLS'
);

select is(
  has_table_privilege('authenticated', 'public.admin_audit_events', 'INSERT'),
  false,
  'authenticated clients cannot insert admin audit events directly'
);

select is(
  has_table_privilege('authenticated', 'public.admin_audit_events', 'UPDATE'),
  false,
  'authenticated clients cannot update admin audit events directly'
);

select is(
  has_table_privilege('authenticated', 'public.admin_audit_events', 'DELETE'),
  false,
  'authenticated clients cannot delete admin audit events directly'
);

select ok(
  has_table_privilege('service_role', 'public.admin_audit_events', 'INSERT'),
  'service_role can insert admin audit events'
);

select ok(
  has_table_privilege('service_role', 'public.admin_audit_events', 'SELECT'),
  'service_role can read admin audit events for backend diagnostics'
);

select is(
  has_table_privilege('service_role', 'public.admin_audit_events', 'UPDATE'),
  false,
  'service_role has no direct update grant for append-only audit events'
);

select is(
  has_table_privilege('service_role', 'public.admin_audit_events', 'DELETE'),
  false,
  'service_role has no direct delete grant for append-only audit events'
);

select ok(
  public.record_admin_audit_event_v1(
    'aaaaaaaa-0000-4000-8000-000000000090',
    'admin',
    'professionals.suspend',
    'professional.suspend.requested',
    'therapist_profile',
    'c1000000-0000-4000-8000-000000000001',
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'suspended'),
    'Teste pgTAP de auditoria administrativa.',
    'audit-test-request-1',
    'audit-test-correlation-1',
    'pg_tap'
  ) is not null,
  'service role writer records an admin audit event'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'audit-test-request-1'
      and action = 'professional.suspend.requested'
  ),
  1,
  'admin audit writer persists exactly one event'
);

select is(
  public.record_admin_audit_event_v1(
    'aaaaaaaa-0000-4000-8000-000000000090',
    'admin',
    'professionals.suspend',
    'professional.suspend.requested',
    'therapist_profile',
    'c1000000-0000-4000-8000-000000000001',
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'suspended'),
    'Teste pgTAP de auditoria administrativa.',
    'audit-test-request-1',
    'audit-test-correlation-1',
    'pg_tap'
  ),
  (
    select id
    from public.admin_audit_events
    where request_id = 'audit-test-request-1'
      and action = 'professional.suspend.requested'
  ),
  'same request id/action/entity returns the existing audit event id'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'audit-test-request-1'
      and action = 'professional.suspend.requested'
  ),
  1,
  'same request id/action/entity does not duplicate audit events'
);

select throws_ok(
  $$
    update public.admin_audit_events
    set reason = 'Tentativa de alterar auditoria'
    where request_id = 'audit-test-request-1'
  $$,
  '23514',
  'admin audit events are append-only',
  'admin audit events cannot be updated'
);

select throws_ok(
  $$
    delete from public.admin_audit_events
    where request_id = 'audit-test-request-1'
  $$,
  '23514',
  'admin audit events cannot be deleted',
  'admin audit events cannot be deleted'
);

select throws_ok(
  $$
    select public.record_admin_audit_event_v1(
      'aaaaaaaa-0000-4000-8000-000000000090',
      'admin',
      'professionals.suspend',
      'professional.suspend.requested',
      'therapist_profile',
      'c1000000-0000-4000-8000-000000000001',
      '[]'::jsonb,
      '{}'::jsonb,
      'Estado anterior invalido.',
      'audit-test-request-invalid-state',
      'audit-test-correlation-invalid-state',
      'pg_tap'
    )
  $$,
  '23514',
  null,
  'admin audit writer rejects non-object previous_state'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.admin_audit_events),
  0,
  'non-admin authenticated users cannot read admin audit events through RLS'
);

select throws_ok(
  $$
    insert into public.admin_audit_events (
      actor_user_id,
      actor_role,
      action,
      entity_type
    )
    values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'therapist',
      'direct.insert',
      'audit'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot insert audit rows directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.admin_audit_events),
  1,
  'admin users can read admin audit events through RLS'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_events'
      and column_name = any(array[
        'authorization',
        'cookie',
        'secret',
        'token',
        'service_role_key',
        'card_number',
        'cvc'
      ])
  ),
  'admin audit schema does not define obvious secret-bearing columns'
);

reset role;

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'a10_prevent_admin_audit_event_update'
      and not tgisinternal
  ),
  'admin audit update prevention trigger exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'a10_prevent_admin_audit_event_delete'
      and not tgisinternal
  ),
  'admin audit delete prevention trigger exists'
);

select col_not_null(
  'public',
  'admin_audit_events',
  'created_at',
  'admin audit events always record creation time'
);

select col_not_null(
  'public',
  'admin_audit_events',
  'actor_user_id',
  'admin audit events always record actor user id'
);

select col_not_null(
  'public',
  'admin_audit_events',
  'action',
  'admin audit events always record action'
);

select col_not_null(
  'public',
  'admin_audit_events',
  'entity_type',
  'admin audit events always record entity type'
);

select * from finish();

rollback;
