begin;

-- ADR-018: TES controls the weekly Transfer. Stripe controls the automatic
-- daily Payout for BR connected accounts. Bank settlement is attributed from
-- authoritative Balance Transactions, never from Payout metadata.

alter table public.stripe_transfers
  add column if not exists stripe_destination_payment_id text,
  add column if not exists stripe_connected_balance_transaction_id text,
  add column if not exists connected_balance_available_on timestamptz;

create unique index if not exists stripe_transfers_destination_payment_uidx
  on public.stripe_transfers (stripe_destination_payment_id)
  where stripe_destination_payment_id is not null;

create unique index if not exists stripe_transfers_connected_balance_tx_uidx
  on public.stripe_transfers (stripe_connected_balance_transaction_id)
  where stripe_connected_balance_transaction_id is not null;

alter table public.stripe_payouts
  drop constraint if exists stripe_payouts_payout_batch_therapist_id_key,
  alter column payout_batch_therapist_id drop not null,
  alter column payout_batch_id drop not null,
  alter column idempotency_key drop not null,
  alter column request_fingerprint drop not null,
  add column if not exists automatic boolean not null default false,
  add column if not exists payout_balance_transaction_id text,
  add column if not exists provider_reconciliation_status text not null default 'not_applicable',
  add column if not exists allocation_status text not null default 'pending',
  add column if not exists reconciled_at timestamptz,
  add column if not exists included_transaction_net_cents integer,
  add column if not exists unmatched_transaction_count integer not null default 0,
  add constraint stripe_payouts_provider_reconciliation_check check (
    provider_reconciliation_status in ('in_progress', 'completed', 'not_applicable')
  ),
  add constraint stripe_payouts_allocation_status_check check (
    allocation_status in ('pending', 'completed', 'partial', 'not_applicable')
  ),
  add constraint stripe_payouts_unmatched_count_check check (
    unmatched_transaction_count >= 0
  );

create index if not exists stripe_payouts_automatic_reconciliation_idx
  on public.stripe_payouts (
    connect_account_id, provider_reconciliation_status, allocation_status, created_at
  )
  where automatic = true;

create table if not exists public.stripe_payout_transfer_allocations (
  id uuid primary key default gen_random_uuid(),
  stripe_payout_id uuid not null
    references public.stripe_payouts(id) on delete restrict,
  stripe_transfer_id uuid not null
    references public.stripe_transfers(id) on delete restrict,
  payout_batch_id uuid not null
    references public.payout_batches(id) on delete restrict,
  payout_batch_therapist_id uuid not null
    references public.payout_batch_therapists(id) on delete restrict,
  connected_balance_transaction_id text not null,
  source_id text not null,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_payout_transfer_allocations_pair_unique
    unique (stripe_payout_id, stripe_transfer_id),
  constraint stripe_payout_transfer_allocations_transfer_unique
    unique (stripe_transfer_id),
  constraint stripe_payout_transfer_allocations_balance_tx_unique
    unique (stripe_payout_id, connected_balance_transaction_id),
  constraint stripe_payout_transfer_allocations_amount_positive
    check (amount_cents > 0),
  constraint stripe_payout_transfer_allocations_currency_brl
    check (currency = 'BRL'),
  constraint stripe_payout_transfer_allocations_source_present
    check (length(trim(source_id)) > 0),
  constraint stripe_payout_transfer_allocations_balance_tx_present
    check (length(trim(connected_balance_transaction_id)) > 0)
);

create index if not exists stripe_payout_allocations_group_idx
  on public.stripe_payout_transfer_allocations (
    payout_batch_therapist_id, stripe_payout_id
  );

create index if not exists stripe_payout_allocations_transfer_idx
  on public.stripe_payout_transfer_allocations (stripe_transfer_id);

drop trigger if exists set_stripe_payout_transfer_allocations_updated_at
  on public.stripe_payout_transfer_allocations;
create trigger set_stripe_payout_transfer_allocations_updated_at
before update on public.stripe_payout_transfer_allocations
for each row execute function public.set_updated_at();

alter table public.stripe_payout_transfer_allocations enable row level security;
revoke all on public.stripe_payout_transfer_allocations from public, anon, authenticated;
grant select, insert, update, delete on public.stripe_payout_transfer_allocations to service_role;

update public.financial_policy_versions
set is_active = false
where version = 'tes-payments-v4-weekly-automatic-payout';

insert into public.financial_policy_versions (
  version, is_active, currency, platform_commission_bps,
  auto_confirmation_days, transfer_safety_period_days,
  free_cancellation_hours, late_cancellation_retention_bps,
  no_show_retention_bps, refund_processing_business_days,
  manual_review_response_days, weekly_batch_weekday, weekly_batch_time,
  timezone, payout_batch_rule, cancellation_policy_key, refund_policy_key,
  proration_policy_key, upgrade_proration_behavior, downgrade_behavior,
  subscription_cancellation_behavior, metadata, effective_from
)
select
  'tes-payments-v5-weekly-transfer-daily-automatic-payout', false,
  policy.currency, policy.platform_commission_bps, 7, 1,
  policy.free_cancellation_hours, policy.late_cancellation_retention_bps,
  policy.no_show_retention_bps, policy.refund_processing_business_days,
  policy.manual_review_response_days, 2, time '02:00',
  'America/Sao_Paulo', 'weekly_transfer_daily_automatic_payout',
  policy.cancellation_policy_key, policy.refund_policy_key,
  policy.proration_policy_key, policy.upgrade_proration_behavior,
  policy.downgrade_behavior, policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'schedulerWindowStart', '02:00',
    'schedulerWindowEnd', '04:00',
    'payoutMode', 'stripe_daily_automatic',
    'payoutAttribution', 'balance_transactions',
    'activation', 'disabled_by_default'
  ),
  now()
from public.financial_policy_versions policy
where policy.is_active
order by policy.effective_from desc
limit 1
on conflict (version) do update
set is_active = false,
    auto_confirmation_days = 7,
    transfer_safety_period_days = 1,
    weekly_batch_weekday = 2,
    weekly_batch_time = time '02:00',
    timezone = 'America/Sao_Paulo',
    payout_batch_rule = 'weekly_transfer_daily_automatic_payout',
    metadata = excluded.metadata;

create or replace function public.complete_payout_transfer_v2(
  p_transfer_id uuid,
  p_worker_id uuid,
  p_stripe_transfer_id text,
  p_stripe_destination_payment_id text,
  p_stripe_connected_balance_transaction_id text default null,
  p_connected_balance_available_on timestamptz default null,
  p_transferred_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_stripe_destination_payment_id), '') is null then
    raise exception 'PAYOUT_TRANSFER_DESTINATION_PAYMENT_REQUIRED';
  end if;

  perform public.complete_payout_transfer_v1(
    p_transfer_id, p_worker_id, p_stripe_transfer_id, p_transferred_at
  );

  update public.stripe_transfers
  set stripe_destination_payment_id = coalesce(
        stripe_destination_payment_id, p_stripe_destination_payment_id
      ),
      stripe_connected_balance_transaction_id = coalesce(
        stripe_connected_balance_transaction_id,
        nullif(trim(p_stripe_connected_balance_transaction_id), '')
      ),
      connected_balance_available_on = coalesce(
        connected_balance_available_on, p_connected_balance_available_on
      ),
      updated_at = now()
  where id = p_transfer_id
    and stripe_transfer_id = p_stripe_transfer_id
    and (
      stripe_destination_payment_id is null
      or stripe_destination_payment_id = p_stripe_destination_payment_id
    );

  if not found then
    raise exception 'PAYOUT_TRANSFER_DESTINATION_PAYMENT_MISMATCH';
  end if;
  return true;
end;
$$;

create or replace function public.reconcile_payout_transfer_v2(
  p_transfer_id uuid,
  p_stripe_transfer_id text,
  p_stripe_destination_payment_id text,
  p_stripe_connected_balance_transaction_id text default null,
  p_connected_balance_available_on timestamptz default null,
  p_reversed boolean default false,
  p_observed_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if nullif(trim(p_stripe_destination_payment_id), '') is null then
    raise exception 'PAYOUT_TRANSFER_DESTINATION_PAYMENT_REQUIRED';
  end if;
  v_status := public.reconcile_payout_transfer_v1(
    p_transfer_id, p_stripe_transfer_id, p_reversed, p_observed_at
  );
  update public.stripe_transfers
  set stripe_destination_payment_id = coalesce(
        stripe_destination_payment_id, p_stripe_destination_payment_id
      ),
      stripe_connected_balance_transaction_id = coalesce(
        stripe_connected_balance_transaction_id,
        nullif(trim(p_stripe_connected_balance_transaction_id), '')
      ),
      connected_balance_available_on = coalesce(
        connected_balance_available_on, p_connected_balance_available_on
      ),
      updated_at = now()
  where id = p_transfer_id
    and (
      stripe_destination_payment_id is null
      or stripe_destination_payment_id = p_stripe_destination_payment_id
    );
  if not found then
    raise exception 'PAYOUT_TRANSFER_DESTINATION_PAYMENT_MISMATCH';
  end if;
  return v_status;
end;
$$;

-- Old workers must fail safely: BR automatic payouts are provider-created and
-- no local claim may produce a Payout API request.
create or replace function public.claim_payout_groups_v1(
  p_payout_batch_id uuid,
  p_worker_id uuid,
  p_limit integer default 10,
  p_lease_minutes integer default 5,
  p_environment text default 'test'
)
returns table (
  payout_id uuid,
  payout_batch_therapist_id uuid,
  therapist_profile_id uuid,
  connect_account_id uuid,
  stripe_account_id text,
  amount_cents integer,
  idempotency_key text,
  request_fingerprint text,
  attempt_count integer
)
language sql
security definer
set search_path = ''
as $$
  select
    null::uuid,
    null::uuid,
    null::uuid,
    null::uuid,
    null::text,
    null::integer,
    null::text,
    null::text,
    null::integer
  where false;
$$;

-- Declared before the event RPC so function-body validation can resolve the
-- dependency. The authoritative implementation replaces this stub below.
create or replace function public.refresh_automatic_payout_batch_states_v1()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  return 0;
end;
$$;

create or replace function public.record_automatic_stripe_payout_v1(
  p_stripe_payout_id text,
  p_stripe_account_id text,
  p_amount_cents integer,
  p_currency text,
  p_provider_status text,
  p_provider_reconciliation_status text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_payout_balance_transaction_id text default null,
  p_source_type text default null,
  p_arrival_at timestamptz default null,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.therapist_connect_accounts%rowtype;
  v_payout public.stripe_payouts%rowtype;
  v_was_paid boolean := false;
begin
  if nullif(trim(p_stripe_payout_id), '') is null
    or nullif(trim(p_stripe_account_id), '') is null
    or p_amount_cents <= 0
    or upper(p_currency) <> 'BRL'
    or p_provider_status not in ('pending', 'in_transit', 'paid', 'failed', 'canceled')
    or p_provider_reconciliation_status not in ('in_progress', 'completed', 'not_applicable')
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'AUTOMATIC_STRIPE_PAYOUT_EVENT_INVALID';
  end if;

  select * into v_account
  from public.therapist_connect_accounts
  where stripe_account_id = p_stripe_account_id
  for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'connect_account_not_found');
  end if;

  select * into v_payout
  from public.stripe_payouts
  where stripe_payout_id = p_stripe_payout_id
  for update;
  if found then
    if v_payout.connect_account_id <> v_account.id then
      raise exception 'AUTOMATIC_STRIPE_PAYOUT_ACCOUNT_MISMATCH';
    end if;
    if v_payout.stripe_event_created_at is not null
      and p_stripe_event_created_at < v_payout.stripe_event_created_at
    then
      return jsonb_build_object('applied', false, 'reason', 'stale_event');
    end if;
    v_was_paid := v_payout.status = 'paid';
  else
    insert into public.stripe_payouts (
      payout_batch_therapist_id, payout_batch_id, therapist_profile_id,
      connect_account_id, stripe_payout_id, idempotency_key,
      request_fingerprint, amount_cents, currency, source_type, status,
      provider_status, stripe_event_id, stripe_event_created_at, arrival_at,
      automatic, payout_balance_transaction_id,
      provider_reconciliation_status, allocation_status
    ) values (
      null, null, v_account.therapist_profile_id, v_account.id,
      p_stripe_payout_id, null, null, p_amount_cents, 'BRL', p_source_type,
      'pending', p_provider_status, p_stripe_event_id,
      p_stripe_event_created_at, p_arrival_at, true,
      nullif(trim(p_payout_balance_transaction_id), ''),
      p_provider_reconciliation_status, 'pending'
    ) returning * into v_payout;
  end if;

  update public.stripe_payouts
  set provider_status = p_provider_status,
      status = case p_provider_status
        when 'paid' then 'paid'::public.stripe_payout_status
        when 'failed' then 'failed'::public.stripe_payout_status
        when 'canceled' then 'canceled'::public.stripe_payout_status
        when 'in_transit' then 'in_transit'::public.stripe_payout_status
        else 'pending'::public.stripe_payout_status
      end,
      provider_reconciliation_status = p_provider_reconciliation_status,
      payout_balance_transaction_id = coalesce(
        payout_balance_transaction_id,
        nullif(trim(p_payout_balance_transaction_id), '')
      ),
      source_type = coalesce(p_source_type, source_type),
      failure_code = left(nullif(regexp_replace(coalesce(p_failure_code, ''), '[\r\n]+', ' ', 'g'), ''), 120),
      failure_message = left(nullif(regexp_replace(coalesce(p_failure_message, ''), '[\r\n]+', ' ', 'g'), ''), 500),
      stripe_event_id = p_stripe_event_id,
      stripe_event_created_at = p_stripe_event_created_at,
      arrival_at = coalesce(p_arrival_at, arrival_at),
      paid_at = case when p_provider_status = 'paid'
        then coalesce(paid_at, p_stripe_event_created_at) else paid_at end,
      failed_at = case when p_provider_status = 'failed'
        then p_stripe_event_created_at else failed_at end,
      updated_at = now()
  where stripe_payout_id = p_stripe_payout_id
  returning * into v_payout;

  if p_provider_status = 'failed' then
    perform public.record_payout_operational_incident_v1(
      'automatic-payout:' || v_payout.id::text || ':failed',
      case when v_was_paid then 'payout_failed_after_paid' else 'payout_failed' end,
      'critical', p_failure_code, p_failure_message, null, null, null, null,
      v_payout.id, v_payout.therapist_profile_id,
      jsonb_build_object('failedAfterPaid', v_was_paid, 'automatic', true)
    );
  end if;

  perform public.refresh_automatic_payout_batch_states_v1();

  return jsonb_build_object(
    'applied', true,
    'payoutId', v_payout.id,
    'status', v_payout.status,
    'automatic', true,
    'failedAfterPaid', v_was_paid and p_provider_status = 'failed'
  );
end;
$$;

create or replace function public.refresh_automatic_payout_batch_states_v1()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  with states as (
    select batch.id,
      count(item.id) filter (
        where item.status in ('failed', 'blocked')
          or transfer.status in ('failed', 'reconciliation_required', 'reversed')
      ) as failed_count,
      count(item.id) filter (
        where item.status <> 'transferred' or transfer.status <> 'transferred'
      ) as transfer_pending_count,
      count(item.id) filter (
        where item.status = 'transferred' and transfer.status = 'transferred'
          and not exists (
            select 1
            from public.stripe_payout_transfer_allocations allocation
            join public.stripe_payouts payout
              on payout.id = allocation.stripe_payout_id
            where allocation.stripe_transfer_id = transfer.id
              and payout.status = 'paid'
              and payout.provider_reconciliation_status = 'completed'
              and payout.allocation_status = 'completed'
          )
      ) as bank_pending_count,
      count(item.id) as item_count
    from public.payout_batches batch
    left join public.payout_batch_items item
      on item.payout_batch_id = batch.id and item.status <> 'removed'
    left join public.stripe_transfers transfer
      on transfer.payout_batch_item_id = item.id
    where batch.status in ('open', 'processing', 'partially_failed')
    group by batch.id
  )
  update public.payout_batches batch
  set status = case
        when states.failed_count > 0 then 'partially_failed'::public.payout_batch_status
        when states.item_count = 0 then 'completed'::public.payout_batch_status
        when states.transfer_pending_count = 0 and states.bank_pending_count = 0
          then 'completed'::public.payout_batch_status
        else 'processing'::public.payout_batch_status
      end,
      processed_at = case
        when states.item_count = 0
          or (states.failed_count = 0 and states.transfer_pending_count = 0 and states.bank_pending_count = 0)
          then coalesce(batch.processed_at, now())
        else null
      end,
      updated_at = now()
  from states
  where batch.id = states.id
    and (
      batch.status is distinct from case
        when states.failed_count > 0 then 'partially_failed'::public.payout_batch_status
        when states.item_count = 0 then 'completed'::public.payout_batch_status
        when states.transfer_pending_count = 0 and states.bank_pending_count = 0
          then 'completed'::public.payout_batch_status
        else 'processing'::public.payout_batch_status
      end
      or (
        (states.item_count = 0 or (states.failed_count = 0 and states.transfer_pending_count = 0 and states.bank_pending_count = 0))
        and batch.processed_at is null
      )
    );
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.reconcile_automatic_stripe_payout_v1(
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
  v_item public.payout_batch_items%rowtype;
  v_transaction_id text;
  v_source_id text;
  v_currency text;
  v_amount integer;
  v_net integer;
  v_available_on timestamptz;
  v_allocated_count integer := 0;
  v_unmatched_count integer := 0;
  v_total_net integer := 0;
  v_allocation_status text;
begin
  if nullif(trim(p_stripe_payout_id), '') is null
    or nullif(trim(p_stripe_account_id), '') is null
    or p_observed_at is null
    or jsonb_typeof(p_balance_transactions) <> 'array'
    or jsonb_array_length(p_balance_transactions) > 1000
  then
    raise exception 'AUTOMATIC_STRIPE_PAYOUT_RECONCILIATION_INVALID';
  end if;

  select payout.* into v_payout
  from public.stripe_payouts payout
  join public.therapist_connect_accounts account
    on account.id = payout.connect_account_id
  where payout.stripe_payout_id = p_stripe_payout_id
    and account.stripe_account_id = p_stripe_account_id
    and payout.automatic = true
  for update of payout;
  if not found then
    return jsonb_build_object('reconciled', false, 'reason', 'payout_not_found');
  end if;

  -- The provider list is a complete authoritative snapshot once
  -- reconciliation_status is completed. Rebuild atomically so stale local
  -- associations cannot survive a corrected provider response.
  delete from public.stripe_payout_transfer_allocations
  where stripe_payout_id = v_payout.id;

  for v_transaction in
    select value from jsonb_array_elements(p_balance_transactions)
  loop
    v_transaction_id := nullif(trim(v_transaction ->> 'id'), '');
    v_source_id := nullif(trim(v_transaction ->> 'source'), '');
    v_currency := lower(coalesce(v_transaction ->> 'currency', ''));
    begin
      v_amount := (v_transaction ->> 'amount')::integer;
      v_net := coalesce((v_transaction ->> 'net')::integer, v_amount);
    exception when others then
      v_amount := null;
      v_net := null;
    end;
    v_total_net := v_total_net + coalesce(v_net, 0);
    v_available_on := case
      when coalesce(v_transaction ->> 'available_on', '') ~ '^[0-9]+$'
        then to_timestamp((v_transaction ->> 'available_on')::double precision)
      else null
    end;

    v_transfer := null;
    if v_transaction_id is not null and v_source_id is not null
      and v_currency = 'brl' and coalesce(v_amount, 0) > 0
    then
      select transfer.* into v_transfer
      from public.stripe_transfers transfer
      join public.therapist_connect_accounts account
        on account.id = transfer.connect_account_id
      where account.stripe_account_id = p_stripe_account_id
        and transfer.status = 'transferred'
        and transfer.amount_cents = v_amount
        and (
          transfer.stripe_destination_payment_id = v_source_id
          or transfer.stripe_connected_balance_transaction_id = v_transaction_id
        )
      order by transfer.created_at
      limit 1
      for update of transfer;
    end if;

    if v_transfer.id is null then
      v_unmatched_count := v_unmatched_count + 1;
      continue;
    end if;

    select * into v_item
    from public.payout_batch_items
    where id = v_transfer.payout_batch_item_id;

    update public.stripe_transfers
    set stripe_connected_balance_transaction_id = coalesce(
          stripe_connected_balance_transaction_id, v_transaction_id
        ),
        connected_balance_available_on = coalesce(
          connected_balance_available_on, v_available_on
        ),
        updated_at = now()
    where id = v_transfer.id;

    insert into public.stripe_payout_transfer_allocations (
      stripe_payout_id, stripe_transfer_id, payout_batch_id,
      payout_batch_therapist_id, connected_balance_transaction_id,
      source_id, amount_cents, currency, reconciled_at
    ) values (
      v_payout.id, v_transfer.id, v_item.payout_batch_id,
      v_item.payout_batch_therapist_id, v_transaction_id,
      v_source_id, v_transfer.amount_cents, 'BRL', p_observed_at
    )
    on conflict (stripe_payout_id, stripe_transfer_id) do update
    set connected_balance_transaction_id = excluded.connected_balance_transaction_id,
        source_id = excluded.source_id,
        amount_cents = excluded.amount_cents,
        reconciled_at = excluded.reconciled_at,
        updated_at = now();
    v_allocated_count := v_allocated_count + 1;
  end loop;

  v_allocation_status := case
    when v_unmatched_count = 0
      and v_total_net = v_payout.amount_cents
      and v_allocated_count > 0 then 'completed'
    when v_allocated_count > 0 then 'partial'
    else 'pending'
  end;

  update public.stripe_payouts
  set provider_reconciliation_status = 'completed',
      allocation_status = v_allocation_status,
      included_transaction_net_cents = v_total_net,
      unmatched_transaction_count = v_unmatched_count,
      reconciled_at = p_observed_at,
      updated_at = now()
  where id = v_payout.id
  returning * into v_payout;

  if v_allocation_status <> 'completed' then
    perform public.record_payout_operational_incident_v1(
      'automatic-payout:' || v_payout.id::text || ':allocation',
      'automatic_payout_reconciliation_required',
      'critical', 'automatic_payout_allocation_incomplete',
      'O Payout automatico possui movimentacoes sem associacao financeira local.',
      null, null, null, null, v_payout.id, v_payout.therapist_profile_id,
      jsonb_build_object(
        'allocatedCount', v_allocated_count,
        'unmatchedCount', v_unmatched_count,
        'amountMatches', v_total_net = v_payout.amount_cents
      )
    );
  else
    update public.payout_operational_incidents
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, p_observed_at),
        updated_at = now()
    where incident_key = 'automatic-payout:' || v_payout.id::text || ':allocation'
      and status = 'open';
  end if;

  perform public.refresh_automatic_payout_batch_states_v1();

  return jsonb_build_object(
    'reconciled', v_allocation_status = 'completed',
    'allocationStatus', v_allocation_status,
    'allocatedCount', v_allocated_count,
    'unmatchedCount', v_unmatched_count,
    'amountMatches', v_total_net = v_payout.amount_cents
  );
end;
$$;

create or replace function public.finalize_payout_scheduler_run_v1(
  p_scheduler_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payout_scheduler_runs%rowtype;
  v_open_incidents integer;
  v_transfer_pending integer;
  v_transfer_failed integer;
  v_status public.payout_scheduler_run_status;
begin
  select * into v_run
  from public.payout_scheduler_runs
  where id = p_scheduler_run_id
  for update;
  if not found then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FOUND'; end if;

  select count(*) into v_open_incidents
  from public.payout_operational_incidents incident
  where incident.status = 'open'
    and (
      incident.payout_scheduler_run_id = v_run.id
      or incident.payout_batch_id = v_run.payout_batch_id
    );

  select
    count(*) filter (where item.status in ('reserved', 'transfer_pending')),
    count(*) filter (where item.status in ('failed', 'blocked'))
  into v_transfer_pending, v_transfer_failed
  from public.payout_batch_items item
  where item.payout_batch_id = v_run.payout_batch_id
    and item.status <> 'removed';

  if v_transfer_pending > 0 then
    update public.payout_batches
    set status = case when v_open_incidents > 0
      then 'partially_failed'::public.payout_batch_status
      else 'processing'::public.payout_batch_status end,
      updated_at = now()
    where id = v_run.payout_batch_id;
    return jsonb_build_object(
      'completed', false,
      'transferPending', v_transfer_pending,
      'awaitingAutomaticPayout', false
    );
  end if;

  v_status := case when v_open_incidents > 0 or v_transfer_failed > 0
    then 'completed_with_incidents'::public.payout_scheduler_run_status
    else 'completed'::public.payout_scheduler_run_status
  end;

  update public.payout_scheduler_runs
  set status = v_status,
      completed_at = coalesce(completed_at, now()),
      worker_id = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_run.id;

  perform public.refresh_automatic_payout_batch_states_v1();

  return jsonb_build_object(
    'completed', true,
    'status', v_status,
    'transferFailures', v_transfer_failed,
    'awaitingAutomaticPayout', v_transfer_failed = 0
  );
end;
$$;

create or replace function public.release_expired_payout_leases_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfers integer := 0;
begin
  if p_limit < 1 or p_limit > 200 then
    raise exception 'PAYOUT_LEASE_LIMIT_INVALID';
  end if;
  with expired as (
    select id from public.stripe_transfers
    where status = 'pending' and lease_expires_at <= now()
    order by lease_expires_at
    limit p_limit
    for update skip locked
  )
  update public.stripe_transfers transfer
  set status = 'reconciliation_required', next_retry_at = now(),
      lease_owner = null, lease_expires_at = null,
      failure_code = 'provider_response_unknown',
      failure_message = 'Lease expirou antes da confirmacao da operacao.',
      updated_at = now()
  from expired where transfer.id = expired.id;
  get diagnostics v_transfers = row_count;
  return jsonb_build_object('transfers', v_transfers, 'payouts', 0);
end;
$$;

create or replace function public.enqueue_stripe_payout_emails_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_user_id uuid;
  v_new_confirmed boolean;
  v_old_confirmed boolean := false;
begin
  v_new_confirmed := new.status = 'paid' and (
    (
      new.automatic = true
      and new.provider_reconciliation_status = 'completed'
      and new.allocation_status = 'completed'
      and exists (
        select 1 from public.stripe_payout_transfer_allocations allocation
        where allocation.stripe_payout_id = new.id
      )
    )
    or (
      new.automatic = false
      and new.payout_batch_therapist_id is not null
    )
  );
  if tg_op = 'UPDATE' then
    v_old_confirmed := old.status = 'paid' and (
      (
        old.automatic = true
        and old.provider_reconciliation_status = 'completed'
        and old.allocation_status = 'completed'
      )
      or (
        old.automatic = false
        and old.payout_batch_therapist_id is not null
      )
    );
  end if;

  if v_new_confirmed and not v_old_confirmed then
    v_action := 'therapist_payout_completed';
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status = 'failed'
    and exists (
      select 1 from public.email_outbox outbox
      where outbox.action_key = 'therapist_payout_completed'
        and outbox.related_entity_type = 'stripe_payout'
        and outbox.related_entity_id = new.id
    )
  then
    v_action := 'therapist_payout_failed_after_paid';
  else
    return new;
  end if;

  select therapist.user_id into v_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;
  if v_user_id is null then return new; end if;

  perform public.enqueue_transactional_email_v1(
    v_action, new.id, 'stripe_payout', new.id, v_user_id,
    'profile:' || v_user_id::text, '{}'::jsonb
  );
  insert into public.notifications (profile_id, kind, title, body, href, event_key)
  values (
    v_user_id, v_action,
    case when v_action = 'therapist_payout_completed'
      then 'Repasse bancário confirmado'
      else 'Repasse bancário precisa de atenção' end,
    case when v_action = 'therapist_payout_completed'
      then 'A Stripe confirmou o envio do valor à sua conta de recebimento.'
      else 'A instituição financeira devolveu uma falha após a confirmação anterior. Consulte os detalhes.' end,
    '/terapeuta/financeiro', v_action || ':' || new.id::text
  ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  return new;
end;
$$;

drop trigger if exists enqueue_stripe_payout_emails on public.stripe_payouts;
create trigger enqueue_stripe_payout_emails
after insert or update of status, provider_reconciliation_status, allocation_status
on public.stripe_payouts
for each row execute function public.enqueue_stripe_payout_emails_v1();

revoke all on function public.complete_payout_transfer_v2(
  uuid, uuid, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.reconcile_payout_transfer_v2(
  uuid, text, text, text, timestamptz, boolean, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_automatic_stripe_payout_v1(
  text, text, integer, text, text, text, text, timestamptz,
  text, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.reconcile_automatic_stripe_payout_v1(
  text, text, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.refresh_automatic_payout_batch_states_v1()
  from public, anon, authenticated;

grant execute on function public.complete_payout_transfer_v2(
  uuid, uuid, text, text, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.reconcile_payout_transfer_v2(
  uuid, text, text, text, timestamptz, boolean, timestamptz
) to service_role;
grant execute on function public.record_automatic_stripe_payout_v1(
  text, text, integer, text, text, text, text, timestamptz,
  text, text, timestamptz, text, text
) to service_role;
grant execute on function public.reconcile_automatic_stripe_payout_v1(
  text, text, jsonb, timestamptz
) to service_role;
grant execute on function public.refresh_automatic_payout_batch_states_v1()
  to service_role;

comment on table public.stripe_payout_transfer_allocations is
  'Authoritative one-Payout-per-Transfer attribution; derives many-to-many batch/group coverage using connected-account Balance Transactions.';
comment on column public.stripe_payouts.automatic is
  'True when Stripe created the Payout from the connected account automatic schedule.';
comment on column public.stripe_payouts.provider_reconciliation_status is
  'Stripe reconciliation_status. Balance Transaction attribution is allowed only when completed.';

commit;
