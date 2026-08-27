begin;

select plan(13);

select ok(
  has_function_privilege(
    'service_role',
    'public.retire_therapist_connect_account_v1(text, text, timestamptz, timestamptz)',
    'EXECUTE'
  ),
  'service role can execute the internal closure transition'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.retire_therapist_connect_account_v1(text, text, timestamptz, timestamptz)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the internal closure transition'
);

update public.therapist_connect_accounts
set is_current = false,
    disabled_reason = coalesce(disabled_reason, 'test_replaced'),
    updated_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and is_current;

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, account_generation,
  onboarding_status, details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, payout_status, payout_schedule_interval,
  operational_status
) values (
  'f8400000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_closure_history_test', 1000,
  'ready', true, false, true,
  'active', 'enabled', 'daily', 'ready'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status, meeting_provider
) values (
  'f8410000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2042-01-10T13:00:00Z', '2042-01-10T13:50:00Z',
  'America/Sao_Paulo', 'confirmed', 'paid', 'zoom'
), (
  'f8410000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2042-01-10T15:00:00Z', '2042-01-10T15:50:00Z',
  'America/Sao_Paulo', 'confirmed', 'paid', 'zoom'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  transfer_status, eligible_at, stripe_charge_id, stripe_balance_transaction_id
)
select
  'f8420000-0000-4000-8000-000000000001',
  'f8410000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 10000, 1500, 1500, 8500, 'paid', 'batched',
  '2042-01-11T12:00:00Z', 'ch_closure_recovery', 'txn_closure_recovery'
from public.financial_policy_versions
where is_active
limit 1;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  transfer_status, eligible_at, stripe_charge_id, stripe_balance_transaction_id
)
select
  'f8420000-0000-4000-8000-000000000002',
  'f8410000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 12000, 1500, 1800, 10200, 'paid', 'transferred',
  '2042-01-11T12:00:00Z', 'ch_closure_historical', 'txn_closure_historical'
from public.financial_policy_versions
where is_active
limit 1;

insert into public.payout_batches (
  id, reference_period_start, reference_period_end, cutoff_at, status
) values (
  'f8430000-0000-4000-8000-000000000001',
  '2042-01-01', '2042-01-07', '2042-01-11T12:00:00Z', 'open'
);

insert into public.payout_batch_therapists (
  id, payout_batch_id, therapist_profile_id, connect_account_id,
  item_count, total_amount_cents, status
) values (
  'f8440000-0000-4000-8000-000000000001',
  'f8430000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f8400000-0000-4000-8000-000000000001', 1, 8500, 'reserved'
);

insert into public.payout_batch_items (
  id, payout_batch_id, payout_batch_therapist_id, session_payment_id,
  booking_id, therapist_profile_id, amount_cents, status
) values (
  'f8450000-0000-4000-8000-000000000001',
  'f8430000-0000-4000-8000-000000000001',
  'f8440000-0000-4000-8000-000000000001',
  'f8420000-0000-4000-8000-000000000001',
  'f8410000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 8500, 'reserved'
), (
  'f8450000-0000-4000-8000-000000000002',
  'f8430000-0000-4000-8000-000000000001',
  'f8440000-0000-4000-8000-000000000001',
  'f8420000-0000-4000-8000-000000000002',
  'f8410000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001', 10200, 'transferred'
);

insert into public.stripe_transfers (
  payout_batch_item_id, session_payment_id, therapist_profile_id,
  connect_account_id, stripe_transfer_id, idempotency_key, amount_cents,
  status, transferred_at
) values (
  'f8450000-0000-4000-8000-000000000002',
  'f8420000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'f8400000-0000-4000-8000-000000000001',
  'tr_closure_historical', 'tes:closure:historical', 10200,
  'transferred', '2042-01-11T12:30:00Z'
);

select is(
  (public.retire_therapist_connect_account_v1(
    'acct_closure_history_test', 'evt_connect_closed_test',
    '2042-01-11T13:00:00Z', '2042-01-11T13:01:00Z'
  )->>'requeuedCount')::integer,
  1,
  'closure requeues a reserved item only when no Transfer exists'
);

select is(
  (select is_current from public.therapist_connect_accounts
    where id = 'f8400000-0000-4000-8000-000000000001'),
  false,
  'closed account becomes historical'
);

select is(
  (select transfer_status::text from public.session_payments
    where id = 'f8420000-0000-4000-8000-000000000001'),
  'eligible',
  'platform-held value waits for a new current account'
);

select is(
  (select status::text from public.payout_batch_items
    where id = 'f8450000-0000-4000-8000-000000000001'),
  'removed',
  'released item remains auditable and is not reused as a Transfer'
);

select is(
  (select status::text from public.payout_batch_items
    where id = 'f8450000-0000-4000-8000-000000000002'),
  'transferred',
  'item with a created Transfer remains in its historical state'
);

select is(
  (select connect_account_id::text from public.stripe_transfers
    where stripe_transfer_id = 'tr_closure_historical'),
  'f8400000-0000-4000-8000-000000000001',
  'created Transfer is never redirected to a future account'
);

select is(
  (select transfer_status::text from public.session_payments
    where id = 'f8420000-0000-4000-8000-000000000002'),
  'transferred',
  'historical Transfer remains in reconciliation rather than returning to eligibility'
);

select is(
  public.retire_therapist_connect_account_v1(
    'acct_closure_history_test', 'evt_connect_closed_duplicate',
    '2042-01-11T13:00:00Z', '2042-01-11T13:02:00Z'
  )->>'reason',
  'already_historical',
  'duplicate closure is idempotent'
);

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, account_generation,
  onboarding_status, details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, payout_status, payout_schedule_interval,
  operational_status
) values (
  'f8400000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'acct_closure_current_test', 1001,
  'ready', true, false, true,
  'active', 'enabled', 'daily', 'ready'
);

select is(
  (select count(*)::integer from public.therapist_connect_accounts
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and is_current),
  1,
  'one new current account may follow the historical closed account'
);

select is(
  (select account_generation from public.therapist_connect_accounts
    where id = 'f8400000-0000-4000-8000-000000000002'),
  1001,
  'new current account has a distinct generation'
);

select ok(
  exists (
    select 1 from public.therapist_connect_account_snapshots
    where connect_account_id = 'f8400000-0000-4000-8000-000000000001'
      and stripe_event_id = 'evt_connect_closed_test'
  ),
  'closure writes a sanitized historical snapshot'
);

select * from finish();

rollback;
