begin;

-- A reversal changes the connected-account balance, but it cannot rewrite a
-- bank Payout that Stripe had already marked paid. Pairs completed before the
-- Payout remain neutral; pairs completed after paid_at preserve the original
-- Transfer allocation and classify only the later debit for audit.
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
  v_refund_occurred_at timestamptz;
  v_reversal_occurred_at timestamptz;
  v_provider_refund_created_at timestamptz;
  v_payout public.stripe_payouts%rowtype;
  v_bound_transfer public.stripe_transfers%rowtype;
  v_session_payment public.session_payments%rowtype;
  v_pair_classification text;
  v_excluded_ids text[] := array[]::text[];
  v_pairs jsonb := '[]'::jsonb;
  v_filtered jsonb;
  v_result jsonb;
  v_post_payout_count integer := 0;
  v_allocated_count integer := 0;
  v_allocated_amount bigint := 0;
  v_remaining_unmatched integer := 0;
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

  select payout.* into v_payout
  from public.stripe_payouts as payout
  join public.therapist_connect_accounts as account
    on account.id = payout.connect_account_id
  where payout.stripe_payout_id = p_stripe_payout_id
    and account.stripe_account_id = p_stripe_account_id
    and payout.automatic = true;

  if not found then
    return public.reconcile_automatic_stripe_payout_v1(
      p_stripe_payout_id, p_stripe_account_id,
      p_balance_transactions, p_observed_at
    );
  end if;

  for v_refund in
    select value from jsonb_array_elements(p_balance_transactions)
    where value ->> 'type' = 'payment_refund'
  loop
    -- Never let chronology from a previous pair leak into the next one.
    v_refund_occurred_at := null;
    v_reversal_occurred_at := null;
    v_provider_refund_created_at := null;
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

      select count(*), coalesce(sum(refund.amount_cents), 0),
             max(refund.processed_at)
        into v_successful_refund_count, v_successful_refund_amount,
             v_refund_occurred_at
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

      select max(entry.occurred_at)
        into v_reversal_occurred_at
      from public.financial_ledger_entries as entry
      join public.stripe_transfer_reversals as reversal
        on reversal.stripe_transfer_id = v_bound_transfer.id
       and reversal.stripe_transfer_reversal_id = entry.source_external_id
      where entry.entry_type = 'transfer_reversal'
        and entry.source_table = 'stripe_transfer_reversals'
        and entry.stripe_transfer_id = v_bound_transfer.id
        and entry.direction = 'credit';

      v_provider_refund_created_at := case
        when coalesce(v_refund ->> 'created', '') ~ '^[0-9]+$'
          then to_timestamp((v_refund ->> 'created')::double precision)
        else null
      end;

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
        or v_refund_occurred_at is null
        or v_reversal_occurred_at is null
      then
        -- Active, partial, ambiguous or externally incomplete TES reversals
        -- remain unmatched and keep the administrative incident open.
        continue;
      end if;

      if v_payout.status = 'paid'
        and v_payout.paid_at is not null
        and v_refund_occurred_at > v_payout.paid_at
        and v_reversal_occurred_at > v_payout.paid_at
        and (
          v_provider_refund_created_at is null
          or v_provider_refund_created_at > v_payout.paid_at
        )
      then
        v_pair_classification := 'tes_v10_post_payout_reversal';
      elsif v_refund_occurred_at <= v_payout.paid_at
        and v_reversal_occurred_at <= v_payout.paid_at
        and (
          v_provider_refund_created_at is null
          or v_provider_refund_created_at <= v_payout.paid_at
        )
      then
        v_pair_classification := 'tes_v10_fully_reversed_transfer';
      else
        -- Cross-cutoff or incomplete chronology is not safe to classify.
        continue;
      end if;
    end if;

    if v_pair_classification <> 'tes_v10_post_payout_reversal' then
      v_excluded_ids := array_append(v_excluded_ids, v_payment ->> 'id');
    else
      v_post_payout_count := v_post_payout_count + 1;
    end if;
    v_excluded_ids := array_append(v_excluded_ids, v_refund ->> 'id');
    v_pairs := v_pairs || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'classification', v_pair_classification,
      'paymentBalanceTransactionId', v_payment ->> 'id',
      'paymentSourceId', v_refund_charge,
      'refundBalanceTransactionId', v_refund ->> 'id',
      'refundSourceId', v_refund ->> 'source',
      'amountCents', (v_payment ->> 'amount')::bigint,
      'localTransferId', case
        when v_pair_classification in (
          'tes_v10_fully_reversed_transfer',
          'tes_v10_post_payout_reversal'
        )
          then v_bound_transfer.id
        else null
      end,
      'refundOccurredAt', v_refund_occurred_at,
      'reversalOccurredAt', v_reversal_occurred_at,
      'payoutPaidAt', v_payout.paid_at
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

  -- V1 deliberately allocates only transfers that are still active. Restore
  -- the historical allocation only for the exact, provider-linked Transfer
  -- whose reversal happened after the bank Payout was already paid.
  if v_post_payout_count > 0 then
    insert into public.stripe_payout_transfer_allocations (
      stripe_payout_id, stripe_transfer_id, payout_batch_id,
      payout_batch_therapist_id, connected_balance_transaction_id,
      source_id, amount_cents, currency, reconciled_at
    )
    select
      v_payout.id,
      transfer.id,
      null,
      null,
      pair.value ->> 'paymentBalanceTransactionId',
      pair.value ->> 'paymentSourceId',
      transfer.amount_cents,
      'BRL',
      p_observed_at
    from jsonb_array_elements(v_pairs) as pair(value)
    join public.stripe_transfers as transfer
      on transfer.id = case
        when coalesce(pair.value ->> 'localTransferId', '') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          then (pair.value ->> 'localTransferId')::uuid
        else null
      end
    where pair.value ->> 'classification' = 'tes_v10_post_payout_reversal'
      and transfer.connect_account_id = v_payout.connect_account_id
      and transfer.transfer_origin = 'session_direct'
      and transfer.status = 'reversed'
      and transfer.amount_cents = (pair.value ->> 'amountCents')::bigint
    on conflict do nothing;

    select count(*)::integer, coalesce(sum(allocation.amount_cents), 0)
      into v_allocated_count, v_allocated_amount
    from public.stripe_payout_transfer_allocations as allocation
    where allocation.stripe_payout_id = v_payout.id;

    v_remaining_unmatched := greatest(
      0,
      coalesce((v_result ->> 'unmatchedCount')::integer, 0)
        - v_post_payout_count
    );

    if v_remaining_unmatched = 0
      and coalesce((v_result ->> 'amountMatches')::boolean, false)
      and v_allocated_amount = v_payout.amount_cents
      and v_allocated_count > 0
    then
      update public.stripe_payouts
      set allocation_status = 'completed',
          unmatched_transaction_count = 0,
          updated_at = now()
      where id = v_payout.id;

      update public.payout_operational_incidents
      set status = 'resolved',
          resolved_at = coalesce(resolved_at, p_observed_at),
          updated_at = now()
      where incident_key =
          'automatic-payout:' || v_payout.id::text || ':allocation'
        and status = 'open';

      v_result := v_result || jsonb_build_object(
        'reconciled', true,
        'allocationStatus', 'completed',
        'allocatedCount', v_allocated_count,
        'unmatchedCount', 0,
        'amountMatches', true
      );
    end if;
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
    'neutralPairCount', jsonb_array_length(v_pairs),
    'postPayoutReversalCount', v_post_payout_count
  );
end;
$$;

revoke all on function public.reconcile_automatic_stripe_payout_v2(
  text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_automatic_stripe_payout_v2(
  text, text, jsonb, timestamptz
) to service_role;

-- Repair only historical rows that already contain the provider-verified
-- pair and whose immutable refund/reversal events happened after paid_at.
-- This restores attribution; it does not create or retry any Stripe movement.
do $repair$
declare
  v_candidate record;
  v_allocated_amount bigint;
begin
  for v_candidate in
    select
      payout.id as payout_id,
      payout.amount_cents as payout_amount_cents,
      payout.paid_at,
      transfer.id as transfer_id,
      transfer.amount_cents as transfer_amount_cents,
      pair.value ->> 'paymentBalanceTransactionId' as balance_transaction_id,
      pair.value ->> 'paymentSourceId' as source_id,
      (
        select max(refund.processed_at)
        from public.session_refunds as refund
        where refund.session_payment_id = payment.id
          and refund.status = 'succeeded'
          and refund.currency = 'BRL'
          and nullif(trim(refund.stripe_refund_id), '') is not null
      ) as refund_occurred_at,
      (
        select max(entry.occurred_at)
        from public.financial_ledger_entries as entry
        join public.stripe_transfer_reversals as reversal
          on reversal.stripe_transfer_id = transfer.id
         and reversal.stripe_transfer_reversal_id = entry.source_external_id
        where entry.entry_type = 'transfer_reversal'
          and entry.source_table = 'stripe_transfer_reversals'
          and entry.stripe_transfer_id = transfer.id
          and entry.direction = 'credit'
      ) as reversal_occurred_at
    from public.stripe_payouts as payout
    cross join lateral jsonb_array_elements(
      payout.neutral_transaction_pairs
    ) as pair(value)
    join public.stripe_transfers as transfer
      on transfer.id = case
        when coalesce(pair.value ->> 'localTransferId', '') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          then (pair.value ->> 'localTransferId')::uuid
        else null
      end
    join public.session_payments as payment
      on payment.id = transfer.session_payment_id
    where payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.paid_at is not null
      and pair.value ->> 'classification' =
        'tes_v10_fully_reversed_transfer'
      and transfer.connect_account_id = payout.connect_account_id
      and transfer.transfer_origin = 'session_direct'
      and transfer.status = 'reversed'
      and transfer.stripe_destination_payment_id =
        pair.value ->> 'paymentSourceId'
      and transfer.stripe_connected_balance_transaction_id =
        pair.value ->> 'paymentBalanceTransactionId'
      and transfer.amount_cents =
        (pair.value ->> 'amountCents')::bigint
      and payment.payment_flow_version = 'v10'
      and payment.financial_status = 'refunded'
      and payment.transfer_status = 'reversed'
      and not payment.refund_pending
      and (
        select count(*) = 1
          and coalesce(sum(refund.amount_cents), 0) =
            payment.gross_amount_cents
        from public.session_refunds as refund
        where refund.session_payment_id = payment.id
          and refund.status = 'succeeded'
          and refund.currency = 'BRL'
          and nullif(trim(refund.stripe_refund_id), '') is not null
      )
      and (
        select count(*) = 1
          and coalesce(sum(reversal.amount_cents), 0) =
            transfer.amount_cents
        from public.stripe_transfer_reversals as reversal
        where reversal.stripe_transfer_id = transfer.id
          and reversal.status = 'succeeded'
          and reversal.currency = 'BRL'
          and nullif(trim(reversal.stripe_transfer_reversal_id), '') is not null
      )
  loop
    if v_candidate.refund_occurred_at is null
      or v_candidate.reversal_occurred_at is null
      or v_candidate.refund_occurred_at <= v_candidate.paid_at
      or v_candidate.reversal_occurred_at <= v_candidate.paid_at
    then
      continue;
    end if;

    insert into public.stripe_payout_transfer_allocations (
      stripe_payout_id, stripe_transfer_id, payout_batch_id,
      payout_batch_therapist_id, connected_balance_transaction_id,
      source_id, amount_cents, currency, reconciled_at
    ) values (
      v_candidate.payout_id,
      v_candidate.transfer_id,
      null,
      null,
      v_candidate.balance_transaction_id,
      v_candidate.source_id,
      v_candidate.transfer_amount_cents,
      'BRL',
      now()
    ) on conflict do nothing;

    if not exists (
      select 1
      from public.stripe_payout_transfer_allocations as allocation
      where allocation.stripe_payout_id = v_candidate.payout_id
        and allocation.stripe_transfer_id = v_candidate.transfer_id
        and allocation.amount_cents = v_candidate.transfer_amount_cents
    ) then
      continue;
    end if;

    update public.stripe_payouts as payout
    set neutral_transaction_pairs = (
          select jsonb_agg(
            case
              when item.value ->> 'localTransferId' =
                  v_candidate.transfer_id::text
                then item.value || jsonb_build_object(
                  'classification', 'tes_v10_post_payout_reversal',
                  'refundOccurredAt', v_candidate.refund_occurred_at,
                  'reversalOccurredAt', v_candidate.reversal_occurred_at,
                  'payoutPaidAt', v_candidate.paid_at
                )
              else item.value
            end
            order by item.ordinality
          )
          from jsonb_array_elements(
            payout.neutral_transaction_pairs
          ) with ordinality as item(value, ordinality)
        ),
        updated_at = now()
    where payout.id = v_candidate.payout_id;

    select coalesce(sum(allocation.amount_cents), 0)
      into v_allocated_amount
    from public.stripe_payout_transfer_allocations as allocation
    where allocation.stripe_payout_id = v_candidate.payout_id;

    if v_allocated_amount = v_candidate.payout_amount_cents then
      update public.stripe_payouts
      set allocation_status = 'completed',
          included_transaction_net_cents = amount_cents,
          unmatched_transaction_count = 0,
          updated_at = now()
      where id = v_candidate.payout_id;

      update public.payout_operational_incidents
      set status = 'resolved',
          resolved_at = coalesce(resolved_at, now()),
          updated_at = now()
      where incident_key =
          'automatic-payout:' || v_candidate.payout_id::text || ':allocation'
        and status = 'open';
    end if;
  end loop;
end;
$repair$;

-- V9 preserves the V8 contract and adds one chronology-bound presentation rule:
-- a direct V10 Transfer reversed only after its bank Payout was paid remains in
-- that received Payout composition. The later debit is not predicted as a future
-- payout group; it stays auditable until Stripe creates a subsequent Payout.
create or replace function public.get_private_therapist_payouts_v9(
  p_period_start date default null,
  p_period_end date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null,
  p_agenda_days integer default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_therapist_id uuid;
  v_period record;
  v_timezone text;
  v_today date;
  v_agenda_end date;
  v_period_start_date date;
  v_period_end_date date;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_history_items jsonb := '[]'::jsonb;
  v_predicted jsonb := '[]'::jsonb;
  v_in_transit jsonb := '[]'::jsonb;
  v_available jsonb := '[]'::jsonb;
  v_without_bank_date jsonb := '[]'::jsonb;
  v_expected_cents integer := 0;
  v_in_transit_cents integer := 0;
begin
  v_base := public.get_private_therapist_payouts_v7(
    p_period_start,
    p_period_end,
    p_page,
    p_page_size,
    p_timezone,
    p_agenda_days
  );
  v_therapist_id := (v_base ->> 'therapistProfileId')::uuid;
  v_timezone := v_base -> 'filters' ->> 'timezone';
  v_today := (v_base -> 'agenda' ->> 'periodStart')::date;
  v_agenda_end := (v_base -> 'agenda' ->> 'periodEnd')::date;
  v_offset := (v_page - 1) * v_page_size;

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_period_start_date :=
    (v_period.starts_at at time zone v_period.timezone)::date;
  v_period_end_date :=
    (v_period.ends_at at time zone v_period.timezone)::date;

  -- Preserve the bank lifecycle after a refund only when the provider money
  -- was already bound to a full Payout allocation and recovery is represented
  -- by an open therapist debt. Unallocated/refundable value keeps the prior
  -- fail-closed behavior and never becomes a bank promise.
  with remaining as (
    select
      transfer.id,
      payment.id as session_payment_id,
      payment.booking_id,
      booking.starts_at as session_date,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      greatest(
        0,
        transfer.amount_cents - coalesce(reversed.amount_cents, 0)
      )::integer as amount_cents,
      case
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        when allocation.id is null
          and transfer.connected_balance_available_on is not null
          then (
            transfer.connected_balance_available_on at time zone v_timezone
          )::date
        else null::date
      end as forecast_date,
      case
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          and (
            payout.status in ('pending', 'in_transit')
            or (
              payout.status = 'paid'
              and payout.provider_reconciliation_status = 'completed'
              and payout.allocation_status = 'completed'
              and allocation.amount_cents = transfer.amount_cents
              and (payout.arrival_at at time zone 'UTC')::date > v_today
            )
          )
          then 'in_transit'
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          then 'predicted'
        when allocation.id is null
          and transfer.connected_balance_available_on is not null
          then 'balance_schedule'
        else 'awaiting_bank_date'
      end as stage
    from public.stripe_transfers as transfer
    left join public.payout_batch_items as batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments as payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    left join public.stripe_payout_transfer_allocations as allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    left join lateral (
      select coalesce(sum(reversal.amount_cents), 0)::integer as amount_cents
      from public.stripe_transfer_reversals as reversal
      where reversal.stripe_transfer_id = transfer.id
        and reversal.status = 'succeeded'
    ) as reversed on true
    where transfer.therapist_profile_id = v_therapist_id
      and transfer.status = 'transferred'
      and (
        (
          payment.financial_status = 'paid'
          and not exists (
            select 1
            from public.session_refunds as refund
            where refund.session_payment_id = payment.id
              and refund.status <> 'failed'
          )
        )
        or (
          payment.financial_status = 'refunded'
          and allocation.id is not null
          and allocation.amount_cents = transfer.amount_cents
          and reversed.amount_cents = 0
          and exists (
            select 1
            from public.therapist_financial_debts as debt
            where debt.session_payment_id = payment.id
              and debt.status = 'open'
              and debt.open_amount_cents > 0
          )
        )
      )
      and (
        allocation.id is null
        or payout.status in (
          'pending_balance', 'creating', 'pending', 'in_transit'
        )
        or (
          payout.status = 'paid'
          and payout.provider_reconciliation_status = 'completed'
          and payout.allocation_status = 'completed'
          and allocation.amount_cents = transfer.amount_cents
          and payout.arrival_at is not null
          and (payout.arrival_at at time zone 'UTC')::date > v_today
        )
      )
      and not exists (
        select 1
        from public.session_disputes as dispute
        where dispute.session_payment_id = payment.id
      )
      and not exists (
        select 1
        from public.stripe_transfer_reversals as reversal
        where reversal.stripe_transfer_id = transfer.id
          and reversal.status not in ('succeeded', 'failed')
      )
  ), scoped as (
    select *
    from remaining
    where amount_cents > 0
      and (forecast_date is null or forecast_date <= v_agenda_end)
  ), grouped as (
    select
      case
        when forecast_date < v_today then null::date
        else forecast_date
      end as forecast_date,
      case
        when forecast_date < v_today then 'awaiting_bank_date'
        else stage
      end as stage,
      sum(amount_cents)::integer as amount_cents,
      count(distinct session_payment_id)::integer as session_count,
      jsonb_agg(jsonb_build_object(
        'sessionPaymentId', session_payment_id,
        'bookingId', booking_id,
        'patientDisplayName', patient_display_name,
        'therapyNameSnapshot', therapy_name_snapshot,
        'sessionDate', session_date,
        'amountCents', amount_cents
      ) order by session_date, session_payment_id) as composition
    from scoped
    group by
      case when forecast_date < v_today then null::date else forecast_date end,
      case
        when forecast_date < v_today then 'awaiting_bank_date'
        else stage
      end
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'predicted:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'predicted'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'in-transit:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'in_transit'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'balance:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'balance_schedule'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'bank-date-pending',
      'date', null,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    )) filter (
      where stage = 'awaiting_bank_date'
    ), '[]'::jsonb),
    coalesce(sum(amount_cents) filter (
      where stage <> 'in_transit'
    ), 0)::integer,
    coalesce(sum(amount_cents) filter (
      where stage = 'in_transit'
    ), 0)::integer
  into
    v_predicted,
    v_in_transit,
    v_available,
    v_without_bank_date,
    v_expected_cents,
    v_in_transit_cents
  from grouped;

  with received_rows as (
    select
      case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end as event_date,
      'received'::text as status,
      allocation.amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.stripe_payout_transfer_allocations as allocation
    join public.stripe_transfers as transfer
      on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    left join public.payout_batch_items as batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments as payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    where transfer.therapist_profile_id = v_therapist_id
      and (
        transfer.status = 'transferred'
        or (
          transfer.status = 'reversed'
          and exists (
            select 1
            from jsonb_array_elements(
              payout.neutral_transaction_pairs
            ) as pair(value)
            where pair.value ->> 'classification' =
                'tes_v10_post_payout_reversal'
              and pair.value ->> 'localTransferId' = transfer.id::text
          )
        )
      )
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
      and allocation.amount_cents = transfer.amount_cents
      and (
        (
          payout.arrival_at is not null
          and (payout.arrival_at at time zone 'UTC')::date
            <= (now() at time zone v_period.timezone)::date
        )
        or (
          payout.arrival_at is null
          and coalesce(payout.paid_at, payout.updated_at) <= now()
        )
      )
      and case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end >= v_period_start_date
      and case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end < v_period_end_date
  ), review_rows as (
    select distinct on (payment.id)
      (
        coalesce(payout.failed_at, transfer.updated_at,
          transfer_job.updated_at, payment.updated_at)
        at time zone v_period.timezone
      )::date as event_date,
      'under_review'::text as status,
      greatest(
        0,
        coalesce(
          transfer.amount_cents,
          transfer_job.transfer_amount_cents,
          payment.therapist_amount_cents
        )
      )::integer as amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.session_payments as payment
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    left join public.session_transfer_jobs as transfer_job
      on transfer_job.session_payment_id = payment.id
    left join public.payout_batch_items as batch_item
      on batch_item.session_payment_id = payment.id
      and batch_item.status <> 'removed'
    left join public.stripe_transfers as transfer
      on transfer.session_payment_id = payment.id
      or transfer.payout_batch_item_id = batch_item.id
    left join public.stripe_payout_transfer_allocations as allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    where payment.therapist_profile_id = v_therapist_id
      and (
        (
          payment.financial_status in (
            'paid', 'partially_refunded', 'refunded', 'disputed'
          )
          and public.private_therapist_receipt_status_v2(payment.id) in (
            'blocked', 'failed', 'reversed', 'disputed'
          )
        )
        or transfer_job.status in (
          'failed', 'partially_reversed', 'reversed',
          'reconciliation_required'
        )
        or transfer.status in (
          'failed', 'reversed', 'reconciliation_required'
        )
        or payout.status in (
          'failed', 'canceled', 'reconciliation_required'
        )
      )
      and not (
        payment.payment_flow_version = 'v10'
        and payment.financial_status = 'refunded'
        and payment.transfer_status = 'reversed'
        and not payment.refund_pending
        and transfer.id is not null
        and transfer.transfer_origin = 'session_direct'
        and transfer.status = 'reversed'
        and transfer.session_payment_id = payment.id
        and transfer.connect_account_id
          is not distinct from payment.connect_account_id_snapshot
        and transfer.stripe_source_charge_id
          is not distinct from payment.stripe_charge_id
        and nullif(trim(transfer.stripe_destination_payment_id), '')
          is not null
        and nullif(
          trim(transfer.stripe_connected_balance_transaction_id), ''
        ) is not null
        and transfer_job.id is not null
        and transfer_job.status = 'reversed'
        and transfer_job.stripe_transfer_id
          is not distinct from transfer.id
        and not exists (
          select 1
          from public.stripe_payout_transfer_allocations as closed_allocation
          where closed_allocation.stripe_transfer_id = transfer.id
        )
        and not exists (
          select 1
          from public.therapist_financial_debts as debt
          where debt.session_payment_id = payment.id
            and debt.status = 'open'
            and debt.open_amount_cents > 0
        )
        and not exists (
          select 1
          from public.session_refund_decisions_v10 as decision
          join public.session_refund_incidents_v10 as incident
            on incident.session_refund_decision_id = decision.id
          where decision.session_payment_id = payment.id
            and incident.resolved_at is null
        )
        and (
          select count(*) = 1
            and coalesce(sum(refund.amount_cents), 0)
              = payment.gross_amount_cents
          from public.session_refunds as refund
          where refund.session_payment_id = payment.id
            and refund.status = 'succeeded'
            and refund.currency = 'BRL'
            and nullif(trim(refund.stripe_refund_id), '') is not null
        )
        and (
          select count(*) = 1
            and coalesce(sum(reversal.amount_cents), 0)
              = transfer.amount_cents
          from public.stripe_transfer_reversals as reversal
          where reversal.stripe_transfer_id = transfer.id
            and reversal.status = 'succeeded'
            and reversal.currency = 'BRL'
            and nullif(trim(reversal.stripe_transfer_reversal_id), '')
              is not null
        )
      )
      and not exists (
        select 1
        from received_rows as received
        where received.session_payment_id = payment.id
      )
      and coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) >= v_period.starts_at
      and coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) < v_period.ends_at
    order by payment.id,
      coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) desc
  ), all_rows as (
    select * from received_rows
    union all
    select * from review_rows
  ), grouped as (
    select
      event_date,
      status,
      sum(amount_cents)::integer as amount_cents,
      count(distinct session_payment_id)::integer as session_count,
      jsonb_agg(jsonb_build_object(
        'sessionPaymentId', session_payment_id,
        'bookingId', booking_id,
        'patientDisplayName', patient_display_name,
        'therapyNameSnapshot', therapy_name_snapshot,
        'sessionDate', session_date,
        'amountCents', amount_cents
      ) order by session_date desc, session_payment_id) as composition
    from all_rows
    group by event_date, status
  ), counted as (
    select count(*)::integer as count from grouped
  ), paged as (
    select *
    from grouped
    order by event_date desc,
      case when status = 'received' then 0 else 1 end
    limit v_page_size offset v_offset
  )
  select
    counted.count,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', paged.status || ':' || paged.event_date::text,
      'date', paged.event_date,
      'amountCents', paged.amount_cents,
      'sessionCount', paged.session_count,
      'status', paged.status,
      'composition', paged.composition
    ) order by paged.event_date desc,
      case when paged.status = 'received' then 0 else 1 end)
      filter (where paged.event_date is not null), '[]'::jsonb)
  into v_total_count, v_history_items
  from counted
  left join paged on true
  group by counted.count;

  v_base := jsonb_set(v_base, '{contractVersion}', '9'::jsonb, true);
  v_base := jsonb_set(
    v_base, '{summary,expectedCents}', to_jsonb(v_expected_cents), true
  );
  v_base := jsonb_set(
    v_base, '{summary,inTransitCents}', to_jsonb(v_in_transit_cents), true
  );
  v_base := jsonb_set(v_base, '{agenda,predicted}', v_predicted, true);
  v_base := jsonb_set(v_base, '{agenda,inTransit}', v_in_transit, true);
  v_base := jsonb_set(
    v_base, '{agenda,balanceAvailable}', v_available, true
  );
  v_base := jsonb_set(
    v_base, '{agenda,awaitingBankDate}', v_without_bank_date, true
  );
  v_base := jsonb_set(v_base, '{historyItems}', v_history_items, true);
  v_base := jsonb_set(
    v_base,
    '{pagination}',
    jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case
        when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer
      end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    true
  );

  return v_base;
end;
$$;

revoke all on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) is 'Repasses V9: preserva o Payout bancario recebido quando a reversao V10 ocorreu somente depois do pagamento, sem criar grupo futuro ou revisao para o terapeuta.';

create or replace function public.private_admin_session_payout_projection_v10(
  p_session_payment_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'payout_display_status', case
      when coalesce(debt_state.open_amount_cents, 0) > 0
        then 'compensation_pending'
      when (job.status = 'reversed' or transfer.status = 'reversed')
        and not (
          bank_payout.status = 'paid'
          and bank_payout.provider_reconciliation_status = 'completed'
          and bank_payout.allocation_status = 'completed'
          and bank_payout.allocated_amount_cents = transfer.amount_cents
          and bank_payout.post_payout_reversal
        )
        then 'reversed'
      when payment.financial_status = 'refunded'
        and transfer.status = 'transferred'
        and coalesce(debt_state.fully_compensated, false)
        then 'compensated'
      when payment.financial_status = 'refunded'
        and transfer.status = 'transferred'
        then 'needs_review'
      when payment.financial_status = 'refunded'
        and not (
          bank_payout.status = 'paid'
          and bank_payout.provider_reconciliation_status = 'completed'
          and bank_payout.allocation_status = 'completed'
          and bank_payout.allocated_amount_cents = transfer.amount_cents
          and bank_payout.post_payout_reversal
        )
        then 'refunded'
      when job.status = 'offset_only'
        then 'compensated'
      when job.status in ('partially_reversed', 'failed')
        or transfer.status = 'failed'
        then 'failed'
      when job.status = 'reconciliation_required'
        or transfer.status = 'reconciliation_required'
        or bank_payout.status = 'reconciliation_required'
        then 'needs_review'
      when bank_payout.status in ('failed', 'canceled')
        then 'failed'
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        and (
          (
            bank_payout.arrival_at is not null
            and (bank_payout.arrival_at at time zone 'UTC')::date
              <= (now() at time zone 'America/Sao_Paulo')::date
          )
          or (
            bank_payout.arrival_at is null
            and bank_payout.paid_at is not null
            and bank_payout.paid_at <= now()
          )
        )
        then 'paid'
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        and (bank_payout.arrival_at at time zone 'UTC')::date
          > (now() at time zone 'America/Sao_Paulo')::date
        then 'bank_pending'
      when bank_payout.status = 'paid'
        or (
          bank_payout.id is not null
          and bank_payout.allocated_amount_cents <> transfer.amount_cents
        )
        then 'needs_review'
      when bank_payout.status in ('pending', 'in_transit')
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        then 'bank_pending'
      when job.status in ('queued', 'creating', 'pending_source', 'transferred')
        or transfer.status in ('pending', 'creating', 'transferred')
        or bank_payout.status in ('pending_balance', 'creating')
        then 'processing'
      else 'processing'
    end,
    'financial_review_status', case
      when exists (
        select 1
        from public.session_confirmation_incidents as incident
        where incident.session_payment_id = payment.id
          and incident.status = 'open'
          and incident.classification in (
            'no_show_therapist', 'no_show_both', 'requires_review'
          )
      ) then 'attendance_review'
      when exists (
        select 1
        from public.booking_reschedule_requests as request
        where request.booking_id = payment.booking_id
          and request.status = 'pending_admin_review'
          and request.change_kind in (
            'therapist_reschedule', 'therapist_cancellation'
          )
      ) then 'therapist_change_refund_review'
      else null
    end,
    'debt_offset_amount_cents', coalesce(
      nullif(job.debt_offset_amount_cents, 0),
      nullif(transfer.debt_offset_amount_cents, 0)
    ),
    'transfer_effective_amount_cents', coalesce(
      job.transfer_amount_cents,
      transfer.amount_cents
    ),
    'bank_paid_at', case
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        and (
          (
            bank_payout.arrival_at is not null
            and (bank_payout.arrival_at at time zone 'UTC')::date
              <= (now() at time zone 'America/Sao_Paulo')::date
          )
          or (
            bank_payout.arrival_at is null
            and bank_payout.paid_at is not null
            and bank_payout.paid_at <= now()
          )
        )
        then coalesce(bank_payout.arrival_at, bank_payout.paid_at)
      else null
    end,
    'bank_paid_date', case
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        and bank_payout.arrival_at is not null
        and (bank_payout.arrival_at at time zone 'UTC')::date
          <= (now() at time zone 'America/Sao_Paulo')::date
        then (bank_payout.arrival_at at time zone 'UTC')::date
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        and bank_payout.arrival_at is null
        and bank_payout.paid_at is not null
        and bank_payout.paid_at <= now()
        then (bank_payout.paid_at at time zone 'America/Sao_Paulo')::date
      else null
    end
  ))
  from public.session_payments as payment
  left join public.session_transfer_jobs as job
    on job.session_payment_id = payment.id
  left join lateral (
    select candidate.*
    from public.stripe_transfers as candidate
    where candidate.session_payment_id = payment.id
    order by
      (candidate.id = job.stripe_transfer_id) desc,
      coalesce(candidate.transferred_at, candidate.created_at) desc,
      candidate.id desc
    limit 1
  ) as transfer on true
  left join lateral (
    select
      coalesce(sum(debt.open_amount_cents) filter (
        where debt.status = 'open' and debt.open_amount_cents > 0
      ), 0)::integer as open_amount_cents,
      coalesce(bool_or(
        debt.status = 'settled'
        and coalesce(offsets.amount_cents, 0) = debt.principal_amount_cents
      ), false) as fully_compensated
    from public.therapist_financial_debts as debt
    left join lateral (
      select coalesce(sum(event.amount_cents), 0)::integer as amount_cents
      from public.therapist_financial_debt_events as event
      where event.therapist_financial_debt_id = debt.id
        and event.event_type = 'transfer_offset'
        and event.direction = 'decrease'
    ) as offsets on true
    where debt.session_payment_id = payment.id
  ) as debt_state on true
  left join lateral (
    select
      payout.id,
      payout.status,
      payout.provider_reconciliation_status,
      payout.allocation_status,
      payout.arrival_at,
      payout.paid_at,
      allocation.amount_cents as allocated_amount_cents,
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(payout.neutral_transaction_pairs, '[]'::jsonb)
        ) as pair(value)
        where pair.value ->> 'classification' =
          'tes_v10_post_payout_reversal'
          and pair.value ->> 'localTransferId' = transfer.id::text
      ) as post_payout_reversal
    from public.stripe_payout_transfer_allocations as allocation
    join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
    order by payout.created_at desc, payout.id desc
    limit 1
  ) as bank_payout on true
  where payment.id = p_session_payment_id
    and (job.id is not null or transfer.id is not null);
$$;

revoke all on function public.private_admin_session_payout_projection_v10(uuid)
  from public, anon, authenticated;

comment on function public.private_admin_session_payout_projection_v10(uuid) is
  'Private V9/V10 Admin projection that preserves a paid bank Payout when its V10 Transfer was reversed only afterwards.';

commit;
