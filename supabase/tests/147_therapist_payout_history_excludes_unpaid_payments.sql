begin;
select plan(7);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values
  ('b1470000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-12-10 13:00:00+00', '2098-12-10 13:50:00+00',
   'America/Sao_Paulo', 'cancelled_by_payment', 'failed'),
  ('b1470000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-12-11 13:00:00+00', '2098-12-11 13:50:00+00',
   'America/Sao_Paulo', 'cancelled_by_payment', 'cancelled'),
  ('b1470000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-12-12 13:00:00+00', '2098-12-12 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid');

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at,
  created_at, updated_at
)
select
  fixture.payment_id,
  fixture.booking_id,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  10000,
  1500,
  1500,
  8500,
  fixture.financial_status::public.session_financial_status,
  'scheduled'::public.session_service_status,
  fixture.transfer_status::public.session_transfer_status,
  'v10',
  account.id,
  account.stripe_account_id,
  fixture.stripe_charge_id,
  fixture.stripe_payment_intent_id,
  fixture.paid_at,
  '2098-12-09 13:00:00+00'::timestamptz,
  fixture.event_at,
  fixture.event_at
from (values
  ('b1470000-0000-4000-8000-000000000021'::uuid,
   'b1470000-0000-4000-8000-000000000011'::uuid,
   'failed', 'not_eligible', null::text, 'pi_test_unpaid_failed_147',
   null::timestamptz, '2098-12-10 12:00:00+00'::timestamptz),
  ('b1470000-0000-4000-8000-000000000022'::uuid,
   'b1470000-0000-4000-8000-000000000012'::uuid,
   'canceled', 'not_eligible', null::text, 'pi_test_unpaid_canceled_147',
   null::timestamptz, '2098-12-11 12:00:00+00'::timestamptz),
  ('b1470000-0000-4000-8000-000000000023'::uuid,
   'b1470000-0000-4000-8000-000000000013'::uuid,
   'paid', 'failed', 'ch_test_payout_failed_147',
   'pi_test_payout_failed_147', '2098-12-12 11:55:00+00'::timestamptz,
   '2098-12-12 12:00:00+00'::timestamptz)
) as fixture(
  payment_id, booking_id, financial_status, transfer_status,
  stripe_charge_id, stripe_payment_intent_id, paid_at, event_at
)
cross join public.financial_policy_versions as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) as account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id,
  therapist_gross_amount_cents, debt_offset_amount_cents,
  transfer_amount_cents, status, idempotency_key, request_fingerprint,
  last_error_code, last_failed_at, created_at, updated_at
)
select
  'b1470000-0000-4000-8000-000000000031',
  payment.id,
  payment.booking_id,
  payment.policy_version_id,
  payment.connect_account_id_snapshot,
  'test',
  payment.stripe_charge_id,
  payment.therapist_amount_cents,
  0,
  payment.therapist_amount_cents,
  'failed',
  'tes:v10:payout-history:147:failed',
  'payout-history-147-failed-fingerprint',
  'provider_rejected',
  '2098-12-12 12:00:00+00',
  '2098-12-12 12:00:00+00',
  '2098-12-12 12:00:00+00'
from public.session_payments as payment
where payment.id = 'b1470000-0000-4000-8000-000000000023';

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id::text from public.therapist_profiles
            where id = 'c1000000-0000-4000-8000-000000000001'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  (public.get_private_therapist_payouts_v7(
    '2098-12-10', '2098-12-12', 1, 20, 'America/Sao_Paulo', 15
  ) ->> 'contractVersion')::integer,
  7,
  'the corrected payout projection publishes contract V7'
);
select ok(
  public.get_private_therapist_payouts_v7(
    '2098-12-10', '2098-12-12', 1, 20, 'America/Sao_Paulo', 15
  )::text not like '%b1470000-0000-4000-8000-000000000021%',
  'a failed unpaid charge without payout artifacts is absent from payout history'
);
select ok(
  public.get_private_therapist_payouts_v7(
    '2098-12-10', '2098-12-12', 1, 20, 'America/Sao_Paulo', 15
  )::text not like '%b1470000-0000-4000-8000-000000000022%',
  'a canceled unpaid charge without payout artifacts is absent from payout history'
);
select ok(
  public.get_private_therapist_payouts_v7(
    '2098-12-10', '2098-12-12', 1, 20, 'America/Sao_Paulo', 15
  )::text like '%b1470000-0000-4000-8000-000000000023%',
  'a paid charge with a real payout failure remains visible for review'
);
select is(
  (public.get_private_therapist_payouts_v7(
    '2098-12-10', '2098-12-12', 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{pagination,totalCount}')::integer,
  1,
  'pagination counts only the remaining payout incident group'
);
select is(
  (select (item ->> 'sessionCount')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v7(
     '2098-12-10', '2098-12-12', 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as item
   where item ->> 'status' = 'under_review'),
  1,
  'the review group count excludes the two unpaid charges'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v7(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'the therapist browser role can execute V7'
);

select * from finish();
rollback;
