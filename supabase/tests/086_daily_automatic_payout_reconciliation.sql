begin;

\ir fixtures/weekly-payout-local.inc

select plan(20);

select ok(
  exists (
    select 1 from public.financial_policy_versions
    where version = 'tes-payments-v5-weekly-transfer-daily-automatic-payout'
      and is_active = false
      and payout_batch_rule = 'weekly_transfer_daily_automatic_payout'
  ),
  'daily automatic payout policy is versioned and inactive'
);

select is(
  (select payout_schedule_interval from public.therapist_connect_accounts
    where stripe_account_id = 'acct_tes_local_weekly_payout_fixture'),
  'daily',
  'BR fixture uses the provider-supported automatic daily schedule'
);

do $$ begin
  perform public.claim_weekly_payout_scheduler_run_v1(
    '2026-08-25 05:10:00+00', '86000000-0000-4000-8000-000000000001', 5
  );
  perform * from public.claim_payout_transfer_items_v1(
    (select payout_batch_id from public.payout_scheduler_runs where business_date = '2026-08-25'),
    '86000000-0000-4000-8000-000000000001', 10, 5, 'test'
  );
  perform public.complete_payout_transfer_v2(
    (select id from public.stripe_transfers where session_payment_id = 'fa100000-0000-4000-8000-000000000001'),
    '86000000-0000-4000-8000-000000000001',
    'tr_auto_many_a', 'py_auto_many_a', 'txn_auto_many_a',
    '2026-08-25 06:00:00+00', '2026-08-25 05:15:00+00'
  );
end $$;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status, service_title_snapshot,
  service_duration_minutes_snapshot, service_price_cents_snapshot
) values
  (
    'fb000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '18 days', now() - interval '18 days' + interval '50 minutes',
    'America/Sao_Paulo', 'completed', 'paid', 'Fixture automático B1', 50, 10000
  ),
  (
    'fb000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '17 days', now() - interval '17 days' + interval '50 minutes',
    'America/Sao_Paulo', 'completed', 'paid', 'Fixture automático B2', 50, 10000
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, stripe_payment_intent_id, stripe_charge_id,
  stripe_balance_transaction_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  service_status, transfer_status, service_confirmed_at,
  service_confirmation_source, eligible_at, paid_at, metadata
)
select
  fixture.payment_id, fixture.booking_id, fixture.patient_id,
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001', policy.id,
  fixture.intent_id, fixture.charge_id, fixture.balance_id,
  10000, 2000, 2000, 8000, 'paid', 'auto_confirmed', 'eligible',
  now() - interval '10 days', 'automatic', now() - interval '9 days',
  now() - interval '18 days', '{"fixture":"automatic_payout_many"}'::jsonb
from public.financial_policy_versions policy
cross join (values
  (
    'fb100000-0000-4000-8000-000000000001'::uuid,
    'fb000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'pi_auto_many_b1', 'ch_auto_many_b1', 'txn_auto_charge_b1'
  ),
  (
    'fb100000-0000-4000-8000-000000000002'::uuid,
    'fb000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'pi_auto_many_b2', 'ch_auto_many_b2', 'txn_auto_charge_b2'
  )
) fixture(payment_id, booking_id, patient_id, intent_id, charge_id, balance_id)
where policy.is_active;

do $$ begin
  perform public.create_weekly_payout_batch(
    '2026-08-11', '2026-08-17', '2026-08-25 05:00:00+00', null
  );
  perform * from public.claim_payout_transfer_items_v1(
    (select id from public.payout_batches
      where reference_period_start = '2026-08-11' and reference_period_end = '2026-08-17'),
    '86000000-0000-4000-8000-000000000002', 10, 5, 'test'
  );
  perform public.complete_payout_transfer_v2(
    transfer.id, '86000000-0000-4000-8000-000000000002',
    case when transfer.session_payment_id = 'fb100000-0000-4000-8000-000000000001'
      then 'tr_auto_many_b1' else 'tr_auto_many_b2' end,
    case when transfer.session_payment_id = 'fb100000-0000-4000-8000-000000000001'
      then 'py_auto_many_b1' else 'py_auto_many_b2' end,
    case when transfer.session_payment_id = 'fb100000-0000-4000-8000-000000000001'
      then 'txn_auto_many_b1' else 'txn_auto_many_b2' end,
    '2026-08-25 06:00:00+00', '2026-08-25 05:20:00+00'
  )
  from public.stripe_transfers transfer
  where transfer.session_payment_id in (
    'fb100000-0000-4000-8000-000000000001',
    'fb100000-0000-4000-8000-000000000002'
  );
end $$;

select is(
  (select count(*)::integer from public.claim_payout_groups_v1(
    (select id from public.payout_batches where reference_period_start = '2026-08-11'),
    '86000000-0000-4000-8000-000000000003', 10, 5, 'test'
  )),
  0,
  'old manual Payout claim is disabled fail-closed'
);

do $$ begin
  perform public.record_automatic_stripe_payout_v1(
    'po_auto_many_1', 'acct_tes_local_weekly_payout_fixture', 17600, 'brl',
    'pending', 'completed', 'evt_auto_many_1_created', '2026-08-26 10:00:00+00',
    'txn_auto_payout_1', 'card', '2026-08-27 10:00:00+00'
  );
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_many_1', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_auto_many_a','source','py_auto_many_a','amount',9600,'net',9600,'currency','brl','available_on',1787635200),
      jsonb_build_object('id','txn_auto_many_b1','source','py_auto_many_b1','amount',8000,'net',8000,'currency','brl','available_on',1787635200)
    ), '2026-08-26 10:01:00+00'
  );
  perform public.record_automatic_stripe_payout_v1(
    'po_auto_many_1', 'acct_tes_local_weekly_payout_fixture', 17600, 'brl',
    'paid', 'completed', 'evt_auto_many_1_paid', '2026-08-26 10:02:00+00',
    'txn_auto_payout_1', 'card', '2026-08-27 10:00:00+00'
  );
end $$;

select is(
  (select count(*)::integer from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where payout.stripe_payout_id = 'po_auto_many_1'),
  2,
  'one automatic Payout reconciles multiple Transfers'
);

select is(
  (select count(distinct allocation.payout_batch_therapist_id)::integer
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where payout.stripe_payout_id = 'po_auto_many_1'),
  2,
  'one automatic Payout can cover multiple weekly batch groups'
);

select is(
  (select status::text from public.payout_batches
    where id = (select payout_batch_id from public.payout_scheduler_runs where business_date = '2026-08-25')),
  'completed',
  'first batch completes when its only Transfer is covered by a paid Payout'
);

select is(
  (select status::text from public.payout_batches where reference_period_start = '2026-08-11'),
  'processing',
  'second batch remains processing while one Transfer lacks bank coverage'
);

do $$ begin
  perform public.record_automatic_stripe_payout_v1(
    'po_auto_many_2', 'acct_tes_local_weekly_payout_fixture', 8000, 'brl',
    'paid', 'completed', 'evt_auto_many_2_paid', '2026-08-27 10:00:00+00',
    'txn_auto_payout_2', 'card', '2026-08-28 10:00:00+00'
  );
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_many_2', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_auto_many_b2','source','py_auto_many_b2','amount',8000,'net',8000,'currency','brl','available_on',1787721600)
    ), '2026-08-27 10:01:00+00'
  );
end $$;

select is(
  (select count(distinct allocation.stripe_payout_id)::integer
    from public.stripe_payout_transfer_allocations allocation
    where allocation.payout_batch_therapist_id = (
      select id from public.payout_batch_therapists group_row
      where group_row.payout_batch_id = (
        select id from public.payout_batches where reference_period_start = '2026-08-11'
      )
    )),
  2,
  'one weekly group can be split across multiple automatic Payouts'
);

select is(
  (select status::text from public.payout_batches where reference_period_start = '2026-08-11'),
  'completed',
  'split batch completes only after all Transfers receive paid coverage'
);

select ok(
  (select bool_and(automatic and payout_batch_id is null
      and payout_batch_therapist_id is null and idempotency_key is null)
    from public.stripe_payouts where stripe_payout_id like 'po_auto_many_%'),
  'automatic Payouts require no TES metadata linkage'
);

select is(
  (select count(*)::integer from public.financial_ledger_entries
    where source_table = 'stripe_transfers'
      and source_id in (
        select id from public.stripe_transfers
        where session_payment_id in (
          'fa100000-0000-4000-8000-000000000001',
          'fb100000-0000-4000-8000-000000000001',
          'fb100000-0000-4000-8000-000000000002'
        )
      )),
  3,
  'Payout attribution creates no second ledger debit'
);

do $$ begin
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_many_1', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_auto_many_a','source','py_auto_many_a','amount',9600,'net',9600,'currency','brl','available_on',1787635200),
      jsonb_build_object('id','txn_auto_many_b1','source','py_auto_many_b1','amount',8000,'net',8000,'currency','brl','available_on',1787635200)
    ), '2026-08-27 10:02:00+00'
  );
end $$;
select is(
  (select count(*)::integer from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where payout.stripe_payout_id = 'po_auto_many_1'),
  2,
  'duplicate Balance Transaction reconciliation is idempotent'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'stripe_payout_transfer_allocations'
      and indexdef like 'CREATE UNIQUE INDEX% (stripe_transfer_id)'
  ),
  'one Transfer balance transaction can belong to only one automatic Payout'
);

do $$ begin
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_many_2', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_temporarily_unknown','source','py_temporarily_unknown','amount',8000,'net',8000,'currency','brl','available_on',1787721600)
    ), '2026-08-27 10:03:00+00'
  );
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_many_2', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_auto_many_b2','source','py_auto_many_b2','amount',8000,'net',8000,'currency','brl','available_on',1787721600)
    ), '2026-08-27 10:04:00+00'
  );
end $$;

select is(
  (select status from public.payout_operational_incidents
    where incident_key = 'automatic-payout:' || (
      select id::text from public.stripe_payouts where stripe_payout_id = 'po_auto_many_2'
    ) || ':allocation'),
  'resolved',
  'a corrected authoritative reconciliation resolves its prior incident'
);

do $$ begin
  perform public.record_automatic_stripe_payout_v1(
    'po_auto_unmatched', 'acct_tes_local_weekly_payout_fixture', 500, 'brl',
    'paid', 'completed', 'evt_auto_unmatched_paid', '2026-08-28 10:00:00+00',
    'txn_auto_payout_unmatched', 'card', '2026-08-29 10:00:00+00'
  );
  perform public.reconcile_automatic_stripe_payout_v1(
    'po_auto_unmatched', 'acct_tes_local_weekly_payout_fixture',
    jsonb_build_array(
      jsonb_build_object('id','txn_unknown','source','py_unknown','amount',500,'net',500,'currency','brl','available_on',1787808000)
    ), '2026-08-28 10:01:00+00'
  );
end $$;
select is(
  (select allocation_status from public.stripe_payouts where stripe_payout_id = 'po_auto_unmatched'),
  'pending',
  'unmatched automatic balance remains fail-closed'
);

select ok(
  exists (
    select 1 from public.payout_operational_incidents
    where incident_type = 'automatic_payout_reconciliation_required'
  ),
  'unmatched automatic balance opens an operational incident'
);

select is(
  (select count(*)::integer from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_type = 'stripe_payout'),
  2,
  'only fully reconciled paid Payouts notify bank success'
);

select is(
  (public.record_automatic_stripe_payout_v1(
    'po_auto_many_1', 'acct_tes_local_weekly_payout_fixture', 17600, 'brl',
    'failed', 'completed', 'evt_auto_many_1_failed', '2026-08-29 10:00:00+00',
    'txn_auto_payout_1', 'card', '2026-08-27 10:00:00+00',
    'bank_account_disabled', 'Conta externa indisponível.'
  )->>'failedAfterPaid')::boolean,
  true,
  'late failure after paid is accepted authoritatively'
);

select is(
  (select count(*)::integer from public.email_outbox
    where action_key = 'therapist_payout_failed_after_paid'),
  1,
  'late failure sends one corrective therapist communication'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.stripe_payout_transfer_allocations'::regclass)
  and not has_table_privilege('anon', 'public.stripe_payout_transfer_allocations', 'SELECT')
  and not has_table_privilege('authenticated', 'public.stripe_payout_transfer_allocations', 'SELECT'),
  'allocation table has restrictive RLS and no browser grants'
);

select * from finish();
rollback;
