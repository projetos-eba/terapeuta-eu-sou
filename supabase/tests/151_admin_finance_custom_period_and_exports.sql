begin;

select plan(7);

select ok(
  to_regprocedure('public.admin_get_finance_module_range_v1(text,jsonb)') is not null,
  'the custom-range finance read model exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_finance_module_range_v1(text,jsonb)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot execute the custom-range finance read model'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

create temporary table custom_range as
select
  ((now() at time zone 'America/Sao_Paulo')::date - 30)::text as start_date,
  (now() at time zone 'America/Sao_Paulo')::date::text as end_date;

grant select on custom_range to authenticated;

select is(
  public.admin_get_finance_module_range_v1(
    'payments',
    jsonb_build_object(
      'period', 'custom',
      'start', (select start_date from custom_range),
      'end', (select end_date from custom_range),
      'page', 1,
      'pageSize', 50
    )
  ) #>> '{filtersApplied,period}',
  'custom',
  'the read model records the applied custom period'
);

select is(
  (
    public.admin_get_finance_module_range_v1(
      'payments',
      jsonb_build_object(
        'period', 'custom',
        'start', (select start_date from custom_range),
        'end', (select end_date from custom_range)
      )
    ) #>> '{metrics,total-payments-amount}'
  )::bigint,
  (
    select coalesce(sum(payment.gross_amount_cents), 0)::bigint
    from public.session_payments as payment
    where coalesce(payment.paid_at, payment.updated_at, payment.created_at) >=
      (select start_date::date::timestamp at time zone 'America/Sao_Paulo' from custom_range)
      and coalesce(payment.paid_at, payment.updated_at, payment.created_at) <
      (select (end_date::date + 1)::timestamp at time zone 'America/Sao_Paulo' from custom_range)
  ),
  'custom payment totals use the exact local-date interval'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.admin_get_finance_module_range_v1(
        'payments',
        jsonb_build_object(
          'period', 'custom',
          'start', (select start_date from custom_range),
          'end', (select end_date from custom_range)
        )
      ) -> 'rows'
    ) as row_payload
    where row_payload ? 'metadata'
      or row_payload ? 'stripe_charge_id'
      or row_payload ? 'stripe_payment_intent_id'
  ),
  'the custom range preserves the finance row privacy boundary'
);

select throws_ok(
  format(
    'select public.admin_get_finance_module_range_v1(''payments'', jsonb_build_object(''period'', ''custom'', ''start'', %L, ''end'', %L))',
    ((now() at time zone 'America/Sao_Paulo')::date - 367)::text,
    (now() at time zone 'America/Sao_Paulo')::date::text
  ),
  '22023',
  'ADMIN_FINANCE_INVALID_CUSTOM_RANGE',
  'the read model rejects a range longer than one year'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  'select public.admin_get_finance_module_range_v1(''payments'', ''{"period":"custom","start":"2026-01-01","end":"2026-01-02"}''::jsonb)',
  '42501',
  'admin permission required',
  'non-admins cannot read custom finance periods'
);

reset role;
select * from finish();
rollback;
