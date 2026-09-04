begin;

\ir fixtures/weekly-payout-local.inc

select plan(26);

select ok(
  'waiting_settlement' = any(enum_range(null::public.session_transfer_status)::text[]),
  'settlement waiting state is part of the canonical transfer lifecycle'
);

select has_column(
  'public', 'session_payments', 'stripe_balance_status',
  'session payments persist Stripe settlement status'
);

select has_column(
  'public', 'session_payments', 'stripe_balance_available_on',
  'session payments persist the Stripe availability instant'
);

select has_column(
  'public', 'session_payments', 'stripe_balance_checked_at',
  'session payments persist the last authoritative Stripe check'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_session_payment_stripe_reconciliation_v2(uuid,text,timestamptz,text,text,integer,integer,text,text,text,text,timestamptz,text,integer,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot write Stripe settlement authority'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_session_payment_stripe_reconciliation_v2(uuid,text,timestamptz,text,text,integer,integer,text,text,text,text,timestamptz,text,integer,text)',
    'EXECUTE'
  ),
  'service role may persist verified Stripe settlement authority'
);

update public.session_payments
set transfer_status = 'waiting_safety_period',
    stripe_balance_status = 'pending',
    stripe_balance_available_on = now() - interval '1 day',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'waiting_settlement',
  'pending Balance Transaction remains in settlement after confirmation'
);

update public.session_payments
set transfer_status = 'waiting_safety_period',
    stripe_balance_status = 'available',
    stripe_balance_available_on = now() + interval '1 hour',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'waiting_settlement',
  'future Stripe availability instant fails closed'
);

update public.session_payments
set transfer_status = 'waiting_safety_period',
    stripe_balance_status = 'available',
    stripe_balance_available_on = now() - interval '1 hour',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'eligible',
  'confirmed available Balance Transaction becomes eligible without an extra safety delay'
);

update public.session_payments
set transfer_status = 'waiting_safety_period',
    stripe_balance_status = null,
    stripe_balance_available_on = null,
    stripe_balance_checked_at = null
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'waiting_settlement',
  'missing settlement proof fails closed'
);

select public.record_session_payment_stripe_reconciliation_v2(
  'fa100000-0000-4000-8000-000000000001',
  'evt_settlement_available', '2026-08-25T04:30:00Z',
  'ch_tes_local_weekly_fixture', 'txn_tes_local_weekly_fixture',
  null, null, null, 'stripe_checkout', null,
  'available', '2026-08-06T12:00:00Z', 'brl', 12000,
  'ch_tes_local_weekly_fixture'
);

select is(
  (select stripe_balance_status from public.session_payments
    where id='fa100000-0000-4000-8000-000000000001'),
  'available',
  'available settlement snapshot is persisted'
);

select public.record_session_payment_stripe_reconciliation_v2(
  'fa100000-0000-4000-8000-000000000001',
  'evt_settlement_out_of_order', '2026-08-25T04:00:00Z',
  'ch_tes_local_weekly_fixture', 'txn_tes_local_weekly_fixture',
  null, null, null, 'stripe_checkout', null,
  'pending', '2026-08-06T12:00:00Z', 'brl', 12000,
  'ch_tes_local_weekly_fixture'
);

select is(
  (select stripe_balance_status from public.session_payments
    where id='fa100000-0000-4000-8000-000000000001'),
  'available',
  'an older pending observation cannot regress an available settlement'
);

select public.record_session_payment_stripe_reconciliation_v2(
  'fa100000-0000-4000-8000-000000000001',
  'evt_settlement_rechecked', '2026-08-25T04:45:00Z',
  'ch_tes_local_weekly_fixture', 'txn_tes_local_weekly_fixture',
  null, null, null, 'stripe_checkout', null,
  'available', '2026-08-06T12:00:00Z', 'brl', 12000,
  'ch_tes_local_weekly_fixture'
);

select is(
  (select stripe_balance_checked_at from public.session_payments
    where id='fa100000-0000-4000-8000-000000000001'),
  '2026-08-25T04:45:00Z'::timestamptz,
  'a repeated authoritative available check refreshes snapshot freshness'
);

select is(
  public.create_weekly_payout_batch_v2(
    date '2099-01-01', date '2099-01-07', '2099-01-08T05:00:00Z', null
  ),
  null,
  'weekly execution suppresses an empty financial batch'
);

select is(
  (public.claim_financial_reconciliation_run_v1(
    '2099-01-01T12:07:00Z',
    '10000000-0000-4000-8000-000000000001',
    45
  )->>'acquired')::boolean,
  true,
  'first hourly reconciliation worker acquires its lease'
);

select is(
  (public.claim_financial_reconciliation_run_v1(
    '2099-01-01T12:08:00Z',
    '10000000-0000-4000-8000-000000000002',
    45
  )->>'acquired')::boolean,
  false,
  'overlapping worker cannot acquire the same hourly run'
);

select public.finalize_financial_reconciliation_run_v1(
  (select id from public.financial_reconciliation_runs
    where scheduled_for = '2099-01-01T12:00:00Z'),
  '10000000-0000-4000-8000-000000000001',
  'completed', 1, 1, 0, 0, null
);

select is(
  (select status from public.financial_reconciliation_runs
    where scheduled_for = '2099-01-01T12:00:00Z'),
  'completed',
  'hourly run is finalized with an auditable terminal state'
);

select is(
  (select settlements_reconciled from public.financial_reconciliation_runs
    where scheduled_for = '2099-01-01T12:00:00Z'),
  1,
  'hourly run stores reconciliation counts'
);

select ok(
  position('create_weekly_payout_batch_v2' in pg_get_functiondef(
    'public.claim_weekly_payout_scheduler_run_v1(timestamptz,uuid,integer)'::regprocedure
  )) > 0,
  'weekly scheduler refreshes and builds through the settlement-aware batch function'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.get_private_therapist_financial_overview_v2(
    date '2026-01-01', date '2026-12-31', 'America/Sao_Paulo'
  )$$,
  'overview v2 executes through the authenticated therapist boundary'
);

select lives_ok(
  $$select public.get_private_therapist_receipts_v2(
    date '2026-01-01', date '2026-12-31', null, null, null, 1, 6,
    'America/Sao_Paulo'
  )$$,
  'receipt v2 executes with full-period aggregates independent from pagination'
);

select is(
  jsonb_array_length(
    public.get_private_therapist_receipts_v2(
      date '2026-01-01', date '2026-12-31', null, null, null, 1, 6,
      'America/Sao_Paulo'
    )->'monthlyTrend'
  ),
  12,
  'monthly trend returns exactly the months in the selected local period'
);

select is(
  public.get_private_therapist_receipts_v2(
    date '2026-01-01', date '2026-12-31', null, null, null, 1, 6,
    'America/Sao_Paulo'
  )#>>'{monthlyTrend,0,month}',
  '2026-01',
  'monthly trend labels the first bucket in the requested timezone'
);

select lives_ok(
  $$select public.get_private_therapist_payouts_v2(
    date '2026-01-01', date '2026-12-31', null, 1, 6,
    'America/Sao_Paulo'
  )$$,
  'payout v2 executes through the authenticated therapist boundary'
);

select set_config(
  'tes.test_blocked_before_refund',
  public.get_private_therapist_payouts_v2(
    date '2026-01-01', date '2026-12-31', null, 1, 6,
    'America/Sao_Paulo'
  )#>>'{summary,blockedCents}',
  true
);

reset role;
update public.session_payments
set financial_status = 'refunded', transfer_status = 'blocked'
where id = 'fa100000-0000-4000-8000-000000000001';
set local role authenticated;

select is(
  (
    public.get_private_therapist_payouts_v2(
      date '2026-01-01', date '2026-12-31', null, 1, 6,
      'America/Sao_Paulo'
    )#>>'{summary,blockedCents}'
  )::integer,
  current_setting('tes.test_blocked_before_refund')::integer,
  'refunded terminal payments are not presented as operationally blocked'
);

reset role;

select ok(
  position('allocation.amount_cents = transfer.amount_cents' in pg_get_functiondef(
    'public.private_therapist_receipt_status_v2(uuid,timestamptz)'::regprocedure
  )) > 0,
  'paid status requires an allocation equal to the complete Transfer amount'
);

select * from finish();
rollback;
