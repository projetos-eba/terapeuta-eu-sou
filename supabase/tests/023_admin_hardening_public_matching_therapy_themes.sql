begin;

select plan(19);

insert into public.therapies (
  id,
  category_id,
  name,
  slug,
  short_description,
  description,
  status,
  is_public_visible,
  archived_at
)
select
  fixture.id,
  category.id,
  fixture.name,
  fixture.slug,
  'Fixture publica para hardening do Match.',
  'Conteudo editorial temporario sem promessa de resultado.',
  fixture.status::public.therapy_status,
  fixture.is_public_visible,
  fixture.archived_at
from (
  values
    (
      'dc000000-0000-4000-8000-000000000001'::uuid,
      'match-theme-public-candidate',
      'Match Theme Public Candidate',
      'published',
      true,
      null::timestamptz
    ),
    (
      'dc000000-0000-4000-8000-000000000002'::uuid,
      'match-theme-draft-candidate',
      'Match Theme Draft Candidate',
      'draft',
      true,
      null::timestamptz
    ),
    (
      'dc000000-0000-4000-8000-000000000003'::uuid,
      'match-theme-hidden-candidate',
      'Match Theme Hidden Candidate',
      'published',
      true,
      null::timestamptz
    ),
    (
      'dc000000-0000-4000-8000-000000000004'::uuid,
      'match-theme-unweighted-candidate',
      'Match Theme Unweighted Candidate',
      'published',
      true,
      null::timestamptz
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
  ('dc000000-0000-4000-8000-000000000001', true),
  ('dc000000-0000-4000-8000-000000000002', true),
  ('dc000000-0000-4000-8000-000000000003', false),
  ('dc000000-0000-4000-8000-000000000004', true);

insert into public.therapy_matching_themes (
  therapy_id,
  theme_id,
  sort_order
)
select
  fixture.therapy_id,
  theme.id,
  fixture.sort_order
from (
  values
    ('dc000000-0000-4000-8000-000000000001'::uuid, 1),
    ('dc000000-0000-4000-8000-000000000002'::uuid, 2),
    ('dc000000-0000-4000-8000-000000000003'::uuid, 3),
    ('dc000000-0000-4000-8000-000000000004'::uuid, 4)
) as fixture(therapy_id, sort_order)
cross join lateral (
  select id
  from public.matching_themes
  where is_active = true
  order by sort_order, name
  limit 1
) as theme;

insert into public.matching_weights (
  version_id,
  therapy_id,
  theme_id,
  weight,
  reason,
  is_active
)
select
  version.id,
  fixture.therapy_id,
  theme.id,
  4.0,
  'Fixture publica para hardening do Match.',
  true
from (
  values
    ('dc000000-0000-4000-8000-000000000001'::uuid),
    ('dc000000-0000-4000-8000-000000000002'::uuid),
    ('dc000000-0000-4000-8000-000000000003'::uuid)
) as fixture(therapy_id)
cross join lateral (
  select id
  from public.matching_versions
  where status = 'published'
  limit 1
) as version
cross join lateral (
  select theme_id as id
  from public.therapy_matching_themes
  where therapy_id = fixture.therapy_id
  limit 1
) as theme;

select isnt_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where therapy_id = 'dc000000-0000-4000-8000-000000000001'
  $$,
  'public Match theme view exposes published, visible, weighted candidate'
);

select is_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where therapy_id = 'dc000000-0000-4000-8000-000000000002'
  $$,
  'public Match theme view hides draft therapies'
);

select is_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where therapy_id = 'dc000000-0000-4000-8000-000000000003'
  $$,
  'public Match theme view hides therapies disabled in Match'
);

select is_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where therapy_id = 'dc000000-0000-4000-8000-000000000004'
  $$,
  'public Match theme view hides therapies without active published weight'
);

set local role anon;

select isnt_empty(
  $$
    select therapy_id, theme_id, sort_order
    from public.public_matching_therapy_themes_v
    where therapy_id = 'dc000000-0000-4000-8000-000000000001'
  $$,
  'anon can read public therapy themes through the safe projection'
);

select is_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where therapy_id in (
      'dc000000-0000-4000-8000-000000000002',
      'dc000000-0000-4000-8000-000000000003',
      'dc000000-0000-4000-8000-000000000004'
    )
  $$,
  'anon cannot read draft, hidden, or unweighted therapy themes'
);

reset role;

select is_empty(
  $$
    select 1
    from public.public_matching_therapy_themes_v
    where theme_id is null
       or theme_name is null
       or theme_slug is null
  $$,
  'public Match therapy themes keep required public theme identifiers'
);

select is_empty(
  $$
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_therapy_themes_v'
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = any(array[
        'weight',
        'reason',
        'metadata',
        'created_by_user_id',
        'updated_by_user_id'
      ])
  $$,
  'public Match therapy themes do not expose internal scoring or actor columns'
);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_therapy_themes_v'
  ),
  '{security_invoker=true}',
  'public_matching_therapy_themes_v runs as security invoker'
);

select ok(
  has_column_privilege(
    'anon',
    'public.therapy_matching_themes',
    'therapy_id',
    'SELECT'
  ),
  'anon can select public therapy_id from therapy_matching_themes'
);

select ok(
  has_column_privilege(
    'anon',
    'public.matching_therapy_settings',
    'is_visible_in_matching',
    'SELECT'
  ),
  'anon can select public matching visibility gate'
);

select ok(
  has_column_privilege(
    'anon',
    'public.matching_weights',
    'theme_id',
    'SELECT'
  ),
  'anon can select public matching weight theme_id gate'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.matching_weights',
    'weight',
    'SELECT'
  ),
  'anon cannot select matching score weight'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.matching_weights',
    'reason',
    'SELECT'
  ),
  'anon cannot select internal matching score reason'
);

select results_eq(
  $$
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'therapy_matching_themes',
        'matching_therapy_settings',
        'matching_weights'
      )
      and policyname in (
        'Public can read public therapy matching themes',
        'Public can read visible matching therapy settings',
        'Public can read active public matching weights'
      )
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'public Match relation tables have explicit restrictive public RLS'
);

select is(
  has_table_privilege('anon', 'public.public_matching_therapy_themes_v', 'SELECT'),
  true,
  'anon keeps SELECT on public_matching_therapy_themes_v'
);

set local role anon;

select isnt_empty(
  $$
    select therapy_id, theme_id, sort_order
    from public.therapy_matching_themes
    where therapy_id = 'dc000000-0000-4000-8000-000000000001'
  $$,
  'anon can read the public base relation row through explicit RLS'
);

select is_empty(
  $$
    select 1
    from public.therapy_matching_themes
    where therapy_id in (
      'dc000000-0000-4000-8000-000000000002',
      'dc000000-0000-4000-8000-000000000003',
      'dc000000-0000-4000-8000-000000000004'
    )
  $$,
  'anon cannot read draft, hidden, or unweighted base relation rows'
);

select throws_ok(
  $$
    select weight
    from public.matching_weights
    where therapy_id = 'dc000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'anon cannot read internal matching score values directly'
);

reset role;

select * from finish();

rollback;
