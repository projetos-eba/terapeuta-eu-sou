-- Reduz o preço público mensal do Premium Plus para R$ 119,90.
-- O Price anterior permanece registrado e inativo para preservar o histórico.

update public.billing_plan_prices
set is_active = false,
    is_public = false,
    metadata = metadata || jsonb_build_object(
      'retired_reason', 'premium_plus_public_price_replaced',
      'retired_at', '2026-09-10T19:00:00Z'
    ),
    updated_at = now()
where stripe_lookup_key = 'tes_premium_plus_brl_monthly_v2';

insert into public.billing_plan_prices (
  plan_id,
  unit_amount_cents,
  interval,
  stripe_lookup_key,
  is_active,
  is_public,
  metadata
)
select
  id,
  11990,
  'month',
  'tes_premium_plus_brl_monthly_v3',
  true,
  true,
  '{"source":"premium_plus_public_price_2026_09"}'::jsonb
from public.billing_plans
where code = 'premium_plus'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    interval = excluded.interval,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    offer_key = null,
    metadata = excluded.metadata,
    updated_at = now();
