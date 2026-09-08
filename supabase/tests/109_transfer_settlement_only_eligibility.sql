begin;

\ir fixtures/weekly-payout-local.inc

select plan(9);

select is(
  (select version from public.financial_policy_versions where is_active),
  'tes-payments-v9-settlement-only',
  'the settlement-only financial policy is active'
);

select is(
  (select transfer_safety_period_days from public.financial_policy_versions where is_active),
  0,
  'the active policy adds no safety delay after confirmation'
);

select ok(
  position('make_interval(days' in pg_get_functiondef(
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)'::regprocedure
  )) = 0,
  'eligibility no longer computes a fixed safety interval'
);

update public.session_payments
set transfer_status = 'waiting_safety_period',
    stripe_balance_status = 'pending',
    stripe_balance_available_on = now() - interval '1 day',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'waiting_settlement',
  'a confirmed payment moves directly from the legacy state to settlement'
);

select is(
  (
    select eligible_at = service_confirmed_at
    from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  true,
  'eligible_at starts at service confirmation instead of a later safety boundary'
);

update public.session_payments
set stripe_balance_status = 'available',
    stripe_balance_available_on = now() - interval '1 hour',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'eligible',
  'recent available Stripe evidence makes the confirmed payment eligible'
);

update public.session_payments
set transfer_status = 'waiting_safety_period'
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.private_therapist_receipt_status_v2(
    'fa100000-0000-4000-8000-000000000001', now()
  ),
  'waiting_settlement',
  'legacy persisted safety state is presented as settlement during compatibility'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)',
    'EXECUTE'
  ),
  'authenticated clients cannot mutate financial eligibility'
);

select is(
  public.create_weekly_payout_batch_v2(
    date '2099-02-01', date '2099-02-07', '2099-02-08T05:00:00Z', null
  ),
  null,
  'a scheduler pass without eligible items still creates no empty batch'
);

select * from finish();
rollback;
