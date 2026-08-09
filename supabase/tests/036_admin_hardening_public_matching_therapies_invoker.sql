begin;

select plan(18);

insert into public.therapies (
  id,
  category_id,
  name,
  slug,
  short_description,
  description,
  status,
  is_public_visible,
  published_at,
  archived_at
)
select
  fixture.id,
  category.id,
  fixture.name,
  fixture.slug,
  'Fixture publica para Match.',
  'Conteudo publico temporario sem promessa de resultado.',
  fixture.status::public.therapy_status,
  fixture.is_public_visible,
  case when fixture.status = 'published' then now() else null end,
  fixture.archived_at
from (
  values
    (
      'e0000000-0000-4000-8000-000000000001'::uuid,
      'matching-therapy-public-candidate',
      'Matching Therapy Public Candidate',
      'published',
      true,
      null::timestamptz
    ),
    (
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'matching-therapy-disabled-candidate',
      'Matching Therapy Disabled Candidate',
      'published',
      true,
      null::timestamptz
    ),
    (
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'matching-therapy-draft-candidate',
      'Matching Therapy Draft Candidate',
      'draft',
      true,
      null::timestamptz
    ),
    (
      'e0000000-0000-4000-8000-000000000004'::uuid,
      'matching-therapy-hidden-candidate',
      'Matching Therapy Hidden Candidate',
      'published',
      false,
      null::timestamptz
    ),
    (
      'e0000000-0000-4000-8000-000000000005'::uuid,
      'matching-therapy-archived-candidate',
      'Matching Therapy Archived Candidate',
      'published',
      true,
      now()
    )
) as fixture(id, slug, name, status, is_public_visible, archived_at)
cross join lateral (
  select id
  from public.therapy_categories
  order by sort_order, name
  limit 1
) as category;

insert into public.matching_therapy_settings (
  therapy_id,
  is_visible_in_matching
)
values
  ('e0000000-0000-4000-8000-000000000001'::uuid, true),
  ('e0000000-0000-4000-8000-000000000002'::uuid, false),
  ('e0000000-0000-4000-8000-000000000003'::uuid, true),
  ('e0000000-0000-4000-8000-000000000004'::uuid, true),
  ('e0000000-0000-4000-8000-000000000005'::uuid, true);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_therapies_v'
  ),
  '{security_invoker=true}',
  'public_matching_therapies_v runs as security invoker'
);

select ok(
  has_table_privilege('anon', 'public.public_matching_therapies_v', 'SELECT'),
  'anon can select public_matching_therapies_v'
);

select ok(
  has_table_privilege('authenticated', 'public.public_matching_therapies_v', 'SELECT'),
  'authenticated can select public_matching_therapies_v'
);

select ok(
  has_table_privilege('service_role', 'public.public_matching_therapies_v', 'SELECT'),
  'service_role can select public_matching_therapies_v'
);

select ok(
  not has_table_privilege('anon', 'public.public_matching_therapies_v', 'TRUNCATE'),
  'anon cannot truncate public_matching_therapies_v'
);

select ok(
  not has_table_privilege('anon', 'public.public_matching_therapies_v', 'REFERENCES'),
  'anon cannot reference public_matching_therapies_v'
);

select results_eq(
  $$
    select id, slug, status, is_visible_in_matching
    from public.public_matching_therapies_v
    where id = 'e0000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'e0000000-0000-4000-8000-000000000001'::uuid,
    'matching-therapy-public-candidate'::text,
    'published'::public.therapy_status,
    true
  ) $$,
  'public_matching_therapies_v exposes published visible therapy enabled for Match'
);

select is_empty(
  $$
    select 1
    from public.public_matching_therapies_v
    where id in (
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'e0000000-0000-4000-8000-000000000004'::uuid,
      'e0000000-0000-4000-8000-000000000005'::uuid
    )
  $$,
  'public_matching_therapies_v hides disabled, draft, hidden and archived therapies'
);

set local role anon;

select results_eq(
  $$
    select id, slug
    from public.public_matching_therapies_v
    where id = 'e0000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'e0000000-0000-4000-8000-000000000001'::uuid,
    'matching-therapy-public-candidate'::text
  ) $$,
  'anon can read the matching therapy DTO through security invoker view'
);

select results_eq(
  $$
    select therapy_id, is_visible_in_matching
    from public.matching_therapy_settings
    where therapy_id = 'e0000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'e0000000-0000-4000-8000-000000000001'::uuid,
    true
  ) $$,
  'anon direct matching settings read is limited to granted public columns'
);

select is_empty(
  $$
    select therapy_id
    from public.matching_therapy_settings
    where therapy_id in (
      'e0000000-0000-4000-8000-000000000002'::uuid,
      'e0000000-0000-4000-8000-000000000003'::uuid,
      'e0000000-0000-4000-8000-000000000004'::uuid,
      'e0000000-0000-4000-8000-000000000005'::uuid
    )
  $$,
  'anon direct matching settings reads are RLS-filtered to public visible enabled therapies'
);

select throws_ok(
  $$
    select created_at
    from public.matching_therapy_settings
    where therapy_id = 'e0000000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select matching_therapy_settings.created_at'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.matching_therapy_settings', 'SELECT'),
  'anon does not hold table-level SELECT on matching_therapy_settings'
);

select ok(
  has_column_privilege('anon', 'public.matching_therapy_settings', 'therapy_id', 'SELECT'),
  'anon can select matching_therapy_settings.therapy_id'
);

select ok(
  has_column_privilege('anon', 'public.matching_therapy_settings', 'is_visible_in_matching', 'SELECT'),
  'anon can select matching_therapy_settings.is_visible_in_matching'
);

select ok(
  not has_column_privilege('anon', 'public.matching_therapy_settings', 'created_at', 'SELECT'),
  'anon cannot select matching_therapy_settings.created_at'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'matching_therapy_settings'
      and policyname = 'Public can read visible matching therapy settings'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'matching_therapy_settings has explicit public RLS gate'
);

select ok(
  has_table_privilege('anon', 'public.public_therapy_details_v', 'SELECT'),
  'anon keeps SELECT on public_therapy_details_v dependency'
);

select * from finish();

rollback;
