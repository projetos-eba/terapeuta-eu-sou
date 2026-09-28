begin;
select plan(20);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
select
  ('a1540000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now() + make_interval(days => n + 2),
  now() + make_interval(days => n + 2, mins => 20),
  'America/Sao_Paulo', 'confirmed', 'paid'
from generate_series(1, 3) as n;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at,
  refund_pending, created_at, updated_at
)
select
  ('a1540000-0000-4000-8000-00000000002' || n)::uuid,
  ('a1540000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 12300, 1500, 1845, 10455,
  case when n = 1
    then 'refunded'::public.session_financial_status
    else 'paid'::public.session_financial_status
  end,
  'scheduled'::public.session_service_status,
  case when n = 1
    then 'reversed'::public.session_transfer_status
    else 'transferred'::public.session_transfer_status
  end,
  'v10', account.id, account.stripe_account_id,
  'ch_test_post_payout_154_' || n,
  'pi_test_post_payout_154_' || n,
  now() - interval '5 days' + make_interval(days => n),
  now() - interval '6 days' + make_interval(days => n),
  false, now() - interval '6 days', now() - interval '1 day'
from generate_series(1, 3) as n
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

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents,
  stripe_destination_payment_id, stripe_connected_balance_transaction_id,
  transferred_at, updated_at
) values
  ('a1540000-0000-4000-8000-000000000031',
   'a1540000-0000-4000-8000-000000000021',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'a1540000-0000-4000-8000-000000000021'),
   'tr_test_post_payout_154_1', 'tes:v10:post-payout:154:1',
   'post-payout-fingerprint-154-1', 10455, 'reversed',
   'ch_test_post_payout_154_1', 'session_direct', 10455, 0,
   'py_test_post_payout_154_1', 'txn_test_post_payout_154_original',
   now() - interval '5 days', now() - interval '1 day'),
  ('a1540000-0000-4000-8000-000000000032',
   'a1540000-0000-4000-8000-000000000022',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'a1540000-0000-4000-8000-000000000022'),
   'tr_test_post_payout_154_2', 'tes:v10:post-payout:154:2',
   'post-payout-fingerprint-154-2', 10455, 'transferred',
   'ch_test_post_payout_154_2', 'session_direct', 10455, 0,
   'py_test_post_payout_154_2', null,
   now() - interval '1 day', now() - interval '1 day'),
  ('a1540000-0000-4000-8000-000000000033',
   'a1540000-0000-4000-8000-000000000023',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'a1540000-0000-4000-8000-000000000023'),
   'tr_test_post_payout_154_3', 'tes:v10:post-payout:154:3',
   'post-payout-fingerprint-154-3', 10455, 'transferred',
   'ch_test_post_payout_154_3', 'session_direct', 10455, 0,
   'py_test_post_payout_154_3', null,
   now() - interval '1 day', now() - interval '1 day');

insert into public.session_refunds (
  session_payment_id, stripe_refund_id, amount_cents, currency,
  status, processed_at, metadata
) values (
  'a1540000-0000-4000-8000-000000000021',
  're_test_post_payout_154_1', 12300, 'BRL', 'succeeded',
  now() - interval '1 day', '{"paymentFlowVersion":"v10"}'::jsonb
);

insert into public.stripe_transfer_reversals (
  id, stripe_transfer_id, stripe_transfer_reversal_id, amount_cents,
  currency, reason, status, metadata, created_at
) values (
  'a1540000-0000-4000-8000-000000000041',
  'a1540000-0000-4000-8000-000000000031',
  'trr_test_post_payout_154_1', 10455, 'BRL', 'refund', 'succeeded',
  '{"paymentFlowVersion":"v10"}'::jsonb, now() - interval '1 day'
);

insert into public.financial_ledger_entries (
  entry_type, direction, amount_cents, therapist_profile_id,
  booking_id, session_payment_id, stripe_transfer_id,
  source_table, source_id, source_external_id, occurred_at,
  financial_policy_version_id, transfer_origin
) values (
  'transfer_reversal', 'credit', 10455,
  'c1000000-0000-4000-8000-000000000001',
  'a1540000-0000-4000-8000-000000000011',
  'a1540000-0000-4000-8000-000000000021',
  'a1540000-0000-4000-8000-000000000031',
  'stripe_transfer_reversals',
  'a1540000-0000-4000-8000-000000000041',
  'trr_test_post_payout_154_1', now() - interval '1 day',
  (select policy_version_id from public.session_payments
   where id = 'a1540000-0000-4000-8000-000000000021'),
  'session_direct'
);

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status,
  arrival_at, paid_at, included_transaction_net_cents,
  unmatched_transaction_count, neutral_transaction_pairs
) values
  ('a1540000-0000-4000-8000-000000000051',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'a1540000-0000-4000-8000-000000000021'),
   'po_test_post_payout_154_original', 10455, 'BRL', 'paid', 'paid', true,
   'completed', 'completed', date_trunc('day', now()) - interval '3 days',
   now() - interval '4 days', 10455, 0,
   jsonb_build_array(jsonb_build_object(
     'classification', 'tes_v10_post_payout_reversal',
     'localTransferId', 'a1540000-0000-4000-8000-000000000031'
   ))),
  ('a1540000-0000-4000-8000-000000000052',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'a1540000-0000-4000-8000-000000000022'),
   'po_test_post_payout_154_later', 10455, 'BRL', 'paid', 'paid', true,
   'completed', 'partial', date_trunc('day', now()) + interval '1 day',
   now(), 10455, 1, '[]'::jsonb);

insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values (
  'a1540000-0000-4000-8000-000000000051',
  'a1540000-0000-4000-8000-000000000031',
  'txn_test_post_payout_154_original', 'py_test_post_payout_154_1',
  10455, 'BRL', 'session_direct', now() - interval '4 days'
);

select public.record_payout_operational_incident_v1(
  'automatic-payout:a1540000-0000-4000-8000-000000000052:allocation',
  'automatic_payout_reconciliation_required', 'critical',
  'automatic_payout_allocation_incomplete',
  'Fixture de conciliacao incompleta.', null, null, null, null,
  'a1540000-0000-4000-8000-000000000052',
  'c1000000-0000-4000-8000-000000000001',
  '{"unmatchedCount":1}'::jsonb
);

select is(
  public.reconcile_automatic_stripe_payout_v3(
    'po_test_post_payout_154_later',
    (select stripe_connect_account_id_snapshot from public.session_payments
     where id = 'a1540000-0000-4000-8000-000000000022'),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'txn_test_post_payout_154_2',
        'source', 'py_test_post_payout_154_2',
        'type', 'payment', 'currency', 'brl',
        'amount', 10455, 'net', 10455,
        'available_on', extract(epoch from now() + interval '1 day')::integer,
        'created', extract(epoch from now() - interval '1 day')::integer
      ),
      jsonb_build_object(
        'id', 'txn_test_post_payout_154_3',
        'source', 'py_test_post_payout_154_3',
        'type', 'payment', 'currency', 'brl',
        'amount', 10455, 'net', 10455,
        'available_on', extract(epoch from now() + interval '1 day')::integer,
        'created', extract(epoch from now() - interval '1 day')::integer
      ),
      jsonb_build_object(
        'id', 'txn_test_post_payout_154_refund',
        'source', 'pyr_test_post_payout_154_1',
        'type', 'payment_refund', 'currency', 'brl',
        'amount', -10455, 'net', -10455,
        'available_on', extract(epoch from now() + interval '1 day')::integer,
        'created', extract(epoch from now() - interval '1 day')::integer,
        'verified_refund_charge', 'py_test_post_payout_154_1'
      )
    ),
    now()
  ) ->> 'allocationStatus',
  'completed',
  'V3 completes an exact later Payout containing a post-Payout reversal debit'
);

select is(
  (select count(*)::integer from public.stripe_payout_transfer_allocations
   where stripe_payout_id = 'a1540000-0000-4000-8000-000000000052'),
  2,
  'both positive V10 Transfers remain allocated to the later Payout'
);
select is(
  (select count(*)::integer from public.stripe_payout_balance_adjustments
   where stripe_payout_id = 'a1540000-0000-4000-8000-000000000052'),
  1,
  'the standalone debit is stored once as immutable adjustment evidence'
);
select is(
  (select amount_cents from public.stripe_payout_balance_adjustments
   where stripe_payout_id = 'a1540000-0000-4000-8000-000000000052'),
  10455,
  'the adjustment stores the exact connected-account debit'
);
select is(
  (select allocation_status from public.stripe_payouts
   where id = 'a1540000-0000-4000-8000-000000000052'),
  'completed',
  'the later Payout no longer remains partially reconciled'
);
select is(
  (select unmatched_transaction_count from public.stripe_payouts
   where id = 'a1540000-0000-4000-8000-000000000052'),
  0,
  'every provider movement is accounted for'
);
select is(
  (select status::text from public.payout_operational_incidents
   where incident_key =
     'automatic-payout:a1540000-0000-4000-8000-000000000052:allocation'),
  'resolved',
  'the false payout reconciliation incident is resolved'
);
select is(
  (select count(*)::integer from public.stripe_payout_transfer_allocations
   where stripe_payout_id = 'a1540000-0000-4000-8000-000000000051'),
  1,
  'the original paid Payout allocation remains immutable'
);

select is(
  public.reconcile_automatic_stripe_payout_v3(
    'po_test_post_payout_154_later',
    (select stripe_connect_account_id_snapshot from public.session_payments
     where id = 'a1540000-0000-4000-8000-000000000022'),
    jsonb_build_array(
      jsonb_build_object('id','txn_test_post_payout_154_2','source','py_test_post_payout_154_2','type','payment','currency','brl','amount',10455,'net',10455,'created',extract(epoch from now())::integer),
      jsonb_build_object('id','txn_test_post_payout_154_3','source','py_test_post_payout_154_3','type','payment','currency','brl','amount',10455,'net',10455,'created',extract(epoch from now())::integer),
      jsonb_build_object('id','txn_test_post_payout_154_refund','source','pyr_test_post_payout_154_1','type','payment_refund','currency','brl','amount',-10455,'net',-10455,'created',extract(epoch from now() - interval '1 day')::integer,'verified_refund_charge','py_test_post_payout_154_1')
    ), now()
  ) ->> 'allocationStatus',
  'completed',
  'repeating the exact snapshot remains idempotently completed'
);
select is(
  (select count(*)::integer from public.stripe_payout_balance_adjustments
   where stripe_payout_id = 'a1540000-0000-4000-8000-000000000052'),
  1,
  'idempotent replay does not duplicate the debit adjustment'
);
select is(
  (select financial_status::text from public.session_payments
   where id = 'a1540000-0000-4000-8000-000000000021'),
  'refunded',
  'reconciliation preserves the refunded payment state shown to patient and admin'
);
select is(
  (select count(*)::integer from public.session_payments
   where id in (
     'a1540000-0000-4000-8000-000000000022',
     'a1540000-0000-4000-8000-000000000023'
   ) and financial_status = 'paid'),
  2,
  'reconciliation preserves both successful payment states'
);
select is(
  (select count(*)::integer from public.financial_ledger_entries
   where session_payment_id = 'a1540000-0000-4000-8000-000000000021'
     and entry_type = 'transfer_reversal'
     and source_id = 'a1540000-0000-4000-8000-000000000041'),
  1,
  'reconciliation records no duplicate financial ledger movement'
);

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'), true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id::text from public.therapist_profiles
            where id = 'c1000000-0000-4000-8000-000000000001'),
    'role', 'authenticated'
  )::text, true
);
set local role authenticated;

select is(
  (public.get_private_therapist_payouts_v10(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) ->> 'contractVersion')::integer,
  10,
  'the therapist read model publishes contract V10'
);
select is(
  (public.get_private_therapist_payouts_v10(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,inTransitCents}')::integer,
  10455,
  'the in-transit summary uses the actual net Payout amount'
);
select is(
  (select (item.value ->> 'amountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v10(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) #> '{agenda,inTransit}') as item(value)
   where item.value ->> 'date' = (current_date + 1)::text),
  10455,
  'the later Payout group is presented at the amount actually sent to the bank'
);
select is(
  (select (item.value ->> 'sessionCount')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v10(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) #> '{agenda,inTransit}') as item(value)
   where item.value ->> 'date' = (current_date + 1)::text),
  2,
  'the debit adjustment does not inflate the session count'
);
select is(
  (select (composition.value ->> 'amountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v10(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) #> '{agenda,inTransit}') as item(value)
   cross join jsonb_array_elements(item.value -> 'composition')
     as composition(value)
   where composition.value ->> 'type' = 'adjustment'),
  -10455,
  'the composition explains the exact debit as a negative adjustment'
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v10(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) #> '{agenda,inTransit}') as item(value)
   cross join jsonb_array_elements(item.value -> 'composition')
     as composition(value)
   where composition.value ->> 'type' = 'session'),
  2,
  'the composition preserves both paid sessions'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v10(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'the therapist browser role can execute V10'
);

select * from finish();
rollback;
