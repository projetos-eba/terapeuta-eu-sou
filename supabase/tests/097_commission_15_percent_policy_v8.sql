begin;

select plan(12);

select is(
  (
    select pg_get_expr(attribute_default.adbin, attribute_default.adrelid)
    from pg_attrdef as attribute_default
    join pg_attribute as attribute
      on attribute.attrelid = attribute_default.adrelid
      and attribute.attnum = attribute_default.adnum
    where attribute_default.adrelid = 'public.financial_policy_versions'::regclass
      and attribute.attname = 'platform_commission_bps'
  ),
  '1500',
  'financial policy default commission is 15 percent'
);

select is(
  (
    select version
    from public.financial_policy_versions
    where is_active
  ),
  'tes-payments-v8-commission-15-percent',
  'V8 is the active financial policy'
);

select is(
  (
    select platform_commission_bps
    from public.financial_policy_versions
    where is_active
  ),
  1500,
  'active policy retains 1500 basis points'
);

select is(
  (
    select count(*)::integer
    from public.financial_policy_versions
    where is_active
  ),
  1,
  'exactly one financial policy is active'
);

select is(
  (
    select platform_commission_bps
    from public.financial_policy_versions
    where version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout'
  ),
  2000,
  'V7 retains its historical 20 percent commission snapshot'
);

select ok(
  (
    select effective_until is not null
    from public.financial_policy_versions
    where version = 'tes-payments-v7-bilateral-weekly-transfer-daily-payout'
  ),
  'V7 is closed instead of being overwritten'
);

select is(
  (
    select platform_commission_bps
    from public.calculate_session_payment_snapshot(20000)
  ),
  1500,
  'default snapshot calculation uses 15 percent'
);

select is(
  (
    select platform_gross_commission_cents
    from public.calculate_session_payment_snapshot(20000)
  ),
  3000,
  'R$ 200 session retains R$ 30 for TES'
);

select is(
  (
    select therapist_amount_cents
    from public.calculate_session_payment_snapshot(20000)
  ),
  17000,
  'R$ 200 session pays R$ 170 to therapist'
);

select is(
  (
    select platform_gross_commission_cents
    from public.calculate_session_payment_snapshot(16000)
  ),
  2400,
  'discounted R$ 160 charge applies 15 percent to the effective amount'
);

select is(
  (
    select therapist_amount_cents
    from public.calculate_session_payment_snapshot(10001)
  ),
  8500,
  'therapist amount keeps floor rounding at 85 percent'
);

select is(
  (
    select platform_gross_commission_cents
    from public.calculate_session_payment_snapshot(10001)
  ),
  1501,
  'TES receives only the integer remainder from fractional rounding'
);

select * from finish();

rollback;
