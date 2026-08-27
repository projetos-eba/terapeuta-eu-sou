begin;

select plan(8);

select is(
  (select count(*)::integer from public.financial_policy_versions where is_active),
  1,
  'exactly one cancellation policy is active'
);
select is(
  (select version from public.financial_policy_versions where is_active),
  'tes-payments-v6-bilateral-7d-30d',
  'the bilateral operational policy is active for open future payments'
);
select is(
  (select free_cancellation_hours from public.financial_policy_versions where is_active),
  24,
  'the free cancellation window remains 24 hours'
);
select is(
  (select late_cancellation_retention_bps from public.financial_policy_versions where is_active),
  10000,
  'late cancellation has no automatic refund obligation'
);
select is(
  (select no_show_retention_bps from public.financial_policy_versions where is_active),
  10000,
  'no-show has no automatic refund obligation'
);
select is(
  (select refund_processing_business_days from public.financial_policy_versions where is_active),
  7,
  'approved refunds start processing within seven business days'
);
select is(
  (select cancellation_policy_key from public.financial_policy_versions where is_active),
  'free_until_24h_late_no_refund_no_show_no_refund',
  'the cancellation policy key describes the operational rule'
);
select is(
  (
    select metadata->>'operationalPolicySource'
    from public.financial_policy_versions
    where is_active
  ),
  'POLÍTICA DE CANCELAMENTO - OPERACIONAL.docx',
  'the operational source is recorded in policy metadata'
);

select * from finish();
rollback;
