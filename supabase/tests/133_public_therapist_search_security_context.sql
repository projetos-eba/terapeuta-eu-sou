begin;

select plan(5);

select is(
  (
    select coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_search_internal'
  ),
  false,
  'catalog implementation keeps the protected projection owner context'
);

select is(
  (
    select coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_search'
  ),
  false,
  'public catalog projection keeps its deliberate definer boundary'
);

select is(
  has_table_privilege('anon', 'public.public_therapist_search', 'SELECT'),
  true,
  'anonymous visitors can read the public catalog projection'
);

select is(
  has_table_privilege('anon', 'public.public_therapist_search_internal', 'SELECT'),
  false,
  'anonymous visitors cannot read the catalog implementation directly'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select lives_ok(
  $$ select count(*) from public.public_therapist_search $$,
  'anonymous catalog query runs through the safe public projection'
);

reset role;

select * from finish();
rollback;
