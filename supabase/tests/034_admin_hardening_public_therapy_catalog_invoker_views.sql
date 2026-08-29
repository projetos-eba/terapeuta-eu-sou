begin;

select plan(21);

update public.therapist_profiles
set status = 'approved',
    is_public = true,
    is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001'::uuid;

insert into public.therapies (
  id,
  name,
  slug,
  short_description,
  description,
  status,
  is_public_visible,
  published_at
)
select
  fixture.id,
  fixture.name,
  fixture.slug,
  'Fixture publica para hardening do catalogo.',
  'Conteudo editorial temporario sem promessa de resultado.',
  fixture.status::public.therapy_status,
  fixture.is_public_visible,
  case when fixture.status = 'published' then now() else null end
from (
  values
    (
      'de000000-0000-4000-8000-000000000001'::uuid,
      'therapy-catalog-public-candidate',
      'Therapy Catalog Public Candidate',
      'published',
      true
    ),
    (
      'de000000-0000-4000-8000-000000000002'::uuid,
      'therapy-catalog-draft-candidate',
      'Therapy Catalog Draft Candidate',
      'draft',
      true
    ),
    (
      'de000000-0000-4000-8000-000000000003'::uuid,
      'therapy-catalog-hidden-candidate',
      'Therapy Catalog Hidden Candidate',
      'published',
      false
    )
) as fixture(id, slug, name, status, is_public_visible);

insert into public.therapy_matching_themes (therapy_id, theme_id, sort_order)
select fixture.therapy_id, theme.id, 1
from (values
  ('de000000-0000-4000-8000-000000000001'::uuid),
  ('de000000-0000-4000-8000-000000000002'::uuid),
  ('de000000-0000-4000-8000-000000000003'::uuid)
) fixture(therapy_id)
cross join lateral (
  select id from public.matching_themes where is_active order by sort_order, name limit 1
) theme;

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  status,
  online_only,
  is_bookable
)
values
  (
    'de100000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'de000000-0000-4000-8000-000000000001'::uuid,
    'Servico publico de catalogo',
    'Fixture operacional sem promessa de resultado.',
    50,
    15000,
    'active',
    true,
    true
  ),
  (
    'de100000-0000-4000-8000-000000000002'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'de000000-0000-4000-8000-000000000002'::uuid,
    'Servico de terapia draft',
    'Nao deve aparecer publicamente.',
    50,
    15000,
    'active',
    true,
    true
  ),
  (
    'de100000-0000-4000-8000-000000000003'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'de000000-0000-4000-8000-000000000003'::uuid,
    'Servico de terapia oculta',
    'Nao deve aparecer publicamente.',
    50,
    15000,
    'active',
    true,
    true
  );

insert into public.matching_therapy_settings (
  therapy_id,
  is_visible_in_matching
)
values
  ('de000000-0000-4000-8000-000000000001'::uuid, true),
  ('de000000-0000-4000-8000-000000000002'::uuid, true),
  ('de000000-0000-4000-8000-000000000003'::uuid, true);

select results_eq(
  $$
    select id, therapist_count
    from public.public_therapies_v
    where id = 'de000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('de000000-0000-4000-8000-000000000001'::uuid, 1) $$,
  'public_therapies_v exposes published visible therapy with public therapist count'
);

select is_empty(
  $$
    select 1
    from public.public_therapies_v
    where id in (
      'de000000-0000-4000-8000-000000000002',
      'de000000-0000-4000-8000-000000000003'
    )
  $$,
  'public_therapies_v hides draft and non-public therapies'
);

select results_eq(
  $$
    select id, href_slug
    from public.public_home_therapies
    where id = 'de000000-0000-4000-8000-000000000001'
  $$,
  $$ values (
    'de000000-0000-4000-8000-000000000001'::uuid,
    'therapy-catalog-public-candidate'::text
  ) $$,
  'public_home_therapies remains readable through the invoker chain'
);

select results_eq(
  $$
    select therapy_id, therapist_count
    from public.public_matching_therapist_counts
    where therapy_id = 'de000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('de000000-0000-4000-8000-000000000001'::uuid, 1) $$,
  'public_matching_therapist_counts remains readable through the invoker chain'
);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapies_v'
  ),
  '{security_invoker=true}',
  'public_therapies_v runs as security invoker'
);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_home_therapies'
  ),
  '{security_invoker=true}',
  'public_home_therapies runs as security invoker'
);

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_matching_therapist_counts'
  ),
  '{security_invoker=true}',
  'public_matching_therapist_counts runs as security invoker'
);

select ok(
  has_column_privilege(
    'anon',
    'public.therapist_services',
    'therapy_id',
    'SELECT'
  ),
  'anon can select therapy_id gate from therapist_services'
);

select ok(
  has_column_privilege(
    'anon',
    'public.therapist_services',
    'therapist_profile_id',
    'SELECT'
  ),
  'anon can select therapist_profile_id gate from therapist_services'
);

select ok(
  has_column_privilege(
    'anon',
    'public.therapist_profiles',
    'is_accepting_bookings',
    'SELECT'
  ),
  'anon can select public booking acceptance gate from therapist_profiles'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_services',
    'title',
    'SELECT'
  ),
  'anon cannot select therapist service title directly'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_services',
    'price_cents',
    'SELECT'
  ),
  'anon cannot select therapist service price directly'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_services'
      and policyname = 'Public can read public therapist service catalog gates'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapist_services has explicit restrictive public catalog gate RLS'
);

select ok(
  has_table_privilege('anon', 'public.public_therapies_v', 'SELECT'),
  'anon keeps SELECT on public_therapies_v'
);

select ok(
  has_table_privilege('anon', 'public.public_home_therapies', 'SELECT'),
  'anon keeps SELECT on public_home_therapies'
);

select ok(
  has_table_privilege('anon', 'public.public_matching_therapist_counts', 'SELECT'),
  'anon keeps SELECT on public_matching_therapist_counts'
);

set local role anon;

select results_eq(
  $$
    select therapy_id, therapist_profile_id, status
    from public.therapist_services
    where therapy_id = 'de000000-0000-4000-8000-000000000001'
  $$,
  $$ values (
    'de000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'active'::public.service_status
  ) $$,
  'anon can read only the public service catalog gate row'
);

select is_empty(
  $$
    select 1
    from public.therapist_services
    where therapy_id in (
      'de000000-0000-4000-8000-000000000002',
      'de000000-0000-4000-8000-000000000003'
    )
  $$,
  'anon cannot read service catalog gates for draft or hidden therapies'
);

select throws_ok(
  $$
    select title
    from public.therapist_services
    where therapy_id = 'de000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'anon cannot read therapist service title even for public catalog services'
);

select throws_ok(
  $$
    select price_cents
    from public.therapist_services
    where therapy_id = 'de000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'anon cannot read therapist service price even for public catalog services'
);

select results_eq(
  $$
    select id, therapist_count
    from public.public_therapies_v
    where id = 'de000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('de000000-0000-4000-8000-000000000001'::uuid, 1) $$,
  'anon can read public therapy catalog through security invoker view'
);

reset role;

select * from finish();

rollback;
