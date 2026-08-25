begin;

do $$ begin
  create type public.payout_scheduler_run_status as enum (
    'running',
    'completed',
    'completed_with_incidents',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stripe_payout_status as enum (
    'pending_balance',
    'creating',
    'pending',
    'in_transit',
    'paid',
    'failed',
    'canceled',
    'reconciliation_required'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payout_operational_incident_status as enum (
    'open',
    'resolved'
  );
exception when duplicate_object then null; end $$;

alter table public.therapist_connect_accounts
  add column if not exists payout_status text not null default 'disabled',
  add column if not exists payout_schedule_interval text,
  add column if not exists balance_settings_synced_at timestamptz,
  add constraint therapist_connect_accounts_payout_status_check
    check (payout_status in ('enabled', 'disabled')),
  add constraint therapist_connect_accounts_payout_schedule_check
    check (
      payout_schedule_interval is null
      or payout_schedule_interval in ('manual', 'daily', 'weekly', 'monthly')
    );

comment on column public.therapist_connect_accounts.payouts_enabled is
  'Compatibility projection of Balance Settings payments.payouts.status=enabled. It must never be inferred from the stripe_transfers capability.';

alter table public.stripe_transfers
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists lease_owner uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists request_fingerprint text,
  add column if not exists last_attempt_at timestamptz,
  add constraint stripe_transfers_attempt_count_check
    check (attempt_count between 0 and 4);

create index if not exists stripe_transfers_retry_idx
  on public.stripe_transfers (next_retry_at, status)
  where status in ('failed', 'reconciliation_required');

create index if not exists stripe_transfers_lease_idx
  on public.stripe_transfers (lease_expires_at)
  where lease_expires_at is not null;

create table if not exists public.payout_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  reference_period_start date not null,
  reference_period_end date not null,
  cutoff_at timestamptz not null,
  payout_batch_id uuid unique references public.payout_batches(id) on delete restrict,
  status public.payout_scheduler_run_status not null default 'running',
  worker_id uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  window_alerted_at timestamptz,
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_scheduler_runs_period_check
    check (reference_period_start <= reference_period_end),
  constraint payout_scheduler_runs_attempts_check check (attempts >= 0)
);

create index if not exists payout_scheduler_runs_active_idx
  on public.payout_scheduler_runs (status, lease_expires_at, business_date)
  where status = 'running';

create table if not exists public.stripe_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_batch_therapist_id uuid not null unique
    references public.payout_batch_therapists(id) on delete restrict,
  payout_batch_id uuid not null references public.payout_batches(id) on delete restrict,
  therapist_profile_id uuid not null
    references public.therapist_profiles(id) on delete restrict,
  connect_account_id uuid not null
    references public.therapist_connect_accounts(id) on delete restrict,
  stripe_payout_id text unique,
  idempotency_key text not null unique,
  request_fingerprint text not null,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  source_type text,
  status public.stripe_payout_status not null default 'creating',
  provider_status text,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  failure_code text,
  failure_message text,
  stripe_event_id text,
  stripe_event_created_at timestamptz,
  arrival_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_payouts_amount_positive check (amount_cents > 0),
  constraint stripe_payouts_currency_brl check (currency = 'BRL'),
  constraint stripe_payouts_attempt_count_check check (attempt_count between 0 and 4),
  constraint stripe_payouts_source_type_check check (
    source_type is null or source_type in ('bank_account', 'card', 'fpx')
  )
);

create index if not exists stripe_payouts_pending_idx
  on public.stripe_payouts (status, next_retry_at, created_at)
  where status in (
    'pending_balance', 'creating', 'pending', 'in_transit',
    'failed', 'reconciliation_required'
  );

create index if not exists stripe_payouts_lease_idx
  on public.stripe_payouts (lease_expires_at)
  where lease_expires_at is not null;

create table if not exists public.payout_operational_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  incident_type text not null,
  severity text not null default 'warning',
  status public.payout_operational_incident_status not null default 'open',
  payout_scheduler_run_id uuid references public.payout_scheduler_runs(id) on delete set null,
  payout_batch_id uuid references public.payout_batches(id) on delete set null,
  payout_batch_item_id uuid references public.payout_batch_items(id) on delete set null,
  stripe_transfer_id uuid references public.stripe_transfers(id) on delete set null,
  stripe_payout_id uuid references public.stripe_payouts(id) on delete set null,
  therapist_profile_id uuid references public.therapist_profiles(id) on delete set null,
  error_code text,
  error_message text,
  occurrence_count integer not null default 1,
  first_occurred_at timestamptz not null default now(),
  last_occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_operational_incidents_key_check
    check (length(trim(incident_key)) > 0),
  constraint payout_operational_incidents_severity_check
    check (severity in ('info', 'warning', 'critical')),
  constraint payout_operational_incidents_occurrence_check
    check (occurrence_count > 0),
  constraint payout_operational_incidents_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists payout_operational_incidents_open_idx
  on public.payout_operational_incidents (severity, last_occurred_at desc)
  where status = 'open';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'payout_scheduler_runs',
    'stripe_payouts',
    'payout_operational_incidents'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.payout_scheduler_runs enable row level security;
alter table public.stripe_payouts enable row level security;
alter table public.payout_operational_incidents enable row level security;

revoke all on public.payout_scheduler_runs from public, anon, authenticated;
revoke all on public.stripe_payouts from public, anon, authenticated;
revoke all on public.payout_operational_incidents from public, anon, authenticated;
grant select, insert, update, delete on public.payout_scheduler_runs to service_role;
grant select, insert, update, delete on public.stripe_payouts to service_role;
grant select, insert, update, delete on public.payout_operational_incidents to service_role;

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
  'tes-payments-v4-weekly-automatic-payout', false, policy.currency,
  policy.platform_commission_bps, 7, 1, policy.free_cancellation_hours,
  policy.late_cancellation_retention_bps, policy.no_show_retention_bps,
  policy.refund_processing_business_days, policy.manual_review_response_days,
  2, time '02:00', 'America/Sao_Paulo',
  'weekly_automatic_transfer_manual_payout', policy.cancellation_policy_key,
  policy.refund_policy_key, policy.proration_policy_key,
  policy.upgrade_proration_behavior, policy.downgrade_behavior,
  policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'schedulerWindowStart', '02:00',
    'schedulerWindowEnd', '04:00',
    'payoutMode', 'manual_api',
    'activation', 'disabled_by_default'
  ),
  now()
from public.financial_policy_versions policy
where policy.is_active
limit 1
on conflict (version) do update
set is_active = false,
    auto_confirmation_days = 7,
    transfer_safety_period_days = 1,
    weekly_batch_weekday = 2,
    weekly_batch_time = time '02:00',
    timezone = 'America/Sao_Paulo',
    payout_batch_rule = 'weekly_automatic_transfer_manual_payout',
    metadata = excluded.metadata;

create or replace function public.record_payout_operational_incident_v1(
  p_incident_key text,
  p_incident_type text,
  p_severity text default 'warning',
  p_error_code text default null,
  p_error_message text default null,
  p_payout_scheduler_run_id uuid default null,
  p_payout_batch_id uuid default null,
  p_payout_batch_item_id uuid default null,
  p_stripe_transfer_id uuid default null,
  p_stripe_payout_id uuid default null,
  p_therapist_profile_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_incident_key), '') is null
    or nullif(trim(p_incident_type), '') is null
    or p_severity not in ('info', 'warning', 'critical')
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
  then
    raise exception 'PAYOUT_INCIDENT_INVALID';
  end if;

  insert into public.payout_operational_incidents (
    incident_key, incident_type, severity, error_code, error_message,
    payout_scheduler_run_id, payout_batch_id, payout_batch_item_id,
    stripe_transfer_id, stripe_payout_id, therapist_profile_id, metadata
  ) values (
    left(trim(p_incident_key), 240), left(trim(p_incident_type), 120), p_severity,
    left(nullif(regexp_replace(coalesce(p_error_code, ''), '[\r\n]+', ' ', 'g'), ''), 120),
    left(nullif(regexp_replace(coalesce(p_error_message, ''), '[\r\n]+', ' ', 'g'), ''), 500),
    p_payout_scheduler_run_id, p_payout_batch_id, p_payout_batch_item_id,
    p_stripe_transfer_id, p_stripe_payout_id, p_therapist_profile_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (incident_key) do update
  set occurrence_count = public.payout_operational_incidents.occurrence_count + 1,
      last_occurred_at = now(),
      severity = excluded.severity,
      error_code = excluded.error_code,
      error_message = excluded.error_message,
      metadata = public.payout_operational_incidents.metadata || excluded.metadata,
      status = 'open',
      resolved_at = null
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_weekly_payout_batch(
  p_reference_period_start date,
  p_reference_period_end date,
  p_cutoff_at timestamptz default now(),
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  if p_reference_period_start is null
    or p_reference_period_end is null
    or p_reference_period_start > p_reference_period_end
    or p_cutoff_at is null
  then
    raise exception 'PAYOUT_BATCH_PERIOD_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'tes-payout-batch:' || p_reference_period_start::text || ':' || p_reference_period_end::text,
      0
    )
  );

  select id into v_batch_id
  from public.payout_batches
  where reference_period_start = p_reference_period_start
    and reference_period_end = p_reference_period_end
    and status <> 'canceled'
  order by created_at asc
  limit 1
  for update;

  if v_batch_id is null then
    insert into public.payout_batches (
      reference_period_start, reference_period_end, cutoff_at, status, created_by
    ) values (
      p_reference_period_start, p_reference_period_end, p_cutoff_at, 'open', p_created_by
    )
    returning id into v_batch_id;
  end if;

  insert into public.payout_batch_therapists (
    payout_batch_id, therapist_profile_id, connect_account_id,
    item_count, total_amount_cents
  )
  select
    v_batch_id, payment.therapist_profile_id, account.id,
    count(*)::integer, sum(payment.therapist_amount_cents)::integer
  from public.session_payments payment
  join public.therapist_connect_accounts account
    on account.therapist_profile_id = payment.therapist_profile_id
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1 from public.payout_batch_items existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    )
  group by payment.therapist_profile_id, account.id
  on conflict (payout_batch_id, therapist_profile_id) do nothing;

  insert into public.payout_batch_items (
    payout_batch_id, payout_batch_therapist_id, session_payment_id,
    booking_id, therapist_profile_id, amount_cents
  )
  select
    v_batch_id, therapist_group.id, payment.id, payment.booking_id,
    payment.therapist_profile_id, payment.therapist_amount_cents
  from public.session_payments payment
  join public.payout_batch_therapists therapist_group
    on therapist_group.payout_batch_id = v_batch_id
    and therapist_group.therapist_profile_id = payment.therapist_profile_id
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1 from public.payout_batch_items existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    );

  update public.session_payments payment
  set transfer_status = 'batched', updated_at = now()
  where exists (
    select 1 from public.payout_batch_items item
    where item.payout_batch_id = v_batch_id
      and item.session_payment_id = payment.id
  ) and payment.transfer_status = 'eligible';

  update public.payout_batch_therapists therapist_group
  set item_count = stats.item_count,
      total_amount_cents = stats.total_amount_cents,
      updated_at = now()
  from (
    select item.payout_batch_therapist_id,
      count(*)::integer as item_count,
      sum(item.amount_cents)::integer as total_amount_cents
    from public.payout_batch_items item
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
    group by item.payout_batch_therapist_id
  ) stats
  where therapist_group.id = stats.payout_batch_therapist_id;

  update public.payout_batches batch
  set item_count = stats.item_count,
      therapist_count = stats.therapist_count,
      gross_amount_cents = stats.gross_amount_cents,
      therapist_amount_cents = stats.therapist_amount_cents,
      platform_gross_commission_cents = stats.platform_amount_cents,
      status = case when stats.item_count = 0
        then 'completed'::public.payout_batch_status
        else 'open'::public.payout_batch_status end,
      processed_at = case when stats.item_count = 0 then now() else null end,
      updated_at = now()
  from (
    select
      count(item.id)::integer as item_count,
      count(distinct item.therapist_profile_id)::integer as therapist_count,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer as platform_amount_cents
    from public.payout_batch_items item
    join public.session_payments payment on payment.id = item.session_payment_id
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
  ) stats
  where batch.id = v_batch_id;

  return v_batch_id;
end;
$$;

create or replace function public.claim_weekly_payout_scheduler_run_v1(
  p_now timestamptz,
  p_worker_id uuid,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp;
  v_business_date date;
  v_cutoff_at timestamptz;
  v_window_open boolean;
  v_run public.payout_scheduler_runs%rowtype;
  v_batch_id uuid;
begin
  if p_now is null or p_worker_id is null or p_lease_minutes < 1 or p_lease_minutes > 30 then
    raise exception 'PAYOUT_SCHEDULER_CLAIM_INVALID';
  end if;

  v_local := p_now at time zone 'America/Sao_Paulo';
  v_business_date := v_local::date;
  v_window_open := extract(dow from v_local)::integer = 2
    and v_local::time >= time '02:00'
    and v_local::time < time '04:00';

  select * into v_run
  from public.payout_scheduler_runs
  where status = 'running'
    and (lease_expires_at is null or lease_expires_at <= p_now or worker_id = p_worker_id)
  order by business_date asc
  limit 1
  for update skip locked;

  if v_run.id is null and not v_window_open then
    return jsonb_build_object('acquired', false, 'reason', 'outside_start_window');
  end if;

  if v_run.id is null then
    v_cutoff_at := make_timestamptz(
      extract(year from v_business_date)::integer,
      extract(month from v_business_date)::integer,
      extract(day from v_business_date)::integer,
      2, 0, 0, 'America/Sao_Paulo'
    );

    perform pg_advisory_xact_lock(
      hashtextextended('tes-weekly-payout:' || v_business_date::text, 0)
    );

    insert into public.payout_scheduler_runs (
      business_date, reference_period_start, reference_period_end,
      cutoff_at, status, worker_id, lease_expires_at, attempts
    ) values (
      v_business_date, v_business_date - 7, v_business_date - 1,
      v_cutoff_at, 'running', p_worker_id,
      p_now + make_interval(mins => p_lease_minutes), 1
    )
    on conflict (business_date) do update
    set worker_id = excluded.worker_id,
        lease_expires_at = excluded.lease_expires_at,
        attempts = public.payout_scheduler_runs.attempts + 1,
        updated_at = now()
    where public.payout_scheduler_runs.status = 'running'
      and (
        public.payout_scheduler_runs.lease_expires_at is null
        or public.payout_scheduler_runs.lease_expires_at <= p_now
        or public.payout_scheduler_runs.worker_id = p_worker_id
      )
    returning * into v_run;

    if v_run.id is null then
      return jsonb_build_object('acquired', false, 'reason', 'already_claimed');
    end if;
  else
    update public.payout_scheduler_runs
    set worker_id = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        attempts = attempts + 1,
        updated_at = now()
    where id = v_run.id
    returning * into v_run;
  end if;

  if v_run.payout_batch_id is null then
    v_batch_id := public.create_weekly_payout_batch(
      v_run.reference_period_start,
      v_run.reference_period_end,
      v_run.cutoff_at,
      null
    );
    update public.payout_scheduler_runs
    set payout_batch_id = v_batch_id, updated_at = now()
    where id = v_run.id
    returning * into v_run;
  end if;

  return jsonb_build_object(
    'acquired', true,
    'runId', v_run.id,
    'batchId', v_run.payout_batch_id,
    'businessDate', v_run.business_date,
    'cutoffAt', v_run.cutoff_at,
    'windowOpen', v_window_open
  );
end;
$$;

create or replace function public.claim_payout_transfer_items_v1(
  p_payout_batch_id uuid,
  p_worker_id uuid,
  p_limit integer default 10,
  p_lease_minutes integer default 5,
  p_environment text default 'test'
)
returns table (
  transfer_id uuid,
  payout_batch_item_id uuid,
  session_payment_id uuid,
  booking_id uuid,
  therapist_profile_id uuid,
  connect_account_id uuid,
  stripe_account_id text,
  stripe_charge_id text,
  amount_cents integer,
  idempotency_key text,
  request_fingerprint text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_payout_batch_id is null or p_worker_id is null
    or p_limit < 1 or p_limit > 50
    or p_lease_minutes < 1 or p_lease_minutes > 30
    or p_environment not in ('test', 'live')
  then
    raise exception 'PAYOUT_TRANSFER_CLAIM_INVALID';
  end if;

  return query
  with candidates as (
    select item.id
    from public.payout_batch_items item
    left join public.stripe_transfers transfer
      on transfer.payout_batch_item_id = item.id
    where item.payout_batch_id = p_payout_batch_id
      and item.status in ('reserved', 'failed')
      and (
        transfer.id is null
        or (
          transfer.status in ('failed', 'reconciliation_required')
          and transfer.next_retry_at <= now()
          and transfer.attempt_count < 4
          and (transfer.lease_expires_at is null or transfer.lease_expires_at <= now())
        )
      )
    order by item.created_at, item.id
    limit p_limit
    for update of item skip locked
  ), claimed_items as (
    update public.payout_batch_items item
    set status = 'transfer_pending',
        failure_code = null,
        failure_message = null,
        updated_at = now()
    from candidates
    where item.id = candidates.id
    returning item.*
  ), prepared as (
    insert into public.stripe_transfers (
      payout_batch_item_id, session_payment_id, therapist_profile_id,
      connect_account_id, idempotency_key, amount_cents, currency,
      status, stripe_source_charge_id, attempt_count, lease_owner,
      lease_expires_at, request_fingerprint, last_attempt_at
    )
    select
      item.id, item.session_payment_id, item.therapist_profile_id,
      account.id,
      'tes:' || p_environment || ':transfer:' || item.id::text || ':v1',
      item.amount_cents, 'BRL', 'pending', payment.stripe_charge_id, 1,
      p_worker_id, now() + make_interval(mins => p_lease_minutes),
      pg_catalog.encode(extensions.digest(
        pg_catalog.concat_ws('|', p_environment, item.id::text, item.amount_cents::text, 'BRL',
          account.stripe_account_id, payment.stripe_charge_id),
        'sha256'
      ), 'hex'),
      now()
    from claimed_items item
    join public.session_payments payment on payment.id = item.session_payment_id
    join public.therapist_connect_accounts account
      on account.therapist_profile_id = item.therapist_profile_id
    on conflict on constraint stripe_transfers_payout_batch_item_id_key do update
    set status = 'pending',
        attempt_count = public.stripe_transfers.attempt_count + 1,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        last_attempt_at = now(),
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where public.stripe_transfers.attempt_count < 4
      and public.stripe_transfers.status in ('failed', 'reconciliation_required')
      and public.stripe_transfers.request_fingerprint = excluded.request_fingerprint
    returning public.stripe_transfers.*
  )
  select
    transfer.id, item.id, item.session_payment_id, item.booking_id,
    item.therapist_profile_id, account.id, account.stripe_account_id,
    payment.stripe_charge_id, item.amount_cents, transfer.idempotency_key,
    transfer.request_fingerprint, transfer.attempt_count
  from prepared transfer
  join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
  join public.session_payments payment on payment.id = item.session_payment_id
  join public.therapist_connect_accounts account on account.id = transfer.connect_account_id;

  update public.session_payments payment
  set transfer_status = 'transfer_pending', updated_at = now()
  where exists (
    select 1 from public.payout_batch_items item
    join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
    where item.session_payment_id = payment.id
      and transfer.lease_owner = p_worker_id
      and transfer.status = 'pending'
  );

  update public.payout_batches
  set status = 'processing', updated_at = now()
  where id = p_payout_batch_id and status in ('open', 'partially_failed');
end;
$$;

create or replace function public.complete_payout_transfer_v1(
  p_transfer_id uuid,
  p_worker_id uuid,
  p_stripe_transfer_id text,
  p_transferred_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.stripe_transfers%rowtype;
  v_item public.payout_batch_items%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select * into v_transfer
  from public.stripe_transfers
  where id = p_transfer_id
  for update;

  if not found then raise exception 'PAYOUT_TRANSFER_NOT_FOUND'; end if;
  if v_transfer.status = 'transferred' then return true; end if;
  if v_transfer.lease_owner <> p_worker_id or v_transfer.lease_expires_at < now() then
    raise exception 'PAYOUT_TRANSFER_CLAIM_LOST';
  end if;
  if nullif(trim(p_stripe_transfer_id), '') is null then
    raise exception 'PAYOUT_TRANSFER_PROVIDER_ID_INVALID';
  end if;

  select * into v_item from public.payout_batch_items
  where id = v_transfer.payout_batch_item_id for update;
  select * into v_payment from public.session_payments
  where id = v_transfer.session_payment_id for update;

  update public.stripe_transfers
  set stripe_transfer_id = p_stripe_transfer_id,
      status = 'transferred', transferred_at = p_transferred_at,
      lease_owner = null, lease_expires_at = null, next_retry_at = null,
      failure_code = null, failure_message = null, updated_at = now()
  where id = v_transfer.id;

  update public.payout_batch_items
  set status = 'transferred', failure_code = null, failure_message = null,
      updated_at = now()
  where id = v_item.id;

  update public.session_payments
  set transfer_status = 'transferred', transfer_blocked_reason = null,
      updated_at = now()
  where id = v_payment.id;

  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents, therapist_profile_id,
    booking_id, session_payment_id, payout_batch_id, stripe_transfer_id,
    source_table, source_id, occurred_at
  ) values (
    'transfer', 'debit', v_transfer.currency, v_transfer.amount_cents,
    v_transfer.therapist_profile_id, v_item.booking_id,
    v_transfer.session_payment_id, v_item.payout_batch_id, v_transfer.id,
    'stripe_transfers', v_transfer.id, p_transferred_at
  ) on conflict do nothing;

  return true;
end;
$$;

create or replace function public.fail_payout_transfer_v1(
  p_transfer_id uuid,
  p_worker_id uuid,
  p_disposition text,
  p_error_code text,
  p_error_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.stripe_transfers%rowtype;
  v_item public.payout_batch_items%rowtype;
  v_next_retry timestamptz;
  v_terminal boolean;
  v_status text;
begin
  if p_disposition not in ('transient', 'blocked', 'reconciliation_required') then
    raise exception 'PAYOUT_TRANSFER_DISPOSITION_INVALID';
  end if;

  select * into v_transfer from public.stripe_transfers
  where id = p_transfer_id for update;
  if not found then raise exception 'PAYOUT_TRANSFER_NOT_FOUND'; end if;
  if v_transfer.status = 'transferred' then return 'transferred'; end if;
  if v_transfer.lease_owner <> p_worker_id then raise exception 'PAYOUT_TRANSFER_CLAIM_LOST'; end if;
  select * into v_item from public.payout_batch_items
  where id = v_transfer.payout_batch_item_id for update;

  v_terminal := p_disposition = 'blocked' or v_transfer.attempt_count >= 4;
  v_next_retry := case v_transfer.attempt_count
    when 1 then now() + interval '15 minutes'
    when 2 then now() + interval '1 hour'
    when 3 then now() + interval '4 hours'
    else null
  end;
  v_status := case
    when p_disposition = 'reconciliation_required' then 'reconciliation_required'
    else 'failed'
  end;

  update public.stripe_transfers
  set status = v_status,
      failure_code = left(coalesce(p_error_code, 'provider_error'), 120),
      failure_message = left(regexp_replace(coalesce(p_error_message, 'Falha no repasse.'), '[\r\n]+', ' ', 'g'), 500),
      next_retry_at = case when v_terminal then null else v_next_retry end,
      lease_owner = null, lease_expires_at = null, updated_at = now()
  where id = v_transfer.id;

  update public.payout_batch_items
  set status = case when p_disposition = 'blocked'
        then 'blocked'::public.payout_batch_item_status
        else 'failed'::public.payout_batch_item_status end,
      failure_code = left(coalesce(p_error_code, 'provider_error'), 120),
      failure_message = left(regexp_replace(coalesce(p_error_message, 'Falha no repasse.'), '[\r\n]+', ' ', 'g'), 500),
      updated_at = now()
  where id = v_item.id;

  update public.session_payments
  set transfer_status = case
        when p_disposition = 'blocked' then 'blocked'::public.session_transfer_status
        when v_terminal then 'failed'::public.session_transfer_status
        else 'transfer_pending'::public.session_transfer_status
      end,
      transfer_blocked_reason = left(coalesce(p_error_code, 'provider_error'), 120),
      updated_at = now()
  where id = v_transfer.session_payment_id;

  if v_terminal or p_disposition = 'reconciliation_required' then
    perform public.record_payout_operational_incident_v1(
      'transfer:' || v_transfer.id::text || ':' || v_status,
      case when p_disposition = 'blocked' then 'transfer_blocked'
        when p_disposition = 'reconciliation_required' then 'transfer_reconciliation_required'
        else 'transfer_failed' end,
      case when v_terminal then 'critical' else 'warning' end,
      p_error_code, p_error_message, null, v_item.payout_batch_id,
      v_item.id, v_transfer.id, null, v_transfer.therapist_profile_id
    );
  end if;

  return case when v_terminal then 'terminal' else v_status end;
end;
$$;

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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_payout_batch_id is null or p_worker_id is null
    or p_limit < 1 or p_limit > 50
    or p_lease_minutes < 1 or p_lease_minutes > 30
    or p_environment not in ('test', 'live')
  then
    raise exception 'STRIPE_PAYOUT_CLAIM_INVALID';
  end if;

  return query
  with candidates as (
    select therapist_group.id
    from public.payout_batch_therapists therapist_group
    left join public.stripe_payouts payout
      on payout.payout_batch_therapist_id = therapist_group.id
    where therapist_group.payout_batch_id = p_payout_batch_id
      and therapist_group.total_amount_cents > 0
      and not exists (
        select 1 from public.payout_batch_items item
        where item.payout_batch_therapist_id = therapist_group.id
          and item.status <> 'transferred'
      )
      and (
        payout.id is null
        or (
          payout.status in ('pending_balance', 'failed', 'reconciliation_required')
          and payout.next_retry_at <= now()
          and (payout.status = 'pending_balance' or payout.attempt_count < 4)
          and (payout.lease_expires_at is null or payout.lease_expires_at <= now())
        )
      )
    order by therapist_group.created_at, therapist_group.id
    limit p_limit
    for update of therapist_group skip locked
  ), prepared as (
    insert into public.stripe_payouts (
      payout_batch_therapist_id, payout_batch_id, therapist_profile_id,
      connect_account_id, idempotency_key, request_fingerprint,
      amount_cents, currency, status, attempt_count, lease_owner,
      lease_expires_at
    )
    select
      therapist_group.id, therapist_group.payout_batch_id,
      therapist_group.therapist_profile_id, account.id,
      'tes:' || p_environment || ':payout:' || therapist_group.id::text || ':v1',
      pg_catalog.encode(extensions.digest(pg_catalog.concat_ws('|', p_environment, therapist_group.id::text,
        therapist_group.total_amount_cents::text, 'BRL', account.stripe_account_id), 'sha256'), 'hex'),
      therapist_group.total_amount_cents, 'BRL', 'creating', 1,
      p_worker_id, now() + make_interval(mins => p_lease_minutes)
    from candidates
    join public.payout_batch_therapists therapist_group
      on therapist_group.id = candidates.id
    join public.therapist_connect_accounts account
      on account.id = therapist_group.connect_account_id
    on conflict on constraint stripe_payouts_payout_batch_therapist_id_key do update
    set status = 'creating',
        attempt_count = case
          when public.stripe_payouts.status = 'pending_balance'
            then public.stripe_payouts.attempt_count
          else public.stripe_payouts.attempt_count + 1
        end,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where (
        public.stripe_payouts.status = 'pending_balance'
        or public.stripe_payouts.attempt_count < 4
      )
      and public.stripe_payouts.status in (
        'pending_balance', 'failed', 'reconciliation_required'
      )
      and public.stripe_payouts.request_fingerprint = excluded.request_fingerprint
    returning public.stripe_payouts.*
  )
  select
    payout.id, payout.payout_batch_therapist_id, payout.therapist_profile_id,
    payout.connect_account_id, account.stripe_account_id, payout.amount_cents,
    payout.idempotency_key, payout.request_fingerprint, payout.attempt_count
  from prepared payout
  join public.therapist_connect_accounts account on account.id = payout.connect_account_id;
end;
$$;

create or replace function public.complete_stripe_payout_creation_v1(
  p_payout_id uuid,
  p_worker_id uuid,
  p_stripe_payout_id text,
  p_provider_status text,
  p_source_type text default null,
  p_arrival_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.stripe_payouts%rowtype;
begin
  select * into v_payout from public.stripe_payouts
  where id = p_payout_id for update;
  if not found then raise exception 'STRIPE_PAYOUT_NOT_FOUND'; end if;
  if v_payout.stripe_payout_id is not null then return true; end if;
  if v_payout.lease_owner <> p_worker_id or v_payout.lease_expires_at < now() then
    raise exception 'STRIPE_PAYOUT_CLAIM_LOST';
  end if;
  if nullif(trim(p_stripe_payout_id), '') is null
    or p_provider_status not in ('pending', 'in_transit', 'paid', 'failed', 'canceled')
  then
    raise exception 'STRIPE_PAYOUT_PROVIDER_STATE_INVALID';
  end if;

  update public.stripe_payouts
  set stripe_payout_id = p_stripe_payout_id,
      provider_status = p_provider_status,
      source_type = p_source_type,
      status = case p_provider_status
        when 'in_transit' then 'in_transit'::public.stripe_payout_status
        else 'pending'::public.stripe_payout_status
      end,
      arrival_at = p_arrival_at,
      lease_owner = null, lease_expires_at = null, next_retry_at = null,
      updated_at = now()
  where id = v_payout.id;

  return true;
end;
$$;

create or replace function public.defer_stripe_payout_v1(
  p_payout_id uuid,
  p_worker_id uuid,
  p_disposition text,
  p_error_code text,
  p_error_message text,
  p_retry_after interval default interval '15 minutes'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.stripe_payouts%rowtype;
  v_terminal boolean;
  v_status public.stripe_payout_status;
begin
  if p_disposition not in ('pending_balance', 'transient', 'reconciliation_required', 'blocked') then
    raise exception 'STRIPE_PAYOUT_DISPOSITION_INVALID';
  end if;
  select * into v_payout from public.stripe_payouts
  where id = p_payout_id for update;
  if not found then raise exception 'STRIPE_PAYOUT_NOT_FOUND'; end if;
  if v_payout.status = 'paid' then return 'paid'; end if;
  if v_payout.lease_owner <> p_worker_id then raise exception 'STRIPE_PAYOUT_CLAIM_LOST'; end if;

  -- Balance availability is eventual and is not a provider failure. It must
  -- never consume the finite retry budget or become terminal by itself.
  v_terminal := p_disposition = 'blocked'
    or (p_disposition <> 'pending_balance' and v_payout.attempt_count >= 4);
  v_status := case
    when p_disposition = 'pending_balance' then 'pending_balance'::public.stripe_payout_status
    when p_disposition = 'reconciliation_required' then 'reconciliation_required'::public.stripe_payout_status
    else 'failed'::public.stripe_payout_status
  end;

  update public.stripe_payouts
  set status = v_status,
      failure_code = left(coalesce(p_error_code, 'provider_error'), 120),
      failure_message = left(regexp_replace(coalesce(p_error_message, 'Falha no repasse bancario.'), '[\r\n]+', ' ', 'g'), 500),
      next_retry_at = case when v_terminal then null else now() + greatest(p_retry_after, interval '1 minute') end,
      lease_owner = null, lease_expires_at = null,
      failed_at = case when v_terminal then now() else failed_at end,
      updated_at = now()
  where id = v_payout.id;

  if v_terminal or p_disposition = 'reconciliation_required' then
    perform public.record_payout_operational_incident_v1(
      'payout:' || v_payout.id::text || ':' || v_status::text,
      case when p_disposition = 'blocked' then 'payout_blocked'
        when p_disposition = 'reconciliation_required' then 'payout_reconciliation_required'
        else 'payout_failed' end,
      case when v_terminal then 'critical' else 'warning' end,
      p_error_code, p_error_message, null, v_payout.payout_batch_id,
      null, null, v_payout.id, v_payout.therapist_profile_id
    );
  end if;

  return case when v_terminal then 'terminal' else v_status::text end;
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
  v_batch public.payout_batches%rowtype;
  v_open_incidents integer;
  v_pending integer;
  v_status public.payout_scheduler_run_status;
begin
  select * into v_run
  from public.payout_scheduler_runs
  where id = p_scheduler_run_id
  for update;

  if not found then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FOUND'; end if;

  select * into v_batch
  from public.payout_batches
  where id = v_run.payout_batch_id
  for update;

  select count(*) into v_open_incidents
  from public.payout_operational_incidents incident
  where incident.payout_scheduler_run_id = v_run.id
    and incident.status = 'open';

  select count(*) into v_pending
  from public.payout_batch_therapists therapist_group
  left join public.stripe_payouts payout
    on payout.payout_batch_therapist_id = therapist_group.id
  where therapist_group.payout_batch_id = v_batch.id
    and therapist_group.total_amount_cents > 0
    and coalesce(payout.status::text, 'missing') in (
      'missing', 'pending_balance', 'creating', 'pending', 'in_transit'
    );

  if v_pending > 0 then
    update public.payout_batches
    set status = case when v_open_incidents > 0
      then 'partially_failed'::public.payout_batch_status
      else 'processing'::public.payout_batch_status end
    where id = v_batch.id;
    return jsonb_build_object('completed', false, 'pending', v_pending);
  end if;

  v_status := case when v_open_incidents > 0
    then 'completed_with_incidents'::public.payout_scheduler_run_status
    else 'completed'::public.payout_scheduler_run_status
  end;

  update public.payout_batches
  set status = case when v_open_incidents > 0
        then 'partially_failed'::public.payout_batch_status
        else 'completed'::public.payout_batch_status end,
      processed_at = coalesce(processed_at, now())
  where id = v_batch.id;

  update public.payout_scheduler_runs
  set status = v_status,
      completed_at = coalesce(completed_at, now()),
      worker_id = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_run.id;

  return jsonb_build_object(
    'completed', true,
    'status', v_status,
    'incidents', v_open_incidents
  );
end;
$$;

create or replace function public.reconcile_payout_transfer_v1(
  p_transfer_id uuid,
  p_stripe_transfer_id text,
  p_reversed boolean default false,
  p_observed_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.stripe_transfers%rowtype;
  v_item public.payout_batch_items%rowtype;
begin
  select * into v_transfer from public.stripe_transfers
  where id = p_transfer_id for update;
  if not found then raise exception 'PAYOUT_TRANSFER_NOT_FOUND'; end if;
  if nullif(trim(p_stripe_transfer_id), '') is null then
    raise exception 'PAYOUT_TRANSFER_PROVIDER_ID_INVALID';
  end if;
  if v_transfer.stripe_transfer_id is not null
    and v_transfer.stripe_transfer_id <> p_stripe_transfer_id
  then raise exception 'PAYOUT_TRANSFER_PROVIDER_ID_MISMATCH'; end if;

  select * into v_item from public.payout_batch_items
  where id = v_transfer.payout_batch_item_id for update;

  if p_reversed then
    update public.stripe_transfers
    set stripe_transfer_id = p_stripe_transfer_id, status = 'reversed',
        lease_owner = null, lease_expires_at = null, next_retry_at = null,
        updated_at = now()
    where id = v_transfer.id;
    update public.payout_batch_items
    set status = 'failed', failure_code = 'stripe_transfer_reversed',
        failure_message = 'Transfer revertido pelo provedor.', updated_at = now()
    where id = v_item.id;
    update public.session_payments
    set transfer_status = 'failed', transfer_blocked_reason = 'stripe_transfer_reversed', updated_at = now()
    where id = v_transfer.session_payment_id;
    perform public.record_payout_operational_incident_v1(
      'transfer:' || v_transfer.id::text || ':reversed', 'transfer_reversed',
      'critical', 'stripe_transfer_reversed', 'Transfer revertido pelo provedor.',
      null, v_item.payout_batch_id, v_item.id, v_transfer.id, null,
      v_transfer.therapist_profile_id
    );
    return 'reversed';
  end if;

  update public.stripe_transfers
  set stripe_transfer_id = p_stripe_transfer_id, status = 'transferred',
      transferred_at = coalesce(transferred_at, p_observed_at),
      lease_owner = null, lease_expires_at = null, next_retry_at = null,
      failure_code = null, failure_message = null, updated_at = now()
  where id = v_transfer.id;
  update public.payout_batch_items
  set status = 'transferred', failure_code = null, failure_message = null, updated_at = now()
  where id = v_item.id;
  update public.session_payments
  set transfer_status = 'transferred', transfer_blocked_reason = null, updated_at = now()
  where id = v_transfer.session_payment_id;
  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents, therapist_profile_id,
    booking_id, session_payment_id, payout_batch_id, stripe_transfer_id,
    source_table, source_id, occurred_at
  ) values (
    'transfer', 'debit', v_transfer.currency, v_transfer.amount_cents,
    v_transfer.therapist_profile_id, v_item.booking_id,
    v_transfer.session_payment_id, v_item.payout_batch_id, v_transfer.id,
    'stripe_transfers', v_transfer.id, p_observed_at
  ) on conflict do nothing;
  return 'transferred';
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
  v_payouts integer := 0;
begin
  if p_limit < 1 or p_limit > 200 then raise exception 'PAYOUT_LEASE_LIMIT_INVALID'; end if;

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

  with expired as (
    select id from public.stripe_payouts
    where status = 'creating' and lease_expires_at <= now()
    order by lease_expires_at
    limit p_limit
    for update skip locked
  )
  update public.stripe_payouts payout
  set status = 'reconciliation_required', next_retry_at = now(),
      lease_owner = null, lease_expires_at = null,
      failure_code = 'provider_response_unknown',
      failure_message = 'Lease expirou antes da confirmacao da operacao.',
      updated_at = now()
  from expired where payout.id = expired.id;
  get diagnostics v_payouts = row_count;

  return jsonb_build_object('transfers', v_transfers, 'payouts', v_payouts);
end;
$$;

create or replace function public.apply_stripe_payout_state_v1(
  p_stripe_payout_id text,
  p_stripe_account_id text,
  p_provider_status text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_payout_batch_therapist_id uuid default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_arrival_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.stripe_payouts%rowtype;
  v_was_paid boolean;
  v_batch_status public.payout_batch_status;
  v_nonterminal_count integer;
begin
  if nullif(trim(p_stripe_payout_id), '') is null
    or nullif(trim(p_stripe_account_id), '') is null
    or p_provider_status not in ('pending', 'in_transit', 'paid', 'failed', 'canceled')
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'STRIPE_PAYOUT_EVENT_INVALID';
  end if;

  select payout.* into v_payout
  from public.stripe_payouts payout
  join public.therapist_connect_accounts account on account.id = payout.connect_account_id
  where account.stripe_account_id = p_stripe_account_id
    and (
      payout.stripe_payout_id = p_stripe_payout_id
      or (
        payout.stripe_payout_id is null
        and payout.payout_batch_therapist_id = p_payout_batch_therapist_id
      )
    )
  order by payout.created_at
  limit 1
  for update of payout;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payout_not_found');
  end if;

  if v_payout.stripe_event_created_at is not null
    and p_stripe_event_created_at < v_payout.stripe_event_created_at
  then
    return jsonb_build_object('applied', false, 'reason', 'stale_event');
  end if;

  v_was_paid := v_payout.status = 'paid';

  update public.stripe_payouts
  set stripe_payout_id = coalesce(stripe_payout_id, p_stripe_payout_id),
      provider_status = p_provider_status,
      status = case p_provider_status
        when 'in_transit' then 'in_transit'::public.stripe_payout_status
        when 'paid' then 'paid'::public.stripe_payout_status
        when 'failed' then 'failed'::public.stripe_payout_status
        when 'canceled' then 'canceled'::public.stripe_payout_status
        else 'pending'::public.stripe_payout_status
      end,
      failure_code = left(nullif(regexp_replace(coalesce(p_failure_code, ''), '[\r\n]+', ' ', 'g'), ''), 120),
      failure_message = left(nullif(regexp_replace(coalesce(p_failure_message, ''), '[\r\n]+', ' ', 'g'), ''), 500),
      stripe_event_id = p_stripe_event_id,
      stripe_event_created_at = p_stripe_event_created_at,
      arrival_at = coalesce(p_arrival_at, arrival_at),
      paid_at = case when p_provider_status = 'paid' then coalesce(paid_at, p_stripe_event_created_at) else paid_at end,
      failed_at = case when p_provider_status = 'failed' then p_stripe_event_created_at else failed_at end,
      lease_owner = null, lease_expires_at = null, next_retry_at = null,
      updated_at = now()
  where id = v_payout.id
  returning * into v_payout;

  if p_provider_status = 'failed' then
    perform public.record_payout_operational_incident_v1(
      'payout:' || v_payout.id::text || ':provider_failed',
      case when v_was_paid then 'payout_failed_after_paid' else 'payout_failed' end,
      'critical', p_failure_code, p_failure_message, null,
      v_payout.payout_batch_id, null, null, v_payout.id,
      v_payout.therapist_profile_id,
      jsonb_build_object('failedAfterPaid', v_was_paid)
    );
  end if;

  select case
    when bool_and(coalesce(payout.status = 'paid', false)) then 'completed'::public.payout_batch_status
    when bool_or(coalesce(payout.status in ('failed', 'canceled', 'reconciliation_required'), false))
      then 'partially_failed'::public.payout_batch_status
    else 'processing'::public.payout_batch_status
  end into v_batch_status
  from public.payout_batch_therapists therapist_group
  left join public.stripe_payouts payout
    on payout.payout_batch_therapist_id = therapist_group.id
  where therapist_group.payout_batch_id = v_payout.payout_batch_id
    and therapist_group.total_amount_cents > 0;

  select count(*) into v_nonterminal_count
  from public.payout_batch_therapists therapist_group
  left join public.stripe_payouts payout
    on payout.payout_batch_therapist_id = therapist_group.id
  where therapist_group.payout_batch_id = v_payout.payout_batch_id
    and therapist_group.total_amount_cents > 0
    and coalesce(payout.status::text, 'missing') in (
      'missing', 'pending_balance', 'creating', 'pending', 'in_transit'
    );

  update public.payout_batches
  set status = v_batch_status,
      processed_at = case when v_batch_status = 'completed' then now() else null end,
      updated_at = now()
  where id = v_payout.payout_batch_id;

  update public.payout_scheduler_runs run
  set status = case
        when v_nonterminal_count = 0 and v_batch_status = 'completed'
          then 'completed'::public.payout_scheduler_run_status
        when v_nonterminal_count = 0 and v_batch_status = 'partially_failed'
          then 'completed_with_incidents'::public.payout_scheduler_run_status
        else run.status
      end,
      completed_at = case when v_nonterminal_count = 0 then now() else run.completed_at end,
      worker_id = case when v_nonterminal_count = 0 then null else run.worker_id end,
      lease_expires_at = case when v_nonterminal_count = 0 then null else run.lease_expires_at end,
      updated_at = now()
  where run.payout_batch_id = v_payout.payout_batch_id;

  return jsonb_build_object(
    'applied', true,
    'payoutId', v_payout.id,
    'status', v_payout.status,
    'failedAfterPaid', v_was_paid and p_provider_status = 'failed'
  );
end;
$$;

create or replace function public.mark_payout_window_incomplete_v1(
  p_run_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payout_scheduler_runs%rowtype;
begin
  select * into v_run from public.payout_scheduler_runs
  where id = p_run_id for update;
  if not found or v_run.status <> 'running' then return false; end if;
  if (p_now at time zone 'America/Sao_Paulo')::time < time '04:00'
    or v_run.window_alerted_at is not null
  then return false; end if;
  update public.payout_scheduler_runs
  set window_alerted_at = p_now, updated_at = now()
  where id = v_run.id;
  perform public.record_payout_operational_incident_v1(
    'scheduler:' || v_run.id::text || ':window_incomplete',
    'batch_incomplete_after_window', 'warning',
    'processing_window_closed', 'Lote ainda em processamento apos a janela inicial.',
    v_run.id, v_run.payout_batch_id
  );
  return true;
end;
$$;

revoke all on function public.record_payout_operational_incident_v1(
  text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.claim_weekly_payout_scheduler_run_v1(timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.complete_payout_transfer_v1(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_payout_transfer_v1(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_payout_groups_v1(uuid, uuid, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.complete_stripe_payout_creation_v1(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.defer_stripe_payout_v1(uuid, uuid, text, text, text, interval)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_payout_state_v1(text, text, text, text, timestamptz, uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mark_payout_window_incomplete_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_payout_scheduler_run_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.reconcile_payout_transfer_v1(uuid, text, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_expired_payout_leases_v1(integer)
  from public, anon, authenticated;

grant execute on function public.record_payout_operational_incident_v1(
  text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb
) to service_role;
grant execute on function public.claim_weekly_payout_scheduler_run_v1(timestamptz, uuid, integer)
  to service_role;
grant execute on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
  to service_role;
grant execute on function public.complete_payout_transfer_v1(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.fail_payout_transfer_v1(uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.claim_payout_groups_v1(uuid, uuid, integer, integer, text)
  to service_role;
grant execute on function public.complete_stripe_payout_creation_v1(uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.defer_stripe_payout_v1(uuid, uuid, text, text, text, interval)
  to service_role;
grant execute on function public.apply_stripe_payout_state_v1(text, text, text, text, timestamptz, uuid, text, text, timestamptz)
  to service_role;
grant execute on function public.mark_payout_window_incomplete_v1(uuid, timestamptz)
  to service_role;
grant execute on function public.finalize_payout_scheduler_run_v1(uuid)
  to service_role;
grant execute on function public.reconcile_payout_transfer_v1(uuid, text, boolean, timestamptz)
  to service_role;
grant execute on function public.release_expired_payout_leases_v1(integer)
  to service_role;

comment on table public.payout_scheduler_runs is
  'Persistent weekly payout orchestration lease. A run may start only Tuesday 02:00-04:00 America/Sao_Paulo, but active retries can continue later.';
comment on table public.stripe_payouts is
  'Bank payout state for one payout batch therapist group. Transfer and bank payout remain separate authorities.';
comment on table public.payout_operational_incidents is
  'Sanitized idempotent operational incidents for payout blocking, failure and reconciliation.';

commit;
