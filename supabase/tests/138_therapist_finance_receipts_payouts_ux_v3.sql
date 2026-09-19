begin;

select plan(18);

select ok(
  to_regprocedure('public.private_therapist_charge_status_v3(uuid)') is not null,
  'the additive charge-language projection exists'
);
select ok(
  to_regprocedure('public.get_private_therapist_receipts_v3(date,date,text,uuid,text,integer,integer,text)') is not null,
  'the additive receipts V3 read model exists'
);
select ok(
  to_regprocedure('public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)') is not null,
  'the additive payouts V3 read model exists'
);

select ok(
  to_regprocedure('public.get_private_therapist_receipts_v2(date,date,text,uuid,text,integer,integer,text)') is not null,
  'the receipts V2 compatibility contract remains available'
);
select ok(
  to_regprocedure('public.get_private_therapist_payouts_v2(date,date,text,integer,integer,text)') is not null,
  'the payouts V2 compatibility contract remains available'
);

select is(
  (select provolatile::text from pg_proc
   where oid = 'public.private_therapist_charge_status_v3(uuid)'::regprocedure),
  's',
  'the charge-language projection is declared stable and read-only'
);
select ok(
  pg_get_functiondef(
    'public.private_therapist_charge_status_v3(uuid)'::regprocedure
  ) like '%else ''under_review''%'
  and pg_get_functiondef(
    'public.private_therapist_charge_status_v3(uuid)'::regprocedure
  ) not like '%else ''processing''%',
  'an unknown pending state cannot fabricate money in processing'
);
select is(
  (select provolatile::text from pg_proc
   where oid = 'public.get_private_therapist_receipts_v3(date,date,text,uuid,text,integer,integer,text)'::regprocedure),
  's',
  'the receipts V3 contract is declared stable and read-only'
);
select is(
  (select provolatile::text from pg_proc
   where oid = 'public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)'::regprocedure),
  's',
  'the payouts V3 contract is declared stable and read-only'
);
select ok(
  pg_get_functiondef(
    'public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)'::regprocedure
  ) like '%transfer.session_payment_id%'
  and pg_get_functiondef(
    'public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)'::regprocedure
  ) like '%batch_item.session_payment_id%',
  'the unified payout composition resolves both direct V10 and historical V9 sessions'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_receipts_v3(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke receipts V3'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_private_therapist_receipts_v3(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot invoke receipts V3'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke payouts V3'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_private_therapist_payouts_v3(date,date,integer,integer,text,integer)',
    'EXECUTE'
  ),
  'anonymous clients cannot invoke payouts V3'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_therapist_charge_status_v3(uuid)',
    'EXECUTE'
  ),
  'the internal charge projection is not callable by clients directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)',
    'EXECUTE'
  ),
  'the canonical V10 confirmation and enqueue command remains available to workers'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)',
    'EXECUTE'
  ),
  'the V10 confirmation command remains fenced from clients'
);
select ok(
  to_regprocedure('public.claim_session_transfer_jobs_v10(timestamptz,uuid,integer,integer)') is not null,
  'the canonical V10 transfer worker claim function remains installed'
);

select * from finish();
rollback;
