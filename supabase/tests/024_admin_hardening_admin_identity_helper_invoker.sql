begin;

select plan(8);

select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_current_admin'
      and pg_get_function_identity_arguments(p.oid) = ''
  ),
  false,
  'is_current_admin runs as security invoker'
);

select ok(
  has_function_privilege('authenticated', 'public.is_current_admin()', 'EXECUTE'),
  'authenticated can still execute is_current_admin for RLS policies'
);

select ok(
  has_function_privilege('service_role', 'public.is_current_admin()', 'EXECUTE'),
  'service_role keeps execute on is_current_admin'
);

select is(
  has_function_privilege('anon', 'public.is_current_admin()', 'EXECUTE'),
  false,
  'anon cannot execute is_current_admin'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.is_current_admin(),
  true,
  'admin caller resolves as admin through security invoker helper'
);

select isnt_empty(
  $$
    select 1
    from public.matching_therapy_settings
    limit 1
  $$,
  'admin policies depending on is_current_admin still allow admin reads'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.is_current_admin(),
  false,
  'therapist caller does not resolve as admin'
);

select isnt_empty(
  $$
    select 1
    from public.matching_therapy_settings
    where is_visible_in_matching = true
    limit 1
  $$,
  'non-admin caller can read public visible matching settings'
);

select * from finish();

rollback;
