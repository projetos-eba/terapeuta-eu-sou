begin;
select plan(6);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, updated_at
) values
  (
    'b1470001-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-01 12:00:00+00', '2099-02-01 12:50:00+00',
    'America/Sao_Paulo', 'cancelled_by_payment', 'cancelled', now()
  ),
  (
    'b1470002-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-01 13:00:00+00', '2099-02-01 13:50:00+00',
    'America/Sao_Paulo', 'cancelled_by_payment', 'failed', now()
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  payment_due_at, canceled_at, updated_at
)
select
  fixture.payment_id,
  fixture.booking_id,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  fixture.financial_status::public.session_financial_status,
  'scheduled', 'not_eligible', 'v10',
  account.id, account.stripe_account_id,
  '2099-01-31 12:00:00+00', fixture.canceled_at, now()
from (
  values
    (
      'c1470001-0000-4000-8000-000000000001'::uuid,
      'b1470001-0000-4000-8000-000000000001'::uuid,
      'canceled'::text,
      '2099-02-01 11:00:00+00'::timestamptz
    ),
    (
      'c1470002-0000-4000-8000-000000000002'::uuid,
      'b1470002-0000-4000-8000-000000000002'::uuid,
      'failed'::text,
      null::timestamptz
    )
) as fixture(payment_id, booking_id, financial_status, canceled_at)
cross join lateral (
  select id
  from public.financial_policy_versions
  where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
  limit 1
) as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) as account;

create temporary table expected_admin_finance_metric as
select
  count(*) filter (where financial_status = 'failed')::integer as failed_count,
  count(*) filter (
    where financial_status in ('failed', 'canceled')
  )::integer as legacy_combined_count
from public.session_payments;

grant select on expected_admin_finance_metric to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.admin_get_finance_module_v2('payments', '{}'::jsonb)
      #>> '{metrics,failed-session-payments}'
  )::integer,
  (select failed_count from expected_admin_finance_metric),
  'the admin failure metric counts only truly failed payments'
);

select isnt(
  (
    public.admin_get_finance_module_v2('payments', '{}'::jsonb)
      #>> '{metrics,failed-session-payments}'
  )::integer,
  (select legacy_combined_count from expected_admin_finance_metric),
  'the admin failure metric no longer combines canceled payments'
);

select is(
  (
    select row_payload ->> 'id'
    from jsonb_array_elements(
      public.admin_get_finance_module_v2(
        'payments',
        '{"status":"canceled","page":1,"pageSize":50}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = 'c1470001-0000-4000-8000-000000000001'
  ),
  'c1470001-0000-4000-8000-000000000001',
  'canceled payments remain available through their dedicated filter'
);

select is(
  (
    select row_payload ->> 'id'
    from jsonb_array_elements(
      public.admin_get_finance_module_v2(
        'payments',
        '{"status":"failed","page":1,"pageSize":50}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = 'c1470002-0000-4000-8000-000000000002'
  ),
  'c1470002-0000-4000-8000-000000000002',
  'failed payments remain available through their dedicated filter'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_finance_module_v2(text,jsonb)',
    'EXECUTE'
  ),
  'authenticated admins can execute the public finance read model'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_finance_v2_pre_failed_metric_20260924(text,jsonb)',
    'EXECUTE'
  ),
  'the preserved implementation is not exposed to authenticated clients'
);

reset role;
select * from finish();
rollback;
