begin;

select plan(74);

select has_table('public', 'session_payment_setups', 'V10 setup bindings exist');
select has_table('public', 'session_payment_schedules', 'V10 charge schedules exist');
select has_table('public', 'session_promotion_reservations', 'V10 promotion reservations exist');
select has_table('public', 'session_transfer_jobs', 'V10 direct Transfer outbox exists');
select has_table('public', 'therapist_financial_debts', 'therapist debt principal exists');
select has_table('public', 'therapist_financial_debt_events', 'therapist debt events exist');
select has_table('public', 'therapist_financial_debt_allocations', 'therapist debt allocations exist');

select has_trigger(
  'public',
  'financial_policy_versions',
  'default_financial_policy_key_v10',
  'legacy policy writers receive a policy key without changing their INSERT contract'
);
select is(
  (select count(*)::integer from public.financial_policy_versions where policy_key is null),
  0,
  'all financial policies retain a non-null stable policy key'
);

select is(
  (
    select is_active
    from public.financial_policy_versions
    where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
  ),
  false,
  'V10 policy is installed but remains inactive'
);

select is(
  (
    select count(*)::integer
    from public.financial_policy_versions
    where is_active
      and policy_key = 'tes-payments-v9-settlement-only'
  ),
  1,
  'V9 remains the only active financial policy'
);

select is(
  (
    select count(*)::integer
    from public.session_payments as payment
    join public.financial_policy_versions as policy
      on policy.id = payment.policy_version_id
    where policy.policy_key = 'tes-payments-v9-settlement-only'
      and payment.payment_flow_version <> 'v9'
  ),
  0,
  'existing session payments remain V9 after the additive migration'
);

select ok(
  not has_table_privilege('authenticated', 'public.session_payment_setups', 'SELECT'),
  'authenticated users cannot read SetupIntent bindings'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_payment_schedules', 'SELECT'),
  'authenticated users cannot read charge schedules'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_promotion_reservations', 'SELECT'),
  'authenticated users cannot read promotion reservations'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_transfer_jobs', 'SELECT'),
  'authenticated users cannot read Transfer jobs'
);
select ok(
  not has_table_privilege('authenticated', 'public.therapist_financial_debts', 'SELECT'),
  'authenticated users cannot read therapist debt principal'
);
select ok(
  has_table_privilege('service_role', 'public.session_payment_setups', 'SELECT'),
  'service role can read private setup bindings'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)',
    'EXECUTE'
  ),
  'service role can atomically confirm a V10 payment and enqueue its Transfer'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke V10 payment confirmation directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.resume_session_transfer_job_v10(uuid,integer)',
    'EXECUTE'
  ),
  'service role can explicitly resume an unprepared failed V10 Transfer job'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.resume_session_transfer_job_v10(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot resume failed V10 Transfer jobs'
);

-- The local browser seed already has a current account for this therapist.
-- Keep that historical row intact within this rolled-back test transaction.
update public.therapist_connect_accounts
set is_current = false
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and is_current;

-- Browser homologation may leave legitimate open debts for this seeded
-- therapist. Settle them only inside this rolled-back test transaction so the
-- fixture below proves its own 1,000-cent offset without depending on ambient
-- local data.
update public.therapist_financial_debts
set open_amount_cents = 0,
    recovered_amount_cents = principal_amount_cents,
    status = 'settled',
    closed_at = coalesce(closed_at, '2098-09-01 11:59:00+00'::timestamptz),
    updated_at = '2098-09-01 11:59:00+00'::timestamptz
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and open_amount_cents > 0;

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status,
  payout_status,
  payout_schedule_interval,
  is_current,
  account_generation
)
values (
  'b1140000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_114',
  'ready',
  true,
  true,
  true,
  'active',
  'ready',
  'enabled',
  'daily',
  true,
  114
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
)
values
  (
    'b1140000-0000-4000-8000-000000000011',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2098-09-14 13:00:00+00',
    '2098-09-14 13:50:00+00',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'b1140000-0000-4000-8000-000000000012',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2098-09-15 13:00:00+00',
    '2098-09-15 13:50:00+00',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  );

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  financial_status,
  service_status,
  transfer_status,
  payment_flow_version,
  connect_account_id_snapshot,
  stripe_connect_account_id_snapshot,
  payment_due_at
)
select
  payment.id,
  payment.booking_id,
  payment.patient_profile_id,
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'd1000000-0000-4000-8000-000000000001'::uuid,
  policy.id,
  10000,
  1500,
  1500,
  8500,
  'pending'::public.session_financial_status,
  'scheduled'::public.session_service_status,
  'not_eligible'::public.session_transfer_status,
  'v10',
  'b1140000-0000-4000-8000-000000000001'::uuid,
  'acct_test_v10_114',
  payment.due_at
from (
  values
    (
      'b1140000-0000-4000-8000-000000000021'::uuid,
      'b1140000-0000-4000-8000-000000000011'::uuid,
      'b1000000-0000-4000-8000-000000000001'::uuid,
      '2098-09-13 13:00:00+00'::timestamptz
    ),
    (
      'b1140000-0000-4000-8000-000000000022'::uuid,
      'b1140000-0000-4000-8000-000000000012'::uuid,
      'b1000000-0000-4000-8000-000000000002'::uuid,
      '2098-09-14 13:00:00+00'::timestamptz
    )
) as payment(id, booking_id, patient_profile_id, due_at)
cross join lateral (
  select id
  from public.financial_policy_versions
  where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
) as policy;

select is(
  (
    select count(*)::integer
    from public.private_direct_transfer_session_payments_v1
    where id in (
      'b1140000-0000-4000-8000-000000000021',
      'b1140000-0000-4000-8000-000000000022'
    )
  ),
  2,
  'V10 payments are visible only in the direct-transfer compatibility surface'
);

select is(
  (
    select count(*)::integer
    from public.private_weekly_payout_session_payments_v1
    where id in (
      'b1140000-0000-4000-8000-000000000021',
      'b1140000-0000-4000-8000-000000000022'
    )
  ),
  0,
  'V10 payments are absent from the weekly-batch compatibility surface'
);

select throws_ok(
  $$
    update public.session_payments
    set payment_flow_version = 'v9'
    where id = 'b1140000-0000-4000-8000-000000000021'
  $$,
  '23514',
  'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE',
  'the V10/V9 policy family cannot be changed after insertion'
);

select is(
  public.register_session_payment_setup_v10(
    'b1140000-0000-4000-8000-000000000021',
    1,
    'test',
    'cus_test_v10_114',
    'seti_test_v10_114_1',
    'pm_test_shared_v10_114',
    'succeeded',
    'tes-card-off-session-v1',
    '2098-09-01 12:00:00+00',
    null
  ) ->> 'status',
  'succeeded',
  'the first booking version stores a succeeded off-session SetupIntent'
);

select is(
  public.register_session_payment_setup_v10(
    'b1140000-0000-4000-8000-000000000022',
    1,
    'test',
    'cus_test_v10_114',
    'seti_test_v10_114_2',
    'pm_test_shared_v10_114',
    'succeeded',
    'tes-card-off-session-v1',
    '2098-09-01 12:05:00+00',
    null
  ) ->> 'status',
  'succeeded',
  'a second reservation can bind another SetupIntent without replacing the first'
);

select is(
  (
    select count(*)::integer
    from public.session_payment_setups
    where stripe_payment_method_id = 'pm_test_shared_v10_114'
      and status = 'succeeded'
  ),
  2,
  'the same saved PaymentMethod may remain independently bound to two reservations'
);

select throws_ok(
  $$
    update public.session_payment_setups
    set status = 'processing'
    where stripe_setup_intent_id = 'seti_test_v10_114_1'
  $$,
  '23514',
  'SESSION_PAYMENT_SETUP_V10_TRANSITION_INVALID',
  'a succeeded SetupIntent binding cannot regress to processing'
);

-- Saving the card confirms the reservation through the checkout workflow.
-- That single operational transition increments the booking version once,
-- while the SetupIntent remains frozen against the pre-confirmation version.
update public.bookings
set status = 'confirmed'
where id = 'b1140000-0000-4000-8000-000000000011';

select is(
  public.schedule_session_payment_v10(
    'b1140000-0000-4000-8000-000000000021',
    (
      select id
      from public.session_payment_setups
      where stripe_setup_intent_id = 'seti_test_v10_114_1'
    ),
    '2098-09-13 13:00:00+00',
    'tes:v10:charge:b114-1',
    'fingerprint-b114-1'
  ) ->> 'status',
  'scheduled',
  'the T-24 charge schedule is created from the matching reservation setup'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.claim_due_session_payment_schedules_v10(
        '2098-09-13 13:01:00+00',
        'b1140000-0000-4000-8000-000000000031',
        10,
        5
      ) -> 'claims'
    ) as claim
    where claim ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000021'
  ),
  1,
  'the schedule worker claims the fixture payment exactly once with a lease'
);

select is(
  public.confirm_session_payment_and_enqueue_transfer_v10(
    'b1140000-0000-4000-8000-000000000021',
    'test',
    'pi_test_v10_114_1',
    'ch_test_v10_114_1',
    '2098-09-13 13:02:00+00',
    'evt_test_v10_114_1',
    '2098-09-13 13:02:00+00'
  ) ->> 'transferStatus',
  'transfer_pending',
  'payment confirmation immediately creates the direct Transfer obligation'
);

select is(
  (
    select count(*)::integer
    from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
      and stripe_source_charge_id = 'ch_test_v10_114_1'
      and transfer_amount_cents = 8500
  ),
  1,
  'the Transfer outbox is linked to the original Charge and frozen amount'
);

select lives_ok(
  $$
    select public.confirm_session_payment_and_enqueue_transfer_v10(
      'b1140000-0000-4000-8000-000000000021',
      'test',
      'pi_test_v10_114_1',
      'ch_test_v10_114_1',
      '2098-09-13 13:02:00+00',
      'evt_test_v10_114_1',
      '2098-09-13 13:02:00+00'
    )
  $$,
  'reprocessing the same Stripe confirmation is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
  ),
  1,
  'idempotent confirmation leaves exactly one logical Transfer job'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.claim_session_transfer_jobs_v10(
        '2098-09-13 13:03:00+00',
        'b1140000-0000-4000-8000-000000000032',
        10,
        5
      ) -> 'claims'
    ) as claim
    where claim ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000021'
      and claim ->> 'bookingId' = 'b1140000-0000-4000-8000-000000000011'
      and claim ->> 'therapistProfileId' = 'c1000000-0000-4000-8000-000000000001'
      and claim ->> 'paymentIntentId' = 'pi_test_v10_114_1'
      and (claim ->> 'grossAmountCents')::integer = 10000
      and claim ->> 'stripeAccountId' = 'acct_test_v10_114'
      and claim ->> 'sourceChargeId' = 'ch_test_v10_114_1'
  ),
  1,
  'the direct Transfer worker receives every field required for Stripe preflight'
);

select is(
  public.fail_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
    'b1140000-0000-4000-8000-000000000032',
    'session_transfer_claim_validation_failed', false
  ) ->> 'status',
  'failed',
  'a definitive pre-provider claim failure records a failed job'
);

update public.session_payments
set admin_blocked_at = now()
where id = 'b1140000-0000-4000-8000-000000000021';

select is(
  public.resume_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
    1
  ) ->> 'resumed',
  'false',
  'an administratively blocked payment cannot resume a failed Transfer'
);

update public.session_payments
set admin_blocked_at = null
where id = 'b1140000-0000-4000-8000-000000000021';

select is(
  public.resume_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
    1
  ) ->> 'resumed',
  'true',
  'the operator may resume an unprepared claim-validation failure'
);

select is(
  (select attempt_count from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
  0,
  'the safe pre-provider failure resumes with first-attempt semantics'
);

select is(
  (select count(*)::integer from jsonb_array_elements(
    public.claim_session_transfer_jobs_v10(
      '2098-09-13 13:04:00+00',
      'b1140000-0000-4000-8000-000000000032', 10, 5
    ) -> 'claims'
  ) as claim where claim ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000021'
    and (claim ->> 'attemptCount')::integer = 1),
  1,
  'the resumed job is claimed once as a first provider attempt'
);

select throws_ok(
  $$
    update public.session_transfer_jobs
    set status = 'queued'
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
  $$,
  '23514',
  'SESSION_TRANSFER_JOB_V10_TRANSITION_INVALID',
  'a claimed Transfer job cannot regress to the queue'
);

insert into public.therapist_financial_debts (
  id, therapist_profile_id, session_payment_id, origin, reason_code,
  principal_amount_cents, open_amount_cents
) values (
  'b1140000-0000-4000-8000-000000000050',
  'c1000000-0000-4000-8000-000000000001',
  'b1140000-0000-4000-8000-000000000022',
  'refund', 'prior_refund_shortfall', 1000, 1000
);

select is(
  public.prepare_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
    'b1140000-0000-4000-8000-000000000032'
  ) ->> 'amountCents',
  '7500',
  'debt is offset atomically before the provider Transfer is created'
);

select is(
  (select open_amount_cents from public.therapist_financial_debts
    where id = 'b1140000-0000-4000-8000-000000000050'),
  0,
  'the oldest open therapist debt is fully settled by the Transfer obligation'
);

select is(
  (select count(*)::integer from public.therapist_financial_debt_allocations
    where session_transfer_job_id = (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021')),
  1,
  'one durable debt allocation is bound to the V10 Transfer job'
);

select is(
  (select amount_cents from public.stripe_transfers
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
  7500,
  'the provider Transfer contains only the amount remaining after debt offset'
);

select is(
  public.complete_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
    'b1140000-0000-4000-8000-000000000032',
    'tr_test_v10_114_1', 'py_test_v10_114_1',
    'txn_test_v10_114_1', '2098-09-14 13:00:00+00',
    '2098-09-13 13:04:00+00'
  ) ->> 'completed',
  'true',
  'the source-bound provider Transfer completes the local job'
);

select is(
  (select count(*)::integer from public.financial_ledger_entries
    where source_table = 'stripe_transfers'
      and source_id = (select id from public.stripe_transfers
        where session_payment_id = 'b1140000-0000-4000-8000-000000000021')
      and entry_type = 'transfer'),
  1,
  'Transfer completion records exactly one direct-transfer ledger debit'
);

select is(
  (select count(*)::integer from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
      and status = 'pending_source'),
  1,
  'a provider Transfer awaiting source availability remains explicitly pending'
);

select is(
  (
    select transfer_origin
    from public.stripe_transfers
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
  ),
  'session_direct',
  'a V10 Transfer is valid without payout_batch_item_id'
);

select lives_ok(
  $$
    select public.record_automatic_stripe_payout_v1(
      'po_test_v10_114_1',
      'acct_test_v10_114',
      7500,
      'brl',
      'pending',
      'completed',
      'evt_test_v10_114_payout_pending',
      '2098-09-14 13:05:00+00',
      'txn_test_v10_114_payout_debit',
      'card',
      '2098-09-15 13:00:00+00'
    )
  $$,
  'a connected automatic Payout can be recorded for a direct Transfer'
);

select lives_ok(
  $$
    select public.reconcile_automatic_stripe_payout_v1(
      'po_test_v10_114_1',
      'acct_test_v10_114',
      jsonb_build_array(jsonb_build_object(
        'id', 'txn_test_v10_114_connected',
        'source', 'py_test_v10_114_1',
        'amount', 7500,
        'net', 7500,
        'currency', 'brl',
        'available_on', 4061538000,
        'type', 'payment',
        'reporting_category', 'transfer'
      )),
      '2098-09-14 13:06:00+00'
    )
  $$,
  'the direct Transfer is fully attributed from the connected Payout balance transaction'
);

select is(
  (select status::text from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
  'pending_source',
  'full allocation alone does not mark the therapist as paid before payout.paid'
);

select is(
  public.private_therapist_receipt_status_v2(
    'b1140000-0000-4000-8000-000000000021',
    '2098-09-14 13:06:00+00'
  ),
  'bank_pending',
  'the therapist receipt remains on its way to the bank before payout.paid'
);

select ok(
  (select allocation_origin = 'session_direct'
      and payout_batch_id is null
      and payout_batch_therapist_id is null
      and amount_cents = 7500
    from public.stripe_payout_transfer_allocations
    where stripe_transfer_id = (
      select id from public.stripe_transfers
      where session_payment_id = 'b1140000-0000-4000-8000-000000000021'
    )),
  'direct Transfer allocation is isolated from the legacy weekly batch'
);

select is(
  public.record_automatic_stripe_payout_v1(
    'po_test_v10_114_1',
    'acct_test_v10_114',
    7500,
    'brl',
    'paid',
    'completed',
    'evt_test_v10_114_payout_paid',
    '2098-09-14 13:07:00+00',
    'txn_test_v10_114_payout_debit',
    'card',
    '2098-09-15 13:00:00+00'
  ) ->> 'status',
  'paid',
  'payout.paid is accepted only after the direct Transfer has been attributed'
);

select is(
  (select status::text from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000021'),
  'transferred',
  'the direct Transfer reaches the paid state only after paid and fully reconciled Payout coverage'
);

select is(
  public.private_therapist_receipt_status_v2(
    'b1140000-0000-4000-8000-000000000021',
    '2098-09-14 13:08:00+00'
  ),
  'paid',
  'the therapist receipt becomes paid only with complete bank payout coverage'
);

select throws_ok(
  $$
    insert into public.stripe_transfers (
      payout_batch_item_id,
      session_payment_id,
      therapist_profile_id,
      connect_account_id,
      idempotency_key,
      amount_cents,
      status,
      transfer_origin,
      therapist_gross_amount_cents,
      debt_offset_amount_cents
    )
    values (
      null,
      'b1140000-0000-4000-8000-000000000022',
      'c1000000-0000-4000-8000-000000000001',
      'b1140000-0000-4000-8000-000000000001',
      'tes:v9:invalid-transfer:b114-2',
      8500,
      'pending',
      'weekly_batch',
      8500,
      0
    )
  $$,
  '23514',
  null,
  'a V9 weekly Transfer still requires payout_batch_item_id'
);

insert into public.payout_batches (
  id,
  reference_period_start,
  reference_period_end,
  cutoff_at,
  status
)
values (
  'b1140000-0000-4000-8000-000000000041',
  '2098-09-01',
  '2098-09-07',
  '2098-09-08 05:00:00+00',
  'open'
);

insert into public.payout_batch_therapists (
  id,
  payout_batch_id,
  therapist_profile_id,
  connect_account_id,
  item_count,
  total_amount_cents
)
values (
  'b1140000-0000-4000-8000-000000000042',
  'b1140000-0000-4000-8000-000000000041',
  'c1000000-0000-4000-8000-000000000001',
  'b1140000-0000-4000-8000-000000000001',
  0,
  0
);

select throws_ok(
  $$
    insert into public.payout_batch_items (
      payout_batch_id,
      payout_batch_therapist_id,
      session_payment_id,
      booking_id,
      therapist_profile_id,
      amount_cents
    )
    values (
      'b1140000-0000-4000-8000-000000000041',
      'b1140000-0000-4000-8000-000000000042',
      'b1140000-0000-4000-8000-000000000022',
      'b1140000-0000-4000-8000-000000000012',
      'c1000000-0000-4000-8000-000000000001',
      8500
    )
  $$,
  '23514',
  'V10_DIRECT_TRANSFER_CANNOT_ENTER_WEEKLY_BATCH',
  'the database rejects any attempt to place a V10 payment in a weekly batch'
);

select is(
  (
    select count(*)::integer
    from public.payout_batch_items
    where session_payment_id in (
      'b1140000-0000-4000-8000-000000000021',
      'b1140000-0000-4000-8000-000000000022'
    )
  ),
  0,
  'no V10 payment entered a weekly payout batch'
);

-- A full debt offset settles the therapist obligation without creating a
-- provider Transfer. The read model must not call it a bank-bound amount.
update public.bookings
set status = 'confirmed'
where id = 'b1140000-0000-4000-8000-000000000012';

select is(
  public.schedule_session_payment_v10(
    'b1140000-0000-4000-8000-000000000022',
    (
      select id
      from public.session_payment_setups
      where stripe_setup_intent_id = 'seti_test_v10_114_2'
    ),
    '2098-09-14 13:00:00+00',
    'tes:v10:charge:b114-2',
    'fingerprint-b114-2'
  ) ->> 'status',
  'scheduled',
  'the full-offset fixture has its own due charge schedule'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.claim_due_session_payment_schedules_v10(
        '2098-09-14 13:01:00+00',
        'b1140000-0000-4000-8000-000000000033',
        10,
        5
      ) -> 'claims'
    ) claim
    where claim ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000022'
  ),
  1,
  'the full-offset payment is claimed once for charging'
);

select is(
  public.confirm_session_payment_and_enqueue_transfer_v10(
    'b1140000-0000-4000-8000-000000000022',
    'test',
    'pi_test_v10_114_2',
    'ch_test_v10_114_2',
    '2098-09-14 13:02:00+00',
    'evt_test_v10_114_2',
    '2098-09-14 13:02:00+00'
  ) ->> 'transferStatus',
  'transfer_pending',
  'the confirmed full-offset payment creates its direct Transfer obligation'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.claim_session_transfer_jobs_v10(
        '2098-09-14 13:03:00+00',
        'b1140000-0000-4000-8000-000000000034',
        10,
        5
      ) -> 'claims'
    ) claim
    where claim ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000022'
  ),
  1,
  'the full-offset Transfer obligation is claimed once'
);

insert into public.therapist_financial_debts (
  id, therapist_profile_id, origin, reason_code,
  principal_amount_cents, open_amount_cents, opened_at
) values (
  'b1140000-0000-4000-8000-000000000051',
  'c1000000-0000-4000-8000-000000000001',
  'manual_adjustment', 'test_full_offset', 8500, 8500,
  '2098-09-14 13:02:30+00'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select set_config(
  'tes.test_payout_processing_before_full_offset',
  public.get_private_therapist_payouts_v2(
    date '2098-09-01', date '2098-09-30', null, 1, 500,
    'America/Sao_Paulo'
  ) #>> '{summary,payoutProcessingCents}',
  true
);
reset role;

select is(
  public.prepare_session_transfer_job_v10(
    (select id from public.session_transfer_jobs
      where session_payment_id = 'b1140000-0000-4000-8000-000000000022'),
    'b1140000-0000-4000-8000-000000000034'
  ) ->> 'amountCents',
  '0',
  'the full therapist amount is consumed by the debt offset'
);

select is(
  (select status::text from public.session_transfer_jobs
    where session_payment_id = 'b1140000-0000-4000-8000-000000000022'),
  'offset_only',
  'the no-transfer job closes in the explicit offset-only state'
);

select is(
  (select count(*)::integer from public.stripe_transfers
    where session_payment_id = 'b1140000-0000-4000-8000-000000000022'),
  0,
  'a full offset creates no Stripe Transfer intent'
);

select is(
  public.private_therapist_receipt_status_v2(
    'b1140000-0000-4000-8000-000000000022',
    '2098-09-14 13:04:00+00'
  ),
  'compensated',
  'the receipt status distinguishes compensation from a bank-bound Transfer'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select is(
  (
    select item ->> 'receiptStatus'
    from jsonb_array_elements(public.get_private_therapist_receipts_v2(
      date '2098-09-01', date '2098-09-30', null, null, null, 1, 500,
      'America/Sao_Paulo'
    ) -> 'items') item
    where item ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000022'
  ),
  'compensated',
  'the authenticated receipt list exposes the compensated state'
);

select is(
  (
    select (item ->> 'therapistNetAmountCents')::integer
    from jsonb_array_elements(public.get_private_therapist_receipts_v2(
      date '2098-09-01', date '2098-09-30', null, null, null, 1, 500,
      'America/Sao_Paulo'
    ) -> 'items') item
    where item ->> 'sessionPaymentId' = 'b1140000-0000-4000-8000-000000000022'
  ),
  0,
  'the compensated receipt has no amount on its way to the therapist bank'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(public.get_private_therapist_receipts_v2(
      date '2098-09-01', date '2098-09-30', null, null, null, 1, 500,
      'America/Sao_Paulo'
    ) -> 'statusDistribution') item
    where item ->> 'status' = 'compensated'
  ),
  0,
  'the zero-value compensation is absent from the status chart'
);

select is(
  (public.get_private_therapist_receipts_v2(
    date '2098-09-01', date '2098-09-30', null, null, null, 1, 500,
    'America/Sao_Paulo'
  ) #>> '{summary,processingCents}')::integer,
  0,
  'the compensated amount does not inflate receipts in processing'
);

select is(
  (public.get_private_therapist_payouts_v2(
    date '2098-09-01', date '2098-09-30', null, 1, 500,
    'America/Sao_Paulo'
  ) #>> '{summary,payoutProcessingCents}')::integer,
  current_setting('tes.test_payout_processing_before_full_offset')::integer - 8500,
  'the compensated amount is removed exactly once from payout processing totals'
);

select * from finish();

rollback;
