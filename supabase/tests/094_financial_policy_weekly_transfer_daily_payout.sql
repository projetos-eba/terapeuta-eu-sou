begin;

select plan(10);

select is(
  (select count(*)::integer from public.financial_policy_versions where is_active),
  1,
  'exactly one financial policy is active'
);

select is(
  (select version from public.financial_policy_versions where is_active),
  'tes-payments-v8-commission-15-percent',
  'the current bilateral weekly payout policy is active'
);

select is(
  (select weekly_batch_weekday from public.financial_policy_versions where is_active),
  2,
  'weekly Transfer remains scheduled for Tuesday'
);

select is(
  (select weekly_batch_time from public.financial_policy_versions where is_active),
  time '02:00',
  'weekly Transfer starts at 02:00 local time'
);

select is(
  (select timezone from public.financial_policy_versions where is_active),
  'America/Sao_Paulo',
  'weekly Transfer uses the canonical business timezone'
);

select is(
  (select payout_batch_rule from public.financial_policy_versions where is_active),
  'weekly_transfer_daily_automatic_payout',
  'TES weekly Transfer and Stripe daily automatic Payout are explicit'
);

select is(
  (select patient_auto_confirmation_days from public.financial_policy_versions where is_active),
  7,
  'patient automatic confirmation remains seven days'
);

select is(
  (select therapist_auto_confirmation_days from public.financial_policy_versions where is_active),
  30,
  'therapist automatic confirmation remains thirty days'
);

select is(
  (select transfer_safety_period_days from public.financial_policy_versions where is_active),
  1,
  'the full transfer safety day remains preserved'
);

select is(
  (select metadata->>'payoutAttribution' from public.financial_policy_versions where is_active),
  'balance_transactions',
  'Payout attribution remains based on Balance Transactions'
);

select * from finish();
rollback;
