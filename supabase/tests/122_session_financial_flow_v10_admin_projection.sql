begin;
select plan(24);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1220000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2098-11-01 13:00:00+00', '2098-11-01 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1220000-0000-4000-8000-000000000021',
  'b1220000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_admin_122', 'pi_test_v10_admin_122',
  '2098-11-01 12:00:00+00', '2098-10-31 13:00:00+00'
from public.financial_policy_versions policy
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
  therapist_gross_amount_cents, debt_offset_amount_cents, transferred_at
) values (
  'b1220000-0000-4000-8000-000000000031',
  'b1220000-0000-4000-8000-000000000021',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220000-0000-4000-8000-000000000021'),
  'tr_test_v10_admin_122', 'tes:v10:admin:122',
  'admin-fingerprint-122', 7500, 'transferred',
  'ch_test_v10_admin_122', 'session_direct', 8500, 1000,
  '2098-11-01 12:02:00+00'
);

insert into public.session_transfer_jobs (
  id, session_payment_id, booking_id, policy_version_id, connect_account_id,
  stripe_environment, stripe_source_charge_id, therapist_gross_amount_cents,
  debt_offset_amount_cents, transfer_amount_cents, status, stripe_transfer_id,
  idempotency_key, request_fingerprint, prepared_at, succeeded_at
) values (
  'b1220000-0000-4000-8000-000000000041',
  'b1220000-0000-4000-8000-000000000021',
  'b1220000-0000-4000-8000-000000000011',
  (select policy_version_id from public.session_payments
   where id = 'b1220000-0000-4000-8000-000000000021'),
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220000-0000-4000-8000-000000000021'),
  'test', 'ch_test_v10_admin_122', 8500, 1000, 7500,
  'pending_source', 'b1220000-0000-4000-8000-000000000031',
  'tes:v10:job:admin:122', 'job-admin-fingerprint-122',
  '2098-11-01 12:01:00+00', '2098-11-01 12:02:00+00'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1220001-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2098-11-02 13:00:00+00', '2098-11-02 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1220001-0000-4000-8000-000000000021',
  'b1220001-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v9',
  account.id, account.stripe_account_id,
  'ch_test_v9_admin_122', 'pi_test_v9_admin_122',
  '2098-11-02 12:00:00+00', '2098-11-01 13:00:00+00'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) account
where policy.policy_key = 'tes-payments-v9-settlement-only';

insert into public.payout_batches (
  id, reference_period_start, reference_period_end, cutoff_at, status,
  item_count, therapist_count, gross_amount_cents,
  therapist_amount_cents, platform_gross_commission_cents, processed_at
) values (
  'b1220001-0000-4000-8000-000000000031',
  '2098-11-01', '2098-11-02', '2098-11-03 12:00:00+00', 'completed',
  1, 1, 10000, 8500, 1500, '2098-11-03 12:05:00+00'
);

insert into public.payout_batch_therapists (
  id, payout_batch_id, therapist_profile_id, connect_account_id,
  item_count, total_amount_cents, status
) values (
  'b1220001-0000-4000-8000-000000000041',
  'b1220001-0000-4000-8000-000000000031',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220001-0000-4000-8000-000000000021'),
  1, 8500, 'transferred'
);

insert into public.payout_batch_items (
  id, payout_batch_id, payout_batch_therapist_id, session_payment_id,
  booking_id, therapist_profile_id, amount_cents, status
) values (
  'b1220001-0000-4000-8000-000000000051',
  'b1220001-0000-4000-8000-000000000031',
  'b1220001-0000-4000-8000-000000000041',
  'b1220001-0000-4000-8000-000000000021',
  'b1220001-0000-4000-8000-000000000011',
  'c1000000-0000-4000-8000-000000000001',
  8500, 'transferred'
);

insert into public.stripe_transfers (
  id, payout_batch_item_id, session_payment_id, therapist_profile_id,
  connect_account_id, stripe_transfer_id, idempotency_key,
  amount_cents, status, transferred_at
) values (
  'b1220001-0000-4000-8000-000000000061',
  'b1220001-0000-4000-8000-000000000051',
  'b1220001-0000-4000-8000-000000000021',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220001-0000-4000-8000-000000000021'),
  'tr_test_v9_admin_122', 'tes:v9:admin:122',
  8500, 'transferred', '2098-11-03 12:05:00+00'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select row_payload ->> 'payout_display_status'
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"page":1,"pageSize":50}'::jsonb
   ) -> 'rows') row_payload
   where row_payload ->> 'id' = 'b1220000-0000-4000-8000-000000000021'),
  'processing',
  'a created V10 transfer without a Payout remains processing'
);
select is(
  (select (row_payload ->> 'debt_offset_amount_cents')::integer
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"page":1,"pageSize":50}'::jsonb
   ) -> 'rows') row_payload
   where row_payload ->> 'id' = 'b1220000-0000-4000-8000-000000000021'),
  1000,
  'the administrative list exposes the compensation amount separately'
);
select is(
  (select (row_payload ->> 'transfer_effective_amount_cents')::integer
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"page":1,"pageSize":50}'::jsonb
   ) -> 'rows') row_payload
   where row_payload ->> 'id' = 'b1220000-0000-4000-8000-000000000021'),
  7500,
  'the administrative list exposes only the effective amount sent'
);
select is(
  public.admin_get_finance_module_v2(
    'payments', '{"page":1,"pageSize":50}'::jsonb
  )::text like '%tr_test_v10_admin_122%',
  false,
  'the administrative list does not expose the Stripe transfer id'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'processing',
  'the administrative detail uses the same bank state'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220001-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'processing',
  'a historical V9 transfer without a Payout remains processing'
);
select is(
  (public.admin_get_finance_detail_v1(
    'payments', 'b1220001-0000-4000-8000-000000000021'
  ) #>> '{record,transfer_effective_amount_cents}')::integer,
  8500,
  'the historical V9 projection retains the transferred amount'
);
reset role;
select is(
  (public.admin_get_finance_module_v2(
    'payments', '{"page":1,"pageSize":50}'::jsonb
  ) #>> '{metrics,open-payout-batches}')::integer,
  (
    select count(*)::integer from public.payout_batches
    where status in ('draft', 'open', 'processing', 'partially_failed')
  ) + (
    select count(*)::integer
    from public.session_transfer_jobs job
    join public.session_payments payment on payment.id = job.session_payment_id
    left join public.stripe_transfers transfer on transfer.id = job.stripe_transfer_id
    where payment.payment_flow_version = 'v10'
      and job.status in (
        'queued', 'creating', 'pending_source', 'transferred',
        'reconciliation_required'
      )
      and not exists (
        select 1
        from public.stripe_payout_transfer_allocations allocation
        join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
        where allocation.stripe_transfer_id = transfer.id
          and allocation.allocation_origin = 'session_direct'
          and allocation.amount_cents = transfer.amount_cents
          and payout.status = 'paid'
          and payout.provider_reconciliation_status = 'completed'
          and payout.allocation_status = 'completed'
      )
  ),
  'the in-progress metric combines open V9 batches and unreconciled V10 transfers'
);
insert into public.therapist_financial_debts (
  id, therapist_profile_id, session_payment_id, stripe_transfer_id,
  origin, reason_code, principal_amount_cents, open_amount_cents
) values (
  'b1220000-0000-4000-8000-000000000051',
  'c1000000-0000-4000-8000-000000000001',
  'b1220000-0000-4000-8000-000000000021',
  'b1220000-0000-4000-8000-000000000031',
  'transfer_reversal_shortfall', 'insufficient_connected_balance',
  7500, 7500
);

insert into public.stripe_payouts (
  id, payout_batch_therapist_id, payout_batch_id,
  therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, paid_at
) values (
  'b1220001-0000-4000-8000-000000000071',
  'b1220001-0000-4000-8000-000000000041',
  'b1220001-0000-4000-8000-000000000031',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220001-0000-4000-8000-000000000021'),
  'po_test_v9_admin_122', 8500, 'BRL', 'in_transit', 'in_transit', true,
  'completed', 'completed', null
);
insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, payout_batch_id,
  payout_batch_therapist_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values (
  'b1220001-0000-4000-8000-000000000071',
  'b1220001-0000-4000-8000-000000000061',
  'b1220001-0000-4000-8000-000000000031',
  'b1220001-0000-4000-8000-000000000041',
  'txn_test_v9_admin_122', 'py_test_v9_admin_122',
  8500, 'BRL', 'weekly_batch', '2098-11-03 18:00:00+00'
);
set local role authenticated;

select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220001-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'bank_pending',
  'a fully allocated in-transit V9 Payout is on its way to the bank'
);
reset role;
update public.stripe_payouts
set status = 'paid', provider_status = 'paid',
    paid_at = '2098-11-03 18:00:00+00'
where id = 'b1220001-0000-4000-8000-000000000071';
set local role authenticated;

select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'compensation_pending',
  'an open debt takes precedence over a stale transferred marker'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220001-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'paid',
  'a historical V9 payment is shown as paid only after full bank reconciliation'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220001-0000-4000-8000-000000000021'
  ) #>> '{record,bank_paid_at}',
  '2098-11-03T18:00:00+00:00',
  'the historical V9 bank timestamp comes from its reconciled payout'
);

reset role;
update public.therapist_financial_debts
set status = 'settled', open_amount_cents = 0, recovered_amount_cents = 7500,
    closed_at = '2098-11-01 17:00:00+00'
where id = 'b1220000-0000-4000-8000-000000000051';

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, paid_at
) values (
  'b1220000-0000-4000-8000-000000000061',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id = 'b1220000-0000-4000-8000-000000000021'),
  'po_test_v10_admin_122', 7500, 'BRL', 'pending', 'pending', true,
  'completed', 'completed', null
);
insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values (
  'b1220000-0000-4000-8000-000000000061',
  'b1220000-0000-4000-8000-000000000031',
  'txn_test_v10_admin_122', 'py_test_v10_admin_122',
  7500, 'BRL', 'session_direct', '2098-11-01 18:00:00+00'
);
set local role authenticated;

select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'bank_pending',
  'a fully allocated pending V10 Payout is on its way to the bank'
);
reset role;
update public.stripe_payouts
set status = 'paid', provider_status = 'paid',
    paid_at = '2098-11-01 18:00:00+00'
where id = 'b1220000-0000-4000-8000-000000000061';
set local role authenticated;

select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'paid',
  'paid is shown only after complete payout reconciliation and allocation'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,bank_paid_at}',
  '2098-11-01T18:00:00+00:00',
  'the bank completion timestamp comes from the paid payout'
);

reset role;
update public.bookings
set status = 'no_show_both'
where id = 'b1220000-0000-4000-8000-000000000011';
set local role authenticated;

select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,booking_status}',
  'no_show_both',
  'the administrative detail exposes the booking attendance outcome'
);
select is(
  (select row_payload ->> 'booking_status'
   from jsonb_array_elements(public.admin_get_finance_module_v2(
     'payments', '{"page":1,"pageSize":50}'::jsonb
   ) -> 'rows') as row_payload
   where row_payload ->> 'id' = 'b1220000-0000-4000-8000-000000000021'),
  'no_show_both',
  'the administrative list exposes the same booking attendance outcome'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,service_status}',
  'scheduled',
  'the operational projection does not rewrite the payment service snapshot'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  ) #>> '{record,payout_display_status}',
  'paid',
  'the operational outcome does not alter the reconciled payout state'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_session_payout_projection_v10(uuid)',
    'EXECUTE'
  ),
  'the internal V10 projection is not executable by the browser role'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_session_operational_projection_v1(uuid)',
    'EXECUTE'
  ),
  'the internal booking outcome projection is not executable by the browser role'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_get_finance_module_v2_v9_legacy(text,jsonb)',
    'EXECUTE'
  ),
  'the legacy administrative list implementation remains private'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_get_finance_detail_v1_v9_legacy(text,uuid)',
    'EXECUTE'
  ),
  'the legacy administrative detail implementation remains private'
);
select is(
  public.admin_get_finance_detail_v1(
    'payments', 'b1220000-0000-4000-8000-000000000021'
  )::text like '%ch_test_v10_admin_122%',
  false,
  'the administrative detail does not expose the Stripe charge id'
);

select * from finish();
rollback;
