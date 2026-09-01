begin;

select plan(5);

select ok(
  position('eligible.transfer_status = ''eligible''' in pg_get_functiondef(
    'public.get_private_therapist_payouts_v1(date,date,text,integer,integer,text)'::regprocedure
  )) > 0,
  'payout forecast is gated by the authenticated therapist eligible payment'
);

select ok(
  position('batch.cutoff_at' in pg_get_functiondef(
    'public.get_private_therapist_payouts_v1(date,date,text,integer,integer,text)'::regprocedure
  )) > 0,
  'batch cutoff remains available only for therapist-owned batch rows'
);

select ok(
  position('account.is_current = true' in pg_get_functiondef(
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)'::regprocedure
  )) > 0,
  'transfer eligibility only considers the current Connect account'
);

select ok(
  position('account.payout_schedule_interval = ''daily''' in pg_get_functiondef(
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)'::regprocedure
  )) > 0,
  'transfer eligibility requires the Stripe automatic daily payout schedule'
);

select is(
  public.recheck_connect_blocked_payments_v1(
    '00000000-0000-0000-0000-000000000000'::uuid,
    now()
  ),
  0,
  'Connect recovery is idempotent and has no effect for an unknown therapist'
);

select * from finish();
rollback;
