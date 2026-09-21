begin;

-- Keep an auditable record of provider-confirmed neutral movements. They are
-- not therapist Transfers and must never create an allocation or ledger entry.
alter table public.stripe_payouts
  add column if not exists neutral_transaction_pairs jsonb not null default '[]'::jsonb,
  add constraint stripe_payouts_neutral_pairs_array_check
    check (jsonb_typeof(neutral_transaction_pairs) = 'array');

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
      or exists (
        select 1
        from public.stripe_transfers as transfer
        join public.therapist_connect_accounts as account
          on account.id = transfer.connect_account_id
        where account.stripe_account_id = p_stripe_account_id
          and (
            transfer.stripe_destination_payment_id = v_refund_charge
            or transfer.stripe_connected_balance_transaction_id = v_payment ->> 'id'
          )
      )
    then
      continue;
    end if;

    v_excluded_ids := array_append(v_excluded_ids, v_payment ->> 'id');
    v_excluded_ids := array_append(v_excluded_ids, v_refund ->> 'id');
    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'paymentBalanceTransactionId', v_payment ->> 'id',
      'paymentSourceId', v_refund_charge,
      'refundBalanceTransactionId', v_refund ->> 'id',
      'refundSourceId', v_refund ->> 'source',
      'amountCents', (v_payment ->> 'amount')::bigint
    ));
  end loop;

  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into v_filtered
  from jsonb_array_elements(p_balance_transactions) as entry(value)
  where not (entry.value ->> 'id' = any(v_excluded_ids));

  -- The existing V9/V10 allocator remains authoritative for every movement
  -- not proven to be a neutral provider-linked pair.
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

-- A confirmed Transfer can still wait for source availability and bank Payout.
-- Resolve only its obsolete failure alert; do not advance the bank state.
create or replace function public.resolve_successful_session_direct_transfer_attention_v10(
  p_session_payment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved integer;
begin
  update public.payout_operational_incidents as incident
  set status = 'resolved',
      resolved_at = coalesce(incident.resolved_at, now()),
      metadata = incident.metadata || jsonb_build_object(
        'resolution', 'confirmed_source_bound_transfer'
      ),
      updated_at = now()
  from public.session_transfer_jobs as job
  join public.stripe_transfers as transfer
    on transfer.id = job.stripe_transfer_id
  join public.session_payments as payment
    on payment.id = job.session_payment_id
  where payment.id = p_session_payment_id
    and payment.payment_flow_version = 'v10'
    and payment.financial_status = 'paid'
    and payment.transfer_status = 'transferred'
    and job.status in ('pending_source', 'transferred')
    and job.succeeded_at is not null
    and job.transfer_amount_cents > 0
    and transfer.transfer_origin = 'session_direct'
    and transfer.status = 'transferred'
    and transfer.stripe_transfer_id is not null
    and transfer.transferred_at is not null
    and transfer.session_payment_id = payment.id
    and transfer.connect_account_id = job.connect_account_id
    and transfer.stripe_source_charge_id = job.stripe_source_charge_id
    and transfer.amount_cents = job.transfer_amount_cents
    and incident.incident_key = 'session-transfer-v10:' || job.id::text
    and incident.incident_type = 'session_direct_transfer_attention'
    and incident.stripe_transfer_id = transfer.id
    and incident.status = 'open';
  get diagnostics v_resolved = row_count;
  return v_resolved;
end;
$$;

revoke all on function public.resolve_successful_session_direct_transfer_attention_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_successful_session_direct_transfer_attention_v10(uuid)
  to service_role;

create or replace function public.resolve_session_transfer_attention_after_payment_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_flow_version = 'v10'
    and new.financial_status = 'paid'
    and new.transfer_status = 'transferred' then
    perform public.resolve_successful_session_direct_transfer_attention_v10(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists resolve_session_transfer_attention_after_payment_v10
  on public.session_payments;
create trigger resolve_session_transfer_attention_after_payment_v10
after update of transfer_status, financial_status on public.session_payments
for each row execute function public.resolve_session_transfer_attention_after_payment_v10();

revoke all on function public.resolve_session_transfer_attention_after_payment_v10()
  from public, anon, authenticated;

-- Repair only incidents for which persisted provider-confirmed evidence already
-- satisfies the same strict rule as future successful Transfer completions.
select public.resolve_successful_session_direct_transfer_attention_v10(payment.id)
from public.session_payments as payment
where payment.payment_flow_version = 'v10'
  and payment.financial_status = 'paid'
  and payment.transfer_status = 'transferred'
  and exists (
    select 1 from public.session_transfer_jobs as job
    join public.payout_operational_incidents as incident
      on incident.incident_key = 'session-transfer-v10:' || job.id::text
    where job.session_payment_id = payment.id
      and incident.incident_type = 'session_direct_transfer_attention'
      and incident.status = 'open'
  );

commit;
