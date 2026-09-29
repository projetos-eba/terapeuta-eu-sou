begin;

-- Stripe may deliver payout.updated and payout.paid for the same object at
-- nearly the same time, while the hourly reconciler can observe that payout
-- independently. Serialize only the database work for the same connected
-- account and Payout. The lock is transaction-scoped and is released before
-- any later provider request made by the caller.
do $migration$
declare
  v_record_definition text;
  v_reconcile_definition text;
  v_record_old text := $fragment$
  end if;

  select * into v_account
$fragment$;
  v_record_new text := $fragment$
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:automatic-payout:' || trim(p_stripe_account_id) || ':' ||
        trim(p_stripe_payout_id),
      0
    )
  );

  select * into v_account
$fragment$;
  v_reconcile_old text := $fragment$
  end if;

  -- V3 is deliberately narrow. Payouts without a standalone verified debit
$fragment$;
  v_reconcile_new text := $fragment$
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:automatic-payout:' || trim(p_stripe_account_id) || ':' ||
        trim(p_stripe_payout_id),
      0
    )
  );

  -- V3 is deliberately narrow. Payouts without a standalone verified debit
$fragment$;
  v_hits integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.record_automatic_stripe_payout_v1(text,text,integer,text,text,text,text,timestamptz,text,text,timestamptz,text,text)'::regprocedure
  ) into v_record_definition;

  select pg_catalog.pg_get_functiondef(
    'public.reconcile_automatic_stripe_payout_v3(text,text,jsonb,timestamptz)'::regprocedure
  ) into v_reconcile_definition;

  if v_record_definition is null or v_reconcile_definition is null then
    raise exception 'AUTOMATIC_PAYOUT_SERIALIZATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  v_hits := (
    length(v_record_definition) -
    length(replace(v_record_definition, v_record_old, ''))
  ) / nullif(length(v_record_old), 0);
  if v_hits <> 1 then
    raise exception 'AUTOMATIC_PAYOUT_RECORD_SERIALIZATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  v_hits := (
    length(v_reconcile_definition) -
    length(replace(v_reconcile_definition, v_reconcile_old, ''))
  ) / nullif(length(v_reconcile_old), 0);
  if v_hits <> 1 then
    raise exception 'AUTOMATIC_PAYOUT_RECONCILIATION_SERIALIZATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  execute replace(v_record_definition, v_record_old, v_record_new);
  execute replace(v_reconcile_definition, v_reconcile_old, v_reconcile_new);
end;
$migration$;

revoke all on function public.record_automatic_stripe_payout_v1(
  text, text, integer, text, text, text, text, timestamptz,
  text, text, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.record_automatic_stripe_payout_v1(
  text, text, integer, text, text, text, text, timestamptz,
  text, text, timestamptz, text, text
) to service_role;

revoke all on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) to service_role;

comment on function public.record_automatic_stripe_payout_v1(
  text, text, integer, text, text, text, text, timestamptz,
  text, text, timestamptz, text, text
) is
  'Records an automatic Stripe Payout event and serializes concurrent work for the same connected account and Payout.';

comment on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) is
  'Reconciles automatic Payouts with exact positive Transfer allocations and exact post-Payout V10 reversal debits. Ambiguous snapshots delegate unchanged to V2. Concurrent work for the same connected account and Payout is serialized transactionally.';

commit;
