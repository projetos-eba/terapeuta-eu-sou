begin;

select plan(8);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    public.admin_get_finance_module_v2(
      'subscriptions', '{"page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,paid-subscriptions}'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_profiles
    where plan in ('premium'::public.therapist_plan, 'premium_plus'::public.therapist_plan)
  ),
  'paid subscription metric uses the current paid plans'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'subscriptions', '{"page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,free-therapists}'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_profiles
    where plan = 'free'::public.therapist_plan
  ),
  'Free metric uses the current profile plan'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'subscriptions', '{"page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,premium-therapists}'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_profiles
    where plan = 'premium'::public.therapist_plan
  ),
  'Premium metric uses the current profile plan'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'subscriptions', '{"page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,premium-plus-therapists}'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_profiles
    where plan = 'premium_plus'::public.therapist_plan
  ),
  'Premium Plus metric uses the current profile plan'
);

select is(
  (
    public.admin_get_finance_module_v2(
      'subscriptions', '{"page":1,"pageSize":12}'::jsonb
    ) #>> '{metrics,canceled-subscriptions}'
  )::integer,
  (
    select count(*)::integer
    from public.therapist_subscriptions
    where status = 'canceled'::public.billing_subscription_status
  ),
  'canceled metric preserves the canonical subscription status'
);

select is(
  public.admin_get_finance_module_v2(
    'subscriptions', '{"plan":"premium","period":"30d","page":1,"pageSize":12}'::jsonb
  ) #>> '{filtersApplied,plan}',
  'premium',
  'subscription plan filter is applied by the read model'
);

select is(
  public.admin_get_finance_module_v2(
    'subscriptions', '{"plan":"premium","period":"30d","page":1,"pageSize":12}'::jsonb
  ) #>> '{filtersApplied,period}',
  '30d',
  'subscription period filter is applied by the read model'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.private_admin_finance_v2_before_subscription_dashboard_20260927(text,jsonb)',
    'EXECUTE'
  ),
  'the preserved subscription dashboard implementation remains private'
);

reset role;
select * from finish();
rollback;
