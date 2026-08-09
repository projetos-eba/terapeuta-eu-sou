begin;

select plan(11);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_config'
  ),
  '{security_invoker=true}',
  'public_matching_config runs as security invoker'
);

select ok(
  has_table_privilege('anon', 'public.matching_versions', 'SELECT'),
  'anon can select matching_versions base table'
);

select ok(
  has_table_privilege('anon', 'public.matching_themes', 'SELECT'),
  'anon can select matching_themes base table'
);

select ok(
  has_table_privilege('anon', 'public.matching_interests', 'SELECT'),
  'anon can select matching_interests base table'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'matching_versions'
      and roles && array['anon']::name[]
      and cmd = 'SELECT'
      and qual like '%published%'
  $$,
  $$ values (true) $$,
  'matching_versions has anon published-only RLS'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'matching_themes'
      and roles && array['anon']::name[]
      and cmd = 'SELECT'
      and qual like '%is_active%'
  $$,
  $$ values (true) $$,
  'matching_themes has anon active-only RLS'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'matching_interests'
      and roles && array['anon']::name[]
      and cmd = 'SELECT'
      and qual like '%is_active%'
  $$,
  $$ values (true) $$,
  'matching_interests has anon active-only RLS'
);

set local role anon;

select isnt_empty(
  $$
    select version_id, theme_id, theme_slug
    from public.public_matching_config
    limit 1
  $$,
  'anon can still read public matching config'
);

select is_empty(
  $$
    select 1
    from public.public_matching_config
    where theme_slug is null
       or theme_name is null
       or version_id is null
  $$,
  'public matching config keeps required public identifiers'
);

select is_empty(
  $$
    select 1
    from public.public_matching_config
    where interest_slug is not null
      and interest_name is null
  $$,
  'public matching config does not expose dangling active interests'
);

reset role;

select is_empty(
  $$
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_config'
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = any(array[
        'weight',
        'score',
        'metadata',
        'created_by_user_id',
        'updated_by_user_id'
      ])
  $$,
  'public matching config does not expose internal scoring or actor columns'
);

select * from finish();

rollback;
