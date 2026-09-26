begin;
select plan(21);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
select
  ('b1480000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2098-12-20 12:00:00+00'::timestamptz + make_interval(days => n),
  '2098-12-20 12:50:00+00'::timestamptz + make_interval(days => n),
  'America/Sao_Paulo', 'confirmed', 'paid'
from generate_series(1, 4) as n;

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
  ('b1480000-0000-4000-8000-00000000002' || n)::uuid,
  ('b1480000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid'::public.session_financial_status,
  'scheduled'::public.session_service_status,
  'transferred'::public.session_transfer_status,
  'v10', account.id, account.stripe_account_id,
  'ch_test_payout_history_148_' || n,
  'pi_test_payout_history_148_' || n,
  now() - interval '6 days' + make_interval(days => n),
  now() - interval '7 days' + make_interval(days => n),
  false,
  now() - interval '6 days' + make_interval(days => n),
  now() - interval '4 days' + make_interval(days => n)
from generate_series(1, 4) as n
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
  stripe_destination_payment_id,
  stripe_connected_balance_transaction_id, transferred_at, updated_at
) values
  ('b1480000-0000-4000-8000-000000000031',
   'b1480000-0000-4000-8000-000000000021',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000021'),
   'tr_test_payout_history_148_1', 'tes:v10:history:148:1',
   'history-fingerprint-148-1', 8500, 'reversed',
   'ch_test_payout_history_148_1', 'session_direct', 8500, 0,
   'py_test_payout_history_148_1', 'txn_test_payout_history_148_1',
   now() - interval '5 days', now() - interval '4 days'),
  ('b1480000-0000-4000-8000-000000000032',
   'b1480000-0000-4000-8000-000000000022',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000022'),
   'tr_test_payout_history_148_2', 'tes:v10:history:148:2',
   'history-fingerprint-148-2', 8500, 'reversed',
   'ch_test_payout_history_148_2', 'session_direct', 8500, 0,
   'py_test_payout_history_148_2', 'txn_test_payout_history_148_2',
   now() - interval '4 days', now() - interval '3 days'),
  ('b1480000-0000-4000-8000-000000000033',
   'b1480000-0000-4000-8000-000000000023',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000023'),
   'tr_test_payout_history_148_3', 'tes:v10:history:148:3',
   'history-fingerprint-148-3', 8500, 'transferred',
   'ch_test_payout_history_148_3', 'session_direct', 8500, 0,
   'py_test_payout_history_148_3', 'txn_test_payout_history_148_3',
   now() - interval '3 days', now() - interval '2 days'),
  ('b1480000-0000-4000-8000-000000000034',
   'b1480000-0000-4000-8000-000000000024',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000024'),
   'tr_test_payout_history_148_4', 'tes:v10:history:148:4',
   'history-fingerprint-148-4', 4000, 'transferred',
   'ch_test_payout_history_148_4', 'session_direct', 8500, 4500,
   'py_test_payout_history_148_4', 'txn_test_payout_history_148_4',
   now() - interval '2 days', now() - interval '1 day');

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status, stripe_transfer_id,
  idempotency_key, request_fingerprint, prepared_at, succeeded_at, updated_at
) values
  ('b1480000-0000-4000-8000-000000000041',
   'b1480000-0000-4000-8000-000000000021',
   'b1480000-0000-4000-8000-000000000011',
   (select policy_version_id from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000021'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000021'),
   'test', 'ch_test_payout_history_148_1', 8500, 0, 8500,
   'transferred', 'b1480000-0000-4000-8000-000000000031',
   'tes:v10:job:history:148:1', 'job-history-fingerprint-148-1',
   now() - interval '5 days', now() - interval '5 days',
   now() - interval '4 days'),
  ('b1480000-0000-4000-8000-000000000042',
   'b1480000-0000-4000-8000-000000000022',
   'b1480000-0000-4000-8000-000000000012',
   (select policy_version_id from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000022'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000022'),
   'test', 'ch_test_payout_history_148_2', 8500, 0, 8500,
   'transferred', 'b1480000-0000-4000-8000-000000000032',
   'tes:v10:job:history:148:2', 'job-history-fingerprint-148-2',
   now() - interval '4 days', now() - interval '4 days',
   now() - interval '3 days'),
  ('b1480000-0000-4000-8000-000000000043',
   'b1480000-0000-4000-8000-000000000023',
   'b1480000-0000-4000-8000-000000000013',
   (select policy_version_id from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000023'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000023'),
   'test', 'ch_test_payout_history_148_3', 8500, 0, 8500,
   'transferred', 'b1480000-0000-4000-8000-000000000033',
   'tes:v10:job:history:148:3', 'job-history-fingerprint-148-3',
   now() - interval '3 days', now() - interval '3 days',
   now() - interval '2 days'),
  ('b1480000-0000-4000-8000-000000000044',
   'b1480000-0000-4000-8000-000000000024',
   'b1480000-0000-4000-8000-000000000014',
   (select policy_version_id from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000024'),
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000024'),
   'test', 'ch_test_payout_history_148_4', 8500, 4500, 4000,
   'transferred', 'b1480000-0000-4000-8000-000000000034',
   'tes:v10:job:history:148:4', 'job-history-fingerprint-148-4',
   now() - interval '2 days', now() - interval '2 days',
   now() - interval '1 day');

update public.session_payments
set financial_status = 'refunded',
    transfer_status = case
      when id in (
        'b1480000-0000-4000-8000-000000000021',
        'b1480000-0000-4000-8000-000000000022'
      ) then 'reversed'::public.session_transfer_status
      else transfer_status
    end
where id in (
  'b1480000-0000-4000-8000-000000000021',
  'b1480000-0000-4000-8000-000000000022',
  'b1480000-0000-4000-8000-000000000023'
);

update public.session_transfer_jobs
set status = case
  when id = 'b1480000-0000-4000-8000-000000000041'
    then 'reversed'
  else 'partially_reversed'
end
where id in (
  'b1480000-0000-4000-8000-000000000041',
  'b1480000-0000-4000-8000-000000000042'
);

insert into public.session_refunds (
  session_payment_id, stripe_refund_id, amount_cents, currency,
  status, processed_at, metadata
) values
  ('b1480000-0000-4000-8000-000000000021',
   're_test_payout_history_148_1', 10000, 'BRL', 'succeeded',
   now() - interval '4 days', '{"paymentFlowVersion":"v10"}'::jsonb),
  ('b1480000-0000-4000-8000-000000000022',
   're_test_payout_history_148_2', 10000, 'BRL', 'succeeded',
   now() - interval '3 days', '{"paymentFlowVersion":"v10"}'::jsonb),
  ('b1480000-0000-4000-8000-000000000023',
   're_test_payout_history_148_3', 10000, 'BRL', 'succeeded',
   now() - interval '2 days', '{"paymentFlowVersion":"v10"}'::jsonb);

insert into public.stripe_transfer_reversals (
  stripe_transfer_id, stripe_transfer_reversal_id, amount_cents,
  currency, reason, status, metadata
) values
  ('b1480000-0000-4000-8000-000000000031',
   'trr_test_payout_history_148_1', 8500, 'BRL', 'refund', 'succeeded',
   '{"paymentFlowVersion":"v10"}'::jsonb),
  ('b1480000-0000-4000-8000-000000000032',
   'trr_test_payout_history_148_2', 4000, 'BRL', 'refund', 'succeeded',
   '{"paymentFlowVersion":"v10"}'::jsonb);

insert into public.therapist_financial_debts (
  id, therapist_profile_id, session_payment_id, stripe_transfer_id,
  origin, reason_code, principal_amount_cents, open_amount_cents
) values (
  'b1480000-0000-4000-8000-000000000051',
  'c1000000-0000-4000-8000-000000000001',
  'b1480000-0000-4000-8000-000000000023',
  'b1480000-0000-4000-8000-000000000033',
  'transfer_reversal_shortfall', 'insufficient_connected_balance',
  8500, 8500
);

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, arrival_at, paid_at
) values
  ('b1480000-0000-4000-8000-000000000061',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000023'),
   'po_test_payout_history_148_3', 8500, 'BRL', 'paid', 'paid', true,
   'completed', 'completed', date_trunc('day', now()) - interval '1 day',
   now() - interval '2 days'),
  ('b1480000-0000-4000-8000-000000000062',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1480000-0000-4000-8000-000000000024'),
   'po_test_payout_history_148_4', 4000, 'BRL', 'paid', 'paid', true,
   'completed', 'completed', date_trunc('day', now()) - interval '1 day',
   now() - interval '2 days');

insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values
  ('b1480000-0000-4000-8000-000000000061',
   'b1480000-0000-4000-8000-000000000033',
   'txn_test_payout_history_148_3', 'py_test_payout_history_148_3',
   8500, 'BRL', 'session_direct', now() - interval '2 days'),
  ('b1480000-0000-4000-8000-000000000062',
   'b1480000-0000-4000-8000-000000000034',
   'txn_test_payout_history_148_4', 'py_test_payout_history_148_4',
   4000, 'BRL', 'session_direct', now() - interval '2 days');

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
  (public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) ->> 'contractVersion')::integer,
  8,
  'the corrected payout projection publishes contract V8'
);
select ok(
  public.get_private_therapist_payouts_v7(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  )::text like '%b1480000-0000-4000-8000-000000000021%',
  'V7 demonstrates the preexisting false review for a fully closed reversal'
);
select ok(
  public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  )::text not like '%b1480000-0000-4000-8000-000000000021%',
  'a uniquely and fully reconciled V10 refund and reversal leaves review'
);
select ok(
  public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  )::text like '%b1480000-0000-4000-8000-000000000022%',
  'a partial reversal remains under review'
);
select is(
  (select history.item ->> 'status'
   from jsonb_array_elements(public.get_private_therapist_payouts_v8(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000023'),
  'received',
  'a refund recovered by debt after a paid payout stays received'
);
select is(
  (select (row.composition_item ->> 'amountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v8(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000023'),
  8500,
  'the historical paid payout preserves the amount actually delivered'
);
select is(
  (select history.item ->> 'status'
   from jsonb_array_elements(public.get_private_therapist_payouts_v8(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000024'),
  'received',
  'a partial debt offset with a positive net transfer follows bank history'
);
select is(
  (select (row.composition_item ->> 'amountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v8(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000024'),
  4000,
  'partial compensation exposes only the net amount sent to the therapist'
);
select is(
  (public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,receivedCents}')::integer,
  12500,
  'received summary stays aligned with both reconciled bank allocations'
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v8(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000023'),
  1,
  'the paid-refunded session is not duplicated into an analysis group'
);

reset role;

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, arrival_at, paid_at,
  neutral_transaction_pairs, included_transaction_net_cents,
  unmatched_transaction_count
) values (
  'b1480000-0000-4000-8000-000000000063',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1480000-0000-4000-8000-000000000021'),
  'po_test_payout_history_148_post_reversal', 8500, 'BRL',
  'paid', 'paid', true, 'completed', 'completed',
  date_trunc('day', now()) - interval '1 day', now() - interval '3 days',
  jsonb_build_array(jsonb_build_object(
    'classification', 'tes_v10_post_payout_reversal',
    'paymentBalanceTransactionId', 'txn_test_payout_history_148_1',
    'paymentSourceId', 'py_test_payout_history_148_1',
    'refundBalanceTransactionId', 'txn_test_payout_history_148_1_refund',
    'refundSourceId', 'pyr_test_payout_history_148_1',
    'amountCents', 8500,
    'localTransferId', 'b1480000-0000-4000-8000-000000000031'
  )),
  8500, 0
);

insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values (
  'b1480000-0000-4000-8000-000000000063',
  'b1480000-0000-4000-8000-000000000031',
  'txn_test_payout_history_148_1', 'py_test_payout_history_148_1',
  8500, 'BRL', 'session_direct', now() - interval '3 days'
);

select is(
  public.private_admin_session_payout_projection_v10(
    'b1480000-0000-4000-8000-000000000021'
  ) ->> 'payout_display_status',
  'paid',
  'Admin preserves the paid bank fact after a later V10 reversal'
);

set local role authenticated;
select is(
  (public.get_private_therapist_payouts_v9(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) ->> 'contractVersion')::integer,
  9,
  'the late-reversal payout projection publishes contract V9'
);
select is(
  (select history.item ->> 'status'
   from jsonb_array_elements(public.get_private_therapist_payouts_v9(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000021'),
  'received',
  'a post-Payout reversal keeps the original session in received history'
);
select is(
  (select (row.composition_item ->> 'amountCents')::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v9(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000021'),
  8500,
  'received history keeps the amount that had actually reached the bank'
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v9(
     current_date - 10, current_date, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as history(item)
   cross join jsonb_array_elements(history.item -> 'composition')
     as row(composition_item)
   where row.composition_item ->> 'sessionPaymentId'
     = 'b1480000-0000-4000-8000-000000000021'),
  1,
  'the received session is not duplicated into an analysis group'
);
select ok(
  (public.get_private_therapist_payouts_v9(
    current_date - 10, current_date, 1, 20,
    'America/Sao_Paulo', 15
  ) -> 'agenda')::text not like
    '%b1480000-0000-4000-8000-000000000021%',
  'the late debit is not guessed into a future payout group'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v9(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'the therapist browser role can execute V9'
);

reset role;
update public.stripe_payouts
set status = 'in_transit',
    provider_status = 'in_transit',
    arrival_at = date_trunc('day', now()) + case
      when id = 'b1480000-0000-4000-8000-000000000061'
        then interval '2 days'
      else interval '3 days'
    end,
    paid_at = null
where id in (
  'b1480000-0000-4000-8000-000000000061',
  'b1480000-0000-4000-8000-000000000062'
);
set local role authenticated;

select ok(
  public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) #> '{agenda,inTransit}' @> jsonb_build_array(jsonb_build_object(
    'composition', jsonb_build_array(jsonb_build_object(
      'sessionPaymentId', 'b1480000-0000-4000-8000-000000000023'
    ))
  )),
  'a refunded session with an allocated payout and open debt stays in transit'
);
select is(
  (public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,inTransitCents}')::integer,
  12500,
  'the in-transit summary preserves refund debt and net compensation transfers'
);
select ok(
  public.get_private_therapist_payouts_v8(
    current_date - 10, current_date, 1, 20, 'America/Sao_Paulo', 15
  ) #> '{agenda,inTransit}' @> jsonb_build_array(jsonb_build_object(
    'composition', jsonb_build_array(jsonb_build_object(
      'sessionPaymentId', 'b1480000-0000-4000-8000-000000000024',
      'amountCents', 4000
    ))
  )),
  'partial compensation keeps only its positive net transfer in transit'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v8(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'the therapist browser role can execute V8'
);

select * from finish();
rollback;
