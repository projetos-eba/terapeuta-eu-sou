begin;
select plan(5);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, updated_at
)
select
  ('b143' || lpad(series::text, 4, '0') || '-0000-4000-8000-' ||
    lpad(series::text, 12, '0'))::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-01-01 12:00:00+00'::timestamptz + series * interval '1 hour',
  '2099-01-01 12:50:00+00'::timestamptz + series * interval '1 hour',
  'America/Sao_Paulo', 'confirmed', 'pending',
  '2099-01-01 12:00:00+00'::timestamptz + series * interval '1 minute'
from generate_series(1, 55) as series;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  payment_due_at, updated_at
)
select
  ('c143' || lpad(series::text, 4, '0') || '-0000-4000-8000-' ||
    lpad(series::text, 12, '0'))::uuid,
  ('b143' || lpad(series::text, 4, '0') || '-0000-4000-8000-' ||
    lpad(series::text, 12, '0'))::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'pending', 'scheduled', 'not_eligible', 'v10',
  account.id, account.stripe_account_id,
  '2098-12-31 12:00:00+00',
  '2099-01-01 12:00:00+00'::timestamptz + series * interval '1 minute'
from generate_series(1, 55) as series
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

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, updated_at
) values (
  'b1439999-0000-4000-8000-000000009999',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2098-01-01 12:00:00+00', '2098-01-01 12:50:00+00',
  'America/Sao_Paulo', 'cancelled_by_payment', 'cancelled',
  '2098-01-01 12:00:00+00'
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
  'c1439999-0000-4000-8000-000000009999',
  'b1439999-0000-4000-8000-000000009999',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'canceled', 'scheduled', 'not_eligible', 'v10',
  account.id, account.stripe_account_id,
  '2097-12-31 12:00:00+00', '2098-01-01 11:00:00+00',
  '2098-01-01 12:00:00+00'
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

select ok(
  (public.admin_get_finance_module_v2(
    'payments', '{"status":"canceled","page":1,"pageSize":12}'::jsonb
  ) #>> '{page,total}')::integer >= 1,
  'the canceled filter covers payments outside the newest 50 rows'
);

select is(
  (select row_payload ->> 'financial_status'
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"status":"canceled","page":1,"pageSize":12}'::jsonb
   ) -> 'rows') as row_payload
   where row_payload ->> 'id' = 'c1439999-0000-4000-8000-000000009999'),
  'canceled',
  'the canceled payment is present in the filtered page'
);

select is(
  (select row_payload ->> 'booking_status'
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"status":"canceled","page":1,"pageSize":12}'::jsonb
   ) -> 'rows') as row_payload
   where row_payload ->> 'id' = 'c1439999-0000-4000-8000-000000009999'),
  'cancelled_by_payment',
  'the canceled row keeps the canonical booking outcome'
);

select is(
  public.admin_get_finance_module_v2(
    'payments', '{"status":"canceled","page":1,"pageSize":12}'::jsonb
  ) #>> '{filtersApplied,status}',
  'canceled',
  'the response preserves the requested filter'
);

select ok(
  jsonb_array_length(public.admin_get_finance_module_v2(
    'payments', '{"status":"canceled","page":1,"pageSize":12}'::jsonb
  ) -> 'rows') <= 12,
  'the complete dataset remains paginated at the requested page size'
);

reset role;
select * from finish();
rollback;
