-- TES Payments V10 phase 1: additive schema, private orchestration contracts
-- and hard isolation from the legacy V9 weekly payout flow.

alter table public.financial_policy_versions
  add column if not exists policy_key text;

update public.financial_policy_versions
set policy_key = version
where policy_key is null;

-- Existing V9 writers and test fixtures insert a version without a policy_key.
-- Preserve that contract while keeping the new key populated and unique.
create or replace function public.default_financial_policy_key_v10()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.policy_key is null then
    new.policy_key := new.version;
  end if;
  return new;
end;
$$;

create trigger default_financial_policy_key_v10
before insert or update on public.financial_policy_versions
for each row execute function public.default_financial_policy_key_v10();

alter table public.financial_policy_versions
  alter column policy_key set not null;

create unique index if not exists financial_policy_versions_policy_key_uidx
  on public.financial_policy_versions (policy_key);

insert into public.financial_policy_versions (
  version,
  policy_key,
  is_active,
  currency,
  platform_commission_bps,
  auto_confirmation_days,
  patient_auto_confirmation_days,
  therapist_auto_confirmation_days,
  transfer_safety_period_days,
  free_cancellation_hours,
  late_cancellation_retention_bps,
  no_show_retention_bps,
  refund_processing_business_days,
  manual_review_response_days,
  weekly_batch_weekday,
  weekly_batch_time,
  timezone,
  payout_batch_rule,
  cancellation_policy_key,
  refund_policy_key,
  proration_policy_key,
  upgrade_proration_behavior,
  downgrade_behavior,
  subscription_cancellation_behavior,
  metadata,
  effective_from
)
values (
  'tes-payments-v10-setup-t24-immediate-transfer',
  'tes-payments-v10-setup-t24-immediate-transfer',
  false,
  'BRL',
  1500,
  30,
  7,
  30,
  0,
  24,
  0,
  0,
  7,
  5,
  2,
  time '02:00',
  'America/Sao_Paulo',
  'direct_transfer_after_payment_confirmation',
  'setup_t24_cancel_before_charge_support_after_charge',
  'platform_refund_then_transfer_reversal_or_internal_debt',
  'upgrade_immediate_prorated_downgrade_period_end',
  'always_invoice',
  'period_end_no_credit',
  'cancel_at_period_end',
  jsonb_build_object(
    'activation', 'disabled_foundation_only',
    'chargeTiming', 't_minus_24_hours_or_immediate',
    'paymentMethodSetup', 'setup_intent_off_session',
    'transferTiming', 'immediate_after_payment_confirmation',
    'transferSource', 'source_transaction',
    'sessionConfirmationFinancialGate', false,
    'payoutMode', 'stripe_daily_automatic',
    'commissionRatePercent', 15,
    'stripeFees', 'absorbed_by_tes',
    'supersedesWhenActivated', 'tes-payments-v9-settlement-only'
  ),
  timestamptz '2026-09-12 00:00:00-03'
)
on conflict (policy_key) do update
set metadata = excluded.metadata;

alter table public.session_payments
  add column if not exists payment_flow_version text not null default 'v9',
  add column if not exists connect_account_id_snapshot uuid,
  add column if not exists stripe_connect_account_id_snapshot text,
  add column if not exists payment_due_at timestamptz;

alter table public.session_payments
  add constraint session_payments_flow_version_check
  check (payment_flow_version in ('v9', 'v10'));

alter table public.session_payments
  add constraint session_payments_v10_snapshot_check
  check (
    payment_flow_version = 'v9'
    or (
      connect_account_id_snapshot is not null
      and nullif(trim(stripe_connect_account_id_snapshot), '') is not null
      and payment_due_at is not null
    )
  );

alter table public.session_payments
  add constraint session_payments_connect_account_snapshot_fkey
  foreign key (connect_account_id_snapshot)
  references public.therapist_connect_accounts(id)
  on delete restrict;

create index if not exists session_payments_v10_due_idx
  on public.session_payments (payment_due_at, financial_status)
  where payment_flow_version = 'v10'
    and financial_status in ('pending', 'processing');

create or replace function public.enforce_session_payment_v10_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy_key text;
  v_account public.therapist_connect_accounts%rowtype;
begin
  if tg_op = 'UPDATE'
    and (old.payment_flow_version = 'v10' or new.payment_flow_version = 'v10')
  then
    if new.payment_flow_version is distinct from old.payment_flow_version
      or new.policy_version_id is distinct from old.policy_version_id
      or new.connect_account_id_snapshot is distinct from old.connect_account_id_snapshot
      or new.stripe_connect_account_id_snapshot is distinct from old.stripe_connect_account_id_snapshot
      or new.platform_commission_bps is distinct from old.platform_commission_bps
      or new.platform_gross_commission_cents is distinct from old.platform_gross_commission_cents
      or new.therapist_amount_cents is distinct from old.therapist_amount_cents
      or new.gross_amount_cents is distinct from old.gross_amount_cents
    then
      raise exception 'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;

  if new.payment_flow_version <> 'v10' then
    return new;
  end if;

  select policy.policy_key
  into v_policy_key
  from public.financial_policy_versions as policy
  where policy.id = new.policy_version_id;

  if v_policy_key is distinct from 'tes-payments-v10-setup-t24-immediate-transfer' then
    raise exception 'SESSION_PAYMENT_V10_POLICY_REQUIRED'
      using errcode = '23514';
  end if;

  select account.*
  into v_account
  from public.therapist_connect_accounts as account
  where account.id = new.connect_account_id_snapshot;

  if not found
    or v_account.therapist_profile_id <> new.therapist_profile_id
    or v_account.stripe_account_id <> new.stripe_connect_account_id_snapshot
  then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_SNAPSHOT_INVALID'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and (
    not v_account.is_current
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or not v_account.payouts_enabled
    or v_account.payout_status <> 'enabled'
    or v_account.payout_schedule_interval <> 'daily'
  ) then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_NOT_READY'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and (
    not v_account.is_current
    or v_account.closed_at is not null
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or not v_account.payouts_enabled
    or v_account.payout_status <> 'enabled'
    or v_account.payout_schedule_interval <> 'daily'
  ) then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_NOT_READY'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_session_payment_v10_snapshot
  on public.session_payments;
create trigger enforce_session_payment_v10_snapshot
before insert or update on public.session_payments
for each row execute function public.enforce_session_payment_v10_snapshot_v1();

revoke all on function public.enforce_session_payment_v10_snapshot_v1()
from public, anon, authenticated;

create table if not exists public.session_payment_setups (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  booking_version bigint not null,
  session_payment_id uuid not null references public.session_payments(id) on delete cascade,
  stripe_environment text not null,
  stripe_customer_id text not null,
  stripe_setup_intent_id text not null,
  stripe_payment_method_id text,
  usage text not null default 'off_session',
  status text not null default 'requires_setup',
  consent_version text not null,
  consented_at timestamptz not null,
  superseded_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_payment_setups_booking_version_positive
    check (booking_version > 0),
  constraint session_payment_setups_environment_check
    check (stripe_environment in ('test', 'live')),
  constraint session_payment_setups_usage_check
    check (usage = 'off_session'),
  constraint session_payment_setups_status_check
    check (status in (
      'requires_setup', 'processing', 'requires_action', 'succeeded',
      'failed', 'canceled', 'superseded'
    )),
  constraint session_payment_setups_payment_method_state_check
    check (status <> 'succeeded' or stripe_payment_method_id is not null)
);

create unique index if not exists session_payment_setups_setup_intent_uidx
  on public.session_payment_setups (stripe_environment, stripe_setup_intent_id);

create unique index if not exists session_payment_setups_active_booking_version_uidx
  on public.session_payment_setups (booking_id, booking_version)
  where superseded_at is null
    and status not in ('canceled', 'superseded');

create index if not exists session_payment_setups_payment_idx
  on public.session_payment_setups (session_payment_id, created_at desc);

create table if not exists public.session_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  booking_version bigint not null,
  session_payment_id uuid not null references public.session_payments(id) on delete cascade,
  session_payment_setup_id uuid not null references public.session_payment_setups(id) on delete restrict,
  stripe_environment text not null,
  due_at timestamptz not null,
  status text not null default 'scheduled',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  claimed_at timestamptz,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  last_error_code text,
  last_failed_at timestamptz,
  succeeded_at timestamptz,
  canceled_at timestamptz,
  idempotency_key text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_payment_schedules_booking_version_positive
    check (booking_version > 0),
  constraint session_payment_schedules_environment_check
    check (stripe_environment in ('test', 'live')),
  constraint session_payment_schedules_status_check
    check (status in (
      'scheduled', 'claimed', 'processing', 'paid',
      'requires_customer_action', 'retry_scheduled', 'failed',
      'canceled', 'superseded'
    )),
  constraint session_payment_schedules_attempt_count_check
    check (attempt_count between 0 and 8),
  constraint session_payment_schedules_idempotency_present
    check (length(trim(idempotency_key)) > 0),
  constraint session_payment_schedules_fingerprint_present
    check (length(trim(request_fingerprint)) > 0),
  constraint session_payment_schedules_lease_check
    check (
      (lease_owner is null and lease_expires_at is null)
      or (lease_owner is not null and lease_expires_at is not null)
    )
);

create unique index if not exists session_payment_schedules_idempotency_uidx
  on public.session_payment_schedules (stripe_environment, idempotency_key);

create unique index if not exists session_payment_schedules_payment_intent_uidx
  on public.session_payment_schedules (stripe_environment, stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists session_payment_schedules_active_booking_version_uidx
  on public.session_payment_schedules (booking_id, booking_version)
  where status not in ('paid', 'failed', 'canceled', 'superseded');

create index if not exists session_payment_schedules_claim_idx
  on public.session_payment_schedules (coalesce(next_retry_at, due_at), created_at)
  where status in ('scheduled', 'retry_scheduled', 'claimed', 'processing');

create table if not exists public.session_promotion_reservations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  booking_version bigint not null,
  session_payment_id uuid references public.session_payments(id) on delete cascade,
  stripe_environment text not null,
  stripe_promotion_code_id text,
  stripe_coupon_id text,
  promotion_code_snapshot text not null,
  scope text not null default 'session',
  currency character(3) not null default 'BRL',
  discount_type text not null,
  discount_value integer not null,
  subtotal_cents integer not null,
  discount_cents integer not null,
  total_cents integer not null,
  status text not null default 'reserved',
  idempotency_key text not null,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_promotion_reservations_booking_version_positive
    check (booking_version > 0),
  constraint session_promotion_reservations_environment_check
    check (stripe_environment in ('test', 'live')),
  constraint session_promotion_reservations_scope_check
    check (scope = 'session'),
  constraint session_promotion_reservations_currency_brl
    check (currency = 'BRL'),
  constraint session_promotion_reservations_discount_type_check
    check (discount_type in ('percent', 'fixed_amount')),
  constraint session_promotion_reservations_status_check
    check (status in ('reserved', 'consumed', 'released', 'expired')),
  constraint session_promotion_reservations_amounts_check
    check (
      discount_value >= 0
      and subtotal_cents >= 0
      and discount_cents >= 0
      and total_cents >= 0
      and subtotal_cents = discount_cents + total_cents
    )
);

create unique index if not exists session_promotion_reservations_idempotency_uidx
  on public.session_promotion_reservations (stripe_environment, idempotency_key);

create unique index if not exists session_promotion_reservations_active_booking_uidx
  on public.session_promotion_reservations (booking_id, booking_version)
  where status in ('reserved', 'consumed');

alter table public.session_payment_attempts
  drop constraint if exists session_payment_attempts_attempt_kind_check;

alter table public.session_payment_attempts
  add constraint session_payment_attempts_attempt_kind_check
  check (attempt_kind in (
    'legacy', 'initial_hold', 'payment_retry',
    'v10_immediate', 'v10_scheduled', 'v10_customer_recovery'
  ));

alter table public.session_payment_attempts
  add column if not exists session_payment_schedule_id uuid,
  add column if not exists stripe_setup_intent_id text;

alter table public.session_payment_attempts
  add constraint session_payment_attempts_schedule_fkey
  foreign key (session_payment_schedule_id)
  references public.session_payment_schedules(id)
  on delete set null;

create index if not exists session_payment_attempts_schedule_idx
  on public.session_payment_attempts (session_payment_schedule_id, created_at desc)
  where session_payment_schedule_id is not null;

alter table public.stripe_transfers
  alter column payout_batch_item_id drop not null,
  add column if not exists transfer_origin text not null default 'weekly_batch',
  add column if not exists therapist_gross_amount_cents integer,
  add column if not exists debt_offset_amount_cents integer not null default 0;

update public.stripe_transfers
set therapist_gross_amount_cents = amount_cents
where therapist_gross_amount_cents is null;

alter table public.stripe_transfers
  add constraint stripe_transfers_origin_check
  check (
    (transfer_origin = 'weekly_batch' and payout_batch_item_id is not null)
    or (
      transfer_origin = 'session_direct'
      and payout_batch_item_id is null
      and nullif(trim(stripe_source_charge_id), '') is not null
    )
  );

alter table public.stripe_transfers
  add constraint stripe_transfers_amount_split_check
  check (
    (transfer_origin = 'weekly_batch' and therapist_gross_amount_cents is null)
    or (
      therapist_gross_amount_cents is not null
      and debt_offset_amount_cents >= 0
      and therapist_gross_amount_cents = debt_offset_amount_cents + amount_cents
    )
  );

create unique index if not exists stripe_transfers_direct_payment_uidx
  on public.stripe_transfers (session_payment_id)
  where transfer_origin = 'session_direct';

create index if not exists stripe_transfers_origin_status_idx
  on public.stripe_transfers (transfer_origin, status, created_at);

create or replace function public.enforce_stripe_transfer_payment_flow_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = new.session_payment_id;

  if not found
    or v_payment.therapist_profile_id <> new.therapist_profile_id
  then
    raise exception 'STRIPE_TRANSFER_PAYMENT_BINDING_INVALID'
      using errcode = '23514';
  end if;

  if new.transfer_origin = 'weekly_batch'
    and v_payment.payment_flow_version <> 'v9'
  then
    raise exception 'V10_DIRECT_TRANSFER_CANNOT_ENTER_WEEKLY_BATCH'
      using errcode = '23514';
  end if;

  if new.transfer_origin = 'session_direct' and (
    v_payment.payment_flow_version <> 'v10'
    or v_payment.connect_account_id_snapshot <> new.connect_account_id
    or v_payment.stripe_charge_id is distinct from new.stripe_source_charge_id
    or new.therapist_gross_amount_cents <> v_payment.therapist_amount_cents
  ) then
    raise exception 'STRIPE_TRANSFER_V10_SNAPSHOT_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_stripe_transfer_payment_flow
  on public.stripe_transfers;
create trigger enforce_stripe_transfer_payment_flow
before insert or update of
  session_payment_id,
  therapist_profile_id,
  connect_account_id,
  stripe_source_charge_id,
  transfer_origin,
  therapist_gross_amount_cents,
  debt_offset_amount_cents,
  amount_cents
on public.stripe_transfers
for each row execute function public.enforce_stripe_transfer_payment_flow_v1();

revoke all on function public.enforce_stripe_transfer_payment_flow_v1()
from public, anon, authenticated;

alter table public.stripe_payout_transfer_allocations
  alter column payout_batch_id drop not null,
  alter column payout_batch_therapist_id drop not null,
  add column if not exists allocation_origin text not null default 'weekly_batch';

alter table public.stripe_payout_transfer_allocations
  add constraint stripe_payout_transfer_allocations_origin_check
  check (
    (allocation_origin = 'weekly_batch'
      and payout_batch_id is not null
      and payout_batch_therapist_id is not null)
    or (allocation_origin = 'session_direct'
      and payout_batch_id is null
      and payout_batch_therapist_id is null)
  );

create index if not exists stripe_payout_allocations_direct_idx
  on public.stripe_payout_transfer_allocations (stripe_payout_id, stripe_transfer_id)
  where allocation_origin = 'session_direct';

create or replace function public.enforce_payout_allocation_transfer_origin_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text;
begin
  select transfer.transfer_origin
  into v_origin
  from public.stripe_transfers as transfer
  where transfer.id = new.stripe_transfer_id;

  if v_origin is null or v_origin <> new.allocation_origin then
    raise exception 'PAYOUT_ALLOCATION_TRANSFER_ORIGIN_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_payout_allocation_transfer_origin
  on public.stripe_payout_transfer_allocations;
create trigger enforce_payout_allocation_transfer_origin
before insert or update on public.stripe_payout_transfer_allocations
for each row execute function public.enforce_payout_allocation_transfer_origin_v1();

revoke all on function public.enforce_payout_allocation_transfer_origin_v1()
from public, anon, authenticated;

alter type public.financial_ledger_entry_type
  add value if not exists 'therapist_debt';
alter type public.financial_ledger_entry_type
  add value if not exists 'therapist_debt_offset';

create table if not exists public.therapist_financial_debts (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles(id) on delete restrict,
  session_payment_id uuid references public.session_payments(id) on delete restrict,
  stripe_transfer_id uuid references public.stripe_transfers(id) on delete restrict,
  origin text not null,
  reason_code text not null,
  currency character(3) not null default 'BRL',
  principal_amount_cents integer not null,
  open_amount_cents integer not null,
  recovered_amount_cents integer not null default 0,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_financial_debts_origin_check
    check (origin in ('refund', 'dispute', 'transfer_reversal_shortfall', 'manual_adjustment')),
  constraint therapist_financial_debts_currency_brl
    check (currency = 'BRL'),
  constraint therapist_financial_debts_amounts_check
    check (
      principal_amount_cents > 0
      and open_amount_cents >= 0
      and recovered_amount_cents >= 0
      and principal_amount_cents = open_amount_cents + recovered_amount_cents
    ),
  constraint therapist_financial_debts_status_check
    check (
      (status = 'open' and open_amount_cents > 0 and closed_at is null)
      or (status = 'settled' and open_amount_cents = 0 and closed_at is not null)
      or (status = 'waived' and closed_at is not null)
    )
);

create index if not exists therapist_financial_debts_open_idx
  on public.therapist_financial_debts (therapist_profile_id, opened_at, id)
  where status = 'open' and open_amount_cents > 0;

create table if not exists public.therapist_financial_debt_events (
  id uuid primary key default gen_random_uuid(),
  therapist_financial_debt_id uuid not null references public.therapist_financial_debts(id) on delete restrict,
  event_type text not null,
  direction text not null,
  amount_cents integer not null,
  idempotency_key text not null,
  financial_ledger_entry_id uuid references public.financial_ledger_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint therapist_financial_debt_events_type_check
    check (event_type in ('created', 'adjusted', 'reversal_recovered', 'transfer_offset', 'waived', 'closed')),
  constraint therapist_financial_debt_events_direction_check
    check (direction in ('increase', 'decrease', 'informational')),
  constraint therapist_financial_debt_events_amount_check
    check (amount_cents >= 0),
  constraint therapist_financial_debt_events_idempotency_present
    check (length(trim(idempotency_key)) > 0)
);

create unique index if not exists therapist_financial_debt_events_idempotency_uidx
  on public.therapist_financial_debt_events (idempotency_key);

create table if not exists public.therapist_financial_debt_allocations (
  id uuid primary key default gen_random_uuid(),
  therapist_financial_debt_id uuid not null references public.therapist_financial_debts(id) on delete restrict,
  stripe_transfer_id uuid not null references public.stripe_transfers(id) on delete restrict,
  financial_ledger_entry_id uuid references public.financial_ledger_entries(id) on delete set null,
  amount_cents integer not null,
  idempotency_key text not null,
  allocated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint therapist_financial_debt_allocations_amount_positive
    check (amount_cents > 0),
  constraint therapist_financial_debt_allocations_idempotency_present
    check (length(trim(idempotency_key)) > 0)
);

create unique index if not exists therapist_financial_debt_allocations_idempotency_uidx
  on public.therapist_financial_debt_allocations (idempotency_key);

create unique index if not exists therapist_financial_debt_allocations_pair_uidx
  on public.therapist_financial_debt_allocations (
    therapist_financial_debt_id,
    stripe_transfer_id
  );

alter table public.financial_ledger_entries
  add column if not exists financial_policy_version_id uuid,
  add column if not exists transfer_origin text,
  add column if not exists therapist_financial_debt_id uuid;

alter table public.financial_ledger_entries
  add constraint financial_ledger_entries_policy_version_fkey
  foreign key (financial_policy_version_id)
  references public.financial_policy_versions(id)
  on delete set null;

alter table public.financial_ledger_entries
  add constraint financial_ledger_entries_debt_fkey
  foreign key (therapist_financial_debt_id)
  references public.therapist_financial_debts(id)
  on delete set null;

alter table public.financial_ledger_entries
  add constraint financial_ledger_entries_transfer_origin_check
  check (transfer_origin is null or transfer_origin in ('weekly_batch', 'session_direct'));

create table if not exists public.session_transfer_jobs (
  id uuid primary key default gen_random_uuid(),
  session_payment_id uuid not null unique references public.session_payments(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  policy_version_id uuid not null references public.financial_policy_versions(id) on delete restrict,
  connect_account_id uuid not null references public.therapist_connect_accounts(id) on delete restrict,
  stripe_environment text not null,
  stripe_source_charge_id text not null,
  therapist_gross_amount_cents integer not null,
  debt_offset_amount_cents integer not null default 0,
  transfer_amount_cents integer not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  stripe_transfer_id uuid references public.stripe_transfers(id) on delete restrict,
  idempotency_key text not null,
  request_fingerprint text not null,
  last_error_code text,
  last_failed_at timestamptz,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_transfer_jobs_environment_check
    check (stripe_environment in ('test', 'live')),
  constraint session_transfer_jobs_amounts_check
    check (
      therapist_gross_amount_cents > 0
      and debt_offset_amount_cents >= 0
      and transfer_amount_cents >= 0
      and therapist_gross_amount_cents = debt_offset_amount_cents + transfer_amount_cents
    ),
  constraint session_transfer_jobs_status_check
    check (status in (
      'queued', 'creating', 'pending_source', 'transferred',
      'reconciliation_required', 'failed', 'offset_only',
      'partially_reversed', 'reversed'
    )),
  constraint session_transfer_jobs_attempt_count_check
    check (attempt_count between 0 and 8),
  constraint session_transfer_jobs_lease_check
    check (
      (lease_owner is null and lease_expires_at is null)
      or (lease_owner is not null and lease_expires_at is not null)
    ),
  constraint session_transfer_jobs_keys_present
    check (
      length(trim(idempotency_key)) > 0
      and length(trim(request_fingerprint)) > 0
      and length(trim(stripe_source_charge_id)) > 0
    )
);

create unique index if not exists session_transfer_jobs_idempotency_uidx
  on public.session_transfer_jobs (stripe_environment, idempotency_key);

create index if not exists session_transfer_jobs_claim_idx
  on public.session_transfer_jobs (coalesce(next_retry_at, created_at), created_at)
  where status in ('queued', 'creating', 'reconciliation_required');

create or replace function public.validate_session_transfer_job_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = new.session_payment_id;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status not in ('paid', 'partially_refunded')
    or v_payment.booking_id <> new.booking_id
    or v_payment.policy_version_id <> new.policy_version_id
    or v_payment.connect_account_id_snapshot <> new.connect_account_id
    or v_payment.stripe_charge_id <> new.stripe_source_charge_id
    or v_payment.therapist_amount_cents <> new.therapist_gross_amount_cents
  then
    raise exception 'SESSION_TRANSFER_JOB_V10_PAYMENT_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_session_transfer_job
before insert or update on public.session_transfer_jobs
for each row execute function public.validate_session_transfer_job_v10();

revoke all on function public.validate_session_transfer_job_v10()
from public, anon, authenticated;

create or replace function public.guard_v10_payment_from_weekly_batch_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.session_payments as payment
    where payment.id = new.session_payment_id
      and payment.payment_flow_version = 'v10'
  ) then
    raise exception 'V10_DIRECT_TRANSFER_CANNOT_ENTER_WEEKLY_BATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_v10_payment_from_weekly_batch
  on public.payout_batch_items;
create trigger guard_v10_payment_from_weekly_batch
before insert or update of session_payment_id on public.payout_batch_items
for each row execute function public.guard_v10_payment_from_weekly_batch_v1();

revoke all on function public.guard_v10_payment_from_weekly_batch_v1()
from public, anon, authenticated;

alter table public.session_payment_setups enable row level security;
alter table public.session_payment_schedules enable row level security;
alter table public.session_promotion_reservations enable row level security;
alter table public.session_transfer_jobs enable row level security;
alter table public.therapist_financial_debts enable row level security;
alter table public.therapist_financial_debt_events enable row level security;
alter table public.therapist_financial_debt_allocations enable row level security;

revoke all on table
  public.session_payment_setups,
  public.session_payment_schedules,
  public.session_promotion_reservations,
  public.session_transfer_jobs,
  public.therapist_financial_debts,
  public.therapist_financial_debt_events,
  public.therapist_financial_debt_allocations
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.session_payment_setups,
  public.session_payment_schedules,
  public.session_promotion_reservations,
  public.session_transfer_jobs,
  public.therapist_financial_debts,
  public.therapist_financial_debt_events,
  public.therapist_financial_debt_allocations
to service_role;

create or replace function public.enforce_session_payment_setup_state_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.booking_version is distinct from old.booking_version
    or new.session_payment_id is distinct from old.session_payment_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_setup_intent_id is distinct from old.stripe_setup_intent_id
    or new.usage is distinct from old.usage
    or new.consent_version is distinct from old.consent_version
    or new.consented_at is distinct from old.consented_at
  then
    raise exception 'SESSION_PAYMENT_SETUP_V10_BINDING_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'requires_setup' and new.status in ('processing', 'canceled', 'superseded'))
    or (old.status = 'processing' and new.status in ('requires_action', 'succeeded', 'failed', 'canceled', 'superseded'))
    or (old.status = 'requires_action' and new.status in ('processing', 'succeeded', 'failed', 'canceled', 'superseded'))
    or (old.status = 'succeeded' and new.status in ('canceled', 'superseded'))
    or (old.status = 'failed' and new.status in ('processing', 'canceled', 'superseded'))
  ) then
    raise exception 'SESSION_PAYMENT_SETUP_V10_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_session_payment_schedule_state_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.booking_version is distinct from old.booking_version
    or new.session_payment_id is distinct from old.session_payment_id
    or new.session_payment_setup_id is distinct from old.session_payment_setup_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.due_at is distinct from old.due_at
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_BINDING_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'scheduled' and new.status in ('claimed', 'paid', 'canceled', 'superseded'))
    or (old.status = 'claimed' and new.status in ('processing', 'paid', 'requires_customer_action', 'retry_scheduled', 'failed', 'canceled', 'superseded'))
    or (old.status = 'processing' and new.status in ('paid', 'requires_customer_action', 'retry_scheduled', 'failed', 'canceled', 'superseded'))
    or (old.status = 'requires_customer_action' and new.status in ('claimed', 'processing', 'paid', 'failed', 'canceled', 'superseded'))
    or (old.status = 'retry_scheduled' and new.status in ('claimed', 'canceled', 'superseded'))
  ) then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_session_transfer_job_state_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.session_payment_id is distinct from old.session_payment_id
    or new.booking_id is distinct from old.booking_id
    or new.policy_version_id is distinct from old.policy_version_id
    or new.connect_account_id is distinct from old.connect_account_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.stripe_source_charge_id is distinct from old.stripe_source_charge_id
    or new.therapist_gross_amount_cents is distinct from old.therapist_gross_amount_cents
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
  then
    raise exception 'SESSION_TRANSFER_JOB_V10_BINDING_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'queued' and new.status in ('creating', 'offset_only', 'failed'))
    or (old.status = 'creating' and new.status in ('pending_source', 'transferred', 'reconciliation_required', 'failed', 'offset_only'))
    or (old.status = 'pending_source' and new.status in ('transferred', 'reconciliation_required', 'failed', 'partially_reversed', 'reversed'))
    or (old.status = 'transferred' and new.status in ('partially_reversed', 'reversed'))
    or (old.status = 'reconciliation_required' and new.status in ('creating', 'pending_source', 'transferred', 'failed'))
    or (old.status = 'failed' and new.status = 'creating')
    or (old.status = 'partially_reversed' and new.status = 'reversed')
  ) then
    raise exception 'SESSION_TRANSFER_JOB_V10_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_session_payment_setup_state
before update on public.session_payment_setups
for each row execute function public.enforce_session_payment_setup_state_v10();

create trigger enforce_session_payment_schedule_state
before update on public.session_payment_schedules
for each row execute function public.enforce_session_payment_schedule_state_v10();

create trigger enforce_session_transfer_job_state
before update on public.session_transfer_jobs
for each row execute function public.enforce_session_transfer_job_state_v10();

revoke all on function public.enforce_session_payment_setup_state_v10()
from public, anon, authenticated;
revoke all on function public.enforce_session_payment_schedule_state_v10()
from public, anon, authenticated;
revoke all on function public.enforce_session_transfer_job_state_v10()
from public, anon, authenticated;

create trigger set_session_payment_setups_updated_at
before update on public.session_payment_setups
for each row execute function public.set_updated_at();

create trigger set_session_payment_schedules_updated_at
before update on public.session_payment_schedules
for each row execute function public.set_updated_at();

create trigger set_session_promotion_reservations_updated_at
before update on public.session_promotion_reservations
for each row execute function public.set_updated_at();

create trigger set_session_transfer_jobs_updated_at
before update on public.session_transfer_jobs
for each row execute function public.set_updated_at();

create trigger set_therapist_financial_debts_updated_at
before update on public.therapist_financial_debts
for each row execute function public.set_updated_at();

comment on table public.session_payment_setups is
  'Private V10 binding between one booking version, SetupIntent and PaymentMethod. Never stores PAN or CVC.';
comment on table public.session_payment_schedules is
  'Private V10 T-24 charge schedule with lease, retry and idempotency state.';
comment on table public.session_promotion_reservations is
  'Private immutable promotion snapshot reserved for one booking version.';
comment on table public.session_transfer_jobs is
  'Private V10 direct Transfer outbox created atomically when a session payment is confirmed.';
comment on table public.therapist_financial_debts is
  'Private therapist debt principal used only when a completed refund or dispute cannot be recovered by Transfer Reversal.';
comment on column public.session_payments.payment_flow_version is
  'Immutable policy family. V9 remains weekly-batch; V10 uses T-24 charge and direct Transfer.';
comment on column public.stripe_transfers.transfer_origin is
  'weekly_batch for V9 and session_direct for V10. Determines mutually exclusive foreign-key requirements.';

create or replace function public.register_session_payment_setup_v10(
  p_session_payment_id uuid,
  p_booking_version bigint,
  p_stripe_environment text,
  p_stripe_customer_id text,
  p_stripe_setup_intent_id text,
  p_stripe_payment_method_id text,
  p_status text,
  p_consent_version text,
  p_consented_at timestamptz,
  p_failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_booking public.bookings%rowtype;
  v_setup public.session_payment_setups%rowtype;
begin
  if p_session_payment_id is null
    or p_booking_version is null
    or p_booking_version <= 0
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_stripe_customer_id), '') is null
    or nullif(trim(p_stripe_setup_intent_id), '') is null
    or p_status not in (
      'requires_setup', 'processing', 'requires_action', 'succeeded',
      'failed', 'canceled', 'superseded'
    )
    or nullif(trim(p_consent_version), '') is null
    or p_consented_at is null
    or (p_status = 'succeeded' and nullif(trim(p_stripe_payment_method_id), '') is null)
  then
    raise exception 'SESSION_PAYMENT_SETUP_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PAYMENT_V10_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id;

  if not found or v_booking.version <> p_booking_version then
    raise exception 'SESSION_PAYMENT_BOOKING_VERSION_MISMATCH'
      using errcode = '23514';
  end if;

  select setup.*
  into v_setup
  from public.session_payment_setups as setup
  where setup.booking_id = v_payment.booking_id
    and setup.booking_version = p_booking_version
    and setup.superseded_at is null
    and setup.status not in ('canceled', 'superseded')
  for update;

  if found and (
    v_setup.stripe_environment <> p_stripe_environment
    or v_setup.stripe_setup_intent_id <> p_stripe_setup_intent_id
    or v_setup.stripe_customer_id <> p_stripe_customer_id
  ) then
    raise exception 'SESSION_PAYMENT_SETUP_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  if found then
    update public.session_payment_setups
    set stripe_payment_method_id = coalesce(
          nullif(trim(p_stripe_payment_method_id), ''),
          stripe_payment_method_id
        ),
        status = p_status,
        failure_code = p_failure_code,
        updated_at = now()
    where id = v_setup.id
    returning * into v_setup;
  else
    insert into public.session_payment_setups (
      booking_id,
      booking_version,
      session_payment_id,
      stripe_environment,
      stripe_customer_id,
      stripe_setup_intent_id,
      stripe_payment_method_id,
      status,
      consent_version,
      consented_at,
      failure_code
    )
    values (
      v_payment.booking_id,
      p_booking_version,
      v_payment.id,
      p_stripe_environment,
      trim(p_stripe_customer_id),
      trim(p_stripe_setup_intent_id),
      nullif(trim(p_stripe_payment_method_id), ''),
      p_status,
      trim(p_consent_version),
      p_consented_at,
      p_failure_code
    )
    returning * into v_setup;
  end if;

  return jsonb_build_object(
    'setupId', v_setup.id,
    'bookingId', v_setup.booking_id,
    'bookingVersion', v_setup.booking_version,
    'status', v_setup.status
  );
end;
$$;

create or replace function public.schedule_session_payment_v10(
  p_session_payment_id uuid,
  p_session_payment_setup_id uuid,
  p_due_at timestamptz,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_setup public.session_payment_setups%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
begin
  if p_session_payment_id is null
    or p_session_payment_setup_id is null
    or p_due_at is null
    or nullif(trim(p_idempotency_key), '') is null
    or nullif(trim(p_request_fingerprint), '') is null
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status not in ('pending', 'processing')
    or v_payment.payment_due_at is distinct from p_due_at
  then
    raise exception 'SESSION_PAYMENT_V10_NOT_SCHEDULABLE'
      using errcode = '23514';
  end if;

  select setup.*
  into v_setup
  from public.session_payment_setups as setup
  where setup.id = p_session_payment_setup_id
    and setup.session_payment_id = v_payment.id
    and setup.booking_id = v_payment.booking_id
    and setup.status = 'succeeded'
    and setup.superseded_at is null;

  if not found then
    raise exception 'SESSION_PAYMENT_SETUP_V10_NOT_READY'
      using errcode = '23514';
  end if;

  select schedule.*
  into v_schedule
  from public.session_payment_schedules as schedule
  where schedule.stripe_environment = v_setup.stripe_environment
    and schedule.idempotency_key = trim(p_idempotency_key)
  for update;

  if found and (
    v_schedule.session_payment_id <> v_payment.id
    or v_schedule.session_payment_setup_id <> v_setup.id
    or v_schedule.request_fingerprint <> trim(p_request_fingerprint)
  ) then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  if not found then
    insert into public.session_payment_schedules (
      booking_id,
      booking_version,
      session_payment_id,
      session_payment_setup_id,
      stripe_environment,
      due_at,
      idempotency_key,
      request_fingerprint
    )
    values (
      v_payment.booking_id,
      v_setup.booking_version,
      v_payment.id,
      v_setup.id,
      v_setup.stripe_environment,
      p_due_at,
      trim(p_idempotency_key),
      trim(p_request_fingerprint)
    )
    returning * into v_schedule;
  end if;

  return jsonb_build_object(
    'scheduleId', v_schedule.id,
    'bookingId', v_schedule.booking_id,
    'dueAt', v_schedule.due_at,
    'status', v_schedule.status
  );
end;
$$;

create or replace function public.claim_due_session_payment_schedules_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
begin
  if p_now is null
    or p_worker_id is null
    or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_CLAIM_V10_INVALID'
      using errcode = '22023';
  end if;

  with candidates as (
    select schedule.id
    from public.session_payment_schedules as schedule
    join public.session_payments as payment
      on payment.id = schedule.session_payment_id
     and payment.payment_flow_version = 'v10'
     and payment.financial_status in ('pending', 'processing')
    where schedule.status in ('scheduled', 'retry_scheduled', 'claimed', 'processing')
      and coalesce(schedule.next_retry_at, schedule.due_at) <= p_now
      and (schedule.lease_expires_at is null or schedule.lease_expires_at <= p_now)
    order by coalesce(schedule.next_retry_at, schedule.due_at), schedule.id
    limit p_limit
    for update of schedule skip locked
  ), claimed as (
    update public.session_payment_schedules as schedule
    set status = 'claimed',
        attempt_count = schedule.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        claimed_at = p_now,
        updated_at = p_now
    from candidates
    where schedule.id = candidates.id
    returning schedule.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'scheduleId', claimed.id,
        'sessionPaymentId', claimed.session_payment_id,
        'setupId', claimed.session_payment_setup_id,
        'stripeEnvironment', claimed.stripe_environment,
        'idempotencyKey', claimed.idempotency_key,
        'requestFingerprint', claimed.request_fingerprint,
        'attemptCount', claimed.attempt_count,
        'leaseExpiresAt', claimed.lease_expires_at
      )
      order by claimed.due_at, claimed.id
    ),
    '[]'::jsonb
  )
  into v_claims
  from claimed;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

create or replace function public.confirm_session_payment_and_enqueue_transfer_v10(
  p_session_payment_id uuid,
  p_stripe_environment text,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text,
  p_paid_at timestamptz,
  p_stripe_event_id text default null,
  p_stripe_event_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_job public.session_transfer_jobs%rowtype;
  v_idempotency_key text;
  v_fingerprint text;
begin
  if p_session_payment_id is null
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_stripe_payment_intent_id), '') is null
    or nullif(trim(p_stripe_charge_id), '') is null
    or p_paid_at is null
  then
    raise exception 'SESSION_PAYMENT_CONFIRMATION_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PAYMENT_V10_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_payment.financial_status = 'paid' and (
    v_payment.stripe_payment_intent_id is distinct from trim(p_stripe_payment_intent_id)
    or v_payment.stripe_charge_id is distinct from trim(p_stripe_charge_id)
  ) then
    raise exception 'SESSION_PAYMENT_CONFIRMATION_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  if v_payment.financial_status not in ('pending', 'processing', 'paid') then
    raise exception 'SESSION_PAYMENT_V10_NOT_CONFIRMABLE'
      using errcode = '23514';
  end if;

  update public.session_payments
  set financial_status = 'paid',
      transfer_status = case
        when therapist_amount_cents > 0
          then 'transfer_pending'::public.session_transfer_status
        else 'not_eligible'::public.session_transfer_status
      end,
      stripe_payment_intent_id = trim(p_stripe_payment_intent_id),
      stripe_charge_id = trim(p_stripe_charge_id),
      paid_at = coalesce(paid_at, p_paid_at),
      stripe_event_id = coalesce(p_stripe_event_id, stripe_event_id),
      stripe_event_created_at = coalesce(p_stripe_event_created_at, stripe_event_created_at),
      updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  update public.session_payment_schedules
  set status = 'paid',
      stripe_payment_intent_id = trim(p_stripe_payment_intent_id),
      stripe_charge_id = trim(p_stripe_charge_id),
      succeeded_at = coalesce(succeeded_at, p_paid_at),
      lease_owner = null,
      lease_expires_at = null,
      next_retry_at = null,
      last_error_code = null,
      updated_at = now()
  where session_payment_id = v_payment.id
    and status <> 'paid';

  if v_payment.therapist_amount_cents = 0 then
    return jsonb_build_object(
      'sessionPaymentId', v_payment.id,
      'financialStatus', v_payment.financial_status,
      'transferJobId', null,
      'transferStatus', v_payment.transfer_status
    );
  end if;

  v_idempotency_key := 'tes:v10:session-transfer:' || v_payment.id::text;
  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        ':',
        p_stripe_environment,
        v_payment.id::text,
        trim(p_stripe_charge_id),
        v_payment.connect_account_id_snapshot::text,
        v_payment.therapist_amount_cents::text,
        v_payment.currency::text
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.session_transfer_jobs (
    session_payment_id,
    booking_id,
    policy_version_id,
    connect_account_id,
    stripe_environment,
    stripe_source_charge_id,
    therapist_gross_amount_cents,
    debt_offset_amount_cents,
    transfer_amount_cents,
    idempotency_key,
    request_fingerprint
  )
  values (
    v_payment.id,
    v_payment.booking_id,
    v_payment.policy_version_id,
    v_payment.connect_account_id_snapshot,
    p_stripe_environment,
    trim(p_stripe_charge_id),
    v_payment.therapist_amount_cents,
    0,
    v_payment.therapist_amount_cents,
    v_idempotency_key,
    v_fingerprint
  )
  on conflict (session_payment_id) do update
  set updated_at = public.session_transfer_jobs.updated_at
  returning * into v_job;

  if v_job.stripe_source_charge_id <> trim(p_stripe_charge_id)
    or v_job.connect_account_id <> v_payment.connect_account_id_snapshot
    or v_job.transfer_amount_cents <> v_payment.therapist_amount_cents
    or v_job.request_fingerprint <> v_fingerprint
  then
    raise exception 'SESSION_TRANSFER_JOB_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id,
    'financialStatus', v_payment.financial_status,
    'transferJobId', v_job.id,
    'transferStatus', v_payment.transfer_status
  );
end;
$$;

create or replace function public.claim_session_transfer_jobs_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
begin
  if p_now is null
    or p_worker_id is null
    or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30
  then
    raise exception 'SESSION_TRANSFER_JOB_CLAIM_V10_INVALID'
      using errcode = '22023';
  end if;

  with candidates as (
    select job.id
    from public.session_transfer_jobs as job
    join public.session_payments as payment
      on payment.id = job.session_payment_id
     and payment.payment_flow_version = 'v10'
     and payment.financial_status in ('paid', 'partially_refunded')
    where job.status in ('queued', 'creating', 'reconciliation_required')
      and coalesce(job.next_retry_at, job.created_at) <= p_now
      and (job.lease_expires_at is null or job.lease_expires_at <= p_now)
    order by coalesce(job.next_retry_at, job.created_at), job.id
    limit p_limit
    for update of job skip locked
  ), claimed as (
    update public.session_transfer_jobs as job
    set status = 'creating',
        attempt_count = job.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        updated_at = p_now
    from candidates
    where job.id = candidates.id
    returning job.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jobId', claimed.id,
        'sessionPaymentId', claimed.session_payment_id,
        'connectAccountId', claimed.connect_account_id,
        'stripeEnvironment', claimed.stripe_environment,
        'sourceChargeId', claimed.stripe_source_charge_id,
        'transferAmountCents', claimed.transfer_amount_cents,
        'idempotencyKey', claimed.idempotency_key,
        'requestFingerprint', claimed.request_fingerprint,
        'attemptCount', claimed.attempt_count,
        'leaseExpiresAt', claimed.lease_expires_at
      )
      order by claimed.created_at, claimed.id
    ),
    '[]'::jsonb
  )
  into v_claims
  from claimed;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

revoke all on function public.register_session_payment_setup_v10(
  uuid, bigint, text, text, text, text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.register_session_payment_setup_v10(
  uuid, bigint, text, text, text, text, text, text, timestamptz, text
) to service_role;

revoke all on function public.schedule_session_payment_v10(
  uuid, uuid, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.schedule_session_payment_v10(
  uuid, uuid, timestamptz, text, text
) to service_role;

revoke all on function public.claim_due_session_payment_schedules_v10(
  timestamptz, uuid, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_due_session_payment_schedules_v10(
  timestamptz, uuid, integer, integer
) to service_role;

revoke all on function public.confirm_session_payment_and_enqueue_transfer_v10(
  uuid, text, text, text, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.confirm_session_payment_and_enqueue_transfer_v10(
  uuid, text, text, text, timestamptz, text, timestamptz
) to service_role;

revoke all on function public.claim_session_transfer_jobs_v10(
  timestamptz, uuid, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_session_transfer_jobs_v10(
  timestamptz, uuid, integer, integer
) to service_role;

create or replace view public.private_session_financial_flow_v10_v1
with (security_invoker = true)
as
select
  payment.id as session_payment_id,
  payment.booking_id,
  payment.financial_status,
  payment.transfer_status,
  payment.payment_due_at,
  setup.id as setup_id,
  setup.status as setup_status,
  schedule.id as schedule_id,
  schedule.status as schedule_status,
  schedule.due_at,
  transfer_job.id as transfer_job_id,
  transfer_job.status as transfer_job_status,
  transfer_job.transfer_amount_cents,
  transfer_job.debt_offset_amount_cents,
  payment.created_at,
  payment.updated_at
from public.session_payments as payment
left join public.session_payment_setups as setup
  on setup.session_payment_id = payment.id
 and setup.superseded_at is null
left join public.session_payment_schedules as schedule
  on schedule.session_payment_id = payment.id
 and schedule.status <> 'superseded'
left join public.session_transfer_jobs as transfer_job
  on transfer_job.session_payment_id = payment.id
where payment.payment_flow_version = 'v10';

create or replace view public.private_weekly_payout_session_payments_v1
with (security_invoker = true)
as
select payment.*
from public.session_payments as payment
where payment.payment_flow_version = 'v9';

create or replace view public.private_direct_transfer_session_payments_v1
with (security_invoker = true)
as
select payment.*
from public.session_payments as payment
where payment.payment_flow_version = 'v10';

revoke all on table
  public.private_session_financial_flow_v10_v1,
  public.private_weekly_payout_session_payments_v1,
  public.private_direct_transfer_session_payments_v1
from public, anon, authenticated;

grant select on table
  public.private_session_financial_flow_v10_v1,
  public.private_weekly_payout_session_payments_v1,
  public.private_direct_transfer_session_payments_v1
to service_role;

comment on function public.confirm_session_payment_and_enqueue_transfer_v10(
  uuid, text, text, text, timestamptz, text, timestamptz
) is 'Atomically records a confirmed V10 card payment and creates its direct Transfer outbox job. Session attendance is not a financial gate.';
comment on view public.private_weekly_payout_session_payments_v1 is
  'V9-only compatibility surface for weekly payout selectors.';
comment on view public.private_direct_transfer_session_payments_v1 is
  'V10-only compatibility surface for direct per-session Transfer orchestration.';

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
      reference_period_start,
      reference_period_end,
      cutoff_at,
      status,
      created_by
    )
    values (
      p_reference_period_start,
      p_reference_period_end,
      p_cutoff_at,
      'open',
      p_created_by
    )
    returning id into v_batch_id;
  end if;

  insert into public.payout_batch_therapists (
    payout_batch_id,
    therapist_profile_id,
    connect_account_id,
    item_count,
    total_amount_cents
  )
  select
    v_batch_id,
    payment.therapist_profile_id,
    account.id,
    count(*)::integer,
    sum(payment.therapist_amount_cents)::integer
  from public.private_weekly_payout_session_payments_v1 as payment
  join public.therapist_connect_accounts as account
    on account.therapist_profile_id = payment.therapist_profile_id
   and account.is_current
   and account.operational_status = 'ready'
   and account.stripe_transfers_status = 'active'
   and account.payouts_enabled
   and account.payout_status = 'enabled'
   and account.payout_schedule_interval = 'daily'
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1
      from public.payout_batch_items as existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    )
  group by payment.therapist_profile_id, account.id
  on conflict (payout_batch_id, therapist_profile_id, connect_account_id) do nothing;

  insert into public.payout_batch_items (
    payout_batch_id,
    payout_batch_therapist_id,
    session_payment_id,
    booking_id,
    therapist_profile_id,
    amount_cents
  )
  select
    v_batch_id,
    therapist_group.id,
    payment.id,
    payment.booking_id,
    payment.therapist_profile_id,
    payment.therapist_amount_cents
  from public.private_weekly_payout_session_payments_v1 as payment
  join public.payout_batch_therapists as therapist_group
    on therapist_group.payout_batch_id = v_batch_id
   and therapist_group.therapist_profile_id = payment.therapist_profile_id
  join public.therapist_connect_accounts as account
    on account.id = therapist_group.connect_account_id
   and account.is_current
   and account.operational_status = 'ready'
   and account.stripe_transfers_status = 'active'
   and account.payouts_enabled
   and account.payout_status = 'enabled'
   and account.payout_schedule_interval = 'daily'
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1
      from public.payout_batch_items as existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    );

  update public.session_payments as payment
  set transfer_status = 'batched',
      updated_at = now()
  where payment.payment_flow_version = 'v9'
    and exists (
      select 1
      from public.payout_batch_items as item
      where item.payout_batch_id = v_batch_id
        and item.session_payment_id = payment.id
        and item.status = 'reserved'
    )
    and payment.transfer_status = 'eligible';

  update public.payout_batch_therapists as therapist_group
  set item_count = stats.item_count,
      total_amount_cents = stats.total_amount_cents,
      updated_at = now()
  from (
    select
      item.payout_batch_therapist_id,
      count(*)::integer as item_count,
      sum(item.amount_cents)::integer as total_amount_cents
    from public.payout_batch_items as item
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
    group by item.payout_batch_therapist_id
  ) as stats
  where therapist_group.id = stats.payout_batch_therapist_id;

  delete from public.payout_batch_therapists as therapist_group
  where therapist_group.payout_batch_id = v_batch_id
    and not exists (
      select 1
      from public.payout_batch_items as item
      where item.payout_batch_therapist_id = therapist_group.id
        and item.status <> 'removed'
    );

  update public.payout_batches as batch
  set item_count = stats.item_count,
      therapist_count = stats.therapist_count,
      gross_amount_cents = stats.gross_amount_cents,
      therapist_amount_cents = stats.therapist_amount_cents,
      platform_gross_commission_cents = stats.platform_amount_cents,
      status = case
        when stats.item_count = 0 then 'completed'::public.payout_batch_status
        else 'open'::public.payout_batch_status
      end,
      processed_at = case when stats.item_count = 0 then now() else null end,
      updated_at = now()
  from (
    select
      count(item.id)::integer as item_count,
      count(distinct item.therapist_profile_id)::integer as therapist_count,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer as platform_amount_cents
    from public.payout_batch_items as item
    join public.session_payments as payment
      on payment.id = item.session_payment_id
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
  ) as stats
  where batch.id = v_batch_id;

  return v_batch_id;
end;
$$;

create or replace function public.create_weekly_payout_batch_v2(
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
  v_payment_id uuid;
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

  for v_payment_id in
    select payment.id
    from public.private_weekly_payout_session_payments_v1 as payment
    where payment.financial_status in ('paid', 'partially_refunded')
      and payment.transfer_status in (
        'waiting_confirmation',
        'waiting_safety_period',
        'waiting_settlement',
        'eligible'
      )
      and not exists (
        select 1
        from public.payout_batch_items as item
        where item.session_payment_id = payment.id
          and item.status in ('reserved', 'transfer_pending', 'transferred')
      )
    order by payment.id
    for update
  loop
    perform public.refresh_session_transfer_eligibility(v_payment_id, p_cutoff_at);
  end loop;

  if not exists (
    select 1
    from public.private_weekly_payout_session_payments_v1 as payment
    join public.therapist_connect_accounts as account
      on account.therapist_profile_id = payment.therapist_profile_id
     and account.is_current
     and account.operational_status = 'ready'
     and account.stripe_transfers_status = 'active'
     and account.payouts_enabled
     and account.payout_status = 'enabled'
     and account.payout_schedule_interval = 'daily'
    where payment.transfer_status = 'eligible'
      and payment.eligible_at <= p_cutoff_at
      and payment.stripe_balance_status = 'available'
      and payment.stripe_balance_available_on <= p_cutoff_at
      and payment.stripe_balance_checked_at >= p_cutoff_at - interval '2 hours'
      and payment.therapist_amount_cents > 0
      and payment.stripe_charge_id is not null
      and payment.stripe_balance_transaction_id is not null
      and not exists (
        select 1
        from public.payout_batch_items as item
        where item.session_payment_id = payment.id
          and item.status in ('reserved', 'transfer_pending', 'transferred')
      )
  ) then
    return null;
  end if;

  return public.create_weekly_payout_batch(
    p_reference_period_start,
    p_reference_period_end,
    p_cutoff_at,
    p_created_by
  );
end;
$$;

revoke all on function public.create_weekly_payout_batch(
  date, date, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.create_weekly_payout_batch(
  date, date, timestamptz, uuid
) to service_role;

revoke all on function public.create_weekly_payout_batch_v2(
  date, date, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.create_weekly_payout_batch_v2(
  date, date, timestamptz, uuid
) to service_role;

comment on function public.create_weekly_payout_batch(
  date, date, timestamptz, uuid
) is 'Legacy V9 weekly payout batch constructor. V10 direct Transfer payments are excluded by view and trigger.';
