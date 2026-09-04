begin;

-- Stripe settlement is now the only time gate after service confirmation.
-- Historical payment policy snapshots remain immutable; V9 applies to new
-- payments and the operational refresh below re-evaluates active unbatched
-- payments without creating a payout batch or a Stripe Transfer.
alter table public.financial_policy_versions
  alter column transfer_safety_period_days set default 0;

insert into public.financial_policy_versions (
  version,
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
select
  'tes-payments-v9-settlement-only',
  false,
  policy.currency,
  policy.platform_commission_bps,
  policy.auto_confirmation_days,
  policy.patient_auto_confirmation_days,
  policy.therapist_auto_confirmation_days,
  0,
  policy.free_cancellation_hours,
  policy.late_cancellation_retention_bps,
  policy.no_show_retention_bps,
  policy.refund_processing_business_days,
  policy.manual_review_response_days,
  policy.weekly_batch_weekday,
  policy.weekly_batch_time,
  policy.timezone,
  policy.payout_batch_rule,
  policy.cancellation_policy_key,
  policy.refund_policy_key,
  policy.proration_policy_key,
  policy.upgrade_proration_behavior,
  policy.downgrade_behavior,
  policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'settlementGate', 'stripe_balance_transaction_available',
    'transferSafetyPeriodRetired', true,
    'supersedes', policy.version
  ),
  now()
from public.financial_policy_versions policy
where policy.is_active
order by policy.effective_from desc
limit 1
on conflict (version) do update
set is_active = false,
    transfer_safety_period_days = 0,
    metadata = excluded.metadata,
    effective_from = excluded.effective_from,
    effective_until = null;

do $$
begin
  if not exists (
    select 1 from public.financial_policy_versions
    where version = 'tes-payments-v9-settlement-only'
  ) then
    raise exception 'FINANCIAL_POLICY_V9_SOURCE_MISSING';
  end if;
end $$;

update public.financial_policy_versions
set is_active = false,
    effective_until = coalesce(effective_until, now())
where is_active
  and version <> 'tes-payments-v9-settlement-only';

update public.financial_policy_versions
set is_active = true,
    effective_until = null
where version = 'tes-payments-v9-settlement-only';

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
  v_connect_ready boolean;
  v_has_active_batch boolean;
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

  select exists (
    select 1
    from public.therapist_connect_accounts account
    where account.therapist_profile_id = v_payment.therapist_profile_id
      and account.is_current = true
      and account.stripe_transfers_status = 'active'
      and account.payouts_enabled = true
      and account.payout_status = 'enabled'
      and account.payout_schedule_interval = 'daily'
      and account.operational_status = 'ready'
  ) into v_connect_ready;

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
  elsif v_payment.admin_blocked_at is not null or v_payment.internal_contested_at is not null then
    v_status := 'blocked';
    v_reason := coalesce(v_payment.transfer_blocked_reason, 'blocked_or_contested');
  elsif v_payment.refund_pending or v_payment.financial_status = 'refunded' then
    v_status := 'blocked';
    v_reason := 'refund';
  elsif v_payment.financial_status not in ('paid', 'partially_refunded') then
    v_status := 'not_eligible';
    v_reason := 'payment_not_confirmed';
  elsif v_payment.service_status not in (
      'confirmed_bilateral',
      'confirmed_by_patient_review',
      'confirmed_by_therapist',
      'auto_confirmed'
    ) or v_payment.service_confirmed_at is null
      or v_payment.service_confirmed_at > p_now then
    v_status := 'waiting_confirmation';
    v_reason := 'service_not_confirmed';
  elsif not v_connect_ready then
    v_status := 'blocked';
    v_reason := 'connect_not_ready';
  elsif v_payment.therapist_amount_cents <= 0 then
    v_status := 'not_eligible';
    v_reason := 'non_positive_transfer_amount';
  else
    v_eligible_at := v_payment.service_confirmed_at;
    if v_payment.stripe_charge_id is null
      or v_payment.stripe_balance_transaction_id is null
      or v_payment.stripe_balance_status is distinct from 'available'
      or v_payment.stripe_balance_available_on is null
      or v_payment.stripe_balance_available_on > p_now
      or v_payment.stripe_balance_checked_at is null
      or v_payment.stripe_balance_checked_at < p_now - interval '2 hours' then
      v_status := 'waiting_settlement';
      v_reason := 'stripe_settlement_pending';
    else
      v_status := 'eligible';
      v_reason := 'eligible';
    end if;
  end if;

  update public.session_payments
  set transfer_status = v_status,
      eligible_at = case
        when v_status in ('waiting_settlement', 'eligible') then v_eligible_at
        when v_status in ('batched', 'transfer_pending', 'transferred') then eligible_at
        else null
      end,
      transfer_blocked_reason = v_reason,
      updated_at = now()
  where id = p_session_payment_id;

  return v_status;
end;
$$;

revoke all on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
to service_role;

create or replace function public.private_therapist_receipt_status_v2(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when payment.financial_status = 'disputed' or payment.disputed_at is not null then 'disputed'
    when payment.financial_status = 'refunded' then 'refunded'
    when payment.financial_status = 'canceled' then 'canceled'
    when payment.financial_status = 'failed' then 'failed'
    when payment.transfer_status = 'reversed' then 'reversed'
    when payment.transfer_status = 'failed' then 'failed'
    when payment.transfer_status = 'blocked' then 'blocked'
    when exists (
      select 1
      from public.stripe_transfers transfer
      join public.stripe_payout_transfer_allocations allocation
        on allocation.stripe_transfer_id = transfer.id
      join public.stripe_payouts payout
        on payout.id = allocation.stripe_payout_id
      where transfer.session_payment_id = payment.id
        and transfer.status = 'transferred'
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
        and allocation.amount_cents = transfer.amount_cents
    ) then 'paid'
    when payment.transfer_status = 'transferred' then 'bank_pending'
    when payment.transfer_status in ('batched', 'transfer_pending') then 'payout_processing'
    when payment.transfer_status = 'eligible' then 'eligible'
    when payment.transfer_status in ('waiting_settlement', 'waiting_safety_period') then 'waiting_settlement'
    when payment.financial_status in ('paid', 'partially_refunded')
      and booking.starts_at > p_now then 'receivable'
    when payment.transfer_status = 'waiting_confirmation' then 'waiting_confirmation'
    when payment.financial_status in ('paid', 'partially_refunded') then 'waiting_confirmation'
    else 'receivable'
  end
  from public.session_payments payment
  join public.bookings booking on booking.id = payment.booking_id
  where payment.id = p_session_payment_id;
$$;

revoke all on function public.private_therapist_receipt_status_v2(uuid, timestamptz)
from public, anon, authenticated;

-- Keep the public RPC signatures stable while translating the retired state.
alter function public.get_session_feedback_v2(uuid)
  rename to private_session_feedback_v2_with_safety_legacy;

create function public.get_session_feedback_v2(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_transfer_status text;
begin
  v_payload := public.private_session_feedback_v2_with_safety_legacy(p_booking_id);

  select payment.transfer_status::text into v_transfer_status
  from public.session_payments payment
  where payment.booking_id = p_booking_id;

  if v_payload ->> 'confirmationState' in ('safety_period', 'next_batch') then
    v_payload := jsonb_set(
      v_payload,
      '{confirmationState}',
      to_jsonb(case
        when v_transfer_status in ('waiting_safety_period', 'waiting_settlement') then 'processing_payment'
        when v_transfer_status = 'transferred' then 'completed'
        else 'next_batch'
      end::text),
      true
    );
  end if;

  v_payload := jsonb_set(v_payload, '{policy,transferSafetyHours}', '0'::jsonb, true);
  v_payload := jsonb_set(
    v_payload,
    '{financial,nextBatchAt}',
    case
      when v_transfer_status = 'eligible' then coalesce(v_payload #> '{financial,nextBatchAt}', 'null'::jsonb)
      else 'null'::jsonb
    end,
    true
  );

  return v_payload;
end;
$$;

alter function public.get_patient_session_feedback_queue_v1()
  rename to private_patient_session_feedback_queue_v1_with_safety_legacy;

create function public.get_patient_session_feedback_queue_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with legacy as (
    select public.private_patient_session_feedback_queue_v1_with_safety_legacy() payload
  ), items as (
    select item.value payload
    from legacy
    cross join lateral jsonb_array_elements(legacy.payload) item
  )
  select coalesce(jsonb_agg(
    items.payload || jsonb_build_object(
      'confirmationState', case
        when items.payload ->> 'confirmationState' in ('safety_period', 'next_batch')
          and payment.transfer_status in ('waiting_safety_period', 'waiting_settlement')
          then 'processing_payment'
        when payment.transfer_status = 'transferred' then 'completed'
        when items.payload ->> 'confirmationState' in ('safety_period', 'next_batch')
          then 'next_batch'
        else items.payload ->> 'confirmationState'
      end,
      'eligibleAt', payment.eligible_at,
      'nextBatchAt', case
        when payment.transfer_status = 'eligible'
          then public.next_weekly_payout_cutoff_v1(payment.eligible_at, now())
        else null
      end
    ) order by (items.payload ->> 'endsAt')::timestamptz desc
  ), '[]'::jsonb)
  from items
  join public.session_payments payment
    on payment.booking_id = (items.payload ->> 'bookingId')::uuid;
$$;

revoke all on function public.private_session_feedback_v2_with_safety_legacy(uuid)
from public, anon, authenticated;
revoke all on function public.private_patient_session_feedback_queue_v1_with_safety_legacy()
from public, anon, authenticated;
revoke all on function public.get_session_feedback_v2(uuid)
from public, anon;
revoke all on function public.get_patient_session_feedback_queue_v1()
from public, anon;
grant execute on function public.private_session_feedback_v2_with_safety_legacy(uuid)
to service_role;
grant execute on function public.private_patient_session_feedback_queue_v1_with_safety_legacy()
to service_role;
grant execute on function public.get_session_feedback_v2(uuid)
to authenticated, service_role;
grant execute on function public.get_patient_session_feedback_queue_v1()
to authenticated, service_role;

comment on function public.get_session_feedback_v2(uuid) is
  'Participant-scoped feedback and confirmation state. Stripe settlement replaces the retired transfer safety period.';
comment on function public.get_patient_session_feedback_queue_v1() is
  'Ended paid patient encounters awaiting feedback, with settlement-only transfer state.';

-- Retrospective operational refresh. The row-level function preserves active
-- batches and transferred payments and never calls an external provider.
do $$
declare
  v_payment record;
begin
  for v_payment in
    select payment.id
    from public.session_payments payment
    where payment.financial_status in ('paid', 'partially_refunded')
      and payment.transfer_status in (
        'waiting_confirmation',
        'waiting_safety_period',
        'waiting_settlement',
        'eligible'
      )
      and not exists (
        select 1
        from public.payout_batch_items item
        where item.session_payment_id = payment.id
          and item.status in ('reserved', 'transfer_pending', 'transferred')
      )
    order by payment.id
    for update of payment
  loop
    perform public.refresh_session_transfer_eligibility(v_payment.id, now());
  end loop;
end $$;

do $$
begin
  if (select count(*) from public.financial_policy_versions where is_active) <> 1 then
    raise exception 'FINANCIAL_POLICY_ACTIVE_COUNT_INVALID';
  end if;

  if not exists (
    select 1
    from public.financial_policy_versions
    where is_active
      and version = 'tes-payments-v9-settlement-only'
      and platform_commission_bps = 1500
      and weekly_batch_weekday = 2
      and weekly_batch_time = time '02:00'
      and timezone = 'America/Sao_Paulo'
      and payout_batch_rule = 'weekly_transfer_daily_automatic_payout'
      and patient_auto_confirmation_days = 7
      and therapist_auto_confirmation_days = 30
      and transfer_safety_period_days = 0
  ) then
    raise exception 'FINANCIAL_POLICY_V9_CONTRACT_INVALID';
  end if;
end $$;

commit;
