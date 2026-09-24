begin;
select plan(16);

-- Keep this test self-contained. The forecast assertions exercise one V10
-- transfer whose net value was reduced by a debt offset; pgTAP files run in
-- independent transactions and cannot depend on fixtures created by test 121.
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1390000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now() + interval '1 day', now() + interval '1 day 50 minutes',
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
  'b1390000-0000-4000-8000-000000000021',
  'b1390000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_forecast_v4', 'pi_test_forecast_v4', now(), now() - interval '1 day'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents, transferred_at
)
select
  'b1390000-0000-4000-8000-000000000031', payment.id,
  payment.therapist_profile_id, payment.connect_account_id_snapshot,
  'tr_test_forecast_v4', 'tes:v10:forecast:139',
  'forecast-fingerprint-139', 7500, 'transferred',
  payment.stripe_charge_id, 'session_direct', 8500, 1000, now()
from public.session_payments payment
where payment.id = 'b1390000-0000-4000-8000-000000000021';

select ok(to_regprocedure('public.get_private_therapist_payouts_v4(date,date,integer,integer,text,integer)') is not null,
  'the additive V4 payout reader exists');
select is((select provolatile::text from pg_proc
  where oid='public.get_private_therapist_payouts_v4(date,date,integer,integer,text,integer)'::regprocedure),
  's','the V4 payout reader is stable');
select ok(has_function_privilege('authenticated',
  'public.get_private_therapist_payouts_v4(date,date,integer,integer,text,integer)','EXECUTE'),
  'authenticated therapists can read their payout forecast');
select ok(not has_function_privilege('anon',
  'public.get_private_therapist_payouts_v4(date,date,integer,integer,text,integer)','EXECUTE'),
  'anonymous users cannot read payout forecasts');

select set_config('request.jwt.claim.sub',
  (select user_id::text from public.therapist_profiles where id='c1000000-0000-4000-8000-000000000001'), true);
set local role authenticated;
create temporary table undated_result as select public.get_private_therapist_payouts_v4(
  p_timezone=>'America/Sao_Paulo',p_agenda_days=>15) as payload;
select is((select payload->>'contractVersion' from undated_result),'4','the response uses V4');
select ok((select exists(select 1 from undated_result,
  jsonb_array_elements(payload->'agenda'->'awaitingBankDate') group_item,
  jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500)),
  'the undated bank arrival shows the net transferred amount after debt offset');
reset role;

update public.stripe_transfers set connected_balance_available_on=now()+interval '3 days'
where id='b1390000-0000-4000-8000-000000000031';
set local role authenticated;
create temporary table dated_result as select public.get_private_therapist_payouts_v4(
  p_timezone=>'America/Sao_Paulo',p_agenda_days=>15) as payload;
select ok((select exists(select 1 from dated_result,
  jsonb_array_elements(payload->'agenda'->'balanceAvailable') group_item,
  jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500)),
  'known connected-balance availability appears separately from bank arrival');
select ok((select not exists(select 1 from dated_result,
  jsonb_array_elements(payload->'agenda'->'awaitingBankDate') group_item,
  jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021')),
  'the same transfer appears in only one forecast group');
reset role;

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, arrival_at
) values (
  'b1390000-0000-4000-8000-000000000051',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id='b1390000-0000-4000-8000-000000000021'),
  'po_test_forecast_v4',7500,'BRL','pending_balance','pending',true,
  'in_progress','pending',now()+interval '5 days'
);
insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id,stripe_transfer_id,connected_balance_transaction_id,
  source_id,amount_cents,currency,allocation_origin
) values (
  'b1390000-0000-4000-8000-000000000051',
  'b1390000-0000-4000-8000-000000000031',
  'txn_test_forecast_v4','py_test_forecast_v4',7500,'BRL','session_direct'
);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'predicted'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500),
  'a reconciled allocation replaces the balance estimate with one bank forecast');
select ok(not exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'balanceAvailable'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'),
  'allocation does not duplicate the balance forecast');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,7500,
  'allocated bank forecast contributes to the summary only once');
reset role;

insert into public.stripe_transfer_reversals(
  id,stripe_transfer_id,stripe_transfer_reversal_id,amount_cents,status
) values (
  'b1390000-0000-4000-8000-000000000001',
  'b1390000-0000-4000-8000-000000000031',
  'trr_test_forecast_v4',2500,'succeeded'
);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'awaitingBankDate'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=5000),
  'reversed value is removed and a stale bank arrival is no longer promised');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,5000,
  'partial reversal reduces the summary by its successful reversed amount');
reset role;

insert into public.session_refunds(id,session_payment_id,amount_cents,status) values (
  'b1390000-0000-4000-8000-000000000002',
  'b1390000-0000-4000-8000-000000000021',10000,'pending'
);
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'awaitingBankDate'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1390000-0000-4000-8000-000000000021'),
  'an unresolved refund removes the transfer from future forecast');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,0,
  'pending refund does not leave stale allocated amounts in the summary');
select ok(to_regprocedure('public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)') is not null,
  'the previous reader remains available during rollout');

select * from finish();
rollback;
