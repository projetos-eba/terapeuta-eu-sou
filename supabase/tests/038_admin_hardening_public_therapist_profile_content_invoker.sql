begin;

select plan(31);

update public.therapist_profiles
set
  status = 'approved'::public.therapist_status,
  is_public = true,
  slug = 'profile-content-public-candidate'
where id = 'c1000000-0000-4000-8000-000000000001'::uuid;

update public.therapist_profiles
set
  status = 'in_review'::public.therapist_status,
  is_public = false,
  slug = 'profile-content-hidden-candidate'
where id = 'c1000000-0000-4000-8000-000000000002'::uuid;

update public.therapist_profile_content_versions
set status = 'archived'
where therapist_profile_id in (
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'c1000000-0000-4000-8000-000000000002'::uuid
);

insert into public.therapist_profile_content_versions (
  id,
  therapist_profile_id,
  status,
  short_intro,
  essence_body,
  invitation_body,
  experience_years,
  published_at,
  profile_payload
)
values
  (
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'published',
    'Introducao publica do perfil.',
    'Essencia publica responsavel.',
    'Convite publico responsavel.',
    8,
    now(),
    '{"privateNote":"must not leak"}'::jsonb
  ),
  (
    'f0380000-0000-4000-8000-000000000002'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'in_review',
    'Introducao em revisao.',
    'Essencia em revisao.',
    'Convite em revisao.',
    9,
    null,
    '{"privateNote":"draft must not leak"}'::jsonb
  ),
  (
    'f0380000-0000-4000-8000-000000000003'::uuid,
    'c1000000-0000-4000-8000-000000000002'::uuid,
    'published',
    'Introducao de terapeuta oculto.',
    'Essencia oculta.',
    'Convite oculto.',
    3,
    now(),
    '{"privateNote":"hidden must not leak"}'::jsonb
  );

insert into public.therapist_profile_guide_items (
  id,
  content_version_id,
  icon,
  label,
  sort_order,
  is_active
)
values
  (
    'f0381000-0000-4000-8000-000000000001'::uuid,
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'sparkles',
    'Guia publico',
    1,
    true
  ),
  (
    'f0381000-0000-4000-8000-000000000002'::uuid,
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'heart',
    'Guia inativo',
    2,
    false
  ),
  (
    'f0381000-0000-4000-8000-000000000003'::uuid,
    'f0380000-0000-4000-8000-000000000002'::uuid,
    'moon',
    'Guia de rascunho',
    1,
    true
  );

insert into public.therapist_profile_reflections (
  id,
  content_version_id,
  title,
  image_url,
  href,
  minutes_to_read,
  sort_order,
  is_public
)
values
  (
    'f0382000-0000-4000-8000-000000000001'::uuid,
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'Reflexao publica',
    'https://example.test/reflexao-publica.webp',
    'https://example.test/reflexao-publica',
    4,
    1,
    true
  ),
  (
    'f0382000-0000-4000-8000-000000000002'::uuid,
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'Reflexao privada',
    'https://example.test/reflexao-privada.webp',
    'https://example.test/reflexao-privada',
    5,
    2,
    false
  ),
  (
    'f0382000-0000-4000-8000-000000000003'::uuid,
    'f0380000-0000-4000-8000-000000000002'::uuid,
    'Reflexao de rascunho',
    'https://example.test/reflexao-rascunho.webp',
    'https://example.test/reflexao-rascunho',
    6,
    1,
    true
  );

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapist_profile_content_v'
  ),
  '{security_invoker=true}',
  'public_therapist_profile_content_v runs as security invoker'
);

select ok(
  has_table_privilege(
    'anon',
    'public.public_therapist_profile_content_v',
    'SELECT'
  ),
  'anon can select the public therapist profile content DTO'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.public_therapist_profile_content_v',
    'SELECT'
  ),
  'authenticated can select the public therapist profile content DTO'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.public_therapist_profile_content_v',
    'SELECT'
  ),
  'service role can select the public therapist profile content DTO'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.public_therapist_profile_content_v',
    'TRUNCATE'
  ),
  'anon cannot truncate the public therapist profile content DTO'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.public_therapist_profile_content_v',
    'REFERENCES'
  ),
  'anon cannot reference the public therapist profile content DTO'
);

select results_eq(
  $$
    select
      slug,
      short_intro,
      essence_body,
      invitation_body,
      experience_years,
      jsonb_array_length(guide_items),
      jsonb_array_length(reflections)
    from public.public_therapist_profile_content_v
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'profile-content-public-candidate'::text,
    'Introducao publica do perfil.'::text,
    'Essencia publica responsavel.'::text,
    'Convite publico responsavel.'::text,
    8,
    1,
    1
  ) $$,
  'public_therapist_profile_content_v exposes only published public profile content'
);

select is_empty(
  $$
    select 1
    from public.public_therapist_profile_content_v
    where short_intro in (
      'Introducao em revisao.',
      'Introducao de terapeuta oculto.'
    )
  $$,
  'public_therapist_profile_content_v hides in-review content and hidden therapists'
);

select is_empty(
  $$
    select 1
    from public.public_therapist_profile_content_v
    where guide_items @> '[{"label":"Guia inativo"}]'::jsonb
      or guide_items @> '[{"label":"Guia de rascunho"}]'::jsonb
      or reflections @> '[{"title":"Reflexao privada"}]'::jsonb
      or reflections @> '[{"title":"Reflexao de rascunho"}]'::jsonb
  $$,
  'public_therapist_profile_content_v hides inactive guide items and private/draft reflections'
);

select ok(
  has_column_privilege(
    'anon',
    'public.therapist_profile_content_versions',
    'short_intro',
    'SELECT'
  ),
  'anon can read the public short_intro content column'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_content_versions',
    'profile_payload',
    'SELECT'
  ),
  'anon cannot read private profile_payload'
);

select ok(
  not has_column_privilege(
    'anon',
    'public.therapist_profile_content_versions',
    'video_url',
    'SELECT'
  ),
  'anon cannot read unpublished video_url directly from content versions'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.therapist_profile_content_versions',
    'TRUNCATE'
  ),
  'anon cannot truncate therapist profile content versions'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.therapist_profile_content_versions',
    'TRUNCATE'
  ),
  'authenticated cannot truncate therapist profile content versions'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.therapist_profile_content_versions',
    'REFERENCES'
  ),
  'anon cannot reference therapist profile content versions'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.therapist_profile_content_versions',
    'REFERENCES'
  ),
  'authenticated cannot reference therapist profile content versions'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.therapist_profile_guide_items',
    'TRIGGER'
  ),
  'anon cannot create triggers on guide items'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.therapist_profile_reflections',
    'TRIGGER'
  ),
  'authenticated cannot create triggers on reflections'
);

set local role anon;

select results_eq(
  $$
    select id, short_intro, essence_body, invitation_body, experience_years
    from public.therapist_profile_content_versions
    where id = 'f0380000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'f0380000-0000-4000-8000-000000000001'::uuid,
    'Introducao publica do perfil.'::text,
    'Essencia publica responsavel.'::text,
    'Convite publico responsavel.'::text,
    8
  ) $$,
  'anon can directly read only granted public columns for eligible published content'
);

select is_empty(
  $$
    select id
    from public.therapist_profile_content_versions
    where id in (
      'f0380000-0000-4000-8000-000000000002'::uuid,
      'f0380000-0000-4000-8000-000000000003'::uuid
    )
  $$,
  'anon direct content reads are RLS-filtered to published content from approved public therapists'
);

select results_eq(
  $$
    select label
    from public.therapist_profile_guide_items
    where content_version_id =
      'f0380000-0000-4000-8000-000000000001'::uuid
    order by sort_order
  $$,
  $$ values ('Guia publico'::text) $$,
  'anon direct guide item reads are RLS-filtered to active public guide items'
);

select results_eq(
  $$
    select title
    from public.therapist_profile_reflections
    where content_version_id =
      'f0380000-0000-4000-8000-000000000001'::uuid
    order by sort_order
  $$,
  $$ values ('Reflexao publica'::text) $$,
  'anon direct reflection reads are RLS-filtered to public published reflections'
);

select throws_ok(
  $$
    select profile_payload
    from public.therapist_profile_content_versions
    where id = 'f0380000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select private profile payload directly'
);

select throws_ok(
  $$
    select video_url
    from public.therapist_profile_content_versions
    where id = 'f0380000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select unpublished video_url directly'
);

select throws_ok(
  $$
    truncate table public.therapist_profile_content_versions
  $$,
  '42501',
  null,
  'anon cannot truncate content versions directly'
);

select throws_ok(
  $$
    select created_at
    from public.therapist_profile_guide_items
    where content_version_id =
      'f0380000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot read guide item operational timestamps'
);

select throws_ok(
  $$
    select excerpt
    from public.therapist_profile_reflections
    where content_version_id =
      'f0380000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot read non-DTO reflection excerpt directly'
);

reset role;

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_profile_content_versions'
      and policyname = 'Public can read published therapist profile content'
      and roles = '{anon,authenticated}'::name[]
  ),
  'public content version RLS policy is explicit for anon/authenticated'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_profile_guide_items'
      and policyname = 'Public can read active therapist profile guide items'
      and roles = '{anon,authenticated}'::name[]
  ),
  'public guide item RLS policy is explicit for anon/authenticated'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapist_profile_reflections'
      and policyname = 'Public can read public therapist profile reflections'
      and roles = '{anon,authenticated}'::name[]
  ),
  'public reflection RLS policy is explicit for anon/authenticated'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_therapist_profile_content_v'
      and column_name in (
        'profile_payload',
        'base_profile_version',
        'video_url',
        'video_provider',
        'video_thumbnail_url',
        'video_title',
        'created_at',
        'updated_at'
      )
  ),
  'public therapist profile content DTO omits private and operational columns'
);

select * from finish();

rollback;
