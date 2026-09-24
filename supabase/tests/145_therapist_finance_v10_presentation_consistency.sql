begin;

select set_config('timezone', 'America/Sao_Paulo', true);
select plan(26);

select has_function(
  'public',
  'get_private_therapist_receipts_v5',
  array['date','date','text','uuid','text','integer','integer','text'],
  'receipts V5 is installed'
);
select has_function(
  'public',
  'get_private_therapist_financial_overview_v3',
  array['date','date','text'],
  'financial overview V3 is installed'
);
select has_function(
  'public',
  'get_private_therapist_financial_metrics_v2',
  array['date','date','text'],
  'F2 metrics V2 is installed'
);
select has_function(
  'public',
  'get_private_therapist_advanced_financial_dashboard_v2',
  array['date','date','text'],
  'Premium Plus dashboard V2 is installed'
);
select has_function(
  'public',
  'get_session_payment_charge_reconciliation_candidates_v2',
  array['integer'],
  'the reconciliation queue separates settlement from receipt repair'
);
select has_function(
  'public',
  'record_session_payment_receipt_url_v1',
  array['uuid','text','text'],
  'the receipt-only reconciliation command is installed'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_receipts_v5(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'authenticated therapists can call receipts V5'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_session_payment_charge_reconciliation_candidates_v2(integer)',
    'EXECUTE'
  ),
  'service role can read the constrained reconciliation queue'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_session_payment_charge_reconciliation_candidates_v2(integer)',
    'EXECUTE'
  ),
  'browser roles cannot read the reconciliation queue'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.record_session_payment_receipt_url_v1(uuid,text,text)',
    'EXECUTE'
  ),
  'service role can fill a missing receipt URL'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_session_payment_receipt_url_v1(uuid,text,text)',
    'EXECUTE'
  ),
  'browser roles cannot invoke receipt repair'
);

update public.session_payments
set stripe_charge_id = 'ch_test_receipt_repair_145'
where booking_id = 'f2000000-0000-4000-8000-000000000006';

insert into public.booking_payment_receipts (
  booking_id, amount_cents, currency, provider, receipt_url, paid_at
)
select
  payment.booking_id,
  payment.gross_amount_cents,
  payment.currency,
  'stripe',
  null,
  payment.paid_at
from public.session_payments as payment
where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
on conflict (booking_id) do update
set receipt_url = null,
    updated_at = now();

select is(
  (
    select candidate.stripe_charge_id
    from public.get_session_payment_charge_reconciliation_candidates_v2(500)
      as candidate
    where candidate.id = (
      select payment.id
      from public.session_payments as payment
      where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
    )
  ),
  'ch_test_receipt_repair_145',
  'a successful payment with a null receipt is queued by its immutable Charge id'
);
select is(
  (
    select candidate.needs_settlement
    from public.get_session_payment_charge_reconciliation_candidates_v2(500)
      as candidate
    where candidate.id = (
      select payment.id
      from public.session_payments as payment
      where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
    )
  ),
  false,
  'a settled refunded payment never re-enters financial settlement'
);
select is(
  (
    select candidate.needs_receipt
    from public.get_session_payment_charge_reconciliation_candidates_v2(500)
      as candidate
    where candidate.id = (
      select payment.id
      from public.session_payments as payment
      where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
    )
  ),
  true,
  'the same payment is queued only for receipt enrichment'
);

create temporary table receipt_repair_payment_before as
select id, financial_status::text, transfer_status::text
from public.session_payments
where booking_id = 'f2000000-0000-4000-8000-000000000006';

set local role service_role;
select is(
  public.record_session_payment_receipt_url_v1(
    (
      select payment.id
      from public.session_payments as payment
      where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
    ),
    'ch_test_receipt_repair_145',
    'https://pay.stripe.com/receipts/test-repair-145'
  ) ->> 'receiptRecorded',
  'true',
  'service-role receipt repair records the missing Stripe URL'
);
reset role;

select is(
  (
    select receipt.receipt_url
    from public.booking_payment_receipts as receipt
    where receipt.booking_id = 'f2000000-0000-4000-8000-000000000006'
  ),
  'https://pay.stripe.com/receipts/test-repair-145',
  'receipt repair fills the presentation record'
);
select is(
  (
    select row(payment.financial_status::text, payment.transfer_status::text)::text
    from public.session_payments as payment
    where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
  ),
  (
    select row(financial_status, transfer_status)::text
    from receipt_repair_payment_before
  ),
  'receipt repair leaves financial and transfer states unchanged'
);
select ok(
  not exists (
    select 1
    from public.get_session_payment_charge_reconciliation_candidates_v2(500)
      as candidate
    where candidate.id = (
      select payment.id
      from public.session_payments as payment
      where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
    )
  ),
  'a filled receipt leaves the receipt-only queue'
);

select is(
  (
    select public.private_therapist_finance_realized_net_cents_v2(payment)
    from public.session_payments as payment
    where payment.booking_id = 'f2000000-0000-4000-8000-000000000006'
  ),
  0,
  'a fully refunded payment contributes zero realized therapist revenue'
);

create temporary table expected_v10_finance_metrics as
select
  count(*)::integer as paid_session_count,
  coalesce(sum(
    public.private_therapist_finance_realized_net_cents_v2(payment)
  ), 0)::integer as therapist_net_cents
from public.session_payments as payment
where payment.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
  and (coalesce(payment.paid_at, payment.created_at) at time zone
    'America/Sao_Paulo')::date between current_date - 29 and current_date;
grant select on expected_v10_finance_metrics to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  public.get_private_therapist_financial_overview_v3(
    current_date - 29, current_date, 'America/Sao_Paulo'
  ) ->> 'contractVersion',
  '3',
  'overview publishes the corrected V3 contract'
);
select is(
  public.get_private_therapist_financial_metrics_v2(
    current_date - 29, current_date, 'America/Sao_Paulo'
  ) ->> 'contractVersion',
  '2',
  'F2 publishes the corrected V2 contract'
);
select is(
  public.get_private_therapist_financial_metrics_v2(
    current_date - 29, current_date, 'America/Sao_Paulo'
  ) ->> 'metricDefinitionVersion',
  '2',
  'the metric definition change is explicit'
);
select is(
  (
    public.get_private_therapist_financial_metrics_v2(
      current_date - 29, current_date, 'America/Sao_Paulo'
    ) #>> '{revenue,paidSessionCount}'
  )::integer,
  (select paid_session_count from expected_v10_finance_metrics),
  'Sessões pagas excludes fully refunded payments without changing the label'
);
select is(
  (
    public.get_private_therapist_financial_metrics_v2(
      current_date - 29, current_date, 'America/Sao_Paulo'
    ) #>> '{revenue,therapistNetCents}'
  )::integer,
  (select therapist_net_cents from expected_v10_finance_metrics),
  'realized therapist revenue equals the non-negative session contributions'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_private_therapist_financial_metrics_v2(
        current_date - 29, current_date, 'America/Sao_Paulo'
      ) -> 'revenueByTherapy'
    ) as item
    where (item ->> 'therapistNetAmountCents')::integer < 0
  ),
  'therapy ranking never exposes negative realized revenue'
);
select is(
  public.get_private_therapist_advanced_financial_dashboard_v2(
    current_date - 29, current_date, 'America/Sao_Paulo'
  ) ->> 'contractVersion',
  '2',
  'Premium Plus publishes the corrected V2 contract'
);

reset role;
select * from finish();
rollback;
