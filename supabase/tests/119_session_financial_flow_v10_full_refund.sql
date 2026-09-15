begin;
select plan(26);

select ok(has_function_privilege('service_role',
  'public.claim_full_session_refund_v10_v3(uuid,uuid,text,text)', 'EXECUTE'),
  'only the service can claim the provider decision');
select ok(not has_function_privilege('authenticated',
  'public.claim_full_session_refund_v10_v3(uuid,uuid,text,text)', 'EXECUTE'),
  'a browser cannot claim a refund');
select ok(not has_table_privilege('authenticated',
  'public.session_refund_decisions_v10', 'SELECT'),
  'provider decision details are private');

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values
  ('b1190000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-14 13:00:00+00', '2098-09-14 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1190000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-15 13:00:00+00', '2098-09-15 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1190000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-16 13:00:00+00', '2098-09-16 13:50:00+00',
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
  ('b1190000-0000-4000-8000-00000000002' || n)::uuid,
  ('b1190000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_119_' || n, 'pi_test_v10_119_' || n,
  now(), '2098-09-13 13:00:00+00'
from generate_series(1,3) n
cross join public.financial_policy_versions policy
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
select ('b1190000-0000-4000-8000-00000000003' || n)::uuid,
  payment.id, payment.therapist_profile_id,
  payment.connect_account_id_snapshot, 'tr_test_v10_119_' || n,
  'tes:v10:transfer:119:' || n, 'fingerprint:119:' || n,
  8500, 'transferred', payment.stripe_charge_id, 'session_direct', 8500, 0
from generate_series(1,2) n
join public.session_payments payment
  on payment.id = ('b1190000-0000-4000-8000-00000000002' || n)::uuid;

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status, stripe_transfer_id,
  idempotency_key, request_fingerprint, prepared_at
)
select ('b1190000-0000-4000-8000-00000000004' || n)::uuid,
  payment.id, payment.booking_id, payment.policy_version_id,
  payment.connect_account_id_snapshot, 'test', payment.stripe_charge_id,
  8500, 0, 8500, 'pending_source', transfer.id,
  'tes:v10:job:119:' || n, 'job-fingerprint:119:' || n, now()
from generate_series(1,2) n
join public.session_payments payment
  on payment.id = ('b1190000-0000-4000-8000-00000000002' || n)::uuid
join public.stripe_transfers transfer on transfer.session_payment_id = payment.id;

select is(public.claim_full_session_refund_v10_v3(
  'aaaaaaaa-0000-4000-8000-000000000090',
  'b1190000-0000-4000-8000-000000000021',
  'b1190000-0000-4000-8000-000000000051',
  'Sessão não realizada, devolução integral aprovada pelo suporte.')
  ->> 'amountCents', '10000',
  'the pending-source Transfer does not block a full refund decision');
select is((select therapist_exposure_cents from public.session_refund_decisions_v10
  where session_payment_id = 'b1190000-0000-4000-8000-000000000021'), 8500,
  'the decision freezes the full therapist exposure');
select ok((select refund_pending and admin_blocked_at is not null
  from public.session_payments where id='b1190000-0000-4000-8000-000000000021'),
  'room and future transfer are blocked before a provider call');
select is((select count(*)::integer from public.admin_audit_events
  where request_id='b1190000-0000-4000-8000-000000000051'), 1,
  'the decision writes one audit event');
select is(public.claim_full_session_refund_v10_v3(
  'aaaaaaaa-0000-4000-8000-000000000090',
  'b1190000-0000-4000-8000-000000000021',
  'b1190000-0000-4000-8000-000000000051',
  'Sessão não realizada, devolução integral aprovada pelo suporte.')
  ->> 'existing', 'true', 'the same request is idempotent');
select throws_ok($$
  select public.claim_full_session_refund_v10_v3(
    'aaaaaaaa-0000-4000-8000-000000000090',
    'b1190000-0000-4000-8000-000000000021',
    'b1190000-0000-4000-8000-000000000052',
    'Sessão não realizada, devolução integral aprovada pelo suporte.')
$$, '23505', 'FULL_REFUND_DECISION_ALREADY_EXISTS',
  'a second decision for the same payment fails closed');

select public.transition_full_session_refund_step_v10(
  (select id from public.session_refund_decisions_v10
   where session_payment_id='b1190000-0000-4000-8000-000000000021'),
  'reversal', 'attempting');
select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_119_1', 'trr_test_v10_119_1', 8500, 'BRL',
  'evt_test_v10_119_reversal_1', now());
select public.transition_full_session_refund_step_v10(
  (select id from public.session_refund_decisions_v10
   where session_payment_id='b1190000-0000-4000-8000-000000000021'),
  'reversal', 'complete');
select public.reconcile_session_refund_event_v10(
  'b1190000-0000-4000-8000-000000000021', 're_test_v10_119_1',
  10000, 'BRL', 'succeeded', null, 'evt_test_v10_119_refund_1', now());
select is(public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000021') ->> 'debtCents', '0',
  'full reversal plus full customer refund creates no debt');
select is((select count(*)::integer from public.therapist_financial_debts
  where session_payment_id='b1190000-0000-4000-8000-000000000021'), 0,
  'no therapist debt is manufactured after full recovery');

select public.claim_full_session_refund_v10_v3(
  'aaaaaaaa-0000-4000-8000-000000000090',
  'b1190000-0000-4000-8000-000000000022',
  'b1190000-0000-4000-8000-000000000052',
  'Sessão não realizada, devolução integral aprovada pelo suporte.');
select public.transition_full_session_refund_step_v10(
  (select id from public.session_refund_decisions_v10
   where session_payment_id='b1190000-0000-4000-8000-000000000022'),
  'reversal', 'attempting');
select public.transition_full_session_refund_step_v10(
  (select id from public.session_refund_decisions_v10
   where session_payment_id='b1190000-0000-4000-8000-000000000022'),
  'reversal', 'unavailable');
select public.reconcile_session_refund_event_v10(
  'b1190000-0000-4000-8000-000000000022', 're_test_v10_119_2',
  10000, 'BRL', 'succeeded', null, 'evt_test_v10_119_refund_2', now());
select is(public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000022') ->> 'debtCents', '8500',
  'the refund proceeds even when therapist recovery is unavailable');
select is((select open_amount_cents from public.therapist_financial_debts
  where session_payment_id='b1190000-0000-4000-8000-000000000022'
    and origin='refund'), 8500, 'the remaining therapist amount becomes one debt');
select lives_ok($$
  select public.reconcile_full_session_refund_debt_v10_v2(
    'b1190000-0000-4000-8000-000000000022')
$$, 'repeating reconciliation is safe');
select is((select count(*)::integer from public.therapist_financial_debt_events
  where therapist_financial_debt_id = (select id from public.therapist_financial_debts
    where session_payment_id='b1190000-0000-4000-8000-000000000022')), 1,
  'the debt has exactly one creation event');
select is((select count(*)::integer from public.financial_ledger_entries
  where entry_type='therapist_debt'
    and session_payment_id='b1190000-0000-4000-8000-000000000022'), 1,
  'the therapist debt has one immutable ledger entry');

select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_119_2', 'trr_test_v10_119_2', 4000, 'BRL',
  'evt_test_v10_119_reversal_2', now());
select is(public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000022') ->> 'debtCents', '4500',
  'a later partial recovery decreases only the still-open exposure');
select is((select open_amount_cents from public.therapist_financial_debts
  where session_payment_id='b1190000-0000-4000-8000-000000000022'
    and origin='refund'), 4500, 'the later recovery decreases the open balance once');
select public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000022');
select is((select open_amount_cents from public.therapist_financial_debts
  where session_payment_id='b1190000-0000-4000-8000-000000000022'
    and origin='refund'), 4500, 'a repeated later recovery cannot double reduce the debt');

select public.reconcile_session_transfer_reversal_v10(
  'tr_test_v10_119_2', 'trr_test_v10_119_3', 4500, 'BRL',
  'evt_test_v10_119_reversal_3', now());
select is(public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000022') ->> 'debtCents', '0',
  'full late recovery settles the remaining exposure');
select is((select reversal_state from public.session_refund_decisions_v10
  where session_payment_id='b1190000-0000-4000-8000-000000000022'), 'complete',
  'late full recovery updates the decision');
insert into public.session_refund_incidents_v10 (
  session_refund_decision_id, code, expected_amount_cents, observed_amount_cents
) select id, 'recovery_exceeds_open_debt', 0, 100
from public.session_refund_decisions_v10
where session_payment_id='b1190000-0000-4000-8000-000000000022';
select is(public.reconcile_full_session_refund_debt_v10_v2(
  'b1190000-0000-4000-8000-000000000022') ->> 'status',
  'recovery_requires_review',
  'an unresolved over-recovery incident cannot be reported as complete');
select ok(not exists (select 1 from pg_proc where proname =
  'claim_full_session_refund_v10'),
  'obsolete claim surface is removed');

select throws_ok($$
  select public.claim_full_session_refund_v10_v3(
    'c1000000-0000-4000-8000-000000000001',
    'b1190000-0000-4000-8000-000000000023',
    'b1190000-0000-4000-8000-000000000053',
    'Tentativa não autorizada de devolver o valor integral da sessão.')
$$, '22023', 'FULL_REFUND_REQUEST_INVALID',
  'a non-admin cannot create the decision');
select is((select count(*)::integer from public.session_refund_decisions_v10
  where session_payment_id='b1190000-0000-4000-8000-000000000023'), 0,
  'unauthorized attempt has no financial effect');
select is((select count(*)::integer from public.session_refunds
  where session_payment_id in (
    'b1190000-0000-4000-8000-000000000021',
    'b1190000-0000-4000-8000-000000000022') and amount_cents <> 10000), 0,
  'TES decisions create no partial customer refund');

select * from finish();
rollback;
