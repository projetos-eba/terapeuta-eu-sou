-- Catálogo mensal de lançamento dos planos TES.
-- Mantém Prices anteriores para histórico e permite que o Premium Plus
-- compartilhe um Product Stripe entre o Price público e o Price fundador.

alter table public.billing_plan_prices
  add column if not exists is_public boolean not null default true,
  add column if not exists offer_key text;

alter table public.billing_plan_prices
  drop constraint if exists billing_plan_prices_stripe_product_id_key;

alter table public.billing_plan_prices
  drop constraint if exists billing_plan_prices_offer_key_nonempty;

alter table public.billing_plan_prices
  add constraint billing_plan_prices_offer_key_nonempty check (
    offer_key is null or btrim(offer_key) <> ''
  );

drop index if exists public.billing_plan_prices_one_active_recurring_idx;
drop index if exists public.billing_plan_prices_one_active_public_cycle_idx;

create index if not exists billing_plan_prices_stripe_product_id_idx
  on public.billing_plan_prices (stripe_product_id)
  where stripe_product_id is not null;

create unique index if not exists billing_plan_prices_one_active_public_recurring_idx
  on public.billing_plan_prices (plan_id, currency, interval)
  where is_active and is_public and interval is not null;

create unique index if not exists billing_plan_prices_offer_key_idx
  on public.billing_plan_prices (offer_key)
  where offer_key is not null;

update public.billing_plan_prices
set is_active = false,
    is_public = false,
    metadata = metadata || jsonb_build_object(
      'retired_reason', 'monthly_launch_catalog',
      'retired_at', '2026-09-01T03:00:00Z'
    ),
    updated_at = now()
where stripe_lookup_key in (
  'tes_premium_brl_monthly_v1',
  'tes_premium_plus_brl_monthly_v1',
  'tes_premium_brl_6months_v1',
  'tes_premium_plus_brl_6months_v1'
);

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
  7990,
  'month',
  'tes_premium_brl_monthly_v2',
  true,
  true,
  '{"source":"monthly_launch_catalog"}'::jsonb
from public.billing_plans
where code = 'premium'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    interval = excluded.interval,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    offer_key = null,
    metadata = excluded.metadata,
    updated_at = now();

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
  12990,
  'month',
  'tes_premium_plus_brl_monthly_v2',
  true,
  true,
  '{"source":"monthly_launch_catalog"}'::jsonb
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
  7990,
  'month',
  'tes_premium_plus_founder_brl_monthly_v1',
  true,
  false,
  'therapist_founder',
  '{"source":"monthly_launch_offer","promotion_code":"TERAPEUTAFUNDADOR"}'::jsonb
from public.billing_plans
where code = 'premium_plus'
on conflict (stripe_lookup_key) do update
set unit_amount_cents = excluded.unit_amount_cents,
    interval = excluded.interval,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    offer_key = excluded.offer_key,
    metadata = excluded.metadata,
    updated_at = now();

drop policy if exists "Anyone can read active billing prices"
  on public.billing_plan_prices;
drop policy if exists "Anyone can read active public billing prices"
  on public.billing_plan_prices;

create policy "Anyone can read active public billing prices"
on public.billing_plan_prices
for select
using (is_active and is_public);

comment on column public.billing_plan_prices.is_public is
  'Controla se o Price pode aparecer no catálogo público; ofertas especiais ficam ocultas.';

comment on column public.billing_plan_prices.offer_key is
  'Chave server-side de oferta resolvida por metadata Stripe, nunca pelo navegador.';
