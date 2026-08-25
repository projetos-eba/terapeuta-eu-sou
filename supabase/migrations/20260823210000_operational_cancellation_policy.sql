-- Align future cancellation decisions with the operational policy supplied on 2026-08-23.
-- Existing payments retain their immutable financial policy snapshot.

update public.financial_policy_versions
set is_active = false
where is_active;

insert into public.financial_policy_versions (
  version,
  is_active,
  currency,
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
  metadata,
  effective_from
)
select
  'tes-payments-v3-cancellation-operational',
  true,
  policy.currency,
  policy.platform_commission_bps,
  policy.auto_confirmation_days,
  policy.transfer_safety_period_days,
  policy.free_cancellation_hours,
  10000,
  10000,
  7,
  policy.manual_review_response_days,
  policy.weekly_batch_weekday,
  policy.weekly_batch_time,
  policy.timezone,
  policy.payout_batch_rule,
  'free_until_24h_late_no_refund_no_show_no_refund',
  'refund_or_reschedule_24h_manual_review_exceptions',
  policy.proration_policy_key,
  policy.upgrade_proration_behavior,
  policy.downgrade_behavior,
  policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'operationalPolicySource', 'POLÍTICA DE CANCELAMENTO - OPERACIONAL.docx',
    'freeCancellation', 'At least 24 hours: reschedule or refund when applicable.',
    'lateCancellation', 'Less than 24 hours: no obligation to refund; exceptional cases may be reviewed.',
    'noShow', 'No obligation to refund; exceptional cases may be reviewed.',
    'refundProcessingBusinessDays', 7
  ),
  now()
from public.financial_policy_versions as policy
where policy.version = 'tes-payments-v2-session-attendance'
on conflict (version) do update
set is_active = excluded.is_active,
    currency = excluded.currency,
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
    metadata = excluded.metadata,
    effective_from = excluded.effective_from,
    effective_until = null;
