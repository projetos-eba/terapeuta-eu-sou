begin;
select plan(25);

select ok(has_function_privilege(
  'service_role',
  'public.reconcile_session_dispute_event_v10(text,text,integer,text,text,text,text,timestamptz,timestamptz)',
  'EXECUTE'
), 'service role can reconcile signed dispute events');

select ok(not has_function_privilege(
  'authenticated',
  'public.reconcile_session_dispute_event_v10(text,text,integer,text,text,text,text,timestamptz,timestamptz)',
  'EXECUTE'
), 'browser clients cannot reconcile dispute events');

select ok(not has_table_privilege(
  'authenticated', 'public.therapist_financial_debts', 'SELECT'
), 'dispute recovery debt remains private');

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values
  ('b1490000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-28 15:00:00+00', '2098-09-28 15:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1490000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-29 15:00:00+00', '2098-09-29 15:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1490000-0000-4000-8000-000000000013',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-09-30 15:00:00+00', '2098-09-30 15:50:00+00',
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
  ('b1490000-0000-4000-8000-00000000002' || n)::uuid,
  ('b1490000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_dispute_149_' || n, 'pi_test_v10_dispute_149_' || n,
  now(), '2098-09-27 15:00:00+00'
from generate_series(1,3) n
cross join public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents
)
select ('b1490000-0000-4000-8000-00000000003' || n)::uuid,
  payment.id, payment.therapist_profile_id,
  payment.connect_account_id_snapshot, 'tr_test_v10_dispute_149_' || n,
  'tes:v10:dispute:transfer:149:' || n,
  'dispute-transfer-fingerprint-149-' || n,
  8500, 'transferred', payment.stripe_charge_id,
  'session_direct', 8500, 0
from generate_series(1,2) n
join public.session_payments payment
  on payment.id = ('b1490000-0000-4000-8000-00000000002' || n)::uuid;

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status, stripe_transfer_id,
  idempotency_key, request_fingerprint, prepared_at, succeeded_at
)
select ('b1490000-0000-4000-8000-00000000004' || n)::uuid,
  payment.id, payment.booking_id, payment.policy_version_id,
  payment.connect_account_id_snapshot, 'test', payment.stripe_charge_id,
  8500, 0, 8500, 'pending_source', transfer.id,
  'tes:v10:dispute:job:149:' || n,
  'dispute-job-fingerprint-149-' || n, now(), now()
from generate_series(1,2) n
join public.session_payments payment
  on payment.id = ('b1490000-0000-4000-8000-00000000002' || n)::uuid
join public.stripe_transfers transfer on transfer.session_payment_id = payment.id;

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status,
  idempotency_key, request_fingerprint, prepared_at, succeeded_at
)
select 'b1490000-0000-4000-8000-000000000043',
  payment.id, payment.booking_id, payment.policy_version_id,
  payment.connect_account_id_snapshot, 'test', payment.stripe_charge_id,
  8500, 8500, 0, 'offset_only',
  'tes:v10:dispute:job:149:3',
  'dispute-job-fingerprint-149-3', now(), now()
from public.session_payments payment
where payment.id = 'b1490000-0000-4000-8000-000000000023';

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_won', 'ch_test_v10_dispute_149_1', 10000,
    'BRL', 'needs_response', 'charge.dispute.created',
    'evt_test_v10_149_created_1', '2098-09-20 10:00:00+00',
    '2098-09-25 10:00:00+00'
  ) ->> 'recoveryState',
  'pending_resolution',
  'an open dispute waits for a final provider decision'
);

select is(
  (select financial_status::text from public.session_payments
   where id = 'b1490000-0000-4000-8000-000000000021'),
  'disputed',
  'an open dispute blocks new financial effects'
);

select is(
  (select transfer_status::text from public.session_payments
   where id = 'b1490000-0000-4000-8000-000000000021'),
  'transferred',
  'an open dispute preserves the already completed transfer history'
);

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_won', 'ch_test_v10_dispute_149_1', 10000,
    'BRL', 'won', 'charge.dispute.closed',
    'evt_test_v10_149_won_1', '2098-09-21 10:00:00+00', null
  ) ->> 'recoveryState',
  'not_needed',
  'a won dispute does not recover money from the therapist'
);

select is(
  (select financial_status::text from public.session_payments
   where id = 'b1490000-0000-4000-8000-000000000021'),
  'paid',
  'a won dispute restores the paid financial state'
);

select is(
  (select status from public.session_disputes
   where stripe_dispute_id = 'dp_test_v10_149_won'),
  'won',
  'the final provider status replaces the open dispute status'
);

select ok(
  (select closed_at is not null from public.session_disputes
   where stripe_dispute_id = 'dp_test_v10_149_won'),
  'a closed dispute records its terminal timestamp'
);

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_won', 'ch_test_v10_dispute_149_1', 10000,
    'BRL', 'won', 'charge.dispute.closed',
    'evt_test_v10_149_won_duplicate_1', '2098-09-22 10:00:00+00', null
  ) ->> 'applied',
  'false',
  'a repeated terminal decision cannot reopen completed recovery'
);

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_won', 'ch_test_v10_dispute_149_1', 10000,
    'BRL', 'needs_response', 'charge.dispute.updated',
    'evt_test_v10_149_late_update_1', '2098-09-22 11:00:00+00', null
  ) ->> 'applied',
  'false',
  'a late nonterminal update cannot regress a closed dispute'
);

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_lost', 'ch_test_v10_dispute_149_2', 10000,
    'BRL', 'lost', 'charge.dispute.closed',
    'evt_test_v10_149_lost_2', '2098-09-21 11:00:00+00', null
  ) ->> 'recoveryState',
  'not_attempted',
  'a lost transferred dispute becomes eligible for one recovery attempt'
);

select is(
  public.claim_session_dispute_recovery_v10('dp_test_v10_149_lost'),
  true,
  'the provider recovery is claimed once'
);

select is(
  public.claim_session_dispute_recovery_v10('dp_test_v10_149_lost'),
  false,
  'a duplicate recovery claim cannot issue a second provider write'
);

select lives_ok(
  $$select public.reconcile_session_dispute_transfer_reversal_v10(
    'dp_test_v10_149_lost', 'tr_test_v10_dispute_149_2',
    'trr_test_v10_dispute_149_2', 8500, 'BRL',
    'evt_test_v10_149_reversal_2', '2098-09-21 11:01:00+00'
  )$$,
  'the exact dispute reversal is reconciled once'
);

select is(
  (select status from public.session_transfer_jobs
   where session_payment_id = 'b1490000-0000-4000-8000-000000000022'),
  'reversed',
  'the Transfer job records the provider reversal'
);

select is(
  (select transfer_status::text from public.session_payments
   where id = 'b1490000-0000-4000-8000-000000000022'),
  'transferred',
  'the already completed bank payout history remains visible'
);

select is(
  public.complete_session_dispute_recovery_v10(
    'dp_test_v10_149_lost', false
  ) ->> 'debtAmountCents',
  '0',
  'a full transfer reversal creates no therapist debt'
);

select is(
  (select recovery_state from public.session_disputes
   where stripe_dispute_id = 'dp_test_v10_149_lost'),
  'complete',
  'the fully recovered dispute is terminal'
);

select is(
  public.reconcile_session_dispute_event_v10(
    'dp_test_v10_149_offset', 'ch_test_v10_dispute_149_3', 10000,
    'BRL', 'lost', 'charge.dispute.closed',
    'evt_test_v10_149_lost_3', '2098-09-21 12:00:00+00', null
  ) ->> 'providerReversalAmountCents',
  '0',
  'an offset-only payout performs no Stripe reversal'
);

select is(
  public.claim_session_dispute_recovery_v10('dp_test_v10_149_offset'),
  true,
  'the offset-only recovery is still claimed atomically'
);

select is(
  public.complete_session_dispute_recovery_v10(
    'dp_test_v10_149_offset', true
  ) ->> 'debtAmountCents',
  '8500',
  'the benefit previously applied to debt becomes a new dispute debt'
);

select is(
  (select open_amount_cents::text
   from public.therapist_financial_debts
   where session_dispute_id = (
     select id from public.session_disputes
     where stripe_dispute_id = 'dp_test_v10_149_offset'
   )),
  '8500',
  'the residual dispute debt is available for future compensation'
);

select is(
  (select count(*)::text from public.financial_ledger_entries
   where source_table = 'stripe_disputes'
     and source_external_id = 'dp_test_v10_149_won'
     and entry_type in ('dispute', 'recovery')),
  '2',
  'won dispute ledger contains one debit and one recovery credit'
);

select * from finish();
rollback;
