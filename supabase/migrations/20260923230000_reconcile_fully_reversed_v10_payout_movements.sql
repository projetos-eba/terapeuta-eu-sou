begin;

-- A fully reversed V10 Transfer appears in the connected account Payout as a
-- positive payment and an equal payment_refund. The original v2 contract kept
-- every TES-bound pair unmatched, which is correct while the Transfer is still
-- active or only partially reversed. Once both the customer refund and the
-- Transfer reversal are independently reconciled in full, however, the pair no
-- longer represents money delivered by this Payout and must be excluded from
-- allocation without erasing its audit trail.
create or replace function public.reconcile_automatic_stripe_payout_v2(
  p_stripe_payout_id text,
  p_stripe_account_id text,
  p_balance_transactions jsonb,
  p_observed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund jsonb;
  v_payment jsonb;
  v_refund_charge text;
  v_payment_count integer;
  v_refund_count integer;
  v_bound_transfer_count integer;
  v_successful_refund_count integer;
  v_successful_refund_amount bigint;
  v_successful_reversal_count integer;
  v_successful_reversal_amount bigint;
  v_bound_transfer public.stripe_transfers%rowtype;
  v_session_payment public.session_payments%rowtype;
  v_pair_classification text;
  v_excluded_ids text[] := array[]::text[];
  v_pairs jsonb := '[]'::jsonb;
  v_filtered jsonb;
  v_result jsonb;
begin
  if jsonb_typeof(p_balance_transactions) <> 'array'
    or jsonb_array_length(p_balance_transactions) > 1000
    or exists (
      select 1
      from jsonb_array_elements(p_balance_transactions) as entry(value)
      group by entry.value ->> 'id'
      having entry.value ->> 'id' is null or count(*) > 1
    )
  then
    raise exception 'AUTOMATIC_STRIPE_PAYOUT_RECONCILIATION_INVALID'
      using errcode = '22023';
  end if;

  for v_refund in
    select value from jsonb_array_elements(p_balance_transactions)
    where value ->> 'type' = 'payment_refund'
  loop
    v_refund_charge := nullif(trim(v_refund ->> 'verified_refund_charge'), '');
    if v_refund_charge is null
      or nullif(trim(v_refund ->> 'source'), '') is null
      or lower(coalesce(v_refund ->> 'currency', '')) <> 'brl'
      or coalesce(v_refund ->> 'amount', '') !~ '^-[0-9]+$'
      or coalesce(v_refund ->> 'net', '') !~ '^-[0-9]+$'
    then
      continue;
    end if;

    select count(*), (array_agg(value))[1]
      into v_payment_count, v_payment
    from jsonb_array_elements(p_balance_transactions) as entry(value)
    where entry.value ->> 'type' = 'payment'
      and entry.value ->> 'source' = v_refund_charge;

    select count(*) into v_refund_count
    from jsonb_array_elements(p_balance_transactions) as entry(value)
    where entry.value ->> 'type' = 'payment_refund'
      and entry.value ->> 'verified_refund_charge' = v_refund_charge;

    if v_payment_count <> 1 or v_refund_count <> 1
      or lower(coalesce(v_payment ->> 'currency', '')) <> 'brl'
      or coalesce(v_payment ->> 'amount', '') !~ '^[0-9]+$'
      or coalesce(v_payment ->> 'net', '') !~ '^[0-9]+$'
      or (v_payment ->> 'amount')::bigint <> -(v_refund ->> 'amount')::bigint
      or (v_payment ->> 'net')::bigint <> -(v_refund ->> 'net')::bigint
      or v_payment ->> 'id' = any(v_excluded_ids)
    then
      continue;
    end if;

    select count(distinct transfer.id)
      into v_bound_transfer_count
    from public.stripe_transfers as transfer
    join public.therapist_connect_accounts as account
      on account.id = transfer.connect_account_id
    where account.stripe_account_id = p_stripe_account_id
      and (
        transfer.stripe_destination_payment_id = v_refund_charge
        or transfer.stripe_connected_balance_transaction_id = v_payment ->> 'id'
      );

    v_pair_classification := 'unrelated_provider_refund';
    v_bound_transfer := null;
    v_session_payment := null;

    if v_bound_transfer_count > 1 then
      -- Conflicting local bindings are never safe to infer from by value.
      continue;
    elsif v_bound_transfer_count = 1 then
      select transfer.*
        into v_bound_transfer
      from public.stripe_transfers as transfer
      join public.therapist_connect_accounts as account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and (
          transfer.stripe_destination_payment_id = v_refund_charge
          or transfer.stripe_connected_balance_transaction_id = v_payment ->> 'id'
        )
      limit 1;

      select payment.*
        into v_session_payment
      from public.session_payments as payment
      where payment.id = v_bound_transfer.session_payment_id;

      select count(*), coalesce(sum(refund.amount_cents), 0)
        into v_successful_refund_count, v_successful_refund_amount
      from public.session_refunds as refund
      where refund.session_payment_id = v_session_payment.id
        and refund.status = 'succeeded'
        and refund.currency = 'BRL'
        and nullif(trim(refund.stripe_refund_id), '') is not null;

      select count(*), coalesce(sum(reversal.amount_cents), 0)
        into v_successful_reversal_count, v_successful_reversal_amount
      from public.stripe_transfer_reversals as reversal
      where reversal.stripe_transfer_id = v_bound_transfer.id
        and reversal.status = 'succeeded'
        and reversal.currency = 'BRL'
        and nullif(trim(reversal.stripe_transfer_reversal_id), '') is not null;

      if v_bound_transfer.transfer_origin <> 'session_direct'
        or v_bound_transfer.status <> 'reversed'
        or v_bound_transfer.stripe_destination_payment_id is distinct from v_refund_charge
        or v_bound_transfer.stripe_connected_balance_transaction_id
          is distinct from (v_payment ->> 'id')
        or v_bound_transfer.amount_cents <> (v_payment ->> 'amount')::bigint
        or v_session_payment.id is null
        or v_session_payment.payment_flow_version <> 'v10'
        or v_session_payment.financial_status <> 'refunded'
        or v_session_payment.transfer_status <> 'reversed'
        or v_session_payment.refund_pending
        or v_session_payment.connect_account_id_snapshot
          is distinct from v_bound_transfer.connect_account_id
        or v_session_payment.stripe_charge_id
          is distinct from v_bound_transfer.stripe_source_charge_id
        or v_successful_refund_count <> 1
        or v_successful_refund_amount <> v_session_payment.gross_amount_cents
        or v_successful_reversal_count <> 1
        or v_successful_reversal_amount <> v_bound_transfer.amount_cents
      then
        -- Active, partial, ambiguous or externally incomplete TES reversals
        -- remain unmatched and keep the administrative incident open.
        continue;
      end if;

      v_pair_classification := 'tes_v10_fully_reversed_transfer';
    end if;

    v_excluded_ids := array_append(v_excluded_ids, v_payment ->> 'id');
    v_excluded_ids := array_append(v_excluded_ids, v_refund ->> 'id');
    v_pairs := v_pairs || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'classification', v_pair_classification,
      'paymentBalanceTransactionId', v_payment ->> 'id',
      'paymentSourceId', v_refund_charge,
      'refundBalanceTransactionId', v_refund ->> 'id',
      'refundSourceId', v_refund ->> 'source',
      'amountCents', (v_payment ->> 'amount')::bigint,
      'localTransferId', case
        when v_pair_classification = 'tes_v10_fully_reversed_transfer'
          then v_bound_transfer.id
        else null
      end
    )));
  end loop;

  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into v_filtered
  from jsonb_array_elements(p_balance_transactions) as entry(value)
  where not (entry.value ->> 'id' = any(v_excluded_ids));

  -- V1 remains the sole allocator for every movement that still represents an
  -- active TES obligation. The v2 layer only removes fully proven zero-sum
  -- provider pairs before delegating.
  v_result := public.reconcile_automatic_stripe_payout_v1(
    p_stripe_payout_id, p_stripe_account_id, v_filtered, p_observed_at
  );
  if coalesce(v_result ->> 'reason', '') = 'payout_not_found' then
    return v_result;
  end if;

  update public.stripe_payouts as payout
  set neutral_transaction_pairs = v_pairs,
      updated_at = now()
  from public.therapist_connect_accounts as account
  where payout.connect_account_id = account.id
    and payout.stripe_payout_id = p_stripe_payout_id
    and account.stripe_account_id = p_stripe_account_id
    and payout.automatic = true;

  return v_result || jsonb_build_object(
    'neutralPairCount', jsonb_array_length(v_pairs)
  );
end;
$$;

revoke all on function public.reconcile_automatic_stripe_payout_v2(
  text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_automatic_stripe_payout_v2(
  text, text, jsonb, timestamptz
) to service_role;

commit;
