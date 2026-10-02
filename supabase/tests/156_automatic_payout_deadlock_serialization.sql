begin;
select plan(10);

select ok(
  to_regprocedure(
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'
  ) is not null,
  'the automatic Payout event recorder exists'
);

select ok(
  to_regprocedure(
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'
  ) is not null,
  'the V3 automatic Payout reconciler exists'
);

select ok(
  pg_get_functiondef(
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'the event recorder serializes same-Payout work transactionally'
);

select ok(
  pg_get_functiondef(
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'the V3 reconciler serializes same-Payout work transactionally'
);

select ok(
  pg_get_functiondef(
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'::regprocedure
  ) like '%tes:automatic-payout:%trim(p_stripe_account_id)%trim(p_stripe_payout_id)%',
  'the event recorder scopes the lock by connected account and Payout'
);

select ok(
  pg_get_functiondef(
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'::regprocedure
  ) like '%tes:automatic-payout:%trim(p_stripe_account_id)%trim(p_stripe_payout_id)%',
  'the reconciler uses the same connected-account and Payout lock key'
);

select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'::regprocedure
    )
  ) < position(
    'select * into v_account' in pg_get_functiondef(
      'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'::regprocedure
    )
  ),
  'the recorder acquires the advisory lock before row locks'
);

select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'::regprocedure
    )
  ) < position(
    'if not exists' in pg_get_functiondef(
      'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'::regprocedure
    )
  ),
  'the reconciler serializes before delegating to V2 or locking rows'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) and not has_function_privilege(
    'authenticated',
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)',
    'EXECUTE'
  ),
  'the event recorder remains service-role only'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)',
    'EXECUTE'
  ) and not has_function_privilege(
    'authenticated',
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)',
    'EXECUTE'
  ),
  'the V3 reconciler remains service-role only'
);

select * from finish();
rollback;
