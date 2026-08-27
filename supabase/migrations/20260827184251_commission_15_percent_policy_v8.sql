begin;

-- Financial policies are immutable once a payment snapshots them.  V8 changes
-- only the split for session payments created after this migration: 15% is
-- retained by TES and 85% remains payable to the therapist. Existing session
-- payments continue to carry their own policy and monetary snapshots.
alter table public.financial_policy_versions
  alter column platform_commission_bps set default 1500;

create or replace function public.calculate_session_payment_snapshot(
  p_gross_amount_cents integer,
  p_platform_commission_bps integer default 1500
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
  'tes-payments-v8-commission-15-percent',
  false,
  policy.currency,
  1500,
  policy.auto_confirmation_days,
  policy.patient_auto_confirmation_days,
  policy.therapist_auto_confirmation_days,
  policy.transfer_safety_period_days,
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
    'commissionRatePercent', 15,
    'commissionScope', 'new_session_payments_only',
    'supersedes', policy.version
  ),
  now()
from public.financial_policy_versions as policy
where policy.version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout'
on conflict (version) do update
set is_active = false,
    currency = excluded.currency,
    platform_commission_bps = excluded.platform_commission_bps,
    auto_confirmation_days = excluded.auto_confirmation_days,
    patient_auto_confirmation_days = excluded.patient_auto_confirmation_days,
    therapist_auto_confirmation_days = excluded.therapist_auto_confirmation_days,
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
    metadata = excluded.metadata,
    effective_from = excluded.effective_from,
    effective_until = null;

do $$
begin
  if not exists (
    select 1
    from public.financial_policy_versions
    where version = 'tes-payments-v8-commission-15-percent'
  ) then
    raise exception 'FINANCIAL_POLICY_V8_SOURCE_MISSING';
  end if;
end $$;

update public.financial_policy_versions
set is_active = false,
    effective_until = coalesce(effective_until, now())
where is_active
  and version <> 'tes-payments-v8-commission-15-percent';

update public.financial_policy_versions
set is_active = true,
    effective_until = null
where version = 'tes-payments-v8-commission-15-percent';

do $$
begin
  if (
    select count(*)
    from public.financial_policy_versions
    where is_active
  ) <> 1 then
    raise exception 'FINANCIAL_POLICY_ACTIVE_COUNT_INVALID';
  end if;

  if not exists (
    select 1
    from public.financial_policy_versions
    where is_active
      and version = 'tes-payments-v8-commission-15-percent'
      and platform_commission_bps = 1500
      and weekly_batch_weekday = 2
      and weekly_batch_time = time '02:00'
      and timezone = 'America/Sao_Paulo'
      and payout_batch_rule = 'weekly_transfer_daily_automatic_payout'
      and patient_auto_confirmation_days = 7
      and therapist_auto_confirmation_days = 30
      and transfer_safety_period_days = 1
  ) then
    raise exception 'FINANCIAL_POLICY_V8_CONTRACT_INVALID';
  end if;
end $$;

commit;
