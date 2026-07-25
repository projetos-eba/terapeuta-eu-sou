create extension if not exists pgcrypto;

do $$
begin
  create type public.billing_interval as enum ('month', 'year');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.billing_subscription_status as enum (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.session_financial_status as enum (
    'pending',
    'processing',
    'paid',
    'failed',
    'canceled',
    'partially_refunded',
    'refunded',
    'disputed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.session_service_status as enum (
    'scheduled',
    'occurred_pending_confirmation',
    'confirmed_by_patient_review',
    'confirmed_by_therapist',
    'auto_confirmed',
    'contested',
    'canceled',
    'not_performed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.session_transfer_status as enum (
    'not_eligible',
    'waiting_confirmation',
    'waiting_safety_period',
    'eligible',
    'batched',
    'transfer_pending',
    'transferred',
    'blocked',
    'reversed',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.session_confirmation_source as enum (
    'patient_review',
    'therapist_manual',
    'automatic',
    'admin'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.connect_onboarding_status as enum (
    'not_started',
    'account_created',
    'onboarding_started',
    'requirements_due',
    'ready',
    'restricted',
    'disabled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payout_batch_status as enum (
    'draft',
    'open',
    'processing',
    'partially_failed',
    'completed',
    'canceled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payout_batch_item_status as enum (
    'reserved',
    'transfer_pending',
    'transferred',
    'failed',
    'blocked',
    'removed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.financial_ledger_entry_type as enum (
    'session_gross_payment',
    'therapist_payable',
    'platform_gross_commission',
    'stripe_fee',
    'refund',
    'adjustment',
    'transfer',
    'transfer_reversal',
    'dispute',
    'loss',
    'recovery',
    'subscription_revenue'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.financial_ledger_direction as enum ('debit', 'credit');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.stripe_webhook_processing_status as enum (
    'received',
    'processing',
    'processed',
    'failed',
    'ignored'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.financial_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  is_active boolean not null default false,
  currency char(3) not null default 'BRL',
  platform_commission_bps integer not null default 2000,
  auto_confirmation_days integer not null default 30,
  transfer_safety_period_days integer not null default 7,
  free_cancellation_hours integer not null default 24,
  late_cancellation_retention_bps integer not null default 5000,
  no_show_retention_bps integer not null default 5000,
  refund_processing_business_days integer not null default 1,
  manual_review_response_days integer not null default 5,
  weekly_batch_weekday integer not null default 2,
  weekly_batch_time time not null default time '10:00',
  timezone text not null default 'America/Sao_Paulo',
  payout_batch_rule text not null default 'weekly_manual_cutoff',
  cancellation_policy_key text not null default 'free_until_24h_late_50_percent_no_show_50_percent',
  refund_policy_key text not null default 'instant_automatic_or_manual_review_before_transfer',
  proration_policy_key text not null default 'upgrade_immediate_prorated_downgrade_period_end',
  upgrade_proration_behavior text not null default 'always_invoice',
  downgrade_behavior text not null default 'period_end_no_credit',
  subscription_cancellation_behavior text not null default 'cancel_at_period_end',
  metadata jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  constraint financial_policy_commission_bps_range check (
    platform_commission_bps between 0 and 10000
  ),
  constraint financial_policy_auto_confirmation_positive check (
    auto_confirmation_days > 0
  ),
  constraint financial_policy_transfer_safety_positive check (
    transfer_safety_period_days >= 0
  ),
  constraint financial_policy_cancellation_window_positive check (
    free_cancellation_hours >= 0
  ),
  constraint financial_policy_retention_bps_range check (
    late_cancellation_retention_bps between 0 and 10000
    and no_show_retention_bps between 0 and 10000
  ),
  constraint financial_policy_review_positive check (
    refund_processing_business_days > 0
    and manual_review_response_days > 0
  ),
  constraint financial_policy_weekday_range check (
    weekly_batch_weekday between 0 and 6
  ),
  constraint financial_policy_currency_brl check (currency = 'BRL')
);

create unique index if not exists financial_policy_versions_one_active_idx
on public.financial_policy_versions (is_active)
where is_active;

insert into public.financial_policy_versions (
  version,
  is_active,
  platform_commission_bps,
  auto_confirmation_days,
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
  metadata
) values (
  'tes-payments-v1',
  true,
  2000,
  30,
  7,
  24,
  5000,
  5000,
  1,
  5,
  2,
  time '10:00',
  'America/Sao_Paulo',
  'weekly_tuesday_10_brt_manual_cutoff',
  'free_until_24h_late_50_percent_no_show_50_percent',
  'instant_automatic_or_manual_review_before_transfer',
  'upgrade_immediate_prorated_downgrade_period_end',
  'always_invoice',
  'period_end_no_credit',
  'cancel_at_period_end',
  jsonb_build_object(
    'rounding', 'therapist_amount_floor_platform_receives_remainder',
    'stripeFees', 'absorbed_by_tes',
    'freeCancellationHours', 24,
    'lateCancellationRetention', '50% retained for therapist payable until manual override',
    'noShowRetention', '50% retained for therapist payable until manual override',
    'manualReview', 'Refunds after transfer eligibility or disputes require manual review.',
    'subscriptionPolicy', 'Upgrades invoice prorated difference immediately; downgrades and cancellations apply at period end.',
    'commercialPending', jsonb_build_array('tax_treatment', 'invoice_issuance')
  )
) on conflict (version) do update
set is_active = excluded.is_active,
    platform_commission_bps = excluded.platform_commission_bps,
    auto_confirmation_days = excluded.auto_confirmation_days,
    transfer_safety_period_days = excluded.transfer_safety_period_days,
    free_cancellation_hours = excluded.free_cancellation_hours,
    late_cancellation_retention_bps = excluded.late_cancellation_retention_bps,
    no_show_retention_bps = excluded.no_show_retention_bps,
    refund_processing_business_days = excluded.refund_processing_business_days,
    manual_review_response_days = excluded.manual_review_response_days,
    weekly_batch_weekday = excluded.weekly_batch_weekday,
    weekly_batch_time = excluded.weekly_batch_time,
    timezone = excluded.timezone,
    payout_batch_rule = excluded.payout_batch_rule,
    cancellation_policy_key = excluded.cancellation_policy_key,
    refund_policy_key = excluded.refund_policy_key,
    proration_policy_key = excluded.proration_policy_key,
    upgrade_proration_behavior = excluded.upgrade_proration_behavior,
    downgrade_behavior = excluded.downgrade_behavior,
    subscription_cancellation_behavior = excluded.subscription_cancellation_behavior,
    metadata = excluded.metadata;

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code public.therapist_plan not null unique,
  name text not null,
  description text,
  is_paid boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans (id) on delete cascade,
  currency char(3) not null default 'BRL',
  unit_amount_cents integer not null,
  interval public.billing_interval,
  stripe_product_id text unique,
  stripe_price_id text unique,
  stripe_lookup_key text unique,
  stripe_livemode boolean not null default false,
  environment text not null default 'test',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plan_prices_amount_non_negative check (unit_amount_cents >= 0),
  constraint billing_plan_prices_currency_brl check (currency = 'BRL'),
  constraint billing_plan_prices_paid_interval check (
    unit_amount_cents = 0 or interval is not null
  )
);

create unique index if not exists billing_plan_prices_one_active_recurring_idx
on public.billing_plan_prices (plan_id, currency, interval)
where is_active and interval is not null;

create unique index if not exists billing_plan_prices_one_active_free_idx
on public.billing_plan_prices (plan_id, currency)
where is_active and interval is null;

insert into public.billing_plans (code, name, description, is_paid)
values
  ('free', 'Free', 'Operacao essencial para comecar.', false),
  ('premium', 'Premium', 'Assinatura mensal Premium.', true),
  ('premium_plus', 'Premium Plus', 'Assinatura mensal Premium Plus.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_paid = excluded.is_paid,
    updated_at = now();

insert into public.billing_plan_prices (
  plan_id,
  unit_amount_cents,
  interval,
  stripe_lookup_key,
  metadata
)
select id, 0, null, 'tes_free_brl_0', '{"source":"migration_seed"}'::jsonb
from public.billing_plans where code = 'free'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    updated_at = now();

insert into public.billing_plan_prices (
  plan_id,
  unit_amount_cents,
  interval,
  stripe_lookup_key,
  metadata
)
select id, 6000, 'month', 'tes_premium_brl_monthly_v1', '{"source":"migration_seed"}'::jsonb
from public.billing_plans where code = 'premium'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    interval = excluded.interval,
    updated_at = now();

insert into public.billing_plan_prices (
  plan_id,
  unit_amount_cents,
  interval,
  stripe_lookup_key,
  metadata
)
select id, 12000, 'month', 'tes_premium_plus_brl_monthly_v1', '{"source":"migration_seed"}'::jsonb
from public.billing_plans where code = 'premium_plus'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    interval = excluded.interval,
    updated_at = now();

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles (id) on delete cascade,
  therapist_profile_id uuid references public.therapist_profiles (id) on delete cascade,
  role public.user_role not null,
  environment text not null default 'test',
  stripe_customer_id text not null,
  email text,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_customers_one_profile_role check (
    (role = 'patient' and patient_profile_id is not null and therapist_profile_id is null)
    or (role = 'therapist' and therapist_profile_id is not null and patient_profile_id is null)
    or (role = 'admin' and patient_profile_id is null and therapist_profile_id is null)
  )
);

create unique index if not exists stripe_customers_profile_role_env_idx
on public.stripe_customers (profile_id, role, environment);

create unique index if not exists stripe_customers_stripe_id_idx
on public.stripe_customers (stripe_customer_id, environment);

create table if not exists public.therapist_subscriptions (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  stripe_customer_id uuid references public.stripe_customers (id) on delete set null,
  billing_plan_id uuid references public.billing_plans (id) on delete restrict,
  billing_plan_price_id uuid references public.billing_plan_prices (id) on delete restrict,
  plan_code public.therapist_plan not null,
  status public.billing_subscription_status not null,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  stripe_latest_invoice_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  stripe_event_created_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_subscriptions_paid_plan check (plan_code <> 'free')
);

create unique index if not exists therapist_subscriptions_one_active_paid_idx
on public.therapist_subscriptions (therapist_profile_id)
where status in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete');

create index if not exists therapist_subscriptions_therapist_idx
on public.therapist_subscriptions (therapist_profile_id, status);

create table if not exists public.therapist_subscription_events (
  id uuid primary key default gen_random_uuid(),
  therapist_subscription_id uuid references public.therapist_subscriptions (id) on delete set null,
  therapist_profile_id uuid references public.therapist_profiles (id) on delete set null,
  stripe_event_id text,
  event_type text not null,
  previous_plan public.therapist_plan,
  next_plan public.therapist_plan,
  previous_status text,
  next_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  therapist_subscription_id uuid references public.therapist_subscriptions (id) on delete set null,
  therapist_profile_id uuid references public.therapist_profiles (id) on delete set null,
  stripe_invoice_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null,
  currency char(3) not null default 'BRL',
  amount_due_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  hosted_invoice_url text,
  invoice_pdf text,
  paid_at timestamptz,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_amounts_non_negative check (
    amount_due_cents >= 0 and amount_paid_cents >= 0
  ),
  constraint billing_invoices_currency_brl check (currency = 'BRL')
);

create table if not exists public.therapist_connect_accounts (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null unique references public.therapist_profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  account_api_version text not null default 'v2',
  dashboard_type text not null default 'express',
  fees_collector text not null default 'application',
  losses_collector text not null default 'application',
  onboarding_status public.connect_onboarding_status not null default 'account_created',
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  stripe_transfers_status text not null default 'inactive',
  pending_requirements jsonb not null default '[]'::jsonb,
  disabled_reason text,
  last_synced_at timestamptz,
  operational_status text not null default 'restricted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_connect_accounts_dashboard check (dashboard_type in ('express', 'full', 'none')),
  constraint therapist_connect_accounts_fees check (fees_collector in ('application', 'stripe')),
  constraint therapist_connect_accounts_losses check (losses_collector in ('application', 'stripe'))
);

create index if not exists therapist_connect_accounts_status_idx
on public.therapist_connect_accounts (onboarding_status, stripe_transfers_status);

create table if not exists public.therapist_connect_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  connect_account_id uuid not null references public.therapist_connect_accounts (id) on delete cascade,
  stripe_event_id text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.session_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  service_id uuid not null references public.therapist_services (id) on delete restrict,
  policy_version_id uuid not null references public.financial_policy_versions (id) on delete restrict,
  stripe_customer_id uuid references public.stripe_customers (id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  stripe_balance_transaction_id text unique,
  gross_amount_cents integer not null,
  platform_commission_bps integer not null,
  platform_gross_commission_cents integer not null,
  therapist_amount_cents integer not null,
  stripe_fee_amount_cents integer,
  stripe_net_amount_cents integer,
  currency char(3) not null default 'BRL',
  financial_status public.session_financial_status not null default 'pending',
  service_status public.session_service_status not null default 'scheduled',
  transfer_status public.session_transfer_status not null default 'not_eligible',
  service_confirmed_at timestamptz,
  service_confirmation_source public.session_confirmation_source,
  eligible_at timestamptz,
  transfer_blocked_reason text,
  refund_pending boolean not null default false,
  disputed_at timestamptz,
  internal_contested_at timestamptz,
  admin_blocked_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_payments_amounts_non_negative check (
    gross_amount_cents >= 0
    and platform_commission_bps between 0 and 10000
    and platform_gross_commission_cents >= 0
    and therapist_amount_cents >= 0
  ),
  constraint session_payments_amounts_reconcile check (
    gross_amount_cents = platform_gross_commission_cents + therapist_amount_cents
  ),
  constraint session_payments_currency_brl check (currency = 'BRL')
);

create index if not exists session_payments_financial_status_idx
on public.session_payments (financial_status);

create index if not exists session_payments_transfer_status_idx
on public.session_payments (transfer_status, eligible_at);

create index if not exists session_payments_auto_confirm_idx
on public.session_payments (service_status, financial_status, service_confirmed_at);

create index if not exists session_payments_disputes_idx
on public.session_payments (disputed_at)
where disputed_at is not null;

create table if not exists public.session_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  session_payment_id uuid not null references public.session_payments (id) on delete cascade,
  idempotency_key text not null unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'created',
  request_metadata jsonb not null default '{}'::jsonb,
  response_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_refunds (
  id uuid primary key default gen_random_uuid(),
  session_payment_id uuid not null references public.session_payments (id) on delete restrict,
  stripe_refund_id text unique,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  status text not null default 'pending',
  reason text,
  requested_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_refunds_amount_positive check (amount_cents > 0),
  constraint session_refunds_currency_brl check (currency = 'BRL')
);

create index if not exists session_refunds_status_idx
on public.session_refunds (status);

create table if not exists public.session_cancellation_decisions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  session_payment_id uuid references public.session_payments (id) on delete restrict,
  policy_version_id uuid references public.financial_policy_versions (id) on delete restrict,
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  decision text not null,
  refund_amount_cents integer not null default 0,
  retained_amount_cents integer not null default 0,
  therapist_retained_cents integer not null default 0,
  platform_retained_cents integer not null default 0,
  requires_manual_review boolean not null default false,
  review_due_at timestamptz,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_cancellation_amounts_non_negative check (
    refund_amount_cents >= 0
    and retained_amount_cents >= 0
    and therapist_retained_cents >= 0
    and platform_retained_cents >= 0
  ),
  constraint session_cancellation_amounts_reconcile check (
    retained_amount_cents = therapist_retained_cents + platform_retained_cents
  )
);

create index if not exists session_cancellation_decisions_booking_idx
on public.session_cancellation_decisions (booking_id, created_at desc);

create table if not exists public.session_disputes (
  id uuid primary key default gen_random_uuid(),
  session_payment_id uuid not null references public.session_payments (id) on delete restrict,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  status text not null,
  evidence_due_by timestamptz,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_disputes_amount_positive check (amount_cents > 0),
  constraint session_disputes_currency_brl check (currency = 'BRL')
);

create index if not exists session_disputes_open_idx
on public.session_disputes (status)
where closed_at is null;

create table if not exists public.session_service_confirmations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  session_payment_id uuid references public.session_payments (id) on delete set null,
  source public.session_confirmation_source not null,
  previous_service_status public.session_service_status,
  confirmed_by_profile_id uuid references public.profiles (id) on delete set null,
  review_id uuid references public.reviews (id) on delete set null,
  policy_version_id uuid references public.financial_policy_versions (id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_service_confirmations_one_source unique (booking_id, source)
);

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  reference_period_start date not null,
  reference_period_end date not null,
  cutoff_at timestamptz not null,
  status public.payout_batch_status not null default 'draft',
  currency char(3) not null default 'BRL',
  item_count integer not null default 0,
  therapist_count integer not null default 0,
  gross_amount_cents integer not null default 0,
  therapist_amount_cents integer not null default 0,
  platform_gross_commission_cents integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_batches_valid_period check (reference_period_start <= reference_period_end),
  constraint payout_batches_currency_brl check (currency = 'BRL')
);

create index if not exists payout_batches_status_idx
on public.payout_batches (status, cutoff_at);

create unique index if not exists payout_batches_unique_active_period_idx
on public.payout_batches (reference_period_start, reference_period_end)
where status <> 'canceled';

create table if not exists public.payout_batch_therapists (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.payout_batches (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  connect_account_id uuid references public.therapist_connect_accounts (id) on delete set null,
  item_count integer not null default 0,
  total_amount_cents integer not null default 0,
  status public.payout_batch_item_status not null default 'reserved',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_batch_therapists_unique unique (payout_batch_id, therapist_profile_id)
);

create table if not exists public.payout_batch_items (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.payout_batches (id) on delete cascade,
  payout_batch_therapist_id uuid references public.payout_batch_therapists (id) on delete set null,
  session_payment_id uuid not null references public.session_payments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  status public.payout_batch_item_status not null default 'reserved',
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_batch_items_amount_positive check (amount_cents > 0),
  constraint payout_batch_items_currency_brl check (currency = 'BRL')
);

create unique index if not exists payout_batch_items_unique_active_session_idx
on public.payout_batch_items (session_payment_id)
where status in ('reserved', 'transfer_pending', 'transferred');

create index if not exists payout_batch_items_status_idx
on public.payout_batch_items (status);

create table if not exists public.stripe_transfers (
  id uuid primary key default gen_random_uuid(),
  payout_batch_item_id uuid not null unique references public.payout_batch_items (id) on delete restrict,
  session_payment_id uuid not null references public.session_payments (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  connect_account_id uuid not null references public.therapist_connect_accounts (id) on delete restrict,
  stripe_transfer_id text unique,
  idempotency_key text not null unique,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  status text not null default 'pending',
  failure_code text,
  failure_message text,
  transferred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_transfers_amount_positive check (amount_cents > 0),
  constraint stripe_transfers_currency_brl check (currency = 'BRL')
);

create index if not exists stripe_transfers_failed_idx
on public.stripe_transfers (status)
where status = 'failed';

create table if not exists public.stripe_transfer_reversals (
  id uuid primary key default gen_random_uuid(),
  stripe_transfer_id uuid not null references public.stripe_transfers (id) on delete restrict,
  stripe_transfer_reversal_id text unique,
  amount_cents integer not null,
  currency char(3) not null default 'BRL',
  reason text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_transfer_reversals_amount_positive check (amount_cents > 0),
  constraint stripe_transfer_reversals_currency_brl check (currency = 'BRL')
);

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type public.financial_ledger_entry_type not null,
  direction public.financial_ledger_direction not null,
  currency char(3) not null default 'BRL',
  amount_cents integer not null,
  profile_id uuid references public.profiles (id) on delete set null,
  patient_profile_id uuid references public.patient_profiles (id) on delete set null,
  therapist_profile_id uuid references public.therapist_profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  session_payment_id uuid references public.session_payments (id) on delete set null,
  payout_batch_id uuid references public.payout_batches (id) on delete set null,
  stripe_transfer_id uuid references public.stripe_transfers (id) on delete set null,
  stripe_event_id text,
  source_table text,
  source_id uuid,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint financial_ledger_amount_positive check (amount_cents > 0),
  constraint financial_ledger_currency_brl check (currency = 'BRL')
);

create unique index if not exists financial_ledger_unique_source_entry_idx
on public.financial_ledger_entries (entry_type, source_table, source_id, direction)
where source_id is not null;

create index if not exists financial_ledger_session_idx
on public.financial_ledger_entries (session_payment_id, recorded_at);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  account_id text,
  livemode boolean not null default false,
  api_version text,
  source text not null default 'platform',
  processing_status public.stripe_webhook_processing_status not null default 'received',
  attempts integer not null default 0,
  payload_sha256 text,
  payload_sanitized jsonb,
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_pending_idx
on public.stripe_webhook_events (processing_status, received_at)
where processing_status in ('received', 'failed');

create or replace function public.calculate_session_payment_snapshot(
  p_gross_amount_cents integer,
  p_platform_commission_bps integer default 2000
)
returns table (
  gross_amount_cents integer,
  platform_commission_bps integer,
  platform_gross_commission_cents integer,
  therapist_amount_cents integer
)
language sql
stable
as $$
  select
    p_gross_amount_cents,
    p_platform_commission_bps,
    p_gross_amount_cents - floor(
      p_gross_amount_cents * (10000 - p_platform_commission_bps) / 10000.0
    )::integer,
    floor(
      p_gross_amount_cents * (10000 - p_platform_commission_bps) / 10000.0
    )::integer
  where p_gross_amount_cents >= 0
    and p_platform_commission_bps between 0 and 10000;
$$;

create or replace function public.refresh_session_transfer_eligibility(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns public.session_transfer_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_connect_status text;
  v_has_active_batch boolean;
  v_safety_days integer;
  v_eligible_at timestamptz;
  v_status public.session_transfer_status;
  v_reason text;
begin
  select * into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    raise exception 'session_payment_not_found';
  end if;

  select coalesce(transfer_safety_period_days, 7)
    into v_safety_days
  from public.financial_policy_versions
  where id = v_payment.policy_version_id;

  select stripe_transfers_status
    into v_connect_status
  from public.therapist_connect_accounts
  where therapist_profile_id = v_payment.therapist_profile_id;

  select exists (
    select 1
    from public.payout_batch_items
    where session_payment_id = p_session_payment_id
      and status in ('reserved', 'transfer_pending', 'transferred')
  ) into v_has_active_batch;

  if v_payment.transfer_status = 'transferred' then
    v_status := 'transferred';
    v_reason := 'already_transferred';
  elsif v_has_active_batch then
    v_status := 'batched';
    v_reason := 'already_batched';
  elsif v_payment.financial_status = 'disputed' or v_payment.disputed_at is not null then
    v_status := 'blocked';
    v_reason := 'disputed';
  elsif v_payment.admin_blocked_at is not null
    or v_payment.internal_contested_at is not null then
    v_status := 'blocked';
    v_reason := 'blocked_or_contested';
  elsif v_payment.refund_pending or v_payment.financial_status = 'refunded' then
    v_status := 'blocked';
    v_reason := 'refund';
  elsif v_payment.financial_status not in ('paid', 'partially_refunded') then
    v_status := 'not_eligible';
    v_reason := 'payment_not_confirmed';
  elsif v_payment.service_status not in (
    'confirmed_by_patient_review',
    'confirmed_by_therapist',
    'auto_confirmed'
  ) or v_payment.service_confirmed_at is null then
    v_status := 'waiting_confirmation';
    v_reason := 'service_not_confirmed';
  elsif coalesce(v_connect_status, 'inactive') <> 'active' then
    v_status := 'blocked';
    v_reason := 'connect_not_ready';
  elsif v_payment.therapist_amount_cents <= 0 then
    v_status := 'not_eligible';
    v_reason := 'non_positive_transfer_amount';
  else
    v_eligible_at := v_payment.service_confirmed_at + make_interval(days => v_safety_days);

    if p_now < v_eligible_at then
      v_status := 'waiting_safety_period';
      v_reason := 'waiting_safety_period';
    else
      v_status := 'eligible';
      v_reason := 'eligible';
    end if;
  end if;

  update public.session_payments
  set transfer_status = v_status,
      eligible_at = case
        when v_status in ('waiting_safety_period', 'eligible') then v_eligible_at
        else eligible_at
      end,
      transfer_blocked_reason = v_reason,
      updated_at = now()
  where id = p_session_payment_id;

  return v_status;
end;
$$;

create or replace function public.confirm_session_service(
  p_booking_id uuid,
  p_source public.session_confirmation_source,
  p_confirmed_by_profile_id uuid default null,
  p_review_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_policy uuid;
  v_confirmation_id uuid;
  v_new_service_status public.session_service_status;
begin
  select id into v_policy
  from public.financial_policy_versions
  where is_active
  limit 1;

  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id
  for update;

  if not found then
    raise exception 'session_payment_not_found';
  end if;

  if v_payment.financial_status not in ('paid', 'partially_refunded') then
    raise exception 'payment_not_confirmed';
  end if;

  if v_payment.financial_status in ('refunded', 'disputed')
    or v_payment.admin_blocked_at is not null
    or v_payment.internal_contested_at is not null then
    raise exception 'session_blocked';
  end if;

  v_new_service_status := case p_source
    when 'patient_review' then 'confirmed_by_patient_review'::public.session_service_status
    when 'therapist_manual' then 'confirmed_by_therapist'::public.session_service_status
    when 'automatic' then 'auto_confirmed'::public.session_service_status
    else 'confirmed_by_therapist'::public.session_service_status
  end;

  insert into public.session_service_confirmations (
    booking_id,
    session_payment_id,
    source,
    previous_service_status,
    confirmed_by_profile_id,
    review_id,
    policy_version_id,
    metadata
  ) values (
    p_booking_id,
    v_payment.id,
    p_source,
    v_payment.service_status,
    p_confirmed_by_profile_id,
    p_review_id,
    v_policy,
    p_metadata
  )
  on conflict (booking_id, source) do update
  set metadata = public.session_service_confirmations.metadata || excluded.metadata
  returning id into v_confirmation_id;

  update public.session_payments
  set service_status = v_new_service_status,
      service_confirmed_at = coalesce(service_confirmed_at, now()),
      service_confirmation_source = p_source,
      updated_at = now()
  where id = v_payment.id;

  update public.bookings
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_booking_id
    and status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded');

  perform public.refresh_session_transfer_eligibility(v_payment.id);

  return v_confirmation_id;
end;
$$;

create or replace function public.confirm_session_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rating between 1 and 5 and new.status in ('pending', 'published') then
    perform public.confirm_session_service(
      new.booking_id,
      'patient_review',
      (select user_id from public.patient_profiles where id = new.patient_profile_id),
      new.id,
      jsonb_build_object('reviewStatus', new.status)
    );
  end if;

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists confirm_session_from_review_trigger on public.reviews;
create trigger confirm_session_from_review_trigger
after insert or update of rating, status on public.reviews
for each row
execute function public.confirm_session_from_review();

create or replace function public.auto_confirm_sessions(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_days integer;
begin
  select coalesce(auto_confirmation_days, 30)
    into v_days
  from public.financial_policy_versions
  where is_active
  limit 1;

  for v_row in
    select sp.booking_id
    from public.session_payments sp
    join public.bookings b on b.id = sp.booking_id
    where sp.financial_status in ('paid', 'partially_refunded')
      and sp.service_status in ('scheduled', 'occurred_pending_confirmation')
      and sp.service_confirmed_at is null
      and b.starts_at <= p_now - make_interval(days => v_days)
      and b.status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
      and sp.refund_pending = false
      and sp.disputed_at is null
      and sp.internal_contested_at is null
      and sp.admin_blocked_at is null
  loop
    perform public.confirm_session_service(
      v_row.booking_id,
      'automatic',
      null,
      null,
      jsonb_build_object('policyVersion', 'tes-payments-v1', 'autoConfirmationDays', v_days)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.calculate_session_cancellation_policy(
  p_booking_id uuid,
  p_reason text default 'patient_cancellation',
  p_now timestamptz default now()
)
returns table (
  booking_id uuid,
  session_payment_id uuid,
  policy_version_id uuid,
  decision text,
  refund_amount_cents integer,
  retained_amount_cents integer,
  therapist_retained_cents integer,
  platform_retained_cents integer,
  requires_manual_review boolean,
  review_due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_policy public.financial_policy_versions%rowtype;
  v_retention_bps integer := 0;
  v_retained integer := 0;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select * into v_payment
  from public.session_payments
  where session_payments.booking_id = p_booking_id;

  select * into v_policy
  from public.financial_policy_versions
  where id = coalesce(v_payment.policy_version_id, (
    select id from public.financial_policy_versions where is_active limit 1
  ));

  if v_policy.id is null then
    raise exception 'financial_policy_not_found';
  end if;

  if v_payment.id is null or v_payment.financial_status not in ('paid', 'partially_refunded') then
    return query select
      v_booking.id,
      v_payment.id,
      v_policy.id,
      'unpaid_cancellation'::text,
      coalesce(v_payment.gross_amount_cents, 0),
      0,
      0,
      0,
      false,
      null::timestamptz;
    return;
  end if;

  if v_payment.transfer_status in ('batched', 'transferred')
    or v_payment.refund_pending
    or v_payment.financial_status in ('disputed', 'refunded')
    or v_payment.disputed_at is not null then
    return query select
      v_booking.id,
      v_payment.id,
      v_policy.id,
      'manual_review_required'::text,
      0,
      v_payment.gross_amount_cents,
      v_payment.therapist_amount_cents,
      v_payment.platform_gross_commission_cents,
      true,
      p_now + make_interval(days => v_policy.manual_review_response_days);
    return;
  end if;

  if p_reason = 'no_show' then
    v_retention_bps := v_policy.no_show_retention_bps;
  elsif v_booking.starts_at - p_now >= make_interval(hours => v_policy.free_cancellation_hours) then
    v_retention_bps := 0;
  else
    v_retention_bps := v_policy.late_cancellation_retention_bps;
  end if;

  v_retained := floor(v_payment.gross_amount_cents * v_retention_bps / 10000.0)::integer;

  return query select
    v_booking.id,
    v_payment.id,
    v_policy.id,
    case
      when p_reason = 'no_show' then 'no_show_retention'
      when v_retention_bps = 0 then 'free_cancellation_full_refund'
      else 'late_cancellation_partial_refund'
    end,
    greatest(v_payment.gross_amount_cents - v_retained, 0),
    v_retained,
    floor(v_retained * (10000 - v_policy.platform_commission_bps) / 10000.0)::integer,
    v_retained - floor(v_retained * (10000 - v_policy.platform_commission_bps) / 10000.0)::integer,
    false,
    null::timestamptz;
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
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  select id into v_batch_id
  from public.payout_batches
  where reference_period_start = p_reference_period_start
    and reference_period_end = p_reference_period_end
    and status <> 'canceled'
  order by created_at asc
  limit 1;

  if v_batch_id is not null then
    return v_batch_id;
  end if;

  insert into public.payout_batches (
    reference_period_start,
    reference_period_end,
    cutoff_at,
    status,
    created_by
  ) values (
    p_reference_period_start,
    p_reference_period_end,
    p_cutoff_at,
    'open',
    p_created_by
  )
  returning id into v_batch_id;

  insert into public.payout_batch_therapists (
    payout_batch_id,
    therapist_profile_id,
    connect_account_id,
    item_count,
    total_amount_cents
  )
  select
    v_batch_id,
    sp.therapist_profile_id,
    tca.id,
    count(*),
    sum(sp.therapist_amount_cents)
  from public.session_payments sp
  join public.therapist_connect_accounts tca
    on tca.therapist_profile_id = sp.therapist_profile_id
  where sp.transfer_status = 'eligible'
    and sp.eligible_at <= p_cutoff_at
    and sp.therapist_amount_cents > 0
    and not exists (
      select 1
      from public.payout_batch_items pbi
      where pbi.session_payment_id = sp.id
        and pbi.status in ('reserved', 'transfer_pending', 'transferred')
    )
  group by sp.therapist_profile_id, tca.id;

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
    pbt.id,
    sp.id,
    sp.booking_id,
    sp.therapist_profile_id,
    sp.therapist_amount_cents
  from public.session_payments sp
  join public.payout_batch_therapists pbt
    on pbt.payout_batch_id = v_batch_id
    and pbt.therapist_profile_id = sp.therapist_profile_id
  where sp.transfer_status = 'eligible'
    and sp.eligible_at <= p_cutoff_at
    and sp.therapist_amount_cents > 0
    and not exists (
      select 1
      from public.payout_batch_items pbi
      where pbi.session_payment_id = sp.id
        and pbi.status in ('reserved', 'transfer_pending', 'transferred')
    );

  update public.session_payments sp
  set transfer_status = 'batched',
      updated_at = now()
  where exists (
    select 1
    from public.payout_batch_items pbi
    where pbi.payout_batch_id = v_batch_id
      and pbi.session_payment_id = sp.id
  );

  update public.payout_batches pb
  set item_count = stats.item_count,
      therapist_count = stats.therapist_count,
      gross_amount_cents = stats.gross_amount_cents,
      therapist_amount_cents = stats.therapist_amount_cents,
      platform_gross_commission_cents = stats.platform_gross_commission_cents,
      updated_at = now()
  from (
    select
      count(pbi.id)::integer as item_count,
      count(distinct pbi.therapist_profile_id)::integer as therapist_count,
      coalesce(sum(sp.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(sp.therapist_amount_cents), 0)::integer as therapist_amount_cents,
      coalesce(sum(sp.platform_gross_commission_cents), 0)::integer as platform_gross_commission_cents
    from public.payout_batch_items pbi
    join public.session_payments sp on sp.id = pbi.session_payment_id
    where pbi.payout_batch_id = v_batch_id
  ) stats
  where pb.id = v_batch_id;

  return v_batch_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'billing_plans',
    'billing_plan_prices',
    'stripe_customers',
    'therapist_subscriptions',
    'billing_invoices',
    'therapist_connect_accounts',
    'session_payments',
    'session_payment_attempts',
    'session_refunds',
    'session_cancellation_decisions',
    'session_disputes',
    'payout_batches',
    'payout_batch_therapists',
    'payout_batch_items',
    'stripe_transfers',
    'stripe_transfer_reversals',
    'stripe_webhook_events'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.billing_plans enable row level security;
alter table public.billing_plan_prices enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.therapist_subscriptions enable row level security;
alter table public.therapist_subscription_events enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.therapist_connect_accounts enable row level security;
alter table public.therapist_connect_account_snapshots enable row level security;
alter table public.session_payments enable row level security;
alter table public.session_payment_attempts enable row level security;
alter table public.session_refunds enable row level security;
alter table public.session_cancellation_decisions enable row level security;
alter table public.session_disputes enable row level security;
alter table public.session_service_confirmations enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_batch_therapists enable row level security;
alter table public.payout_batch_items enable row level security;
alter table public.stripe_transfers enable row level security;
alter table public.stripe_transfer_reversals enable row level security;
alter table public.financial_ledger_entries enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.financial_policy_versions enable row level security;

grant select on public.billing_plans to anon, authenticated, service_role;
grant select on public.billing_plan_prices to anon, authenticated, service_role;
grant select on public.financial_policy_versions to authenticated, service_role;

grant all on public.billing_plans to service_role;
grant all on public.billing_plan_prices to service_role;
grant all on public.stripe_customers to service_role;
grant all on public.therapist_subscriptions to service_role;
grant all on public.therapist_subscription_events to service_role;
grant all on public.billing_invoices to service_role;
grant all on public.therapist_connect_accounts to service_role;
grant all on public.therapist_connect_account_snapshots to service_role;
grant all on public.session_payments to service_role;
grant all on public.session_payment_attempts to service_role;
grant all on public.session_refunds to service_role;
grant all on public.session_cancellation_decisions to service_role;
grant all on public.session_disputes to service_role;
grant all on public.session_service_confirmations to service_role;
grant all on public.payout_batches to service_role;
grant all on public.payout_batch_therapists to service_role;
grant all on public.payout_batch_items to service_role;
grant all on public.stripe_transfers to service_role;
grant all on public.stripe_transfer_reversals to service_role;
grant all on public.financial_ledger_entries to service_role;
grant all on public.stripe_webhook_events to service_role;
grant all on public.financial_policy_versions to service_role;

drop policy if exists "Anyone can read active billing catalog" on public.billing_plans;
create policy "Anyone can read active billing catalog"
on public.billing_plans
for select
using (is_active);

drop policy if exists "Anyone can read active billing prices" on public.billing_plan_prices;
create policy "Anyone can read active billing prices"
on public.billing_plan_prices
for select
using (is_active);

drop policy if exists "Therapists can read own subscriptions" on public.therapist_subscriptions;
create policy "Therapists can read own subscriptions"
on public.therapist_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = therapist_subscriptions.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Therapists can read own connect account" on public.therapist_connect_accounts;
create policy "Therapists can read own connect account"
on public.therapist_connect_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = therapist_connect_accounts.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Patients can read own session payments" on public.session_payments;
create policy "Patients can read own session payments"
on public.session_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles pp
    where pp.id = session_payments.patient_profile_id
      and pp.user_id = (select auth.uid())
  )
);

drop policy if exists "Therapists can read own session payments" on public.session_payments;
create policy "Therapists can read own session payments"
on public.session_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = session_payments.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Therapists can read own payout batch items" on public.payout_batch_items;
create policy "Therapists can read own payout batch items"
on public.payout_batch_items
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = payout_batch_items.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Therapists can read own transfers" on public.stripe_transfers;
create policy "Therapists can read own transfers"
on public.stripe_transfers
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = stripe_transfers.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Patients can read own cancellation decisions" on public.session_cancellation_decisions;
create policy "Patients can read own cancellation decisions"
on public.session_cancellation_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles pp
    join public.session_payments sp on sp.patient_profile_id = pp.id
    where sp.id = session_cancellation_decisions.session_payment_id
      and pp.user_id = (select auth.uid())
  )
);

drop policy if exists "Therapists can read own cancellation decisions" on public.session_cancellation_decisions;
create policy "Therapists can read own cancellation decisions"
on public.session_cancellation_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    join public.session_payments sp on sp.therapist_profile_id = tp.id
    where sp.id = session_cancellation_decisions.session_payment_id
      and tp.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can read payment operations" on public.stripe_webhook_events;
create policy "Admins can read payment operations"
on public.stripe_webhook_events
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

grant execute on function public.calculate_session_payment_snapshot(integer, integer) to service_role;
grant execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz) to service_role;
grant execute on function public.confirm_session_service(uuid, public.session_confirmation_source, uuid, uuid, jsonb) to service_role;
grant execute on function public.auto_confirm_sessions(timestamptz) to service_role;
grant execute on function public.calculate_session_cancellation_policy(uuid, text, timestamptz) to service_role;
grant execute on function public.create_weekly_payout_batch(date, date, timestamptz, uuid) to service_role;

comment on table public.session_payments is
  'Fonte financeira canônica para cobranças de sessão TES. Valores são snapshots em centavos.';

comment on function public.refresh_session_transfer_eligibility(uuid, timestamptz) is
  'Recalcula status de repasse de uma sessão com pagamento e realização como estados independentes.';

comment on table public.financial_ledger_entries is
  'Ledger auditável de eventos financeiros; operações históricas são compensadas por novos lançamentos.';
