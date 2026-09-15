begin;
select plan(15);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values
  ('b1210000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-10-01 13:00:00+00', '2098-10-01 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1210000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-10-02 13:00:00+00', '2098-10-02 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1210000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-10-03 13:00:00+00', '2098-10-03 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid');

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  ('b1210000-0000-4000-8000-00000000002' || n)::uuid,
  ('b1210000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_history_121_' || n,
  'pi_test_v10_history_121_' || n,
  ('2098-10-0' || n || ' 12:00:00+00')::timestamptz,
  '2098-09-30 13:00:00+00'::timestamptz + make_interval(days => n - 1)
from generate_series(1, 3) n
cross join public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents, transferred_at
) values
  ('b1210000-0000-4000-8000-000000000031',
   'b1210000-0000-4000-8000-000000000021',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000021'),
   'tr_test_v10_history_121_1', 'tes:v10:history:121:1',
   'history-fingerprint-121-1', 7500, 'transferred',
   'ch_test_v10_history_121_1', 'session_direct', 8500, 1000,
   '2098-10-01 12:02:00+00'),
  ('b1210000-0000-4000-8000-000000000032',
   'b1210000-0000-4000-8000-000000000022',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000022'),
   'tr_test_v10_history_121_2', 'tes:v10:history:121:2',
   'history-fingerprint-121-2', 8500, 'transferred',
   'ch_test_v10_history_121_2', 'session_direct', 8500, 0,
   '2098-10-02 12:02:00+00');

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status, stripe_transfer_id,
  idempotency_key, request_fingerprint, prepared_at, succeeded_at
) values
  ('b1210000-0000-4000-8000-000000000041',
   'b1210000-0000-4000-8000-000000000021',
   'b1210000-0000-4000-8000-000000000011',
   (select policy_version_id from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000021'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000021'),
   'test', 'ch_test_v10_history_121_1', 8500, 1000, 7500,
   'pending_source', 'b1210000-0000-4000-8000-000000000031',
   'tes:v10:job:history:121:1', 'job-history-fingerprint-121-1',
   '2098-10-01 12:01:00+00', '2098-10-01 12:02:00+00'),
  ('b1210000-0000-4000-8000-000000000042',
   'b1210000-0000-4000-8000-000000000022',
   'b1210000-0000-4000-8000-000000000012',
   (select policy_version_id from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000022'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000022'),
   'test', 'ch_test_v10_history_121_2', 8500, 0, 8500,
   'transferred', 'b1210000-0000-4000-8000-000000000032',
   'tes:v10:job:history:121:2', 'job-history-fingerprint-121-2',
   '2098-10-02 12:01:00+00', '2098-10-02 12:02:00+00'),
  ('b1210000-0000-4000-8000-000000000043',
   'b1210000-0000-4000-8000-000000000023',
   'b1210000-0000-4000-8000-000000000013',
   (select policy_version_id from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000023'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1210000-0000-4000-8000-000000000023'),
   'test', 'ch_test_v10_history_121_3', 8500, 8500, 0,
   'offset_only', null,
   'tes:v10:job:history:121:3', 'job-history-fingerprint-121-3',
   '2098-10-03 12:01:00+00', '2098-10-03 12:01:00+00');

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, paid_at
) values (
  'b1210000-0000-4000-8000-000000000051',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1210000-0000-4000-8000-000000000022'),
  'po_test_v10_history_121_2', 8500, 'BRL', 'paid', 'paid', true,
  'completed', 'completed', '2098-10-02 18:00:00+00'
);

insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values (
  'b1210000-0000-4000-8000-000000000051',
  'b1210000-0000-4000-8000-000000000032',
  'txn_test_v10_history_121_2', 'py_test_v10_history_121_2',
  8500, 'BRL', 'session_direct', '2098-10-02 18:00:00+00'
);

select set_config('request.jwt.claim.sub',
  (select user_id::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'), true);
select set_config('request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id::text from public.therapist_profiles
            where id = 'c1000000-0000-4000-8000-000000000001'),
    'role', 'authenticated'
  )::text, true);
set local role authenticated;

select is(
  (public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  ) #>> '{pagination,totalCount}')::integer,
  2,
  'the unified history contains the two provider transfers'
);
select is(
  jsonb_array_length(public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  ) -> 'items'),
  2,
  'pagination returns both V10 items exactly once'
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'sourceKind' = 'session_direct'),
  2,
  'direct and weekly histories remain distinguishable internally'
);
select is(
  (select item -> 'payoutBatchId'
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000041'),
  'null'::jsonb,
  'a direct Transfer is never disguised as a weekly batch'
);
select is(
  (select item ->> 'transferStatus'
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000041'),
  'bank_pending',
  'a created Transfer is still on its way to the bank before payout confirmation'
);
select is(
  (select item ->> 'transferStatus'
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000042'),
  'paid',
  'only the fully allocated paid Payout is presented as paid'
);
select ok(
  (select item ->> 'transferredAt' is not null
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000042'),
  'the completion date comes from the paid Payout'
);
select is(
  (select (item ->> 'debtOffsetAmountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000041'),
  1000,
  'the therapist sees the prior-value compensation separately'
);
select is(
  (select (item ->> 'therapistNetAmountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v2(
     '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
   ) -> 'items') item
   where item ->> 'payoutItemId' = 'b1210000-0000-4000-8000-000000000041'),
  7500,
  'the payout amount is the amount actually sent after compensation'
);
select ok(
  public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  )::text not like '%tr_test_v10_history%'
  and public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  )::text not like '%ch_test_v10_history%',
  'provider identifiers never cross the browser read model'
);
select is(
  (public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', 'paid', 1, 20, 'America/Sao_Paulo'
  ) #>> '{pagination,totalCount}')::integer,
  1,
  'the status filter includes the V10 paid item'
);
select ok(
  public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  )::text not like '%b1210000-0000-4000-8000-000000000043%',
  'a fully compensated session does not pretend to be a bank payout'
);
reset role;
select is(
  (public.get_private_therapist_payouts_v2(
    '2098-10-01', '2098-10-03', null, 1, 20, 'America/Sao_Paulo'
  ) #>> '{summary,payoutProcessingCents}')::integer,
  (
    select coalesce(sum(
      case
        when payment.payment_flow_version = 'v10'
          then coalesce(job.transfer_amount_cents, payment.therapist_amount_cents)
        else payment.therapist_amount_cents
      end
    ), 0)::integer
    from public.session_payments payment
    left join public.session_transfer_jobs job
      on job.session_payment_id = payment.id
    where payment.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and public.private_therapist_receipt_status_v2(payment.id) in (
        'waiting_confirmation',
        'waiting_safety_period',
        'waiting_settlement',
        'eligible',
        'payout_processing',
        'bank_pending'
      )
  ),
  'processing uses the actual V10 bank amount after compensation'
);
set local role authenticated;
select ok(
  not has_function_privilege('authenticated',
    'public.private_therapist_payouts_v2_v10_gross_processing_legacy(date,date,text,integer,integer,text)',
    'EXECUTE'),
  'the superseded gross-processing projection remains private'
);
select ok(
  not has_function_privilege('authenticated',
    'public.private_therapist_payouts_v2_v9_history_legacy(date,date,text,integer,integer,text)',
    'EXECUTE'),
  'the compatibility implementation remains private'
);

select * from finish();
rollback;
