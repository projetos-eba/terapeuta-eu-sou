begin;

select plan(47);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_payout_scheduler_failure_v1(uuid, uuid, text, text, uuid, timestamptz)',
    'EXECUTE'
  ),
  'service role can record an owned scheduler failure'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_payout_scheduler_failure_v1(uuid, uuid, text, text, uuid, timestamptz)',
    'EXECUTE'
  ),
  'authenticated users cannot mutate scheduler failure state'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.set_weekly_payout_scheduler_active_v1(boolean)',
    'EXECUTE'
  ),
  'service role can pause the fixed weekly scheduler job'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.set_weekly_payout_scheduler_active_v1(boolean)',
    'EXECUTE'
  ),
  'authenticated users cannot change scheduler activation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.resolve_payout_operational_incident_v1(text, timestamptz)',
    'EXECUTE'
  ),
  'service role can resolve a recovered worker incident'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.resolve_payout_operational_incident_v1(text, timestamptz)',
    'EXECUTE'
  ),
  'authenticated users cannot resolve payout incidents'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.rearm_definitive_payout_transfer_v1(uuid, uuid)',
    'EXECUTE'
  ),
  'service role can explicitly rearm a definitive terminal Transfer rejection'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.rearm_definitive_payout_transfer_v1(uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot rearm terminal Transfer rejections'
);

select public.record_payout_operational_incident_v1(
  'batch:test:worker:process_payout_batch',
  'process_payout_batch_failed',
  'critical'
);

select is(
  public.resolve_payout_operational_incident_v1(
    'batch:test:worker:process_payout_batch',
    '2097-01-13T05:00:00Z'
  ),
  true,
  'successful recovery resolves the matching open worker incident'
);

select is(
  (select status::text from public.payout_operational_incidents
    where incident_key = 'batch:test:worker:process_payout_batch'),
  'resolved',
  'resolved worker incident remains available as immutable audit history'
);

select is(
  public.resolve_payout_operational_incident_v1(
    'batch:test:worker:process_payout_batch',
    '2097-01-13T05:01:00Z'
  ),
  false,
  'repeating resolution is idempotent'
);

update public.therapist_connect_accounts
set is_current = false,
    disabled_reason = coalesce(disabled_reason, 'test_replaced'),
    updated_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and is_current;

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, account_generation, is_current,
  onboarding_status, details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, payout_status, payout_schedule_interval,
  operational_status, disabled_reason
) values (
  'f8500000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_frozen_generation', 2000, false,
  'ready', true, false, true, 'active', 'enabled', 'daily', 'ready',
  'test_replaced_after_batch'
), (
  'f8500000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'acct_current_generation', 2001, true,
  'ready', true, false, true, 'active', 'enabled', 'daily', 'ready', null
);

create temporary table payout_claim_fixture (
  fixture_index integer primary key,
  booking_id uuid not null,
  payment_id uuid not null,
  item_id uuid not null
) on commit drop;

insert into payout_claim_fixture (fixture_index, booking_id, payment_id, item_id)
select
  fixture_index,
  ('f8510000-0000-4000-8000-' || lpad(fixture_index::text, 12, '0'))::uuid,
  ('f8520000-0000-4000-8000-' || lpad(fixture_index::text, 12, '0'))::uuid,
  ('f8550000-0000-4000-8000-' || lpad(fixture_index::text, 12, '0'))::uuid
from generate_series(1, 13) fixture_index;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status, meeting_provider
)
select
  fixture.booking_id,
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2097-01-01T12:00:00Z'::timestamptz + make_interval(hours => fixture.fixture_index * 2),
  '2097-01-01T12:50:00Z'::timestamptz + make_interval(hours => fixture.fixture_index * 2),
  'America/Sao_Paulo', 'confirmed', 'paid', 'zoom'
from payout_claim_fixture fixture;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  transfer_status, eligible_at, stripe_charge_id, stripe_balance_transaction_id,
  stripe_balance_status, stripe_balance_available_on, stripe_balance_checked_at
)
select
  fixture.payment_id, fixture.booking_id,
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500, 'paid', 'batched',
  '2097-01-02T12:00:00Z',
  'ch_frozen_' || fixture.fixture_index,
  'txn_frozen_' || fixture.fixture_index,
  'available', '2097-01-02T11:00:00Z', '2097-01-02T12:00:00Z'
from payout_claim_fixture fixture
cross join lateral (
  select id from public.financial_policy_versions where is_active limit 1
) policy;

insert into public.payout_batches (
  id, reference_period_start, reference_period_end, cutoff_at, status,
  item_count, therapist_count, gross_amount_cents, therapist_amount_cents,
  platform_gross_commission_cents
) values (
  'f8530000-0000-4000-8000-000000000001',
  '2097-01-01', '2097-01-07', '2097-01-08T05:00:00Z', 'open',
  13, 1, 130000, 110500, 19500
);

insert into public.payout_batch_therapists (
  id, payout_batch_id, therapist_profile_id, connect_account_id,
  item_count, total_amount_cents, status
) values (
  'f8540000-0000-4000-8000-000000000001',
  'f8530000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f8500000-0000-4000-8000-000000000001',
  13, 110500, 'reserved'
);

insert into public.payout_batch_items (
  id, payout_batch_id, payout_batch_therapist_id, session_payment_id,
  booking_id, therapist_profile_id, amount_cents, status
)
select
  fixture.item_id,
  'f8530000-0000-4000-8000-000000000001',
  'f8540000-0000-4000-8000-000000000001',
  fixture.payment_id, fixture.booking_id,
  'c1000000-0000-4000-8000-000000000001', 8500, 'reserved'
from payout_claim_fixture fixture;

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    'f8530000-0000-4000-8000-000000000001',
    'f8560000-0000-4000-8000-000000000001', 10, 5, 'test'
  )),
  10,
  'the first claim returns exactly ten unique items with two account generations present'
);

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    'f8530000-0000-4000-8000-000000000001',
    'f8560000-0000-4000-8000-000000000002', 10, 5, 'test'
  )),
  3,
  'the second claim returns the remaining three items'
);

select is(
  (select count(*)::integer from public.stripe_transfers transfer
    join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
    where item.payout_batch_id = 'f8530000-0000-4000-8000-000000000001'),
  13,
  'one local Transfer intention exists per batch item'
);

select is(
  (select count(*)::integer from public.stripe_transfers transfer
    join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
    where item.payout_batch_id = 'f8530000-0000-4000-8000-000000000001'
      and transfer.connect_account_id = 'f8500000-0000-4000-8000-000000000001'),
  13,
  'all Transfer intentions retain the account frozen in the therapist group'
);

select is(
  (select count(*)::integer from public.stripe_transfers transfer
    join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
    where item.payout_batch_id = 'f8530000-0000-4000-8000-000000000001'
      and transfer.connect_account_id = 'f8500000-0000-4000-8000-000000000002'),
  0,
  'no item is redirected to the current replacement account'
);

select is(
  (select count(distinct idempotency_key)::integer from public.stripe_transfers transfer
    join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
    where item.payout_batch_id = 'f8530000-0000-4000-8000-000000000001'),
  13,
  'every item starts with one provider idempotency key'
);

create temporary table payout_retry_key_fixture as
select idempotency_key
from public.stripe_transfers
where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    'f8530000-0000-4000-8000-000000000001',
    'f8560000-0000-4000-8000-000000000003', 10, 5, 'test'
  )),
  0,
  'an immediate replay cannot claim pending items again'
);

select is(
  public.fail_payout_transfer_v1(
    (select id from public.stripe_transfers
      where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
    'f8560000-0000-4000-8000-000000000001',
    'blocked', 'balance_insufficient', 'temporary balance shortage'
  ),
  'failed',
  'database defense converts a provider balance shortage into a retryable failure'
);

select is(
  (select status::text from public.payout_batch_items
    where id = 'f8550000-0000-4000-8000-000000000001'),
  'failed',
  'a temporary balance shortage does not terminally block the batch item'
);

select is(
  (select transfer_status::text from public.session_payments
    where id = 'f8520000-0000-4000-8000-000000000001'),
  'transfer_pending',
  'a temporary balance shortage remains active for the therapist'
);

select ok(
  (select next_retry_at between updated_at + interval '14 minutes 55 seconds'
      and updated_at + interval '15 minutes 5 seconds'
    from public.stripe_transfers
    where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
  'the first Transfer failure uses the bounded fifteen-minute retry backoff'
);

update public.stripe_transfers
set next_retry_at = now() - interval '1 second'
where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    'f8530000-0000-4000-8000-000000000001',
    'f8560000-0000-4000-8000-000000000003', 1, 5, 'test'
  )),
  1,
  'a definitive balance rejection can be claimed after its backoff'
);

select isnt(
  (select idempotency_key from public.stripe_transfers
    where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
  (select idempotency_key from payout_retry_key_fixture),
  'a definitive rejection rotates the provider idempotency key'
);

select is(
  (select attempt_count from public.stripe_transfers
    where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
  2,
  'the rotated retry preserves the bounded attempt counter'
);

update public.stripe_transfers
set status = 'failed', attempt_count = 4,
    failure_code = 'balance_insufficient',
    stripe_transfer_id = null, lease_owner = null, lease_expires_at = null,
    next_retry_at = null
where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001';
update public.payout_batch_items
set status = 'failed'
where id = 'f8550000-0000-4000-8000-000000000001';

select is(
  (public.rearm_definitive_payout_transfer_v1(
    (select id from public.stripe_transfers
      where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
    'f8530000-0000-4000-8000-000000000001'
  )->>'rearmed')::boolean,
  true,
  'an operator can rearm only a definitive terminal rejection without provider evidence'
);

select ok(
  (select attempt_count = 0 and retry_cycle = 1
    from public.stripe_transfers
    where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
  'manual rearm starts a new bounded retry cycle'
);

select is(
  (select count(*)::integer from public.claim_payout_transfer_items_v1(
    'f8530000-0000-4000-8000-000000000001',
    'f8560000-0000-4000-8000-000000000004', 1, 5, 'test'
  )),
  1,
  'a rearmed definitive rejection is claimable exactly once'
);

select like(
  (select idempotency_key from public.stripe_transfers
    where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
  '%:cycle:1:attempt:1:v2',
  'a rearmed Transfer uses a fresh deterministic provider idempotency namespace'
);

select throws_ok(
  $$ select public.rearm_definitive_payout_transfer_v1(
    (select id from public.stripe_transfers
      where payout_batch_item_id = 'f8550000-0000-4000-8000-000000000001'),
    'f8530000-0000-4000-8000-000000000001'
  ) $$,
  'PAYOUT_TRANSFER_REARM_NOT_SAFE',
  'a pending rearmed Transfer cannot be rearmed again'
);

insert into public.payout_scheduler_runs (
  id, business_date, reference_period_start, reference_period_end, cutoff_at,
  payout_batch_id, status, worker_id, lease_expires_at, attempts
) values (
  'f8570000-0000-4000-8000-000000000001',
  '2097-01-13', '2097-01-06', '2097-01-12', '2097-01-13T05:00:00Z',
  'f8530000-0000-4000-8000-000000000001', 'running',
  'f8580000-0000-4000-8000-000000000001', '2097-01-13T05:05:00Z', 1
);

select is(
  (public.record_payout_scheduler_failure_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8580000-0000-4000-8000-000000000001',
    'supabase_http_500', E'claim failed\ninternal detail',
    'f8590000-0000-4000-8000-000000000001', '2097-01-13T05:01:00Z'
  )->>'consecutiveFailures')::integer,
  1,
  'the first owned failure is recorded'
);

select is(
  public.claim_weekly_payout_scheduler_run_v1(
    '2097-01-13T05:02:00Z', 'f8580000-0000-4000-8000-000000000002', 5
  )->>'reason',
  'backoff_active',
  'a scheduler tick during backoff does not acquire the run'
);

select is(
  (select attempts from public.payout_scheduler_runs
    where id = 'f8570000-0000-4000-8000-000000000001'),
  1,
  'backoff ticks do not increment attempts'
);

select is(
  (public.claim_weekly_payout_scheduler_run_v1(
    '2097-01-13T05:16:00Z', 'f8580000-0000-4000-8000-000000000002', 5
  )->>'acquired')::boolean,
  true,
  'the run can be reacquired after the first backoff'
);

select is(
  (public.record_payout_scheduler_failure_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8580000-0000-4000-8000-000000000002',
    'worker_failure', 'second',
    'f8590000-0000-4000-8000-000000000002', '2097-01-13T05:17:00Z'
  )->>'consecutiveFailures')::integer,
  2,
  'the second failure applies the thirty-minute backoff'
);

select is(
  (public.claim_weekly_payout_scheduler_run_v1(
    '2097-01-13T05:48:00Z', 'f8580000-0000-4000-8000-000000000003', 5
  )->>'acquired')::boolean,
  true,
  'the run can be reacquired after the second backoff'
);

select is(
  (public.record_payout_scheduler_failure_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8580000-0000-4000-8000-000000000003',
    'worker_failure', 'third',
    'f8590000-0000-4000-8000-000000000003', '2097-01-13T05:49:00Z'
  )->>'consecutiveFailures')::integer,
  3,
  'the third failure applies the sixty-minute backoff'
);

select is(
  (public.claim_weekly_payout_scheduler_run_v1(
    '2097-01-13T06:50:00Z', 'f8580000-0000-4000-8000-000000000004', 5
  )->>'acquired')::boolean,
  true,
  'the run can be reacquired after the third backoff'
);

select is(
  (public.record_payout_scheduler_failure_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8580000-0000-4000-8000-000000000004',
    'worker_failure', 'fourth',
    'f8590000-0000-4000-8000-000000000004', '2097-01-13T06:51:00Z'
  )->>'circuitOpen')::boolean,
  true,
  'the fourth failure opens the circuit'
);

select is(
  (select status::text from public.payout_scheduler_runs
    where id = 'f8570000-0000-4000-8000-000000000001'),
  'failed',
  'an open circuit releases the running scheduler run as failed'
);

select is(
  (select count(*)::integer from public.payout_operational_incidents
    where incident_key = 'scheduler:f8570000-0000-4000-8000-000000000001:worker-circuit-open'
      and status = 'open' and severity = 'critical'),
  1,
  'the circuit opens one deduplicated critical incident'
);

select throws_ok(
  $$ select public.resume_failed_payout_scheduler_run_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8530000-0000-4000-8000-000000000099', '2097-01-13T07:00:00Z'
  ) $$,
  'PAYOUT_SCHEDULER_BATCH_MISMATCH',
  'manual resume fails closed for a different batch'
);

select is(
  (public.resume_failed_payout_scheduler_run_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8530000-0000-4000-8000-000000000001', '2097-01-13T07:00:00Z'
  )->>'resumed')::boolean,
  true,
  'manual resume reopens only the same immutable run and batch'
);

select is(
  (public.claim_weekly_payout_scheduler_run_v1(
    '2097-01-13T07:01:00Z', 'f8580000-0000-4000-8000-000000000005', 5
  )->>'acquired')::boolean,
  true,
  'a resumed run can be reacquired outside the original start window'
);

select is(
  (public.record_payout_scheduler_progress_v1(
    'f8570000-0000-4000-8000-000000000001',
    'f8580000-0000-4000-8000-000000000005',
    'f8590000-0000-4000-8000-000000000005', '2097-01-13T07:02:00Z'
  )->>'recorded')::boolean,
  true,
  'owned progress is acknowledged'
);

select is(
  (select consecutive_failures from public.payout_scheduler_runs
    where id = 'f8570000-0000-4000-8000-000000000001'),
  0,
  'acknowledged progress resets consecutive failures'
);

select is(
  (select status::text from public.payout_operational_incidents
    where incident_key = 'scheduler:f8570000-0000-4000-8000-000000000001:worker-circuit-open'),
  'resolved',
  'manual recovery resolves the circuit incident'
);

select * from finish();

rollback;
