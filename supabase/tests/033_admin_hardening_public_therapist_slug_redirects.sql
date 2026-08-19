begin;

select plan(19);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_slug_redirects_v'
  ),
  '{security_invoker=true}',
  'public_therapist_slug_redirects_v runs as security invoker'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_slug_history',
    'old_slug',
    'SELECT'
  ),
  'anon cannot select old_slug from therapist_profile_slug_history'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_slug_history',
    'current_slug',
    'SELECT'
  ),
  'anon cannot select current_slug from therapist_profile_slug_history'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_slug_history',
    'therapist_profile_id',
    'SELECT'
  ),
  'anon cannot select internal therapist_profile_id from therapist_profile_slug_history'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_slug_history',
    'id',
    'SELECT'
  ),
  'anon cannot select internal id from therapist_profile_slug_history'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_profile_slug_history'
      and policyname = 'Public can read approved therapist slug redirects'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapist_profile_slug_history has explicit public redirect RLS'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_profiles'
      and policyname = 'Public can read approved public therapist profile gates'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapist_profiles has explicit public gate RLS for redirect policy'
);

select ok(
  has_column_privilege('anon', 'public.therapist_profiles', 'id', 'SELECT'),
  'anon can select profile id needed by the redirect policy'
);

select ok(
  has_column_privilege('anon', 'public.therapist_profiles', 'status', 'SELECT'),
  'anon can select profile status needed by the redirect policy'
);

select ok(
  has_column_privilege('anon', 'public.therapist_profiles', 'is_public', 'SELECT'),
  'anon can select public profile flag needed by the redirect policy'
);

insert into public.therapist_profile_slug_history (
  therapist_profile_id,
  old_slug,
  current_slug
)
values (
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'hardening-old-therapist-slug',
  'ana-oliveira'
)
on conflict (old_slug) do update
set current_slug = excluded.current_slug,
    therapist_profile_id = excluded.therapist_profile_id;

set local role anon;

select results_eq(
  $$
    select old_slug, current_slug
    from public.public_therapist_slug_redirects_v
    where old_slug = 'hardening-old-therapist-slug'
  $$,
  $$ values ('hardening-old-therapist-slug'::text, 'ana-oliveira'::text) $$,
  'anon can read an approved public therapist redirect through the view'
);

select throws_ok(
  $$
    select old_slug, current_slug
    from public.therapist_profile_slug_history
    where old_slug = 'hardening-old-therapist-slug'
  $$,
  '42501',
  null,
  'anon cannot read a redirect through the private base table'
);

select throws_ok(
  $$
    select therapist_profile_id
    from public.therapist_profile_slug_history
    where old_slug = 'hardening-old-therapist-slug'
  $$,
  '42501',
  null,
  'anon cannot read internal profile IDs directly from the base table'
);

reset role;

select is_empty(
  $$
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_slug_redirects_v'
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = any(array[
        'id',
        'therapist_profile_id',
        'created_at'
      ])
  $$,
  'public therapist slug redirects do not expose internal IDs or timestamps'
);

select results_eq(
  $$
    select array_agg(a.attname order by a.attnum)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_slug_redirects_v'
      and a.attnum > 0
      and not a.attisdropped
  $$,
  $$ values (array['old_slug', 'current_slug']::name[]) $$,
  'public therapist slug redirects expose only the expected DTO columns'
);

select ok(
  has_table_privilege(
    'anon',
    'public.public_therapist_slug_redirects_v',
    'SELECT'
  ),
  'anon keeps SELECT on public_therapist_slug_redirects_v'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.public_therapist_slug_redirects_v',
    'SELECT'
  ),
  'authenticated keeps SELECT on public_therapist_slug_redirects_v'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.public_therapist_slug_redirects_v',
    'SELECT'
  ),
  'service_role keeps SELECT on public_therapist_slug_redirects_v'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.therapist_profile_slug_history',
    'current_slug',
    'SELECT'
  ),
  'authenticated cannot select current_slug from therapist_profile_slug_history'
);

select * from finish();

rollback;
