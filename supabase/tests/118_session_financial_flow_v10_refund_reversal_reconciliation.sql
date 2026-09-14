begin;
select plan(23);

select ok(has_function_privilege('service_role',
  'public.reconcile_session_refund_event_v10(uuid,text,integer,text,text,text,text,timestamptz)',
  'EXECUTE'), 'the signed webhook can reconcile a V10 refund');
select ok(not has_function_privilege('authenticated',
  'public.reconcile_session_refund_event_v10(uuid,text,integer,text,text,text,text,timestamptz)',
  'EXECUTE'), 'the browser cannot project a refund');
select ok(has_function_privilege('service_role',
  'public.reconcile_session_transfer_reversal_v10(text,text,integer,text,text,timestamptz)',
  'EXECUTE'), 'the signed webhook can reconcile a V10 reversal');
select ok(not has_function_privilege('authenticated',
  'public.reconcile_session_transfer_reversal_v10(text,text,integer,text,text,timestamptz)',
  'EXECUTE'), 'the browser cannot project a reversal');

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1180000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2098-09-14 13:00:00+00', '2098-09-14 13:50:00+00',
  'America/Sao_Paulo', 'pending_payment', 'pending'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1180000-0000-4000-8000-000000000021',
  'b1180000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_118', 'pi_test_v10_118', now(), '2098-09-13 13:00:00+00'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents
)
select
  'b1180000-0000-4000-8000-000000000031',
  payment.id, payment.therapist_profile_id,
  payment.connect_account_id_snapshot, 'tr_test_v10_118',
  'tes:v10:transfer:118', 'fingerprint:118', 8500,
  'transferred', 'ch_test_v10_118', 'session_direct', 8500, 0
from public.session_payments payment
where payment.id = 'b1180000-0000-4000-8000-000000000021';

select lives_ok($$
  select public.reconcile_session_refund_event_v10(
    'b1180000-0000-4000-8000-000000000021', 're_test_v10_118_1',
    3000, 'BRL', 'pending', null, 'evt_test_v10_118_1', now())
$$, 'a pending refund is stored without prematurely changing payment status');
select is((select refund_pending from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), true,
  'pending provider refund blocks new financial work');
select is((select financial_status::text from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), 'paid',
  'pending is not presented as refunded');
select is((select count(*)::integer from public.financial_ledger_entries
  where source_external_id='re_test_v10_118_1'), 0,
  'pending refund has no monetary ledger debit');

select lives_ok($$
  select public.reconcile_session_refund_event_v10(
    'b1180000-0000-4000-8000-000000000021', 're_test_v10_118_1',
    3000, 'BRL', 'succeeded', null, 'evt_test_v10_118_2', now())
$$, 'the first partial refund succeeds atomically');
select is((select financial_status::text from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), 'partially_refunded',
  'partial refund has its own financial status');
select is((select count(*)::integer from public.financial_ledger_entries
  where source_external_id='re_test_v10_118_1'), 1,
  'the first refund produces exactly one debit');

select public.reconcile_session_refund_event_v10(
  'b1180000-0000-4000-8000-000000000021', 're_test_v10_118_1',
  3000, 'BRL', 'pending', null, 'evt_test_v10_118_3', now());
select is((select status from public.session_refunds
  where stripe_refund_id='re_test_v10_118_1'), 'succeeded',
  'an old pending event cannot undo success');
select is((select count(*)::integer from public.financial_ledger_entries
  where source_external_id='re_test_v10_118_1'), 1,
  'duplicate and out-of-order events do not duplicate the ledger');

select public.reconcile_session_refund_event_v10(
  'b1180000-0000-4000-8000-000000000021', 're_test_v10_118_2',
  7000, 'BRL', 'succeeded', null, 'evt_test_v10_118_4', now());
select is((select financial_status::text from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), 'refunded',
  'cumulative full refund closes the payment');
select is((select coalesce(sum(amount_cents),0)::integer
  from public.financial_ledger_entries where entry_type='refund'
    and session_payment_id='b1180000-0000-4000-8000-000000000021'), 10000,
  'two partial refunds sum to the exact gross amount');
select is((select refund_pending from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), false,
  'no refund remains pending after provider success');
select throws_ok($$
  select public.reconcile_session_refund_event_v10(
    'b1180000-0000-4000-8000-000000000021', 're_test_v10_118_1',
    3100, 'BRL', 'succeeded', null, 'evt_test_v10_118_5', now())
$$, '23505', 'V10_REFUND_ID_REUSED',
  'a provider refund ID cannot be silently reused with another amount');

select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_118', 'trr_test_v10_118_1', 3500, 'BRL',
  'evt_test_v10_118_6', now());
select is((select status from public.stripe_transfers
  where id='b1180000-0000-4000-8000-000000000031'), 'partially_reversed',
  'a partial reversal does not become an integral reversal');
select is((select transfer_status::text from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), 'transferred',
  'partial reversal does not falsely mark the whole payment reversed');
select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_118', 'trr_test_v10_118_1', 3500, 'BRL',
  'evt_test_v10_118_7', now());
select is((select count(*)::integer from public.financial_ledger_entries
  where source_external_id='trr_test_v10_118_1'), 1,
  'duplicate reversal creates no second credit');

select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_118', 'trr_test_v10_118_2', 5000, 'BRL',
  'evt_test_v10_118_8', now());
select is((select status from public.stripe_transfers
  where id='b1180000-0000-4000-8000-000000000031'), 'reversed',
  'the second reversal closes the Transfer exactly');
select is((select transfer_status::text from public.session_payments
  where id='b1180000-0000-4000-8000-000000000021'), 'reversed',
  'the full reversal is projected to the payment');
select is((select coalesce(sum(amount_cents),0)::integer
  from public.financial_ledger_entries where entry_type='transfer_reversal'
    and session_payment_id='b1180000-0000-4000-8000-000000000021'), 8500,
  'individual reversal credits sum to the original Transfer');

select * from finish();
rollback;
