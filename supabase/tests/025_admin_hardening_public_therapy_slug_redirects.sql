begin;

select plan(10);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapy_slug_redirects_v'
  ),
  '{security_invoker=true}',
  'public_therapy_slug_redirects_v runs as security invoker'
);

select ok(
  has_table_privilege('anon', 'public.therapy_slug_redirects', 'SELECT'),
  'anon can select the therapy_slug_redirects base table'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapy_slug_redirects'
      and roles && array['anon']::name[]
      and cmd = 'SELECT'
      and qual = 'true'
  $$,
  $$ values (true) $$,
  'therapy_slug_redirects has explicit public read RLS'
);

insert into public.therapy_slug_redirects (
  old_slug,
  current_slug,
  therapy_id,
  created_by_profile_id
)
select
  'hardening-old-therapy-slug',
  therapies.slug,
  therapies.id,
  'aaaaaaaa-0000-4000-8000-000000000090'::uuid
from public.therapies
where therapies.slug = 'reiki'
on conflict (old_slug) do update
set current_slug = excluded.current_slug,
    therapy_id = excluded.therapy_id,
    created_by_profile_id = excluded.created_by_profile_id;

set local role anon;

select results_eq(
  $$
    select old_slug, current_slug
    from public.public_therapy_slug_redirects_v
    where old_slug = 'hardening-old-therapy-slug'
  $$,
  $$ values ('hardening-old-therapy-slug'::text, 'reiki'::text) $$,
  'anon can read a public therapy slug redirect through the view'
);

select results_eq(
  $$
    select old_slug, current_slug
    from public.therapy_slug_redirects
    where old_slug = 'hardening-old-therapy-slug'
  $$,
  $$ values ('hardening-old-therapy-slug'::text, 'reiki'::text) $$,
  'anon can read the same redirect through explicit base-table RLS'
);

reset role;

select is_empty(
  $$
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapy_slug_redirects_v'
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = any(array[
        'id',
        'created_by_profile_id',
        'updated_by_profile_id',
        'metadata'
      ])
  $$,
  'public therapy slug redirects do not expose internal actor or metadata columns'
);

select results_eq(
  $$
    select array_agg(a.attname order by a.attnum)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapy_slug_redirects_v'
      and a.attnum > 0
      and not a.attisdropped
  $$,
  $$ values (array['old_slug', 'current_slug', 'therapy_id', 'created_at']::name[]) $$,
  'public therapy slug redirects expose only the expected DTO columns'
);

select ok(
  has_table_privilege('anon', 'public.public_therapy_slug_redirects_v', 'SELECT'),
  'anon keeps SELECT on public_therapy_slug_redirects_v'
);

select ok(
  has_table_privilege('authenticated', 'public.public_therapy_slug_redirects_v', 'SELECT'),
  'authenticated keeps SELECT on public_therapy_slug_redirects_v'
);

select ok(
  has_table_privilege('service_role', 'public.public_therapy_slug_redirects_v', 'SELECT'),
  'service_role keeps SELECT on public_therapy_slug_redirects_v'
);

select * from finish();

rollback;
