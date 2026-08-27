begin;

select plan(14);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where is_active and is_public and unit_amount_cents > 0),
  2,
  'the paid public catalog exposes exactly two monthly Prices'
);

select is(
  (select unit_amount_cents
   from public.billing_plan_prices prices
   join public.billing_plans plans on plans.id = prices.plan_id
   where plans.code = 'premium' and prices.is_active
     and prices.is_public and prices.interval = 'month'),
  7990,
  'Premium monthly costs R$ 79,90'
);

select is(
  (select unit_amount_cents
   from public.billing_plan_prices prices
   join public.billing_plans plans on plans.id = prices.plan_id
   where plans.code = 'premium_plus' and prices.is_active
     and prices.is_public and prices.interval = 'month'),
  12990,
  'Premium Plus monthly costs R$ 129,90'
);

select is(
  (select unit_amount_cents
   from public.billing_plan_prices prices
   join public.billing_plans plans on plans.id = prices.plan_id
   where plans.code = 'premium_plus' and prices.is_active
     and not prices.is_public and prices.offer_key = 'therapist_founder'
     and prices.interval = 'month'),
  7990,
  'founder recurring Premium Plus Price is R$ 79,90 monthly'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where is_active and offer_key = 'therapist_founder'),
  1,
  'the founder offer has one active hidden Price'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where is_active and interval is not null
     and (interval <> 'month' or stripe_lookup_key like '%6months%')),
  0,
  'there are no active non-monthly catalog offers'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where stripe_lookup_key in (
     'tes_premium_brl_monthly_v1',
     'tes_premium_plus_brl_monthly_v1'
   ) and (is_active or is_public)),
  0,
  'legacy monthly Prices are retained but inactive and private'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where stripe_lookup_key in (
     'tes_premium_brl_monthly_v1',
     'tes_premium_plus_brl_monthly_v1'
   )),
  2,
  'legacy monthly Price history is preserved'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'billing_plan_prices_one_active_public_recurring_idx'
  ),
  'public monthly Prices have an explicit uniqueness guard'
);

select is(
  (select qual from pg_policies
   where schemaname = 'public'
     and tablename = 'billing_plan_prices'
     and policyname = 'Anyone can read active public billing prices'),
  '(is_active AND is_public)',
  'public catalog policy excludes hidden offers'
);

set local role anon;

select is(
  (select count(*)::integer from public.billing_plan_prices
   where offer_key = 'therapist_founder'),
  0,
  'anon cannot read the hidden founder Price'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where is_active and is_public and unit_amount_cents > 0),
  2,
  'anon reads only the two public paid Prices'
);

reset role;
set local role authenticated;

select is(
  (select count(*)::integer from public.billing_plan_prices
   where offer_key = 'therapist_founder'),
  0,
  'authenticated users cannot read the hidden founder Price'
);

select is(
  (select count(*)::integer from public.billing_plan_prices
   where is_active and is_public and unit_amount_cents > 0),
  2,
  'authenticated users read only the two public paid Prices'
);

rollback;
