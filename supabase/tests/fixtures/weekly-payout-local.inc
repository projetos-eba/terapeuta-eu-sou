-- Local-only, idempotent fixtures for the weekly Transfer + Payout lifecycle.
-- Provider identifiers are syntactically fake and must never be sent to Stripe.

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, balance_settings_synced_at,
  pending_requirements, metadata
) values (
  'ca000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_tes_local_weekly_payout_fixture',
  'ready', true, true, true, 'active', 'ready', 'enabled', 'daily', now(),
  '[]'::jsonb, '{"fixture":"weekly_payout_local"}'::jsonb
)
on conflict (therapist_profile_id) where is_current do update
set stripe_account_id = excluded.stripe_account_id,
    onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    operational_status = excluded.operational_status,
    payout_status = excluded.payout_status,
    payout_schedule_interval = excluded.payout_schedule_interval,
    balance_settings_synced_at = excluded.balance_settings_synced_at,
    pending_requirements = excluded.pending_requirements,
    metadata = public.therapist_connect_accounts.metadata || excluded.metadata;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status, service_title_snapshot,
  service_duration_minutes_snapshot, service_price_cents_snapshot
) values
  (
    'fa000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '20 days', now() - interval '20 days' + interval '50 minutes',
    'America/Sao_Paulo', 'completed', 'paid', 'Fixture repasse semanal', 50, 12000
  ),
  (
    'fa000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '19 days', now() - interval '19 days' + interval '50 minutes',
    'America/Sao_Paulo', 'completed', 'paid', 'Fixture sessão gratuita', 50, 0
  )
on conflict (id) do nothing;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, stripe_payment_intent_id, stripe_charge_id,
  stripe_balance_transaction_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  service_status, transfer_status, service_confirmed_at,
  service_confirmation_source, eligible_at, paid_at,
  stripe_balance_status, stripe_balance_available_on,
  stripe_balance_checked_at, metadata
)
select
  'fa100000-0000-4000-8000-000000000001',
  'fa000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 'pi_tes_local_weekly_fixture', 'ch_tes_local_weekly_fixture',
  'txn_tes_local_weekly_fixture', 12000, 2000, 2400, 9600, 'paid',
  'auto_confirmed', 'eligible', '2026-08-20T12:00:00Z', 'automatic',
  '2026-08-21T12:00:00Z', '2026-08-05T12:00:00Z', 'available',
  '2026-08-06T12:00:00Z', '2026-08-25T04:30:00Z',
  '{"fixture":"weekly_payout_local"}'::jsonb
from public.financial_policy_versions policy
where policy.is_active
limit 1
on conflict (id) do nothing;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  service_status, transfer_status, service_confirmed_at,
  service_confirmation_source, eligible_at, paid_at, metadata
)
select
  'fa100000-0000-4000-8000-000000000002',
  'fa000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 0, 2000, 0, 0, 'paid', 'auto_confirmed', 'not_eligible',
  now() - interval '10 days', 'automatic', null, now() - interval '19 days',
  '{"fixture":"weekly_payout_zero_total","promotion_code":"FREE100"}'::jsonb
from public.financial_policy_versions policy
where policy.is_active
limit 1
on conflict (id) do nothing;
