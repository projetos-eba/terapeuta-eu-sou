begin;
select plan(16);

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
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500)),
  'the undated bank arrival shows the net transferred amount after debt offset');
reset role;

update public.stripe_transfers set connected_balance_available_on=now()+interval '3 days'
where id='b1211000-0000-4000-8000-000000000031';
set local role authenticated;
create temporary table dated_result as select public.get_private_therapist_payouts_v4(
  p_timezone=>'America/Sao_Paulo',p_agenda_days=>15) as payload;
select ok((select exists(select 1 from dated_result,
  jsonb_array_elements(payload->'agenda'->'balanceAvailable') group_item,
  jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500)),
  'known connected-balance availability appears separately from bank arrival');
select ok((select not exists(select 1 from dated_result,
  jsonb_array_elements(payload->'agenda'->'awaitingBankDate') group_item,
  jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021')),
  'the same transfer appears in only one forecast group');
reset role;

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, arrival_at
) values (
  'b1390000-0000-4000-8000-000000000011',
  'c1000000-0000-4000-8000-000000000001',
  (select connect_account_id_snapshot from public.session_payments
   where id='b1211000-0000-4000-8000-000000000021'),
  'po_test_forecast_v4',7500,'BRL','pending_balance','pending',true,
  'in_progress','pending',now()+interval '5 days'
);
insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id,stripe_transfer_id,connected_balance_transaction_id,
  source_id,amount_cents,currency,allocation_origin
) values (
  'b1390000-0000-4000-8000-000000000011',
  'b1211000-0000-4000-8000-000000000031',
  'txn_test_forecast_v4','py_test_forecast_v4',7500,'BRL','session_direct'
);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'predicted'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=7500),
  'a reconciled allocation replaces the balance estimate with one bank forecast');
select ok(not exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'balanceAvailable'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'),
  'allocation does not duplicate the balance forecast');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,7500,
  'allocated bank forecast contributes to the summary only once');
reset role;

insert into public.stripe_transfer_reversals(
  id,stripe_transfer_id,stripe_transfer_reversal_id,amount_cents,status
) values (
  'b1390000-0000-4000-8000-000000000001',
  'b1211000-0000-4000-8000-000000000031',
  'trr_test_forecast_v4',2500,'succeeded'
);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'awaitingBankDate'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'
    and (item->>'amountCents')::integer=5000),
  'reversed value is removed and a stale bank arrival is no longer promised');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,5000,
  'partial reversal reduces the summary by its successful reversed amount');
reset role;

insert into public.session_refunds(id,session_payment_id,amount_cents,status) values (
  'b1390000-0000-4000-8000-000000000002',
  'b1211000-0000-4000-8000-000000000021',10000,'pending'
);
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(
  public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')->'agenda'->'awaitingBankDate'
) group_item, jsonb_array_elements(group_item->'composition') item
  where item->>'sessionPaymentId'='b1211000-0000-4000-8000-000000000021'),
  'an unresolved refund removes the transfer from future forecast');
select is((public.get_private_therapist_payouts_v4(p_timezone=>'America/Sao_Paulo')
  #>> '{summary,expectedCents}')::integer,0,
  'pending refund does not leave stale allocated amounts in the summary');
select ok(to_regprocedure('public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)') is not null,
  'the previous reader remains available during rollout');

select * from finish();
rollback;
