begin;

-- A later connected-account debit can legitimately compose a new automatic
-- Payout after the original Transfer was already included in a paid Payout.
-- Keep that provider evidence separate from positive Transfer allocations:
-- the original bank deposit stays immutable and the later Payout is presented
-- at its net amount only after exact Stripe and local lifecycle reconciliation.
create table if not exists public.stripe_payout_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  stripe_payout_id uuid not null
    references public.stripe_payouts(id) on delete restrict,
  original_stripe_payout_id uuid not null
    references public.stripe_payouts(id) on delete restrict,
  session_payment_id uuid not null
    references public.session_payments(id) on delete restrict,
  stripe_transfer_id uuid not null
    references public.stripe_transfers(id) on delete restrict,
  stripe_transfer_reversal_id uuid not null
    references public.stripe_transfer_reversals(id) on delete restrict,
  connected_balance_transaction_id text not null,
  source_id text not null,
  verified_refund_charge_id text not null,
  adjustment_type text not null default 'post_payout_transfer_reversal',
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  occurred_at timestamptz not null,
  reconciled_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint stripe_payout_balance_adjustments_payout_distinct
    check (stripe_payout_id <> original_stripe_payout_id),
  constraint stripe_payout_balance_adjustments_type_check
    check (adjustment_type = 'post_payout_transfer_reversal'),
  constraint stripe_payout_balance_adjustments_amount_positive
    check (amount_cents > 0),
  constraint stripe_payout_balance_adjustments_currency_brl
    check (currency = 'BRL'),
  constraint stripe_payout_balance_adjustments_balance_tx_present
    check (length(trim(connected_balance_transaction_id)) > 0),
  constraint stripe_payout_balance_adjustments_source_present
    check (length(trim(source_id)) > 0),
  constraint stripe_payout_balance_adjustments_charge_present
    check (length(trim(verified_refund_charge_id)) > 0),
  constraint stripe_payout_balance_adjustments_payout_balance_tx_unique
    unique (stripe_payout_id, connected_balance_transaction_id),
  constraint stripe_payout_balance_adjustments_reversal_unique
    unique (stripe_transfer_reversal_id)
);

create index if not exists stripe_payout_balance_adjustments_payout_idx
  on public.stripe_payout_balance_adjustments (stripe_payout_id);
create index if not exists stripe_payout_balance_adjustments_original_idx
  on public.stripe_payout_balance_adjustments (original_stripe_payout_id);
create index if not exists stripe_payout_balance_adjustments_payment_idx
  on public.stripe_payout_balance_adjustments (session_payment_id);

alter table public.stripe_payout_balance_adjustments enable row level security;
revoke all on public.stripe_payout_balance_adjustments
  from public, anon, authenticated;
grant select, insert on public.stripe_payout_balance_adjustments
  to service_role;

comment on table public.stripe_payout_balance_adjustments is
  'Immutable provider evidence for a negative connected-balance movement included in a later automatic Payout. It never creates or changes money movement.';

create or replace function public.reconcile_automatic_stripe_payout_v3(
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
  v_payout public.stripe_payouts%rowtype;
  v_transaction jsonb;
  v_transfer public.stripe_transfers%rowtype;
  v_payment public.session_payments%rowtype;
  v_reversal public.stripe_transfer_reversals%rowtype;
  v_original_payout public.stripe_payouts%rowtype;
  v_transaction_id text;
  v_source_id text;
  v_verified_charge text;
  v_currency text;
  v_type text;
  v_amount integer;
  v_net integer;
  v_available_on timestamptz;
  v_provider_created_at timestamptz;
  v_refund_occurred_at timestamptz;
  v_reversal_occurred_at timestamptz;
  v_candidate_count integer;
  v_refund_count integer;
  v_refund_amount bigint;
  v_reversal_count integer;
  v_reversal_amount bigint;
  v_total_net bigint := 0;
  v_positive_amount bigint := 0;
  v_adjustment_amount bigint := 0;
  v_positive_bindings jsonb := '[]'::jsonb;
  v_adjustment_bindings jsonb := '[]'::jsonb;
  v_pairs jsonb := '[]'::jsonb;
  v_binding jsonb;
  v_allocated_count integer := 0;
  v_adjustment_count integer := 0;
begin
  if nullif(trim(p_stripe_payout_id), '') is null
    or nullif(trim(p_stripe_account_id), '') is null
    or p_observed_at is null
    or jsonb_typeof(p_balance_transactions) <> 'array'
    or jsonb_array_length(p_balance_transactions) > 1000
    or exists (
      select 1
      from jsonb_array_elements(p_balance_transactions) as entry(value)
      group by entry.value ->> 'id'
      having nullif(trim(entry.value ->> 'id'), '') is null or count(*) > 1
    )
  then
    raise exception 'AUTOMATIC_STRIPE_PAYOUT_RECONCILIATION_INVALID'
      using errcode = '22023';
  end if;

  -- V3 is deliberately narrow. Payouts without a standalone verified debit
  -- retain every existing V2 rule and result.
  if not exists (
    select 1
    from jsonb_array_elements(p_balance_transactions) as entry(value)
    where entry.value ->> 'type' = 'payment_refund'
      and coalesce(entry.value ->> 'amount', '') ~ '^-[0-9]+$'
      and nullif(trim(entry.value ->> 'verified_refund_charge'), '') is not null
  ) then
    return public.reconcile_automatic_stripe_payout_v2(
      p_stripe_payout_id,
      p_stripe_account_id,
      p_balance_transactions,
      p_observed_at
    );
  end if;

  select payout.* into v_payout
  from public.stripe_payouts as payout
  join public.therapist_connect_accounts as account
    on account.id = payout.connect_account_id
  where payout.stripe_payout_id = p_stripe_payout_id
    and account.stripe_account_id = p_stripe_account_id
    and payout.automatic = true
  for update of payout;

  if not found then
    return jsonb_build_object('reconciled', false, 'reason', 'payout_not_found');
  end if;

  for v_transaction in
    select value from jsonb_array_elements(p_balance_transactions)
  loop
    v_transaction_id := nullif(trim(v_transaction ->> 'id'), '');
    v_source_id := nullif(trim(v_transaction ->> 'source'), '');
    v_verified_charge :=
      nullif(trim(v_transaction ->> 'verified_refund_charge'), '');
    v_currency := lower(coalesce(v_transaction ->> 'currency', ''));
    v_type := coalesce(v_transaction ->> 'type', '');
    begin
      v_amount := (v_transaction ->> 'amount')::integer;
      v_net := (v_transaction ->> 'net')::integer;
    exception when others then
      return public.reconcile_automatic_stripe_payout_v2(
        p_stripe_payout_id, p_stripe_account_id,
        p_balance_transactions, p_observed_at
      );
    end;

    v_total_net := v_total_net + v_net;
    v_available_on := case
      when coalesce(v_transaction ->> 'available_on', '') ~ '^[0-9]+$'
        then to_timestamp((v_transaction ->> 'available_on')::double precision)
      else null
    end;
    v_provider_created_at := case
      when coalesce(v_transaction ->> 'created', '') ~ '^[0-9]+$'
        then to_timestamp((v_transaction ->> 'created')::double precision)
      else null
    end;

    if v_type = 'payment'
      and v_amount > 0
      and v_net = v_amount
      and v_currency = 'brl'
      and v_transaction_id is not null
      and v_source_id is not null
    then
      select count(distinct transfer.id)
        into v_candidate_count
      from public.stripe_transfers as transfer
      join public.therapist_connect_accounts as account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and transfer.status = 'transferred'
        and transfer.amount_cents = v_amount
        and transfer.stripe_destination_payment_id = v_source_id
        and (
          transfer.stripe_connected_balance_transaction_id is null
          or transfer.stripe_connected_balance_transaction_id = v_transaction_id
        );

      if v_candidate_count <> 1 then
        return public.reconcile_automatic_stripe_payout_v2(
          p_stripe_payout_id, p_stripe_account_id,
          p_balance_transactions, p_observed_at
        );
      end if;

      select transfer.* into v_transfer
      from public.stripe_transfers as transfer
      join public.therapist_connect_accounts as account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and transfer.status = 'transferred'
        and transfer.amount_cents = v_amount
        and transfer.stripe_destination_payment_id = v_source_id
        and (
          transfer.stripe_connected_balance_transaction_id is null
          or transfer.stripe_connected_balance_transaction_id = v_transaction_id
        )
      limit 1;

      if exists (
        select 1
        from jsonb_array_elements(v_positive_bindings) as binding(value)
        where binding.value ->> 'localTransferId' = v_transfer.id::text
      ) then
        return public.reconcile_automatic_stripe_payout_v2(
          p_stripe_payout_id, p_stripe_account_id,
          p_balance_transactions, p_observed_at
        );
      end if;

      v_positive_amount := v_positive_amount + v_amount;
      v_positive_bindings := v_positive_bindings || jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object(
          'localTransferId', v_transfer.id,
          'balanceTransactionId', v_transaction_id,
          'sourceId', v_source_id,
          'amountCents', v_amount,
          'availableOn', v_available_on
        ))
      );
      continue;
    end if;

    if v_type = 'payment_refund'
      and v_amount < 0
      and v_net = v_amount
      and v_currency = 'brl'
      and v_transaction_id is not null
      and v_source_id is not null
      and v_verified_charge is not null
      and v_provider_created_at is not null
    then
      select count(distinct transfer.id)
        into v_candidate_count
      from public.stripe_transfers as transfer
      join public.therapist_connect_accounts as account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and transfer.transfer_origin = 'session_direct'
        and transfer.status = 'reversed'
        and transfer.amount_cents = -v_amount
        and transfer.stripe_destination_payment_id = v_verified_charge;

      if v_candidate_count <> 1 then
        return public.reconcile_automatic_stripe_payout_v2(
          p_stripe_payout_id, p_stripe_account_id,
          p_balance_transactions, p_observed_at
        );
      end if;

      select transfer.* into v_transfer
      from public.stripe_transfers as transfer
      join public.therapist_connect_accounts as account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and transfer.transfer_origin = 'session_direct'
        and transfer.status = 'reversed'
        and transfer.amount_cents = -v_amount
        and transfer.stripe_destination_payment_id = v_verified_charge
      limit 1;

      select payment.* into v_payment
      from public.session_payments as payment
      where payment.id = v_transfer.session_payment_id;

      select count(*), coalesce(sum(refund.amount_cents), 0),
             max(refund.processed_at)
        into v_refund_count, v_refund_amount, v_refund_occurred_at
      from public.session_refunds as refund
      where refund.session_payment_id = v_payment.id
        and refund.status = 'succeeded'
        and refund.currency = 'BRL'
        and nullif(trim(refund.stripe_refund_id), '') is not null;

      select count(*), coalesce(sum(reversal.amount_cents), 0)
        into v_reversal_count, v_reversal_amount
      from public.stripe_transfer_reversals as reversal
      where reversal.stripe_transfer_id = v_transfer.id
        and reversal.status = 'succeeded'
        and reversal.currency = 'BRL'
        and nullif(trim(reversal.stripe_transfer_reversal_id), '') is not null;

      v_reversal := null;
      select reversal.* into v_reversal
      from public.stripe_transfer_reversals as reversal
      where reversal.stripe_transfer_id = v_transfer.id
        and reversal.status = 'succeeded'
        and reversal.currency = 'BRL'
        and nullif(trim(reversal.stripe_transfer_reversal_id), '') is not null
      order by reversal.created_at
      limit 1;

      select max(entry.occurred_at)
        into v_reversal_occurred_at
      from public.financial_ledger_entries as entry
      where entry.entry_type = 'transfer_reversal'
        and entry.source_table = 'stripe_transfer_reversals'
        and entry.source_external_id = v_reversal.stripe_transfer_reversal_id
        and entry.stripe_transfer_id = v_transfer.id
        and entry.direction = 'credit';

      select payout.* into v_original_payout
      from public.stripe_payout_transfer_allocations as allocation
      join public.stripe_payouts as payout
        on payout.id = allocation.stripe_payout_id
      where allocation.stripe_transfer_id = v_transfer.id
        and allocation.amount_cents = v_transfer.amount_cents
        and payout.id <> v_payout.id
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
      limit 1;

      if v_payment.id is null
        or v_payment.payment_flow_version <> 'v10'
        or v_payment.financial_status <> 'refunded'
        or v_payment.transfer_status <> 'reversed'
        or v_payment.refund_pending
        or v_payment.connect_account_id_snapshot
          is distinct from v_transfer.connect_account_id
        or v_payment.stripe_charge_id
          is distinct from v_transfer.stripe_source_charge_id
        or v_refund_count <> 1
        or v_refund_amount <> v_payment.gross_amount_cents
        or v_refund_occurred_at is null
        or v_reversal_count <> 1
        or v_reversal_amount <> v_transfer.amount_cents
        or v_reversal.id is null
        or v_reversal_occurred_at is null
        or v_original_payout.id is null
        or v_original_payout.paid_at is null
        or v_refund_occurred_at <= v_original_payout.paid_at
        or v_reversal_occurred_at <= v_original_payout.paid_at
        or v_provider_created_at <= v_original_payout.paid_at
        or exists (
          select 1
          from public.therapist_financial_debts as debt
          where debt.session_payment_id = v_payment.id
            and debt.status = 'open'
            and debt.open_amount_cents > 0
        )
        or exists (
          select 1
          from public.session_refund_decisions_v10 as decision
          join public.session_refund_incidents_v10 as incident
            on incident.session_refund_decision_id = decision.id
          where decision.session_payment_id = v_payment.id
            and incident.resolved_at is null
        )
        or exists (
          select 1
          from jsonb_array_elements(v_adjustment_bindings) as binding(value)
          where binding.value ->> 'localTransferId' = v_transfer.id::text
        )
      then
        return public.reconcile_automatic_stripe_payout_v2(
          p_stripe_payout_id, p_stripe_account_id,
          p_balance_transactions, p_observed_at
        );
      end if;

      if exists (
        select 1
        from public.stripe_payout_balance_adjustments as adjustment
        where (
          adjustment.stripe_transfer_reversal_id = v_reversal.id
          or (
            adjustment.stripe_payout_id = v_payout.id
            and adjustment.connected_balance_transaction_id = v_transaction_id
          )
        )
        and (
          adjustment.stripe_payout_id <> v_payout.id
          or adjustment.original_stripe_payout_id <> v_original_payout.id
          or adjustment.session_payment_id <> v_payment.id
          or adjustment.stripe_transfer_id <> v_transfer.id
          or adjustment.source_id <> v_source_id
          or adjustment.verified_refund_charge_id <> v_verified_charge
          or adjustment.amount_cents <> -v_amount
          or adjustment.currency <> 'BRL'
        )
      ) then
        return public.reconcile_automatic_stripe_payout_v2(
          p_stripe_payout_id, p_stripe_account_id,
          p_balance_transactions, p_observed_at
        );
      end if;

      v_adjustment_amount := v_adjustment_amount - v_amount;
      v_adjustment_bindings := v_adjustment_bindings || jsonb_build_array(
        jsonb_build_object(
          'originalPayoutId', v_original_payout.id,
          'sessionPaymentId', v_payment.id,
          'localTransferId', v_transfer.id,
          'localReversalId', v_reversal.id,
          'balanceTransactionId', v_transaction_id,
          'sourceId', v_source_id,
          'verifiedRefundChargeId', v_verified_charge,
          'amountCents', -v_amount,
          'occurredAt', v_provider_created_at
        )
      );
      v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
        'classification', 'tes_v10_post_payout_reversal_debit',
        'originalPayoutId', v_original_payout.id,
        'refundBalanceTransactionId', v_transaction_id,
        'refundSourceId', v_source_id,
        'paymentSourceId', v_verified_charge,
        'amountCents', -v_amount,
        'localTransferId', v_transfer.id,
        'localReversalId', v_reversal.id,
        'refundOccurredAt', v_refund_occurred_at,
        'reversalOccurredAt', v_reversal_occurred_at,
        'providerOccurredAt', v_provider_created_at,
        'originalPayoutPaidAt', v_original_payout.paid_at
      ));
      continue;
    end if;

    -- Unsupported movement types and incomplete provider evidence stay on the
    -- existing fail-closed path.
    return public.reconcile_automatic_stripe_payout_v2(
      p_stripe_payout_id, p_stripe_account_id,
      p_balance_transactions, p_observed_at
    );
  end loop;

  if jsonb_array_length(v_positive_bindings) = 0
    or jsonb_array_length(v_adjustment_bindings) = 0
    or v_total_net <> v_payout.amount_cents
    or v_positive_amount - v_adjustment_amount <> v_payout.amount_cents
  then
    return public.reconcile_automatic_stripe_payout_v2(
      p_stripe_payout_id, p_stripe_account_id,
      p_balance_transactions, p_observed_at
    );
  end if;

  delete from public.stripe_payout_transfer_allocations
  where stripe_payout_id = v_payout.id;

  for v_binding in
    select value from jsonb_array_elements(v_positive_bindings)
  loop
    select transfer.* into v_transfer
    from public.stripe_transfers as transfer
    where transfer.id = (v_binding ->> 'localTransferId')::uuid
    for update;

    update public.stripe_transfers
    set stripe_connected_balance_transaction_id = coalesce(
          stripe_connected_balance_transaction_id,
          v_binding ->> 'balanceTransactionId'
        ),
        connected_balance_available_on = coalesce(
          connected_balance_available_on,
          (v_binding ->> 'availableOn')::timestamptz
        ),
        updated_at = now()
    where id = v_transfer.id;

    insert into public.stripe_payout_transfer_allocations (
      stripe_payout_id, stripe_transfer_id, payout_batch_id,
      payout_batch_therapist_id, connected_balance_transaction_id,
      source_id, amount_cents, currency, reconciled_at
    )
    select
      v_payout.id,
      v_transfer.id,
      item.payout_batch_id,
      item.payout_batch_therapist_id,
      v_binding ->> 'balanceTransactionId',
      v_binding ->> 'sourceId',
      (v_binding ->> 'amountCents')::integer,
      'BRL',
      p_observed_at
    from (select 1) as anchor
    left join public.payout_batch_items as item
      on item.id = v_transfer.payout_batch_item_id;

    v_allocated_count := v_allocated_count + 1;
  end loop;

  for v_binding in
    select value from jsonb_array_elements(v_adjustment_bindings)
  loop
    insert into public.stripe_payout_balance_adjustments (
      stripe_payout_id, original_stripe_payout_id, session_payment_id,
      stripe_transfer_id, stripe_transfer_reversal_id,
      connected_balance_transaction_id, source_id,
      verified_refund_charge_id, amount_cents, currency,
      occurred_at, reconciled_at
    ) values (
      v_payout.id,
      (v_binding ->> 'originalPayoutId')::uuid,
      (v_binding ->> 'sessionPaymentId')::uuid,
      (v_binding ->> 'localTransferId')::uuid,
      (v_binding ->> 'localReversalId')::uuid,
      v_binding ->> 'balanceTransactionId',
      v_binding ->> 'sourceId',
      v_binding ->> 'verifiedRefundChargeId',
      (v_binding ->> 'amountCents')::integer,
      'BRL',
      (v_binding ->> 'occurredAt')::timestamptz,
      p_observed_at
    ) on conflict do nothing;
    v_adjustment_count := v_adjustment_count + 1;
  end loop;

  update public.stripe_payouts
  set provider_reconciliation_status = 'completed',
      allocation_status = 'completed',
      included_transaction_net_cents = v_total_net::integer,
      unmatched_transaction_count = 0,
      neutral_transaction_pairs = v_pairs,
      reconciled_at = p_observed_at,
      updated_at = now()
  where id = v_payout.id;

  update public.payout_operational_incidents
  set status = 'resolved',
      resolved_at = coalesce(resolved_at, p_observed_at),
      updated_at = now()
  where incident_key =
      'automatic-payout:' || v_payout.id::text || ':allocation'
    and status = 'open';

  update public.notifications as notification
  set read_at = coalesce(notification.read_at, p_observed_at)
  from public.payout_operational_incidents as incident
  where incident.incident_key =
      'automatic-payout:' || v_payout.id::text || ':allocation'
    and notification.kind = 'payout_operational_alert_admin'
    and notification.event_key = 'payout_incident:' || incident.id::text;

  perform public.refresh_automatic_payout_batch_states_v1();

  return jsonb_build_object(
    'reconciled', true,
    'allocationStatus', 'completed',
    'allocatedCount', v_allocated_count,
    'adjustmentCount', v_adjustment_count,
    'unmatchedCount', 0,
    'amountMatches', true
  );
end;
$$;

revoke all on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) to service_role;

comment on function public.reconcile_automatic_stripe_payout_v3(
  text, text, jsonb, timestamptz
) is
  'Reconciles automatic Payouts with exact positive Transfer allocations and exact post-Payout V10 reversal debits. Ambiguous snapshots delegate unchanged to V2.';

create or replace function public.private_therapist_payout_groups_v10(
  p_groups jsonb,
  p_therapist_profile_id uuid,
  p_stage text,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group jsonb;
  v_result jsonb := '[]'::jsonb;
  v_composition jsonb;
  v_adjustments jsonb;
  v_adjustment_cents integer;
  v_date date;
begin
  if jsonb_typeof(p_groups) <> 'array' then
    return '[]'::jsonb;
  end if;

  for v_group in select value from jsonb_array_elements(p_groups)
  loop
    select coalesce(jsonb_agg(item.value || jsonb_build_object(
      'type', 'session'
    ) order by item.ordinality), '[]'::jsonb)
    into v_composition
    from jsonb_array_elements(
      coalesce(v_group -> 'composition', '[]'::jsonb)
    ) with ordinality as item(value, ordinality);

    v_adjustments := '[]'::jsonb;
    v_adjustment_cents := 0;
    v_date := case
      when coalesce(v_group ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (v_group ->> 'date')::date
      else null
    end;

    if p_stage in ('in_transit', 'received')
      and v_date is not null
      and (
        p_stage <> 'received'
        or v_group ->> 'status' = 'received'
      )
    then
      select
        coalesce(sum(adjustment.amount_cents), 0)::integer,
        coalesce(jsonb_agg(jsonb_build_object(
          'type', 'adjustment',
          'adjustmentId', adjustment.id,
          'label', 'Ajuste de reembolso',
          'amountCents', -adjustment.amount_cents,
          'occurredAt', adjustment.occurred_at
        ) order by adjustment.occurred_at, adjustment.id), '[]'::jsonb)
      into v_adjustment_cents, v_adjustments
      from public.stripe_payout_balance_adjustments as adjustment
      join public.stripe_payouts as payout
        on payout.id = adjustment.stripe_payout_id
      where payout.therapist_profile_id = p_therapist_profile_id
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
        and case
          when payout.arrival_at is not null
            then (payout.arrival_at at time zone 'UTC')::date
          else (
            coalesce(payout.paid_at, payout.updated_at)
            at time zone p_timezone
          )::date
        end = v_date
        and (
          (
            p_stage = 'in_transit'
            and payout.arrival_at is not null
            and (payout.arrival_at at time zone 'UTC')::date
              > (now() at time zone p_timezone)::date
          )
          or (
            p_stage = 'received'
            and (
              (
                payout.arrival_at is not null
                and (payout.arrival_at at time zone 'UTC')::date
                  <= (now() at time zone p_timezone)::date
              )
              or (
                payout.arrival_at is null
                and coalesce(payout.paid_at, payout.updated_at) <= now()
              )
            )
          )
        );
    end if;

    v_group := jsonb_set(v_group, '{composition}',
      v_composition || v_adjustments, true);
    if v_adjustment_cents > 0 then
      v_group := jsonb_set(
        v_group,
        '{amountCents}',
        to_jsonb((v_group ->> 'amountCents')::integer - v_adjustment_cents),
        true
      );
    end if;
    v_result := v_result || jsonb_build_array(v_group);
  end loop;

  return v_result;
end;
$$;

revoke all on function public.private_therapist_payout_groups_v10(
  jsonb, uuid, text, text
) from public, anon, authenticated, service_role;

create or replace function public.get_private_therapist_payouts_v10(
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
  v_payload jsonb;
  v_therapist_id uuid;
  v_timezone text;
  v_period record;
  v_period_start_date date;
  v_period_end_date date;
  v_received_adjustment_cents integer := 0;
  v_in_transit_cents integer := 0;
begin
  v_payload := public.get_private_therapist_payouts_v9(
    p_period_start, p_period_end, p_page, p_page_size,
    p_timezone, p_agenda_days
  );
  v_therapist_id := (v_payload ->> 'therapistProfileId')::uuid;
  v_timezone := v_payload -> 'filters' ->> 'timezone';

  v_payload := jsonb_set(v_payload, '{agenda,predicted}',
    public.private_therapist_payout_groups_v10(
      v_payload #> '{agenda,predicted}', v_therapist_id, 'predicted', v_timezone
    ), true);
  v_payload := jsonb_set(v_payload, '{agenda,balanceAvailable}',
    public.private_therapist_payout_groups_v10(
      v_payload #> '{agenda,balanceAvailable}', v_therapist_id,
      'balance_schedule', v_timezone
    ), true);
  v_payload := jsonb_set(v_payload, '{agenda,awaitingBankDate}',
    public.private_therapist_payout_groups_v10(
      v_payload #> '{agenda,awaitingBankDate}', v_therapist_id,
      'awaiting_bank_date', v_timezone
    ), true);
  v_payload := jsonb_set(v_payload, '{agenda,inTransit}',
    public.private_therapist_payout_groups_v10(
      v_payload #> '{agenda,inTransit}', v_therapist_id,
      'in_transit', v_timezone
    ), true);
  v_payload := jsonb_set(v_payload, '{historyItems}',
    public.private_therapist_payout_groups_v10(
      v_payload -> 'historyItems', v_therapist_id, 'received', v_timezone
    ), true);

  select coalesce(sum((item.value ->> 'amountCents')::integer), 0)::integer
  into v_in_transit_cents
  from jsonb_array_elements(v_payload #> '{agenda,inTransit}') as item(value);

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, v_timezone
  );
  v_period_start_date :=
    (v_period.starts_at at time zone v_period.timezone)::date;
  v_period_end_date :=
    (v_period.ends_at at time zone v_period.timezone)::date;

  select coalesce(sum(adjustment.amount_cents), 0)::integer
  into v_received_adjustment_cents
  from public.stripe_payout_balance_adjustments as adjustment
  join public.stripe_payouts as payout
    on payout.id = adjustment.stripe_payout_id
  where payout.therapist_profile_id = v_therapist_id
    and payout.status = 'paid'
    and payout.provider_reconciliation_status = 'completed'
    and payout.allocation_status = 'completed'
    and (
      (
        payout.arrival_at is not null
        and (payout.arrival_at at time zone 'UTC')::date
          <= (now() at time zone v_timezone)::date
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
        at time zone v_timezone
      )::date
    end >= v_period_start_date
    and case
      when payout.arrival_at is not null
        then (payout.arrival_at at time zone 'UTC')::date
      else (
        coalesce(payout.paid_at, payout.updated_at)
        at time zone v_timezone
      )::date
    end < v_period_end_date;

  v_payload := jsonb_set(v_payload, '{contractVersion}', '10'::jsonb, true);
  v_payload := jsonb_set(
    v_payload, '{summary,inTransitCents}', to_jsonb(v_in_transit_cents), true
  );
  v_payload := jsonb_set(
    v_payload,
    '{summary,receivedCents}',
    to_jsonb(greatest(
      0,
      (v_payload #>> '{summary,receivedCents}')::integer
        - v_received_adjustment_cents
    )),
    true
  );
  return v_payload;
end;
$$;

revoke all on function public.get_private_therapist_payouts_v10(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v10(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v10(
  date, date, integer, integer, text, integer
) is
  'Private therapist payout V10 projection. Preserves session count and historical deposits while showing exact later Payout reversal debits as negative adjustments.';

commit;
