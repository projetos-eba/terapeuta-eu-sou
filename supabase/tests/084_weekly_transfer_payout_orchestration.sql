begin;

\ir fixtures/weekly-payout-local.inc

select plan(30);

select ok(
  exists (
    select 1 from public.financial_policy_versions
    where version = 'tes-payments-v4-weekly-automatic-payout'
      and is_active = false
      and auto_confirmation_days = 7
      and transfer_safety_period_days = 1
      and weekly_batch_weekday = 2
      and weekly_batch_time = time '02:00'
      and timezone = 'America/Sao_Paulo'
  ),
  'v4 weekly policy is versioned with 7+1 and remains inactive'
);

select is(
  public.claim_weekly_payout_scheduler_run_v1(
    '2026-08-24 12:00:00+00', '84000000-0000-4000-8000-000000000001', 5
  )->>'reason',
  'outside_start_window',
  'a new run does not start outside Tuesday 02:00-04:00 Sao Paulo'
);

select is(
  (public.claim_weekly_payout_scheduler_run_v1(
    '2026-08-25 05:17:00+00', '84000000-0000-4000-8000-000000000001', 5
  )->>'acquired')::boolean,
  true,
  'Tuesday 02:17 Sao Paulo acquires the weekly run'
);

select is(
  (select cutoff_at from public.payout_scheduler_runs where business_date = date '2026-08-25'),
  '2026-08-25 05:00:00+00'::timestamptz,
  'financial cutoff is fixed at Tuesday 02:00 Sao Paulo'
);

select is(
  (select reference_period_start from public.payout_scheduler_runs where business_date = date '2026-08-25'),
  date '2026-08-18',
  'auditable period starts on the previous Tuesday'
);

select is(
  (select reference_period_end from public.payout_scheduler_runs where business_date = date '2026-08-25'),
  date '2026-08-24',
  'auditable period ends on the previous Monday'
);

select is(
  (select count(*)::integer from public.payout_scheduler_runs where business_date = date '2026-08-25'),
  1,
  'weekly run is unique for the Tuesday reference date'
);

select is(
  (select count(*)::integer from public.payout_batch_items
    where session_payment_id = 'fa100000-0000-4000-8000-000000000001'),
  1,
  'eligible backlog older than the audit period is included up to cutoff'
);

select is(
  (select count(*)::integer from public.payout_batch_items
    where session_payment_id = 'fa100000-0000-4000-8000-000000000002'),
  0,
  'zero-total promotional session creates no payout item'
);

select is(
  (select transfer_status::text from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000002'),
  'not_eligible',
  'zero-total promotional session remains valid without a payout failure'
);

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    (select payout_batch_id from public.payout_scheduler_runs where business_date = date '2026-08-25'),
    '84000000-0000-4000-8000-000000000001', 10, 5
  )),
  1,
  'one eligible item is claimed atomically'
);

select is(
  (select status::text from public.stripe_transfers
    where payout_batch_item_id = (
      select id from public.payout_batch_items
      where session_payment_id = 'fa100000-0000-4000-8000-000000000001'
    )),
  'pending',
  'Transfer intent is persisted before the provider response'
);

select ok(
  (select idempotency_key like 'tes:test:transfer:%:v1' from public.stripe_transfers
    where session_payment_id = 'fa100000-0000-4000-8000-000000000001'),
  'Transfer has a stable scoped idempotency key'
);

select is(
  public.complete_payout_transfer_v2(
    (select id from public.stripe_transfers where session_payment_id = 'fa100000-0000-4000-8000-000000000001'),
    '84000000-0000-4000-8000-000000000001',
    'tr_tes_local_weekly_fixture',
    'py_tes_local_weekly_fixture',
    'txn_tes_connected_weekly_fixture',
    '2026-08-25 05:20:00+00',
    '2026-08-25 05:20:00+00'
  ),
  true,
  'Transfer completion is accepted transactionally'
);

select is(
  (select count(*)::integer from public.financial_ledger_entries
    where source_table = 'stripe_transfers'
      and source_id = (select id from public.stripe_transfers where session_payment_id = 'fa100000-0000-4000-8000-000000000001')),
  1,
  'Transfer writes exactly one ledger entry'
);

select is(
  public.complete_payout_transfer_v2(
    (select id from public.stripe_transfers where session_payment_id = 'fa100000-0000-4000-8000-000000000001'),
    '84000000-0000-4000-8000-000000000001',
    'tr_tes_local_weekly_fixture',
    'py_tes_local_weekly_fixture',
    'txn_tes_connected_weekly_fixture',
    '2026-08-25 05:20:00+00',
    '2026-08-25 05:20:00+00'
  ),
  true,
  'duplicate Transfer completion is idempotent'
);

select is(
  (select count(*)::integer from public.financial_ledger_entries
    where source_table = 'stripe_transfers'
      and source_id = (select id from public.stripe_transfers where session_payment_id = 'fa100000-0000-4000-8000-000000000001')),
  1,
  'duplicate completion does not duplicate ledger'
);

select is(
  (select count(*)::integer from public.claim_payout_groups_v1(
    (select payout_batch_id from public.payout_scheduler_runs where business_date = date '2026-08-25'),
    '84000000-0000-4000-8000-000000000001', 10, 5
  )),
  0,
  'automatic payout mode never claims a provider Payout creation'
);

select is(
  (select count(*)::integer from public.stripe_payouts),
  0,
  'weekly worker creates no local Payout intent before Stripe emits one'
);

select is(
  (public.finalize_payout_scheduler_run_v1(
    (select id from public.payout_scheduler_runs where business_date = date '2026-08-25')
  )->>'completed')::boolean,
  true,
  'scheduler execution completes after all weekly Transfers are resolved'
);

select is(
  (select status::text from public.payout_scheduler_runs where business_date = date '2026-08-25'),
  'completed',
  'scheduler no longer remains leased while waiting for the bank stage'
);

select is(
  (select status::text from public.payout_batches where id = (
    select payout_batch_id from public.payout_scheduler_runs where business_date = date '2026-08-25'
  )),
  'processing',
  'financial batch remains processing while awaiting automatic Payout coverage'
);

select is(
  (public.record_automatic_stripe_payout_v1(
    'po_tes_local_weekly_fixture', 'acct_tes_local_weekly_payout_fixture',
    9600, 'brl', 'pending', 'completed', 'evt_tes_payout_created',
    '2026-08-27 12:00:00+00', 'txn_tes_payout_debit', 'card',
    '2026-08-28 12:00:00+00'
  )->>'applied')::boolean,
  true,
  'automatic Payout is imported from the connected-account event'
);

select ok(
  (select automatic and payout_batch_therapist_id is null
      and idempotency_key is null and request_fingerprint is null
    from public.stripe_payouts where stripe_payout_id = 'po_tes_local_weekly_fixture'),
  'automatic Payout requires no TES metadata or local creation key'
);

select is(
  (public.reconcile_automatic_stripe_payout_v1(
    'po_tes_local_weekly_fixture', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(jsonb_build_object(
      'id', 'txn_tes_connected_weekly_fixture',
      'source', 'py_tes_local_weekly_fixture',
      'amount', 9600, 'net', 9600, 'currency', 'brl',
      'available_on', 1787635200, 'type', 'payment',
      'reporting_category', 'transfer'
    )),
    '2026-08-27 12:00:30+00'
  )->>'reconciled')::boolean,
  true,
  'Payout is attributed from its authoritative Balance Transactions'
);

select is(
  (select count(*)::integer from public.stripe_payout_transfer_allocations),
  1,
  'automatic Payout creates one idempotent Transfer allocation'
);

select is(
  (public.record_automatic_stripe_payout_v1(
    'po_tes_local_weekly_fixture', 'acct_tes_local_weekly_payout_fixture',
    9600, 'brl', 'paid', 'completed', 'evt_tes_payout_paid',
    '2026-08-27 12:01:00+00', 'txn_tes_payout_debit', 'card',
    '2026-08-28 12:00:00+00'
  )->>'status'),
  'paid',
  'payout.paid authoritatively completes the bank stage after attribution'
);

select is(
  (select count(*)::integer from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_type = 'stripe_payout'),
  1,
  'therapist success email is queued only after paid and reconciled coverage'
);

select is(
  (select status::text from public.payout_batches where id = (
    select payout_batch_id from public.payout_scheduler_runs where business_date = date '2026-08-25'
  )),
  'completed',
  'batch completes only when every Transfer has paid automatic Payout coverage'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stripe_payouts'::regclass)
  and not has_table_privilege('anon', 'public.stripe_payouts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.stripe_payouts', 'SELECT')
  and (select relrowsecurity from pg_class where oid = 'public.payout_scheduler_runs'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.stripe_payout_transfer_allocations'::regclass)
  and not has_table_privilege('authenticated', 'public.stripe_payout_transfer_allocations', 'SELECT'),
  'new operational objects have restrictive RLS and no public read grants'
);

select * from finish();
rollback;
