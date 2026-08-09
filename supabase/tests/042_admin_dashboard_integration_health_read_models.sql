begin;

select plan(28);

select ok(
  to_regprocedure('public.admin_get_dashboard_v1()') is not null,
  'admin dashboard read model RPC exists'
);

select is(
  has_function_privilege('anon', 'public.admin_get_dashboard_v1()', 'EXECUTE'),
  false,
  'anon cannot execute admin dashboard read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_dashboard_v1()',
    'EXECUTE'
  ),
  'authenticated role can invoke dashboard RPC after admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_dashboard_v1()',
    'EXECUTE'
  ),
  'service_role can invoke dashboard RPC for server-side adapters'
);

select ok(
  to_regprocedure('public.admin_get_integration_health_v1()') is not null,
  'admin integration health read model RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_integration_health_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute admin integration health read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_integration_health_v1()',
    'EXECUTE'
  ),
  'authenticated role can invoke integration health RPC after admin validation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_integration_health_v1()',
    'EXECUTE'
  ),
  'service_role can invoke integration health RPC for server-side adapters'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_dashboard_v1()',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read dashboard aggregates'
);

select throws_ok(
  'select public.admin_get_integration_health_v1()',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read integration health'
);

reset role;

insert into public.stripe_webhook_events (
  stripe_event_id,
  event_type,
  account_id,
  processing_status,
  payload_sha256,
  payload_sanitized,
  error_code,
  error_message
)
values (
  'evt_admin_dashboard_hidden',
  'checkout.session.completed',
  'acct_admin_dashboard_hidden',
  'failed',
  'payload-hash-admin-dashboard-hidden',
  '{"secret":"hidden-stripe-payload"}'::jsonb,
  'webhook_failed',
  'hidden stripe error'
)
on conflict (stripe_event_id) do nothing;

insert into public.admin_audit_events (
  actor_user_id,
  actor_role,
  permission,
  action,
  entity_type,
  entity_id,
  previous_state,
  next_state,
  reason,
  request_id,
  correlation_id,
  source
)
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  'admin',
  'admin.therapies.manage',
  'therapy_published',
  'therapy',
  'therapy-admin-dashboard-hidden',
  '{"secret":"hidden-before"}'::jsonb,
  '{"secret":"hidden-after"}'::jsonb,
  'Evento sanitizado para dashboard.',
  'admin-dashboard-hidden-request',
  'admin-dashboard-hidden-correlation',
  'therapy_catalog_events'
)
on conflict do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  (
    public.admin_get_dashboard_v1()
      -> 'metrics'
      ->> 'active-therapists'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_profiles
    where status = 'approved'
  ),
  'dashboard active therapist metric uses canonical therapist_profiles'
);

select is(
  (
    public.admin_get_dashboard_v1()
      -> 'metrics'
      ->> 'published-therapies'
  )::integer,
  (
    select count(*)::integer
    from public.therapies
    where status::text in ('active', 'published')
      and is_public_visible is true
  ),
  'dashboard published therapies metric uses canonical catalog state'
);

select is(
  (
    public.admin_get_dashboard_v1()
      -> 'metrics'
      ->> 'pending-session-payments'
  )::integer,
  (
    select count(*)::integer
    from public.session_payments
    where financial_status::text in ('pending', 'processing')
  ),
  'dashboard pending payment metric uses canonical session_payments'
);

select is(
  (
    public.admin_get_dashboard_v1()
      -> 'metrics'
      ->> 'failed-webhooks'
  )::integer,
  (
    select count(*)::integer
    from public.stripe_webhook_events
    where processing_status::text = 'failed'
  ),
  'dashboard failed webhook metric uses canonical Stripe webhook events'
);

select ok(
  jsonb_array_length(public.admin_get_dashboard_v1() -> 'events') > 0,
  'dashboard returns sanitized admin audit events'
);

select ok(
  (
    public.admin_get_dashboard_v1()
      -> 'events'
      -> 0
  ) ? 'eventType',
  'dashboard event includes action as event type'
);

select is(
  public.admin_get_dashboard_v1()::text like '%hidden-before%',
  false,
  'dashboard DTO does not expose previous admin audit state'
);

select is(
  public.admin_get_dashboard_v1()::text like '%hidden-after%',
  false,
  'dashboard DTO does not expose next admin audit state'
);

select is(
  public.admin_get_dashboard_v1()::text like '%evt_admin_dashboard_hidden%',
  false,
  'dashboard DTO does not expose Stripe event id'
);

select is(
  public.admin_get_dashboard_v1()::text like '%acct_admin_dashboard_hidden%',
  false,
  'dashboard DTO does not expose Stripe account id'
);

select is(
  public.admin_get_dashboard_v1()::text like '%hidden-stripe-payload%',
  false,
  'dashboard DTO does not expose Stripe payload content'
);

select is(
  (
    public.admin_get_integration_health_v1()
      -> 'signals'
      ->> 'failed-stripe-webhooks'
  )::integer,
  (
    select count(*)::integer
    from public.stripe_webhook_events
    where processing_status::text = 'failed'
  ),
  'integration health failed Stripe metric uses canonical webhook events'
);

select is(
  (
    public.admin_get_integration_health_v1()
      -> 'signals'
      ->> 'attention-subscriptions'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_subscriptions
    where status::text in ('past_due', 'unpaid', 'incomplete')
  ),
  'integration health subscription attention metric uses canonical subscriptions'
);

select is(
  (
    public.admin_get_integration_health_v1()
      -> 'signals'
      ->> 'restricted-connect-accounts'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_connect_accounts
    where operational_status <> 'active'
  ),
  'integration health Connect metric uses canonical Connect accounts'
);

select ok(
  public.admin_get_integration_health_v1() ? 'last',
  'integration health includes provider last-seen timestamps'
);

select is(
  public.admin_get_integration_health_v1()::text like '%evt_admin_dashboard_hidden%',
  false,
  'integration health DTO does not expose Stripe event id'
);

select is(
  public.admin_get_integration_health_v1()::text like '%acct_admin_dashboard_hidden%',
  false,
  'integration health DTO does not expose Stripe account id'
);

select is(
  public.admin_get_integration_health_v1()::text like '%hidden-stripe-payload%',
  false,
  'integration health DTO does not expose Stripe payload content'
);

select * from finish();

rollback;
