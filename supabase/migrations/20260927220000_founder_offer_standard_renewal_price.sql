-- New TERAPEUTAFUNDADOR subscriptions keep the public Premium Plus renewal
-- price after their three fully discounted invoices. The former hidden Price
-- remains in Stripe for existing subscriptions, but is retired locally so new
-- Checkout Sessions can no longer select it.

begin;

update public.billing_plan_prices
set
  is_active = false,
  is_public = false,
  offer_key = null,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'retired_reason', 'founder_offer_standard_renewal_price',
    'retired_offer_key', 'therapist_founder',
    'retired_at', now()
  ),
  updated_at = now()
where stripe_lookup_key = 'tes_premium_plus_founder_brl_monthly_v1'
  and offer_key = 'therapist_founder';

insert into public.billing_plan_prices (
  plan_id,
  unit_amount_cents,
  interval,
  stripe_lookup_key,
  is_active,
  is_public,
  offer_key,
  metadata
)
select
  id,
  11990,
  'month',
  'tes_premium_plus_founder_brl_monthly_v2',
  true,
  false,
  'therapist_founder',
  '{"source":"founder_offer_standard_renewal_price_2026_09","promotion_code":"TERAPEUTAFUNDADOR"}'::jsonb
from public.billing_plans
where code = 'premium_plus'
on conflict (stripe_lookup_key) do update
set
  unit_amount_cents = excluded.unit_amount_cents,
  interval = excluded.interval,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  offer_key = excluded.offer_key,
  metadata = excluded.metadata,
  updated_at = now();

comment on column public.billing_plan_prices.offer_key is
  'Chave server-side de oferta resolvida por metadata Stripe, nunca pelo navegador. O TERAPEUTAFUNDADOR usa o Price fundador ativo de R$ 119,90 após os três meses gratuitos.';

commit;
