begin;

select plan(27);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_financial_overview_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private financial overview'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_financial_overview_v1(date,date,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the private financial overview'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_receipts_v1(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private receipts read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_receipts_v1(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the private receipts read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v1(date,date,text,integer,integer,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private payouts read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_payouts_v1(date,date,text,integer,integer,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the private payouts read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_connect_account_v1()',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private Connect account read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_connect_account_v1()',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the private Connect account read model'
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
  payment_status,
  meeting_provider,
  meeting_url,
  completed_at
) values
  (
    'f6100000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2038-01-10T13:00:00Z',
    '2038-01-10T13:50:00Z',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/finance-1',
    '2038-01-10T13:50:00Z'
  ),
  (
    'f6100000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2038-01-12T13:00:00Z',
    '2038-01-12T13:50:00Z',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/finance-2',
    '2038-01-12T13:50:00Z'
  ),
  (
    'f6100000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000007',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2038-01-14T13:00:00Z',
    '2038-01-14T13:50:00Z',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/finance-3',
    '2038-01-14T13:50:00Z'
  ),
  (
    'f6100000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000008',
    'c1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    '2038-01-16T13:00:00Z',
    '2038-01-16T13:50:00Z',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/finance-4',
    '2038-01-16T13:50:00Z'
  );

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  financial_status,
  transfer_status,
  paid_at,
  eligible_at,
  disputed_at,
  metadata
)
select
  payment.id::uuid,
  payment.booking_id::uuid,
  payment.patient_profile_id::uuid,
  payment.therapist_profile_id::uuid,
  payment.service_id::uuid,
  policy.id,
  payment.checkout_id,
  payment.intent_id,
  payment.gross_amount_cents,
  2000,
  payment.platform_gross_commission_cents,
  payment.therapist_amount_cents,
  payment.financial_status::public.session_financial_status,
  payment.transfer_status::public.session_transfer_status,
  payment.paid_at::timestamptz,
  payment.eligible_at::timestamptz,
  payment.disputed_at::timestamptz,
  payment.metadata
from (
  values
    (
      'f6200000-0000-4000-8000-000000000001',
      'f6100000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000005',
      'c1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'cs_finance_1',
      'pi_finance_1',
      10000,
      2000,
      8000,
      'paid',
      'transferred',
      '2038-01-10T13:51:00Z',
      '2038-01-17T13:51:00Z',
      null,
      '{"paymentMethodType":"card","paymentOrigin":"stripe_checkout"}'::jsonb
    ),
    (
      'f6200000-0000-4000-8000-000000000002',
      'f6100000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000006',
      'c1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'cs_finance_2',
      'pi_finance_2',
      5000,
      1000,
      4000,
      'partially_refunded',
      'waiting_safety_period',
      '2038-01-12T13:51:00Z',
      '2038-01-19T13:51:00Z',
      null,
      '{"payment_method_type":"pix"}'::jsonb
    ),
    (
      'f6200000-0000-4000-8000-000000000003',
      'f6100000-0000-4000-8000-000000000003',
      'b1000000-0000-4000-8000-000000000007',
      'c1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'cs_finance_3',
      'pi_finance_3',
      7000,
      1400,
      5600,
      'disputed',
      'blocked',
      '2038-01-14T13:51:00Z',
      '2038-01-21T13:51:00Z',
      '2038-01-15T10:00:00Z',
      '{}'::jsonb
    ),
    (
      'f6200000-0000-4000-8000-000000000004',
      'f6100000-0000-4000-8000-000000000004',
      'b1000000-0000-4000-8000-000000000008',
      'c1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000002',
      'cs_finance_4',
      'pi_finance_4',
      9000,
      1800,
      7200,
      'paid',
      'eligible',
      '2038-01-16T13:51:00Z',
      '2038-01-23T13:51:00Z',
      null,
      '{}'::jsonb
    )
) as payment(
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  checkout_id,
  intent_id,
  gross_amount_cents,
  platform_gross_commission_cents,
  therapist_amount_cents,
  financial_status,
  transfer_status,
  paid_at,
  eligible_at,
  disputed_at,
  metadata
)
cross join lateral (
  select id
  from public.financial_policy_versions
  where is_active
  limit 1
) as policy;

update public.booking_payment_receipts
set receipt_url = 'https://stripe.test/receipts/f6200000'
where booking_id = 'f6100000-0000-4000-8000-000000000001';

insert into public.session_refunds (
  session_payment_id,
  stripe_refund_id,
  amount_cents,
  status,
  processed_at
) values (
  'f6200000-0000-4000-8000-000000000002',
  're_finance_1',
  1000,
  'succeeded',
  '2038-01-12T14:00:00Z'
);

insert into public.session_disputes (
  session_payment_id,
  stripe_dispute_id,
  stripe_charge_id,
  amount_cents,
  status,
  opened_at
) values (
  'f6200000-0000-4000-8000-000000000003',
  'dp_finance_1',
  'ch_finance_3',
  7000,
  'needs_response',
  '2038-01-15T10:00:00Z'
);

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  details_submitted,
  payouts_enabled,
  charges_enabled,
  stripe_transfers_status,
  pending_requirements,
  operational_status,
  last_synced_at
) values (
  'f6300000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_1234567890abcdef',
  'ready',
  true,
  true,
  false,
  'active',
  '{"currentlyDue":[],"eventuallyDue":["business_profile.url"],"pendingVerification":[]}'::jsonb,
  'ready',
  '2038-01-12T15:00:00Z'
);

insert into public.payout_batches (
  id,
  reference_period_start,
  reference_period_end,
  cutoff_at,
  status,
  item_count,
  therapist_count,
  gross_amount_cents,
  therapist_amount_cents,
  platform_gross_commission_cents,
  processed_at
) values (
  'f6400000-0000-4000-8000-000000000001',
  '2038-01-01',
  '2038-01-07',
  '2038-01-09T13:00:00Z',
  'completed',
  1,
  1,
  10000,
  8000,
  2000,
  '2038-01-09T14:00:00Z'
);

insert into public.payout_batch_therapists (
  id,
  payout_batch_id,
  therapist_profile_id,
  connect_account_id,
  item_count,
  total_amount_cents,
  status
) values (
  'f6500000-0000-4000-8000-000000000001',
  'f6400000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f6300000-0000-4000-8000-000000000001',
  1,
  8000,
  'transferred'
);

insert into public.payout_batch_items (
  id,
  payout_batch_id,
  payout_batch_therapist_id,
  session_payment_id,
  booking_id,
  therapist_profile_id,
  amount_cents,
  status
) values (
  'f6600000-0000-4000-8000-000000000001',
  'f6400000-0000-4000-8000-000000000001',
  'f6500000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000001',
  'f6100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  8000,
  'transferred'
);

insert into public.stripe_transfers (
  id,
  payout_batch_item_id,
  session_payment_id,
  therapist_profile_id,
  connect_account_id,
  stripe_transfer_id,
  idempotency_key,
  amount_cents,
  status,
  transferred_at
) values (
  'f6700000-0000-4000-8000-000000000001',
  'f6600000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f6300000-0000-4000-8000-000000000001',
  'tr_finance_1',
  'idem_finance_1',
  8000,
  'transferred',
  '2038-01-09T14:00:00Z'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_private_therapist_financial_overview_v1(
    '2038-01-01',
    '2038-01-31',
    'America/Sao_Paulo'
  )->>'contractVersion',
  '1',
  'financial overview is versioned'
);

select is(
  (
    public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )->>'grossPaidCents'
  )::integer,
  22000,
  'overview sums gross paid cents from canonical session payments'
);

select is(
  (
    public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )->>'tesCommissionCents'
  )::integer,
  4400,
  'overview sums TES commission cents'
);

select is(
  (
    public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )->>'refundedToCustomersCents'
  )::integer,
  1000,
  'overview includes customer refunds only when succeeded'
);

select is(
  (
    public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )->>'therapistNetCents'
  )::integer,
  16600,
  'overview returns gross minus TES commission minus customer refunds'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      null,
      1,
      2,
      'America/Sao_Paulo'
    ) #>> '{pagination,totalCount}'
  )::integer,
  3,
  'receipts are scoped to the authenticated therapist'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      null,
      1,
      2,
      'America/Sao_Paulo'
    ) #>> '{pagination,hasNextPage}'
  )::boolean,
  true,
  'receipts paginate server-side'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      'paid',
      null,
      null,
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{pagination,totalCount}'
  )::integer,
  1,
  'receipts filter by financial status server-side'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      'Lucas',
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{pagination,totalCount}'
  )::integer,
  1,
  'receipts search by permitted patient display name'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      'Lucas',
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{items,0,paymentMethodType}'
  ),
  'card',
  'receipt exposes real payment method when persisted'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      'Marina',
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{items,0,refundedAmountCents}'
  )::integer,
  1000,
  'receipt item includes succeeded refund cents'
);

select is(
  (
    public.get_private_therapist_payouts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{pagination,totalCount}'
  )::integer,
  1,
  'payouts are listed by batch for the authenticated therapist'
);

select is(
  (
    public.get_private_therapist_payouts_v1(
      '2038-01-01',
      '2038-01-31',
      'transferred',
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{items,0,therapistNetAmountCents}'
  )::integer,
  8000,
  'payouts expose authoritative therapist net cents'
);

select ok(
  (
    public.get_private_therapist_connect_account_v1()
      ->> 'maskedAccountId'
  ) <> 'acct_1234567890abcdef',
  'Connect account ID is masked'
);

select is(
  public.get_private_therapist_connect_account_v1()
    -> 'maskedBankAccountSummary',
  'null'::jsonb,
  'Connect read model does not expose bank-account data'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )->>'grossPaidCents'
  )::integer,
  9000,
  'another therapist sees only their own financial movement'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      null,
      null,
      'Lucas',
      1,
      10,
      'America/Sao_Paulo'
    ) #>> '{pagination,totalCount}'
  )::integer,
  0,
  'cross-therapist search does not leak receipts'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.get_private_therapist_financial_overview_v1(
      '2038-01-01',
      '2038-01-31',
      'America/Sao_Paulo'
    )
  $$,
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot read private therapist finance RPCs'
);

select throws_ok(
  $$
    select public.get_private_therapist_receipts_v1(
      '2038-01-01',
      '2038-01-31',
      'unknown',
      null,
      null,
      1,
      10,
      'America/Sao_Paulo'
    )
  $$,
  '22023',
  'VALIDATION_ERROR',
  'invalid receipt status is rejected server-side'
);

select * from finish();

rollback;
