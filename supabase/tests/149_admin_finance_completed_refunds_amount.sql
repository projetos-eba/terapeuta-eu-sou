begin;
select plan(4);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, updated_at
) values (
  'b1490001-0000-4000-8000-000000000001',
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
  'c1490001-0000-4000-8000-000000000001',
  'b1490001-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 20000, 1500, 3000, 17000, 500, 19500,
  'paid', 'scheduled', 'not_eligible', 'v10',
  account.id, account.stripe_account_id,
  now(), now(), '{}'::jsonb, now()
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

insert into public.session_refunds (
  id, session_payment_id, amount_cents, currency, status, processed_at, updated_at
) values
  (
    'e1490001-0000-4000-8000-000000000001',
    'c1490001-0000-4000-8000-000000000001',
    7500, 'BRL', 'succeeded', now(), now()
  ),
  (
    'e1490001-0000-4000-8000-000000000002',
    'c1490001-0000-4000-8000-000000000001',
    2500, 'BRL', 'succeeded', null, now()
  ),
  (
    'e1490001-0000-4000-8000-000000000003',
    'c1490001-0000-4000-8000-000000000001',
    4000, 'BRL', 'succeeded', now() - interval '8 days', now() - interval '8 days'
  ),
  (
    'e1490001-0000-4000-8000-000000000004',
    'c1490001-0000-4000-8000-000000000001',
    1000, 'BRL', 'pending', null, now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.admin_get_finance_module_v2(
      'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,completed-refunds-amount}'
  )::bigint,
  (
    select coalesce(sum(refund.amount_cents), 0)::bigint
    from public.session_refunds as refund
    where refund.status = 'succeeded'
      and coalesce(refund.processed_at, refund.updated_at, refund.created_at)
        >= (
          ((now() at time zone 'America/Sao_Paulo')::date - 6)::timestamp
          at time zone 'America/Sao_Paulo'
        )
  ),
  'the completed refund amount sums succeeded refunds in the selected period'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'payments', '{"period":"7d","page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,pending-refunds-amount}'
  )::bigint,
  (
    select coalesce(sum(refund.amount_cents), 0)::bigint
    from public.session_refunds as refund
    where refund.status = 'pending'
      and coalesce(refund.updated_at, refund.created_at)
        >= (
          ((now() at time zone 'America/Sao_Paulo')::date - 6)::timestamp
          at time zone 'America/Sao_Paulo'
        )
  ),
  'the pending refund amount remains unchanged'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.admin_get_finance_module_v2(
        'payments',
        '{"period":"7d","status":"refunded","search":"c1490001-0000-4000-8000-000000000001","page":1,"pageSize":12}'::jsonb
      ) -> 'rows'
    ) as row_payload
    where row_payload ->> 'id' = 'c1490001-0000-4000-8000-000000000001'
  ),
  'the refunded filter does not misclassify a partially refunded payment'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_finance_v2_before_completed_refunds_20260927(text,jsonb)',
    'EXECUTE'
  ),
  'the preserved finance implementation remains private'
);

reset role;
select * from finish();
rollback;
