begin;

-- Preserve the bilateral confirmation contract while correcting the weekly
-- Transfer window inherited from the legacy active policy. Stripe remains the
-- authority for automatic daily Payouts on eligible BR connected accounts.
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
  'tes-payments-v7-bilateral-weekly-transfer-daily-payout',
  false,
  policy.currency,
  policy.platform_commission_bps,
  policy.auto_confirmation_days,
  policy.patient_auto_confirmation_days,
  policy.therapist_auto_confirmation_days,
  policy.transfer_safety_period_days,
  policy.free_cancellation_hours,
  policy.late_cancellation_retention_bps,
  policy.no_show_retention_bps,
  policy.refund_processing_business_days,
  policy.manual_review_response_days,
  2,
  time '02:00',
  'America/Sao_Paulo',
  'weekly_transfer_daily_automatic_payout',
  policy.cancellation_policy_key,
  policy.refund_policy_key,
  policy.proration_policy_key,
  policy.upgrade_proration_behavior,
  policy.downgrade_behavior,
  policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'schedulerWindowStart', '02:00',
    'schedulerWindowEnd', '04:00',
    'payoutMode', 'stripe_daily_automatic',
    'payoutAttribution', 'balance_transactions',
    'activation', 'production_ready_after_hml_gate',
    'supersedes', policy.version
  ),
  now()
from public.financial_policy_versions policy
where policy.version = 'tes-payments-v6-bilateral-7d-30d'
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
    effective_until = null;

do $$
begin
  if not exists (
    select 1
    from public.financial_policy_versions
    where version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout'
  ) then
    raise exception 'FINANCIAL_POLICY_V7_SOURCE_MISSING';
  end if;
end $$;

update public.financial_policy_versions
set is_active = false,
    effective_until = coalesce(effective_until, now())
where is_active
  and version <> 'tes-payments-v7-bilateral-weekly-transfer-daily-payout';

update public.financial_policy_versions
set is_active = true,
    effective_until = null
where version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout';

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
      and version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout'
      and weekly_batch_weekday = 2
      and weekly_batch_time = time '02:00'
      and timezone = 'America/Sao_Paulo'
      and payout_batch_rule = 'weekly_transfer_daily_automatic_payout'
      and patient_auto_confirmation_days = 7
      and therapist_auto_confirmation_days = 30
      and transfer_safety_period_days = 1
  ) then
    raise exception 'FINANCIAL_POLICY_V7_CONTRACT_INVALID';
  end if;
end $$;

commit;
