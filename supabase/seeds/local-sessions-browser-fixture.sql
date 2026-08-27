-- Local-only browser fixture for the authenticated Sessions and public-profile
-- E2E scenarios. This file is intentionally outside [db.seed].sql_paths so
-- the global pgTAP suite keeps its isolated financial/publication contracts.

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status,
  pending_requirements,
  last_synced_at
)
values (
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_local_ana_sessions',
  'ready',
  true,
  true,
  true,
  'active',
  'ready',
  '[]'::jsonb,
  now()
)
on conflict (therapist_profile_id) where is_current do update
set stripe_account_id = excluded.stripe_account_id,
    onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    operational_status = excluded.operational_status,
    pending_requirements = excluded.pending_requirements,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  currency,
  status,
  online_only,
  is_bookable,
  archived_at
)
values (
  'd1000000-0000-4000-8000-000000000007',
  'c1000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222228',
  'Tarô e autoconhecimento',
  'Uma leitura simbólica para refletir sobre escolhas, padrões e caminhos possíveis.',
  60,
  20000,
  'BRL',
  'active',
  true,
  true,
  null
)
on conflict (id) do update
set therapist_profile_id = excluded.therapist_profile_id,
    therapy_id = excluded.therapy_id,
    title = excluded.title,
    description = excluded.description,
    duration_minutes = excluded.duration_minutes,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    status = excluded.status,
    online_only = excluded.online_only,
    is_bookable = excluded.is_bookable,
    archived_at = excluded.archived_at,
    updated_at = now();

insert into public.therapy_theme_weights (
  id,
  therapy_id,
  theme_id,
  weight,
  reason,
  source,
  is_active
)
values
  (
    '44444444-4444-4444-8444-444444444451',
    '22222222-2222-4222-8222-222222222225',
    '33333333-3333-4333-8333-333333333332',
    12,
    'Fixture local: Reiki aparece para autoconhecimento.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444452',
    '22222222-2222-4222-8222-222222222225',
    '33333333-3333-4333-8333-333333333331',
    10,
    'Fixture local: Reiki aparece para equilíbrio emocional.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444453',
    '22222222-2222-4222-8222-222222222228',
    '33333333-3333-4333-8333-333333333342',
    11,
    'Fixture local: Tarô aparece para clareza nas escolhas.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444454',
    '22222222-2222-4222-8222-222222222228',
    '33333333-3333-4333-8333-333333333332',
    9,
    'Fixture local: Tarô aparece para autoconhecimento.',
    'journey',
    true
  )
on conflict (id) do update
set therapy_id = excluded.therapy_id,
    theme_id = excluded.theme_id,
    weight = excluded.weight,
    reason = excluded.reason,
    source = excluded.source,
    is_active = excluded.is_active,
    updated_at = now();
