begin;

select plan(19);

select ok(
  to_regprocedure('public.admin_get_operation_module_v2(text, jsonb)') is not null,
  'admin operation v2 read model exists'
);

select ok(
  to_regprocedure('public.admin_get_finance_module_v2(text, jsonb)') is not null,
  'admin finance v2 read model exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_operation_module_v2(text, jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute operation module v2'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_finance_module_v2(text, jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute finance module v2'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_operation_module_v2(text, jsonb)',
    'EXECUTE'
  ),
  'authenticated can invoke operation v2 after admin validation'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_finance_module_v2(text, jsonb)',
    'EXECUTE'
  ),
  'authenticated can invoke finance v2 after admin validation'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_operation_module_v2(''professionals'', ''{}''::jsonb)',
  '42501',
  'admin permission required',
  'non-admin cannot read operation module v2'
);

select throws_ok(
  'select public.admin_get_finance_module_v2(''payments'', ''{}''::jsonb)',
  '42501',
  'admin permission required',
  'non-admin cannot read finance module v2'
);

reset role;

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
  'operation v2 includes page metadata'
);

select is(
  (
    public.admin_get_operation_module_v2(
      'professionals',
      '{"page":1,"pageSize":5}'::jsonb
    ) -> 'page' ->> 'pageSize'
  )::integer,
  5,
  'operation v2 respects requested page size'
);

select is(
  (
    public.admin_get_operation_module_v2(
      'professionals',
      '{"page":1,"pageSize":500}'::jsonb
    ) -> 'page' ->> 'pageSize'
  )::integer,
  50,
  'operation v2 caps page size'
);

select ok(
  public.admin_get_operation_module_v2(
    'professionals',
    '{"search":"ana","status":"approved","sort":"name"}'::jsonb
  ) ? 'filtersApplied',
  'operation v2 returns filters applied'
);

select is(
  (
    public.admin_get_operation_module_v2(
    'verifications',
    '{"search":"privatePath"}'::jsonb
    ) -> 'rows'
  )::text like '%privatePath%',
  false,
  'operation v2 does not expose private document metadata through search'
);

select ok(
  public.admin_get_finance_module_v2(
    'payments',
    '{"page":1,"pageSize":5}'::jsonb
  ) ? 'page',
  'finance v2 includes page metadata'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'payments',
      '{"status":"paid"}'::jsonb
    ) -> 'filtersApplied' ->> 'status'
  ),
  'paid',
  'finance v2 returns applied status filter'
);

select ok(
  jsonb_array_length(
    public.admin_get_finance_module_v2('reports', '{}'::jsonb) -> 'rows'
  ) > 0,
  'finance reports use v2 read model rows'
);

select is(
  (
    public.admin_get_finance_module_v2(
    'subscriptions',
    '{"search":"stripe_subscription_id"}'::jsonb
    ) -> 'rows'
  )::text like '%stripe_subscription_id%',
  false,
  'finance v2 does not expose Stripe provider identifiers by search'
);

select ok(
  to_regprocedure(
    'public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text)'
  ) is not null,
  'admin operation command v2 exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text)',
    'EXECUTE'
  ),
  'authenticated can invoke command v2 after admin validation'
);

select * from finish();

rollback;
