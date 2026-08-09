begin;

select plan(26);

select ok(
  to_regprocedure(
    'public.admin_get_finance_module_v1(text,integer,integer)'
  ) is not null,
  'admin finance module read model RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_finance_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin finance module read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_finance_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated role can invoke finance module RPC after admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_finance_module_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'service_role can invoke finance module RPC for server-side adapters'
);

select ok(
  to_regprocedure(
    'public.admin_get_finance_detail_v1(text,uuid)'
  ) is not null,
  'admin finance detail read model RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_finance_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin finance detail read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_finance_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  'authenticated role can invoke finance detail RPC after admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_finance_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  'service_role can invoke finance detail RPC for server-side adapters'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_finance_module_v1(''payments'')',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read horizontal finance data'
);

select throws_ok(
  'select public.admin_get_finance_detail_v1(''payments'', ''f6500000-0000-4000-8000-000000000001''::uuid)',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read finance details'
);

reset role;

create temporary table admin_finance_base as
select
  therapist_profiles.id as therapist_profile_id,
  therapist_profiles.user_id as therapist_user_id,
  patient_profiles.id as patient_profile_id,
  patient_profiles.user_id as patient_user_id,
  therapist_services.id as service_id,
  financial_policy_versions.id as policy_id
from public.therapist_profiles
join public.therapist_services
  on therapist_services.therapist_profile_id = therapist_profiles.id
cross join public.patient_profiles
cross join public.financial_policy_versions
where financial_policy_versions.is_active is true
limit 1;

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  meeting_provider,
  meeting_url
)
select
  'f6500000-0000-4000-8000-000000000001',
  patient_profile_id,
  therapist_profile_id,
  service_id,
  '2038-02-10T13:00:00Z',
  '2038-02-10T13:50:00Z',
  'America/Sao_Paulo',
  'completed',
  'paid',
  'zoom',
  'https://example.test/admin-finance-hidden'
from admin_finance_base;

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  stripe_balance_transaction_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  currency,
  financial_status,
  service_status,
  transfer_status,
  paid_at,
  stripe_event_created_at,
  metadata
)
select
  'f6500000-0000-4000-8000-000000000002',
  'f6500000-0000-4000-8000-000000000001',
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_id,
  'cs_admin_hidden',
  'pi_admin_hidden',
  'ch_admin_hidden',
  'txn_admin_hidden',
  17000,
  2000,
  3400,
  13600,
  'BRL',
  'paid',
  'confirmed_by_therapist',
  'eligible',
  now(),
  now(),
  '{"raw":"hidden-payment-metadata"}'::jsonb
from admin_finance_base;

update public.financial_ledger_entries
set stripe_event_id = 'evt_admin_hidden'
where session_payment_id = 'f6500000-0000-4000-8000-000000000002';

insert into public.stripe_customers (
  id,
  profile_id,
  therapist_profile_id,
  role,
  environment,
  stripe_customer_id,
  email,
  livemode,
  metadata
)
select
  'f6500000-0000-4000-8000-000000000003',
  therapist_user_id,
  therapist_profile_id,
  'therapist',
  'admin_test',
  'cus_admin_hidden',
  'hidden@example.test',
  false,
  '{"raw":"hidden-customer-metadata"}'::jsonb
from admin_finance_base;

insert into public.therapist_subscriptions (
  id,
  therapist_profile_id,
  stripe_customer_id,
  billing_plan_id,
  billing_plan_price_id,
  plan_code,
  status,
  stripe_subscription_id,
  stripe_checkout_session_id,
  stripe_latest_invoice_id,
  current_period_start,
  current_period_end,
  stripe_event_created_at,
  metadata
)
select
  'f6500000-0000-4000-8000-000000000004',
  admin_finance_base.therapist_profile_id,
  'f6500000-0000-4000-8000-000000000003',
  billing_plans.id,
  billing_plan_prices.id,
  'premium_plus',
  'canceled',
  'sub_admin_hidden',
  'cs_sub_admin_hidden',
  'in_admin_hidden',
  now() - interval '30 days',
  now(),
  now(),
  '{"raw":"hidden-subscription-metadata"}'::jsonb
from admin_finance_base
join public.billing_plans
  on billing_plans.code = 'premium_plus'::public.therapist_plan
join public.billing_plan_prices
  on billing_plan_prices.plan_id = billing_plans.id
  and billing_plan_prices.interval = 'month'::public.billing_interval
limit 1;

insert into public.billing_invoices (
  therapist_subscription_id,
  therapist_profile_id,
  stripe_invoice_id,
  stripe_customer_id,
  stripe_subscription_id,
  status,
  amount_due_cents,
  amount_paid_cents,
  hosted_invoice_url,
  invoice_pdf,
  paid_at,
  metadata
)
select
  'f6500000-0000-4000-8000-000000000004',
  therapist_profile_id,
  'in_admin_hidden',
  'cus_admin_hidden',
  'sub_admin_hidden',
  'paid',
  12000,
  12000,
  'https://invoice.example.test/hidden',
  'https://invoice.example.test/hidden.pdf',
  now(),
  '{"raw":"hidden-invoice-metadata"}'::jsonb
from admin_finance_base;

insert into public.therapist_subscription_events (
  therapist_subscription_id,
  therapist_profile_id,
  stripe_event_id,
  event_type,
  previous_plan,
  next_plan,
  previous_status,
  next_status,
  metadata
)
select
  'f6500000-0000-4000-8000-000000000004',
  therapist_profile_id,
  'evt_sub_admin_hidden',
  'customer.subscription.updated',
  'premium',
  'premium_plus',
  'active',
  'canceled',
  '{"raw":"hidden-event-metadata"}'::jsonb
from admin_finance_base;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  (
    public.admin_get_finance_module_v1('payments')
      -> 'metrics'
      ->> 'paid-session-payments'
  )::integer,
  (
    select count(*)::integer
    from public.session_payments
    where financial_status in ('paid', 'partially_refunded')
  ),
  'payments metric uses canonical session_payments statuses'
);

select ok(
  jsonb_array_length(public.admin_get_finance_module_v1('payments') -> 'rows') > 0,
  'payments list returns real rows for admin'
);

select ok(
  (
    public.admin_get_finance_module_v1('payments')
      -> 'rows'
      -> 0
  ) ? 'refund_count',
  'payments DTO includes aggregate refund count'
);

select is(
  public.admin_get_finance_module_v1('payments')::text like '%cs_admin_hidden%',
  false,
  'payments module DTO does not expose checkout session id'
);

select is(
  public.admin_get_finance_detail_v1(
    'payments',
    'f6500000-0000-4000-8000-000000000002'
  )::text like '%pi_admin_hidden%',
  false,
  'payment detail DTO does not expose payment intent id'
);

select is(
  (
    public.admin_get_finance_detail_v1(
      'payments',
      'f6500000-0000-4000-8000-000000000002'
    )
      -> 'record'
      ->> 'has_checkout_session'
  )::boolean,
  true,
  'payment detail exposes provider reference presence as boolean'
);

select is(
  public.admin_get_finance_detail_v1(
    'payments',
    'f6500000-0000-4000-8000-000000000002'
  )::text like '%evt_admin_hidden%',
  false,
  'payment detail events do not expose Stripe event id'
);

select is(
  (
    public.admin_get_finance_module_v1('subscriptions')
      -> 'metrics'
      ->> 'stripe-customers'
  )::integer,
  (
    select count(*)::integer
    from public.stripe_customers
    where role = 'therapist'
  ),
  'subscriptions metric uses canonical stripe_customers count'
);

select ok(
  jsonb_array_length(
    public.admin_get_finance_module_v1('subscriptions') -> 'rows'
  ) > 0,
  'subscriptions list returns real rows for admin'
);

select ok(
  (
    public.admin_get_finance_module_v1('subscriptions')
      -> 'rows'
      -> 0
  ) ? 'invoice_count',
  'subscriptions DTO includes aggregate invoice count'
);

select is(
  public.admin_get_finance_module_v1('subscriptions')::text like '%sub_admin_hidden%',
  false,
  'subscriptions module DTO does not expose Stripe subscription id'
);

select is(
  public.admin_get_finance_detail_v1(
    'subscriptions',
    'f6500000-0000-4000-8000-000000000004'
  )::text like '%cs_sub_admin_hidden%',
  false,
  'subscription detail DTO does not expose checkout session id'
);

select is(
  (
    public.admin_get_finance_detail_v1(
      'subscriptions',
      'f6500000-0000-4000-8000-000000000004'
    )
      -> 'record'
      ->> 'has_subscription_reference'
  )::boolean,
  true,
  'subscription detail exposes provider reference presence as boolean'
);

select is(
  public.admin_get_finance_detail_v1(
    'subscriptions',
    'f6500000-0000-4000-8000-000000000004'
  )::text like '%invoice.example.test%',
  false,
  'subscription detail does not expose invoice hosted URL or PDF'
);

select throws_ok(
  'select public.admin_get_finance_module_v1(''refunds'')',
  '22023',
  'unsupported admin finance module: refunds',
  'unsupported finance module fails closed'
);

select is(
  (
    public.admin_get_finance_detail_v1(
      'payments',
      'f6500000-0000-4000-8000-000000009999'
    )
    -> 'record'
  )::text,
  'null',
  'missing finance detail returns null record'
);

select * from finish();

rollback;
