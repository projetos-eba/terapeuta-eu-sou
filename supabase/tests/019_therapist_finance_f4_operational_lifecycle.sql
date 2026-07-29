begin;

select plan(14);

insert into public.therapist_connect_accounts (
  therapist_profile_id,
  stripe_account_id,
  account_api_version,
  dashboard_type,
  fees_collector,
  losses_collector,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status,
  last_synced_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'acct_f4_ana',
  'v2',
  'express',
  'application',
  'application',
  'ready',
  true,
  false,
  true,
  'active',
  'ready',
  '2039-04-01T09:00:00Z'
)
on conflict (therapist_profile_id) do update
set stripe_account_id = excluded.stripe_account_id,
    onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    operational_status = excluded.operational_status,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

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
  meeting_provider
) values (
  'f9100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2039-04-02T13:00:00Z',
  '2039-04-02T13:50:00Z',
  'America/Sao_Paulo',
  'pending_payment',
  'pending',
  'zoom'
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
  transfer_status
)
select
  'f9000000-0000-4000-8000-000000000001',
  'f9100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id,
  20000,
  2000,
  4000,
  16000,
  'pending',
  'not_eligible'
from public.financial_policy_versions
where is_active
limit 1;

select is(
  (
    public.apply_session_payment_state_v1(
      'f9000000-0000-4000-8000-000000000001',
      'paid',
      'evt_f4_payment_paid',
      '2039-04-02T12:50:00Z',
      'pi_f4_session',
      'ch_f4_session',
      'cs_f4_session'
    )->>'applied'
  )::boolean,
  true,
  'webhook payment confirmation applies paid state'
);

select is(
  (
    public.record_session_payment_stripe_reconciliation_v1(
      'f9000000-0000-4000-8000-000000000001',
      'evt_f4_payment_paid',
      '2039-04-02T12:50:00Z',
      'ch_f4_session',
      'txn_f4_balance',
      890,
      19110,
      'card',
      'stripe_checkout',
      'https://stripe.test/receipts/f4'
    )->>'receiptRecorded'
  )::boolean,
  true,
  'webhook reconciliation records receipt metadata'
);

select is(
  (
    select receipt_url
    from public.booking_payment_receipts
    where booking_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  'https://stripe.test/receipts/f4',
  'receipt URL is available to receipt read models'
);

select is(
  (
    select stripe_balance_transaction_id
    from public.session_payments
    where id = 'f9000000-0000-4000-8000-000000000001'
  ),
  'txn_f4_balance',
  'balance transaction is persisted for reconciliation'
);

select is(
  (
    select count(*)::integer
    from public.financial_ledger_entries
    where session_payment_id = 'f9000000-0000-4000-8000-000000000001'
      and entry_type = 'stripe_fee'
  ),
  1,
  'Stripe fee is recorded as TES-side ledger evidence, not therapist discount'
);

select lives_ok(
  $$
    select public.confirm_session_service(
      'f9100000-0000-4000-8000-000000000001',
      'therapist_manual',
      'aaaaaaaa-0000-4000-8000-000000000001',
      null,
      jsonb_build_object('source', 'f4_pgtap')
    )
  $$,
  'therapist confirmation marks service realization'
);

select is(
  (
    select service_status::text
    from public.session_payments
    where id = 'f9000000-0000-4000-8000-000000000001'
  ),
  'confirmed_by_therapist',
  'session payment stores service confirmation status'
);

select is(
  public.refresh_session_transfer_eligibility(
    'f9000000-0000-4000-8000-000000000001',
    '2026-07-30T12:00:00Z'
  )::text,
  'waiting_safety_period',
  'controlled clock keeps payment in safety period before eligibility'
);

select is(
  public.refresh_session_transfer_eligibility(
    'f9000000-0000-4000-8000-000000000001',
    '2039-04-15T12:00:00Z'
  )::text,
  'eligible',
  'controlled clock marks payment eligible after safety period'
);

select is(
  public.create_weekly_payout_batch(
    '2039-04-01',
    '2039-04-07',
    '2039-04-15T12:00:00Z'
  ) is not null,
  true,
  'eligible payment is reserved into a payout batch'
);

select is(
  (
    select transfer_status::text
    from public.session_payments
    where id = 'f9000000-0000-4000-8000-000000000001'
  ),
  'batched',
  'session payment becomes batched after batch creation'
);

insert into public.stripe_transfers (
  payout_batch_item_id,
  session_payment_id,
  therapist_profile_id,
  connect_account_id,
  stripe_transfer_id,
  idempotency_key,
  amount_cents,
  status,
  stripe_source_charge_id,
  transferred_at
)
select
  item.id,
  item.session_payment_id,
  item.therapist_profile_id,
  account.id,
  'tr_f4_session',
  'tes:test:transfer:f4',
  item.amount_cents,
  'transferred',
  'ch_f4_session',
  '2039-04-15T12:05:00Z'
from public.payout_batch_items as item
join public.therapist_connect_accounts as account
  on account.therapist_profile_id = item.therapist_profile_id
where item.session_payment_id = 'f9000000-0000-4000-8000-000000000001';

update public.payout_batch_items
set status = 'transferred'
where session_payment_id = 'f9000000-0000-4000-8000-000000000001';

update public.session_payments
set transfer_status = 'transferred'
where id = 'f9000000-0000-4000-8000-000000000001';

update public.payout_batches
set status = 'completed',
    processed_at = '2039-04-15T12:05:00Z'
where id in (
  select payout_batch_id
  from public.payout_batch_items
  where session_payment_id = 'f9000000-0000-4000-8000-000000000001'
);

select is(
  (
    select stripe_source_charge_id
    from public.stripe_transfers
    where session_payment_id = 'f9000000-0000-4000-8000-000000000001'
  ),
  'ch_f4_session',
  'transfer stores the source_transaction charge used by Stripe Connect'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    public.get_private_therapist_payouts_v1(
      '2039-04-01',
      '2039-04-30',
      'transferred',
      1,
      20,
      'America/Sao_Paulo'
    ) #>> '{items,0,reconciliationStatus}'
  ),
  'matched',
  'private payout dashboard exposes matched reconciliation status'
);

select is(
  (
    public.get_private_therapist_receipts_v1(
      '2039-04-01',
      '2039-04-30',
      'paid',
      null,
      null,
      1,
      20,
      'America/Sao_Paulo'
    ) #>> '{items,0,receiptUrl}'
  ),
  'https://stripe.test/receipts/f4',
  'private receipt dashboard exposes Stripe receipt URL'
);

select * from finish();

rollback;
