-- Local-only Stripe Connect state fixture.
--
-- This file is intentionally outside [db.seed].sql_paths. It mirrors only the
-- non-sensitive, read-model-visible state of a ready HML receiving account.
-- It never copies a provider account id, bank data, KYC data or documents.
--
-- The caller must set tes.local_fixture.therapist_email in the same database
-- session before running this file. Example with psql:
--
--   begin;
--   select set_config(
--     'tes.local_fixture.therapist_email',
--     '<local therapist email>',
--     true
--   );
--   \i supabase/seeds/local-therapist-connect-ready-fixture.sql
--   commit;
--
-- A pre-existing current account is retained as a historical local row. The
-- fixture uses a deterministic fake id so provider-backed operations fail
-- closed instead of reaching an HML Stripe account.

create temporary table _tes_local_connect_fixture_target
on commit drop
as
select therapist.id as therapist_profile_id
from auth.users as auth_user
join public.therapist_profiles as therapist
  on therapist.user_id = auth_user.id
where lower(auth_user.email) = lower(
  nullif(current_setting('tes.local_fixture.therapist_email', true), '')
);

do $$
declare
  v_target_count integer;
begin
  select count(*) into v_target_count
  from _tes_local_connect_fixture_target;

  if v_target_count <> 1 then
    raise exception 'local_connect_fixture_requires_one_therapist';
  end if;
end;
$$;

update public.therapist_connect_accounts as account
set is_current = false,
    metadata = coalesce(account.metadata, '{}'::jsonb) || jsonb_build_object(
      'superseded_by_local_fixture', true,
      'superseded_at', now()
    ),
    updated_at = now()
from _tes_local_connect_fixture_target as target
where account.therapist_profile_id = target.therapist_profile_id
  and account.is_current
  and account.stripe_account_id <> (
    'acct_local_hml_state_' ||
    substr(md5(target.therapist_profile_id::text), 1, 16)
  );

insert into public.therapist_connect_accounts (
  therapist_profile_id,
  stripe_account_id,
  account_api_version,
  dashboard_type,
  fees_collector,
  losses_collector,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  pending_requirements,
  disabled_reason,
  last_synced_at,
  operational_status,
  metadata,
  account_generation,
  is_current,
  payout_status,
  payout_schedule_interval,
  balance_settings_synced_at
)
select
  target.therapist_profile_id,
  'acct_local_hml_state_' ||
    substr(md5(target.therapist_profile_id::text), 1, 16),
  'v2',
  'express',
  'application',
  'application',
  'ready',
  true,
  true,
  true,
  'active',
  jsonb_build_object(
    'currentlyDue', '[]'::jsonb,
    'eventuallyDue', '[]'::jsonb,
    'pendingVerification', '[]'::jsonb
  ),
  null,
  now(),
  'ready',
  jsonb_build_object(
    'local_fixture', true,
    'provider_operations_allowed', false,
    'source_environment', 'hml_state_snapshot',
    'fixture_purpose', 'connect_account_ui_testing',
    'imported_at', now()
  ),
  coalesce((
    select max(existing.account_generation) + 1
    from public.therapist_connect_accounts as existing
    where existing.therapist_profile_id = target.therapist_profile_id
  ), 1),
  true,
  'enabled',
  'daily',
  now()
from _tes_local_connect_fixture_target as target
on conflict (stripe_account_id) do update
set onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    pending_requirements = excluded.pending_requirements,
    disabled_reason = excluded.disabled_reason,
    last_synced_at = excluded.last_synced_at,
    operational_status = excluded.operational_status,
    metadata = excluded.metadata,
    is_current = true,
    closed_at = null,
    closed_stripe_event_id = null,
    closed_stripe_event_created_at = null,
    payout_status = excluded.payout_status,
    payout_schedule_interval = excluded.payout_schedule_interval,
    balance_settings_synced_at = excluded.balance_settings_synced_at,
    updated_at = now();

select
  account.onboarding_status,
  account.details_submitted,
  account.charges_enabled,
  account.payouts_enabled,
  account.stripe_transfers_status,
  account.operational_status,
  account.payout_status,
  account.payout_schedule_interval,
  account.metadata ->> 'local_fixture' as local_fixture,
  account.metadata ->> 'provider_operations_allowed'
    as provider_operations_allowed
from public.therapist_connect_accounts as account
join _tes_local_connect_fixture_target as target
  on target.therapist_profile_id = account.therapist_profile_id
where account.is_current;
