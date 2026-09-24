begin;
select plan(19);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values
  ('b1460000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-12-01 13:00:00+00', '2098-12-01 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid'),
  ('b1460000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2098-12-02 13:00:00+00', '2098-12-02 13:50:00+00',
   'America/Sao_Paulo', 'confirmed', 'paid');

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  ('b1460000-0000-4000-8000-00000000002' || n)::uuid,
  ('b1460000-0000-4000-8000-00000000001' || n)::uuid,
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transferred', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_bank_arrival_146_' || n,
  'pi_test_bank_arrival_146_' || n,
  now() - interval '3 days', now() - interval '4 days'
from generate_series(1, 2) as n
cross join public.financial_policy_versions as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) as account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents, transferred_at
) values
  ('b1460000-0000-4000-8000-000000000031',
   'b1460000-0000-4000-8000-000000000021',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1460000-0000-4000-8000-000000000021'),
   'tr_test_bank_arrival_146_future', 'tes:test:bank-arrival:146:future',
   'bank-arrival-fingerprint-146-future', 8500, 'transferred',
   'ch_test_bank_arrival_146_1', 'session_direct', 8500, 0,
   now() - interval '2 days'),
  ('b1460000-0000-4000-8000-000000000032',
   'b1460000-0000-4000-8000-000000000022',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1460000-0000-4000-8000-000000000022'),
   'tr_test_bank_arrival_146_arrived', 'tes:test:bank-arrival:146:arrived',
   'bank-arrival-fingerprint-146-arrived', 8500, 'transferred',
   'ch_test_bank_arrival_146_2', 'session_direct', 8500, 0,
   now() - interval '3 days');

insert into public.stripe_payouts (
  id, therapist_profile_id, connect_account_id, stripe_payout_id,
  amount_cents, currency, status, provider_status, automatic,
  provider_reconciliation_status, allocation_status, arrival_at, paid_at
) values
  ('b1460000-0000-4000-8000-000000000041',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1460000-0000-4000-8000-000000000021'),
   'po_test_bank_arrival_146_future', 8500, 'BRL', 'paid', 'paid', true,
   'completed', 'completed',
   date_trunc('day', now()) + interval '2 days', now() - interval '1 hour'),
  ('b1460000-0000-4000-8000-000000000042',
   'c1000000-0000-4000-8000-000000000001',
   (select connect_account_id_snapshot from public.session_payments
    where id = 'b1460000-0000-4000-8000-000000000022'),
   'po_test_bank_arrival_146_arrived', 8500, 'BRL', 'paid', 'paid', true,
   'completed', 'completed',
   date_trunc('day', now()) - interval '1 day', now() - interval '2 days');

insert into public.stripe_payout_transfer_allocations (
  stripe_payout_id, stripe_transfer_id, connected_balance_transaction_id,
  source_id, amount_cents, currency, allocation_origin, reconciled_at
) values
  ('b1460000-0000-4000-8000-000000000041',
   'b1460000-0000-4000-8000-000000000031',
   'txn_test_bank_arrival_146_future', 'py_test_bank_arrival_146_future',
   8500, 'BRL', 'session_direct', now() - interval '1 hour'),
  ('b1460000-0000-4000-8000-000000000042',
   'b1460000-0000-4000-8000-000000000032',
   'txn_test_bank_arrival_146_arrived', 'py_test_bank_arrival_146_arrived',
   8500, 'BRL', 'session_direct', now() - interval '2 days');

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id::text from public.therapist_profiles
            where id = 'c1000000-0000-4000-8000-000000000001'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  (public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  ) ->> 'contractVersion')::integer,
  6,
  'the current payout projection publishes contract V6'
);
select is(
  (public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,inTransitCents}')::integer,
  8500,
  'a paid Payout with future arrival remains in transit'
);
select is(
  (public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,receivedCents}')::integer,
  8500,
  'only the Payout whose arrival was reached is received'
);
select is(
  (select item ->> 'date'
   from jsonb_array_elements(public.get_private_therapist_payouts_v6(
     current_date - 5, current_date + 5, 1, 20,
     'America/Sao_Paulo', 15
   ) #> '{agenda,inTransit}') as item
   where item ->> 'status' = 'in_transit'),
  (date_trunc('day', now()) + interval '2 days')::date::text,
  'the future arrival keeps its Stripe civil date without timezone rollback'
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_private_therapist_payouts_v6(
     current_date - 5, current_date + 5, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as item
   where item -> 'composition' @> jsonb_build_array(jsonb_build_object(
     'sessionPaymentId', 'b1460000-0000-4000-8000-000000000021'
   ))),
  0,
  'the future arrival does not enter received history early'
);
select is(
  (select item ->> 'date'
   from jsonb_array_elements(public.get_private_therapist_payouts_v6(
     current_date - 5, current_date + 5, 1, 20,
     'America/Sao_Paulo', 15
   ) -> 'historyItems') as item
   where item -> 'composition' @> jsonb_build_array(jsonb_build_object(
     'sessionPaymentId', 'b1460000-0000-4000-8000-000000000022'
   ))),
  (date_trunc('day', now()) - interval '1 day')::date::text,
  'received history keeps the reached Stripe civil arrival date'
);
select ok(
  public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  )::text not like '%po_test_bank_arrival_146%'
  and public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  )::text not like '%tr_test_bank_arrival_146%',
  'provider identifiers remain outside the browser contract'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v6(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'the therapist browser role can execute V6'
);

reset role;
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000021'
  ) ->> 'payout_display_status',
  'bank_pending',
  'Admin keeps a reconciled paid Payout on its way until arrival'
);
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000021'
  ) ->> 'bank_paid_at',
  null,
  'Admin does not expose an early bank-paid timestamp'
);
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000021'
  ) ->> 'bank_paid_date',
  null,
  'Admin does not expose an early bank-paid date'
);
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000022'
  ) ->> 'payout_display_status',
  'paid',
  'Admin marks the payout paid after the bank arrival is reached'
);
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000022'
  ) ->> 'bank_paid_date',
  (date_trunc('day', now()) - interval '1 day')::date::text,
  'Admin publishes the reached civil bank date'
);
select ok(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000022'
  ) ->> 'bank_paid_at' is not null,
  'Admin retains the timestamp for audit compatibility'
);

update public.stripe_payouts
set arrival_at = (
  ((now() at time zone 'America/Sao_Paulo')::date)::timestamp
  at time zone 'UTC'
)
where id = 'b1460000-0000-4000-8000-000000000041';

set local role authenticated;
select is(
  (public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,inTransitCents}')::integer,
  0,
  'a Payout arriving on the current Sao Paulo civil date is no longer in transit'
);
select is(
  (public.get_private_therapist_payouts_v6(
    current_date - 5, current_date + 5, 1, 20, 'America/Sao_Paulo', 15
  ) #>> '{summary,receivedCents}')::integer,
  17000,
  'a Payout arriving on the current Sao Paulo civil date is already received'
);

reset role;
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000021'
  ) ->> 'payout_display_status',
  'paid',
  'Admin marks the payout paid throughout its Sao Paulo arrival date'
);
select is(
  public.private_admin_session_payout_projection_v10(
    'b1460000-0000-4000-8000-000000000021'
  ) ->> 'bank_paid_date',
  (now() at time zone 'America/Sao_Paulo')::date::text,
  'Admin preserves the current Sao Paulo civil bank date without UTC rollback'
);

set local role authenticated;
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_session_payout_projection_v10(uuid)',
    'EXECUTE'
  ),
  'the internal Admin projection remains unavailable to the browser role'
);

select * from finish();
rollback;
