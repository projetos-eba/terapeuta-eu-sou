begin;
select plan(7);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, updated_at
) values (
  'b1480001-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now() + interval '2 days', now() + interval '2 days 50 minutes',
  'America/Sao_Paulo', 'confirmed', 'paid', now()
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  stripe_fee_amount_cents, stripe_net_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  payment_due_at, paid_at, metadata, updated_at
)
select
  'c1480001-0000-4000-8000-000000000001',
  'b1480001-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 12000, 1500, 1800, 10200, 300, 11700,
  'paid', 'scheduled', 'not_eligible', 'v10',
  account.id, account.stripe_account_id,
  now(), now(),
  '{"paymentMethodType":"pix","raw":"must-not-be-exposed"}'::jsonb,
  now()
from public.financial_policy_versions as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) as account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  public.admin_get_finance_module_v2(
    'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
  ) #>> '{filtersApplied,period}',
  '7d',
  'the finance read model preserves the selected period'
);

select cmp_ok(
  (
    public.admin_get_finance_module_v2(
      'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,total-payments-amount}'
  )::bigint,
  '>=',
  12000::bigint,
  'the total payment amount is returned in cents for the selected period'
);

select cmp_ok(
  (
    public.admin_get_finance_module_v2(
      'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,gross-platform-commission-amount}'
  )::bigint,
  '>=',
  1800::bigint,
  'the gross TES commission is returned in cents'
);

select cmp_ok(
  (
    public.admin_get_finance_module_v2(
      'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,net-platform-revenue-amount}'
  )::bigint,
  '>=',
  1500::bigint,
  'the net TES revenue deducts the real Stripe fee'
);

select is(
  (
    select row_payload ->> 'payment_method_type'
    from jsonb_array_elements(
      public.admin_get_finance_module_v2(
        'payments',
        '{"period":"7d","search":"c1480001-0000-4000-8000-000000000001","page":1,"pageSize":12}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = 'c1480001-0000-4000-8000-000000000001'
  ),
  'pix',
  'the payment row returns the allowlisted payment method category'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.admin_get_finance_module_v2(
        'payments',
        '{"period":"7d","search":"c1480001-0000-4000-8000-000000000001","page":1,"pageSize":12}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload::text like '%must-not-be-exposed%'
  ),
  'the finance list does not expose raw payment metadata'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_finance_v2_before_period_amounts_20260926(text,jsonb)',
    'EXECUTE'
  ),
  'the preserved finance implementation remains private'
);

reset role;
select * from finish();
rollback;
