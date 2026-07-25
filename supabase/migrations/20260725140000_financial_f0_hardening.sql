alter table public.stripe_webhook_events
  add column if not exists stripe_event_created_at timestamptz,
  add column if not exists object_id text;

alter table public.session_payments
  add column if not exists stripe_event_id text,
  add column if not exists stripe_event_created_at timestamptz;

alter table public.therapist_connect_accounts
  add column if not exists stripe_event_id text,
  add column if not exists stripe_event_created_at timestamptz;

alter table public.stripe_transfers
  add column if not exists stripe_source_charge_id text;

alter table public.financial_ledger_entries
  add column if not exists source_external_id text;

create unique index if not exists therapist_subscription_events_stripe_event_idx
on public.therapist_subscription_events (stripe_event_id)
where stripe_event_id is not null;

create index if not exists stripe_webhook_events_object_idx
on public.stripe_webhook_events (event_type, object_id, received_at desc)
where object_id is not null;

create index if not exists session_payments_stripe_event_idx
on public.session_payments (stripe_event_created_at desc)
where stripe_event_created_at is not null;

drop index if exists public.financial_ledger_unique_source_entry_idx;
create unique index financial_ledger_unique_source_entry_idx
on public.financial_ledger_entries (entry_type, source_table, source_id, direction);

drop index if exists public.financial_ledger_unique_external_entry_idx;
create unique index financial_ledger_unique_external_entry_idx
on public.financial_ledger_entries (
  entry_type,
  source_table,
  source_external_id,
  direction
);

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
)
select
  'tes-legacy-import-v1',
  false,
  1500,
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
  metadata || jsonb_build_object(
    'source', 'legacy_payments_backfill',
    'note', 'Per-record amount snapshots remain authoritative.'
  )
from public.financial_policy_versions
where is_active
limit 1
on conflict (version) do update
set metadata = excluded.metadata;

insert into public.session_payments (
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  currency,
  financial_status,
  transfer_status,
  transfer_blocked_reason,
  paid_at,
  failed_at,
  metadata,
  created_at,
  updated_at
)
select
  p.booking_id,
  p.patient_profile_id,
  p.therapist_profile_id,
  b.service_id,
  fp.id,
  p.stripe_checkout_session_id,
  p.stripe_payment_intent_id,
  p.amount_cents,
  case
    when p.amount_cents > 0
      then floor(p.platform_fee_cents * 10000.0 / p.amount_cents)::integer
    else 0
  end,
  p.platform_fee_cents,
  p.therapist_amount_cents,
  p.currency,
  case p.status
    when 'not_started' then 'pending'::public.session_financial_status
    when 'pending' then 'processing'::public.session_financial_status
    when 'paid' then 'paid'::public.session_financial_status
    when 'failed' then 'failed'::public.session_financial_status
    when 'cancelled' then 'canceled'::public.session_financial_status
    when 'refunded' then 'refunded'::public.session_financial_status
    when 'partially_refunded' then 'partially_refunded'::public.session_financial_status
  end,
  case
    when p.status = 'paid' and p.stripe_payment_intent_id is not null
      then 'blocked'::public.session_transfer_status
    else 'not_eligible'::public.session_transfer_status
  end,
  case
    when p.status = 'paid' and p.stripe_payment_intent_id is not null
      then 'source_charge_reconciliation_required'
    else null
  end,
  p.paid_at,
  case when p.status = 'failed' then p.updated_at else null end,
  jsonb_build_object(
    'source', 'legacy_payments_backfill',
    'legacyPaymentId', p.id
  ),
  p.created_at,
  p.updated_at
from public.payments p
join public.bookings b on b.id = p.booking_id
join public.financial_policy_versions fp
  on fp.version = 'tes-legacy-import-v1'
where not exists (
  select 1
  from public.session_payments sp
  where sp.booking_id = p.booking_id
)
on conflict (booking_id) do nothing;

insert into public.financial_ledger_entries (
  entry_type,
  direction,
  amount_cents,
  patient_profile_id,
  therapist_profile_id,
  booking_id,
  session_payment_id,
  source_table,
  source_id,
  occurred_at,
  metadata
)
select
  entries.entry_type,
  'credit',
  entries.amount_cents,
  sp.patient_profile_id,
  sp.therapist_profile_id,
  sp.booking_id,
  sp.id,
  'session_payments',
  sp.id,
  coalesce(sp.paid_at, sp.created_at),
  '{"source":"legacy_payments_backfill"}'::jsonb
from public.session_payments sp
cross join lateral (
  values
    (
      'session_gross_payment'::public.financial_ledger_entry_type,
      sp.gross_amount_cents
    ),
    (
      'therapist_payable'::public.financial_ledger_entry_type,
      sp.therapist_amount_cents
    ),
    (
      'platform_gross_commission'::public.financial_ledger_entry_type,
      sp.platform_gross_commission_cents
    )
) as entries(entry_type, amount_cents)
where sp.financial_status in ('paid', 'partially_refunded', 'refunded', 'disputed')
  and entries.amount_cents > 0
on conflict do nothing;

create or replace function public.sync_session_payment_projections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_legacy_status public.payment_status;
begin
  v_legacy_status := case new.financial_status
    when 'pending' then 'pending'::public.payment_status
    when 'processing' then 'pending'::public.payment_status
    when 'paid' then 'paid'::public.payment_status
    when 'failed' then 'failed'::public.payment_status
    when 'canceled' then 'cancelled'::public.payment_status
    when 'partially_refunded' then 'partially_refunded'::public.payment_status
    when 'refunded' then 'refunded'::public.payment_status
    when 'disputed' then 'paid'::public.payment_status
  end;

  update public.bookings
  set payment_status = v_legacy_status,
      status = case
        when new.financial_status in ('pending', 'processing')
          and status = 'draft' then 'pending_payment'::public.booking_status
        when new.financial_status = 'paid'
          and status in ('draft', 'pending_payment') then 'confirmed'::public.booking_status
        else status
      end,
      updated_at = now()
  where id = new.booking_id
    and payment_status is distinct from v_legacy_status;

  insert into public.payments (
    booking_id,
    patient_profile_id,
    therapist_profile_id,
    provider,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    amount_cents,
    platform_fee_cents,
    therapist_amount_cents,
    currency,
    status,
    paid_at,
    refunded_at
  ) values (
    new.booking_id,
    new.patient_profile_id,
    new.therapist_profile_id,
    'stripe',
    new.stripe_checkout_session_id,
    new.stripe_payment_intent_id,
    new.gross_amount_cents,
    new.platform_gross_commission_cents,
    new.therapist_amount_cents,
    new.currency,
    v_legacy_status,
    new.paid_at,
    case
      when new.financial_status in ('refunded', 'partially_refunded') then now()
      else null
    end
  )
  on conflict (booking_id) do update
  set stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      amount_cents = excluded.amount_cents,
      platform_fee_cents = excluded.platform_fee_cents,
      therapist_amount_cents = excluded.therapist_amount_cents,
      currency = excluded.currency,
      status = excluded.status,
      paid_at = excluded.paid_at,
      refunded_at = coalesce(excluded.refunded_at, public.payments.refunded_at),
      updated_at = now();

  if new.financial_status in ('paid', 'partially_refunded', 'refunded', 'disputed') then
    insert into public.booking_payment_receipts (
      booking_id,
      amount_cents,
      currency,
      provider,
      paid_at
    ) values (
      new.booking_id,
      new.gross_amount_cents,
      new.currency,
      'stripe',
      new.paid_at
    )
    on conflict (booking_id) do update
    set amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        provider = excluded.provider,
        paid_at = excluded.paid_at,
        updated_at = now();

    insert into public.financial_ledger_entries (
      entry_type,
      direction,
      amount_cents,
      patient_profile_id,
      therapist_profile_id,
      booking_id,
      session_payment_id,
      source_table,
      source_id,
      occurred_at
    )
    select
      entries.entry_type,
      'credit',
      entries.amount_cents,
      new.patient_profile_id,
      new.therapist_profile_id,
      new.booking_id,
      new.id,
      'session_payments',
      new.id,
      coalesce(new.paid_at, new.created_at)
    from (
      values
        (
          'session_gross_payment'::public.financial_ledger_entry_type,
          new.gross_amount_cents
        ),
        (
          'therapist_payable'::public.financial_ledger_entry_type,
          new.therapist_amount_cents
        ),
        (
          'platform_gross_commission'::public.financial_ledger_entry_type,
          new.platform_gross_commission_cents
        )
    ) as entries(entry_type, amount_cents)
    where entries.amount_cents > 0
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_session_payment_projections_trigger
on public.session_payments;

create trigger sync_session_payment_projections_trigger
after insert or update of
  financial_status,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  gross_amount_cents,
  platform_gross_commission_cents,
  therapist_amount_cents,
  paid_at
on public.session_payments
for each row
execute function public.sync_session_payment_projections();

create or replace function public.import_legacy_payment_projection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_policy_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select *
    into v_booking
  from public.bookings
  where id = new.booking_id;

  select id
    into v_policy_id
  from public.financial_policy_versions
  where version = 'tes-legacy-import-v1';

  insert into public.session_payments (
    booking_id,
    patient_profile_id,
    therapist_profile_id,
    service_id,
    policy_version_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    gross_amount_cents,
    platform_commission_bps,
    platform_gross_commission_cents,
    therapist_amount_cents,
    currency,
    financial_status,
    transfer_status,
    transfer_blocked_reason,
    paid_at,
    failed_at,
    metadata,
    created_at,
    updated_at
  ) values (
    new.booking_id,
    new.patient_profile_id,
    new.therapist_profile_id,
    v_booking.service_id,
    v_policy_id,
    new.stripe_checkout_session_id,
    new.stripe_payment_intent_id,
    new.amount_cents,
    case
      when new.amount_cents > 0
        then floor(new.platform_fee_cents * 10000.0 / new.amount_cents)::integer
      else 0
    end,
    new.platform_fee_cents,
    new.therapist_amount_cents,
    new.currency,
    case new.status
      when 'not_started' then 'pending'::public.session_financial_status
      when 'pending' then 'processing'::public.session_financial_status
      when 'paid' then 'paid'::public.session_financial_status
      when 'failed' then 'failed'::public.session_financial_status
      when 'cancelled' then 'canceled'::public.session_financial_status
      when 'refunded' then 'refunded'::public.session_financial_status
      when 'partially_refunded' then 'partially_refunded'::public.session_financial_status
    end,
    case
      when new.status = 'paid' and new.stripe_payment_intent_id is not null
        then 'blocked'::public.session_transfer_status
      else 'not_eligible'::public.session_transfer_status
    end,
    case
      when new.status = 'paid' and new.stripe_payment_intent_id is not null
        then 'source_charge_reconciliation_required'
      else null
    end,
    new.paid_at,
    case when new.status = 'failed' then new.updated_at else null end,
    jsonb_build_object(
      'source', 'legacy_payments_projection_import',
      'legacyPaymentId', new.id
    ),
    new.created_at,
    new.updated_at
  )
  on conflict (booking_id) do nothing;

  return new;
end;
$$;

drop trigger if exists import_legacy_payment_projection_trigger
on public.payments;

create trigger import_legacy_payment_projection_trigger
after insert or update on public.payments
for each row
execute function public.import_legacy_payment_projection();

update public.session_payments
set updated_at = updated_at;

revoke insert, update, delete on public.payments from service_role;

grant select on public.therapist_subscriptions to authenticated;
grant select on public.billing_invoices to authenticated;
grant select on public.therapist_connect_accounts to authenticated;
grant select on public.session_payments to authenticated;
grant select on public.session_cancellation_decisions to authenticated;
grant select on public.payout_batch_items to authenticated;
grant select on public.stripe_transfers to authenticated;

drop policy if exists "Therapists can read own billing invoices"
on public.billing_invoices;

create policy "Therapists can read own billing invoices"
on public.billing_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles tp
    where tp.id = billing_invoices.therapist_profile_id
      and tp.user_id = (select auth.uid())
  )
);

create or replace function public.reserve_stripe_webhook_event_v1(
  p_stripe_event_id text,
  p_event_type text,
  p_account_id text,
  p_livemode boolean,
  p_api_version text,
  p_source text,
  p_payload_sha256 text,
  p_event_created_at timestamptz,
  p_object_id text
)
returns table (
  processing_status public.stripe_webhook_processing_status,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_webhook_events%rowtype;
begin
  insert into public.stripe_webhook_events (
    stripe_event_id,
    event_type,
    account_id,
    livemode,
    api_version,
    source,
    processing_status,
    attempts,
    payload_sha256,
    stripe_event_created_at,
    object_id,
    processing_started_at,
    updated_at
  ) values (
    p_stripe_event_id,
    p_event_type,
    p_account_id,
    p_livemode,
    p_api_version,
    p_source,
    'processing',
    1,
    p_payload_sha256,
    p_event_created_at,
    p_object_id,
    now(),
    now()
  )
  on conflict (stripe_event_id) do nothing
  returning * into v_event;

  if v_event.id is not null then
    return query select v_event.processing_status, true;
    return;
  end if;

  select *
    into v_event
  from public.stripe_webhook_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if v_event.processing_status in ('processed', 'ignored')
    or (
      v_event.processing_status = 'processing'
      and v_event.processing_started_at > now() - interval '5 minutes'
    ) then
    return query select v_event.processing_status, false;
    return;
  end if;

  update public.stripe_webhook_events
  set processing_status = 'processing',
      processing_started_at = now(),
      processed_at = null,
      attempts = attempts + 1,
      error_code = null,
      error_message = null,
      updated_at = now()
  where id = v_event.id
  returning * into v_event;

  return query select v_event.processing_status, true;
end;
$$;

create or replace function public.apply_session_payment_state_v1(
  p_session_payment_id uuid,
  p_financial_status public.session_financial_status,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_stripe_checkout_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_booking_status public.booking_status;
  v_applied boolean := false;
  v_now timestamptz := now();
begin
  select *
    into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  end if;

  if v_payment.stripe_event_created_at is not null
    and p_stripe_event_created_at < v_payment.stripe_event_created_at then
    return jsonb_build_object(
      'applied', false,
      'reason', 'stale_event',
      'financialStatus', v_payment.financial_status
    );
  end if;

  v_applied := case
    when p_financial_status = 'paid'
      then v_payment.financial_status in ('pending', 'processing', 'failed', 'canceled', 'paid')
    when p_financial_status = 'processing'
      then v_payment.financial_status in ('pending', 'processing')
    when p_financial_status in ('failed', 'canceled')
      then v_payment.financial_status in ('pending', 'processing', p_financial_status)
    else false
  end;

  if not v_applied then
    return jsonb_build_object(
      'applied', false,
      'reason', 'transition_blocked',
      'financialStatus', v_payment.financial_status
    );
  end if;

  update public.session_payments
  set financial_status = p_financial_status,
      stripe_event_id = p_stripe_event_id,
      stripe_event_created_at = p_stripe_event_created_at,
      stripe_payment_intent_id = coalesce(
        p_stripe_payment_intent_id,
        stripe_payment_intent_id
      ),
      stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
      stripe_checkout_session_id = coalesce(
        p_stripe_checkout_session_id,
        stripe_checkout_session_id
      ),
      paid_at = case
        when p_financial_status = 'paid' then coalesce(paid_at, p_stripe_event_created_at)
        else paid_at
      end,
      failed_at = case
        when p_financial_status = 'failed' then p_stripe_event_created_at
        when p_financial_status = 'paid' then null
        else failed_at
      end,
      canceled_at = case
        when p_financial_status = 'canceled' then p_stripe_event_created_at
        when p_financial_status = 'paid' then null
        else canceled_at
      end,
      updated_at = v_now
  where id = v_payment.id
  returning * into v_payment;

  select status
    into v_booking_status
  from public.bookings
  where id = v_payment.booking_id;

  if p_financial_status = 'paid' then
    update public.bookings
    set payment_status = 'paid',
        status = case
          when status in ('draft', 'pending_payment') then 'confirmed'
          else status
        end,
        updated_at = v_now
    where id = v_payment.booking_id;

    if v_booking_status in (
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'refunded'
    ) then
      update public.session_payments
      set transfer_status = 'blocked',
          transfer_blocked_reason = 'paid_after_booking_closed',
          updated_at = v_now
      where id = v_payment.id;
    end if;

    update public.payments
    set status = 'paid',
        stripe_payment_intent_id = coalesce(
          p_stripe_payment_intent_id,
          stripe_payment_intent_id
        ),
        stripe_checkout_session_id = coalesce(
          p_stripe_checkout_session_id,
          stripe_checkout_session_id
        ),
        paid_at = coalesce(paid_at, p_stripe_event_created_at),
        updated_at = v_now
    where booking_id = v_payment.booking_id;

    insert into public.financial_ledger_entries (
      entry_type,
      direction,
      amount_cents,
      patient_profile_id,
      therapist_profile_id,
      booking_id,
      session_payment_id,
      stripe_event_id,
      source_table,
      source_id,
      occurred_at
    )
    select entry_type, direction, amount_cents,
      v_payment.patient_profile_id,
      v_payment.therapist_profile_id,
      v_payment.booking_id,
      v_payment.id,
      p_stripe_event_id,
      'session_payments',
      v_payment.id,
      p_stripe_event_created_at
    from (
      values
        (
          'session_gross_payment'::public.financial_ledger_entry_type,
          'credit'::public.financial_ledger_direction,
          v_payment.gross_amount_cents
        ),
        (
          'therapist_payable'::public.financial_ledger_entry_type,
          'credit'::public.financial_ledger_direction,
          v_payment.therapist_amount_cents
        ),
        (
          'platform_gross_commission'::public.financial_ledger_entry_type,
          'credit'::public.financial_ledger_direction,
          v_payment.platform_gross_commission_cents
        )
    ) as entries(entry_type, direction, amount_cents)
    where amount_cents > 0
    on conflict do nothing;

    perform public.refresh_session_transfer_eligibility(v_payment.id);
  elsif p_financial_status = 'processing' then
    update public.bookings
    set payment_status = 'pending',
        status = case when status = 'draft' then 'pending_payment' else status end,
        updated_at = v_now
    where id = v_payment.booking_id;

    update public.payments
    set status = 'pending',
        updated_at = v_now
    where booking_id = v_payment.booking_id
      and status <> 'paid';
  else
    update public.bookings
    set payment_status = case
          when p_financial_status = 'canceled' then 'cancelled'::public.payment_status
          else 'failed'::public.payment_status
        end,
        updated_at = v_now
    where id = v_payment.booking_id
      and payment_status <> 'paid';

    update public.payments
    set status = case
          when p_financial_status = 'canceled' then 'cancelled'::public.payment_status
          else 'failed'::public.payment_status
        end,
        updated_at = v_now
    where booking_id = v_payment.booking_id
      and status <> 'paid';
  end if;

  update public.session_payment_attempts
  set status = p_financial_status::text,
      stripe_payment_intent_id = coalesce(
        p_stripe_payment_intent_id,
        stripe_payment_intent_id
      ),
      updated_at = v_now
  where session_payment_id = v_payment.id
    and (
      p_stripe_checkout_session_id is null
      or stripe_checkout_session_id = p_stripe_checkout_session_id
    );

  return jsonb_build_object(
    'applied', true,
    'financialStatus', p_financial_status,
    'sessionPaymentId', v_payment.id
  );
end;
$$;

create or replace function public.apply_therapist_subscription_event_v1(
  p_therapist_profile_id uuid,
  p_stripe_subscription_id text,
  p_plan_code public.therapist_plan,
  p_status public.billing_subscription_status,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_customer_id uuid default null,
  p_billing_plan_id uuid default null,
  p_billing_plan_price_id uuid default null,
  p_stripe_checkout_session_id text default null,
  p_stripe_latest_invoice_id text default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_canceled_at timestamptz default null,
  p_ended_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.therapist_subscriptions%rowtype;
  v_previous_plan public.therapist_plan;
  v_previous_status text;
  v_active_plan public.therapist_plan;
  v_applied boolean := false;
begin
  select *
    into v_subscription
  from public.therapist_subscriptions
  where stripe_subscription_id = p_stripe_subscription_id
  for update;

  v_previous_plan := v_subscription.plan_code;
  v_previous_status := v_subscription.status::text;

  if v_subscription.id is null then
    insert into public.therapist_subscriptions (
      therapist_profile_id,
      stripe_customer_id,
      billing_plan_id,
      billing_plan_price_id,
      plan_code,
      status,
      stripe_subscription_id,
      stripe_checkout_session_id,
      stripe_latest_invoice_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      canceled_at,
      ended_at,
      stripe_event_created_at,
      metadata
    ) values (
      p_therapist_profile_id,
      p_stripe_customer_id,
      p_billing_plan_id,
      p_billing_plan_price_id,
      p_plan_code,
      p_status,
      p_stripe_subscription_id,
      p_stripe_checkout_session_id,
      p_stripe_latest_invoice_id,
      p_current_period_start,
      p_current_period_end,
      p_cancel_at_period_end,
      p_canceled_at,
      p_ended_at,
      p_stripe_event_created_at,
      p_metadata
    )
    returning * into v_subscription;
    v_applied := true;
  elsif v_subscription.stripe_event_created_at is null
    or p_stripe_event_created_at >= v_subscription.stripe_event_created_at then
    update public.therapist_subscriptions
    set stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
        billing_plan_id = coalesce(p_billing_plan_id, billing_plan_id),
        billing_plan_price_id = coalesce(
          p_billing_plan_price_id,
          billing_plan_price_id
        ),
        plan_code = p_plan_code,
        status = p_status,
        stripe_checkout_session_id = coalesce(
          p_stripe_checkout_session_id,
          stripe_checkout_session_id
        ),
        stripe_latest_invoice_id = p_stripe_latest_invoice_id,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        cancel_at_period_end = p_cancel_at_period_end,
        canceled_at = p_canceled_at,
        ended_at = p_ended_at,
        stripe_event_created_at = p_stripe_event_created_at,
        metadata = p_metadata,
        updated_at = now()
    where id = v_subscription.id
    returning * into v_subscription;
    v_applied := true;
  end if;

  if v_applied then
    insert into public.therapist_subscription_events (
      therapist_subscription_id,
      therapist_profile_id,
      stripe_event_id,
      event_type,
      previous_plan,
      next_plan,
      previous_status,
      next_status,
      metadata
    ) values (
      v_subscription.id,
      p_therapist_profile_id,
      p_stripe_event_id,
      'stripe_subscription_sync',
      v_previous_plan,
      p_plan_code,
      v_previous_status,
      p_status::text,
      jsonb_build_object('stripeEventCreatedAt', p_stripe_event_created_at)
    )
    on conflict (stripe_event_id) where stripe_event_id is not null do nothing;
  end if;

  select plan_code
    into v_active_plan
  from public.therapist_subscriptions
  where therapist_profile_id = p_therapist_profile_id
    and status in ('active', 'trialing', 'past_due')
  order by
    case plan_code when 'premium_plus' then 2 when 'premium' then 1 else 0 end desc,
    stripe_event_created_at desc nulls last,
    updated_at desc
  limit 1;

  update public.therapist_profiles
  set plan = coalesce(v_active_plan, 'free'::public.therapist_plan),
      updated_at = now()
  where id = p_therapist_profile_id;

  return jsonb_build_object(
    'applied', v_applied,
    'plan', coalesce(v_active_plan, 'free'::public.therapist_plan),
    'subscriptionId', v_subscription.id
  );
end;
$$;

revoke all on function public.reserve_stripe_webhook_event_v1(
  text, text, text, boolean, text, text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.apply_session_payment_state_v1(
  uuid, public.session_financial_status, text, timestamptz, text, text, text
) from public, anon, authenticated;
revoke all on function public.apply_therapist_subscription_event_v1(
  uuid, text, public.therapist_plan, public.billing_subscription_status,
  text, timestamptz, uuid, uuid, uuid, text, text, timestamptz, timestamptz,
  boolean, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.reserve_stripe_webhook_event_v1(
  text, text, text, boolean, text, text, text, timestamptz, text
) to service_role;
grant execute on function public.apply_session_payment_state_v1(
  uuid, public.session_financial_status, text, timestamptz, text, text, text
) to service_role;
grant execute on function public.apply_therapist_subscription_event_v1(
  uuid, text, public.therapist_plan, public.billing_subscription_status,
  text, timestamptz, uuid, uuid, uuid, text, text, timestamptz, timestamptz,
  boolean, timestamptz, timestamptz, jsonb
) to service_role;

comment on function public.reserve_stripe_webhook_event_v1(
  text, text, text, boolean, text, text, text, timestamptz, text
) is 'Reserva atomica e reprocessavel de evento Stripe, com lease de cinco minutos.';

comment on function public.apply_session_payment_state_v1(
  uuid, public.session_financial_status, text, timestamptz, text, text, text
) is 'Aplica transicao financeira de sessao sem regressao por evento antigo e espelha projecoes legadas.';

comment on function public.apply_therapist_subscription_event_v1(
  uuid, text, public.therapist_plan, public.billing_subscription_status,
  text, timestamptz, uuid, uuid, uuid, text, text, timestamptz, timestamptz,
  boolean, timestamptz, timestamptz, jsonb
) is 'Sincroniza assinatura e plano do terapeuta com protecao contra eventos Stripe fora de ordem.';
