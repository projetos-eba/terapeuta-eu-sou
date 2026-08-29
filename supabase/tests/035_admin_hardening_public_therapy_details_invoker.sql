begin;

select plan(28);

insert into public.therapies (
  id,
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
  fixture.name,
  fixture.slug,
  'Fixture publica para detalhe de terapia.',
  'Conteudo editorial temporario sem promessa de resultado.',
  fixture.status::public.therapy_status,
  fixture.is_public_visible,
  case when fixture.status = 'published' then now() else null end,
  fixture.archived_at
from (
  values
    (
      'df000000-0000-4000-8000-000000000001'::uuid,
      'therapy-detail-public-candidate',
      'Therapy Detail Public Candidate',
      'published',
      true,
      null::timestamptz
    ),
    (
      'df000000-0000-4000-8000-000000000002'::uuid,
      'therapy-detail-draft-candidate',
      'Therapy Detail Draft Candidate',
      'draft',
      true,
      null::timestamptz
    ),
    (
      'df000000-0000-4000-8000-000000000003'::uuid,
      'therapy-detail-hidden-candidate',
      'Therapy Detail Hidden Candidate',
      'published',
      false,
      null::timestamptz
    ),
    (
      'df000000-0000-4000-8000-000000000004'::uuid,
      'therapy-detail-archived-candidate',
      'Therapy Detail Archived Candidate',
      'published',
      true,
      now()
    )
) as fixture(id, slug, name, status, is_public_visible, archived_at);

insert into public.therapy_matching_themes (therapy_id, theme_id, sort_order)
select fixture.therapy_id, theme.id, 1
from (values
  ('df000000-0000-4000-8000-000000000001'::uuid),
  ('df000000-0000-4000-8000-000000000002'::uuid),
  ('df000000-0000-4000-8000-000000000003'::uuid),
  ('df000000-0000-4000-8000-000000000004'::uuid)
) fixture(therapy_id)
cross join lateral (
  select id from public.matching_themes where is_active order by sort_order, name limit 1
) theme;

insert into public.therapy_public_content (
  therapy_id,
  hero_image_url,
  subtitle,
  introduction,
  complementary_description,
  safety_note,
  seo_title,
  seo_description,
  approach_label,
  approach_icon_key,
  visual_theme_key,
  hero_focal_point
)
values
  (
    'df000000-0000-4000-8000-000000000001'::uuid,
    'https://example.test/public-detail.webp',
    'Subtitulo publico',
    'Introducao publica responsavel.',
    'Descricao complementar publica.',
    'Nota de seguranca publica.',
    'SEO publico',
    'Descricao SEO publica.',
    'Abordagem publica',
    'sparkles',
    'energy',
    'center'
  ),
  (
    'df000000-0000-4000-8000-000000000002'::uuid,
    'https://example.test/draft-detail.webp',
    'Subtitulo draft',
    'Introducao draft.',
    'Descricao complementar draft.',
    'Nota draft.',
    'SEO draft',
    'Descricao SEO draft.',
    'Abordagem draft',
    'sparkles',
    'energy',
    'center'
  ),
  (
    'df000000-0000-4000-8000-000000000003'::uuid,
    'https://example.test/hidden-detail.webp',
    'Subtitulo oculto',
    'Introducao oculta.',
    'Descricao complementar oculta.',
    'Nota oculta.',
    'SEO oculto',
    'Descricao SEO oculta.',
    'Abordagem oculta',
    'sparkles',
    'energy',
    'center'
  ),
  (
    'df000000-0000-4000-8000-000000000004'::uuid,
    'https://example.test/archived-detail.webp',
    'Subtitulo arquivado',
    'Introducao arquivada.',
    'Descricao complementar arquivada.',
    'Nota arquivada.',
    'SEO arquivado',
    'Descricao SEO arquivada.',
    'Abordagem arquivada',
    'sparkles',
    'energy',
    'center'
  );

insert into public.therapy_highlights (therapy_id, title, icon_key, sort_order)
values
  ('df000000-0000-4000-8000-000000000001'::uuid, 'Destaque publico', 'sparkles', 1),
  ('df000000-0000-4000-8000-000000000002'::uuid, 'Destaque draft', 'sparkles', 1),
  ('df000000-0000-4000-8000-000000000003'::uuid, 'Destaque oculto', 'sparkles', 1),
  ('df000000-0000-4000-8000-000000000004'::uuid, 'Destaque arquivado', 'sparkles', 1);

insert into public.therapy_benefits (
  therapy_id,
  title,
  description,
  icon_key,
  sort_order
)
values
  (
    'df000000-0000-4000-8000-000000000001'::uuid,
    'Beneficio publico',
    'Descricao publica sem promessa de resultado.',
    'heart',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000002'::uuid,
    'Beneficio draft',
    'Descricao draft.',
    'heart',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000003'::uuid,
    'Beneficio oculto',
    'Descricao oculta.',
    'heart',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000004'::uuid,
    'Beneficio arquivado',
    'Descricao arquivada.',
    'heart',
    1
  );

insert into public.therapy_faqs (therapy_id, question, answer, sort_order)
values
  (
    'df000000-0000-4000-8000-000000000001'::uuid,
    'Pergunta publica?',
    'Resposta publica responsavel.',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000002'::uuid,
    'Pergunta draft?',
    'Resposta draft.',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000003'::uuid,
    'Pergunta oculta?',
    'Resposta oculta.',
    1
  ),
  (
    'df000000-0000-4000-8000-000000000004'::uuid,
    'Pergunta arquivada?',
    'Resposta arquivada.',
    1
  );

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_therapy_details_v'
  ),
  '{security_invoker=true}',
  'public_therapy_details_v runs as security invoker'
);

select ok(
  has_table_privilege('anon', 'public.public_therapy_details_v', 'SELECT'),
  'anon can select the public detail DTO view'
);

select results_eq(
  $$
    select slug, subtitle, jsonb_array_length(highlights), jsonb_array_length(benefits)
    from public.public_therapy_details_v
    where id = 'df000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'therapy-detail-public-candidate'::text,
    'Subtitulo publico'::text,
    1,
    1
  ) $$,
  'public_therapy_details_v exposes published visible detail content'
);

select is_empty(
  $$
    select 1
    from public.public_therapy_details_v
    where id in (
      'df000000-0000-4000-8000-000000000002'::uuid,
      'df000000-0000-4000-8000-000000000003'::uuid,
      'df000000-0000-4000-8000-000000000004'::uuid
    )
  $$,
  'public_therapy_details_v hides draft, hidden and archived therapy details'
);

select ok(
  not has_table_privilege('anon', 'public.therapy_public_content', 'SELECT'),
  'anon does not hold table-level SELECT on therapy_public_content'
);

select ok(
  not has_table_privilege('anon', 'public.therapy_highlights', 'SELECT'),
  'anon does not hold table-level SELECT on therapy_highlights'
);

select ok(
  not has_table_privilege('anon', 'public.therapy_benefits', 'SELECT'),
  'anon does not hold table-level SELECT on therapy_benefits'
);

select ok(
  not has_table_privilege('anon', 'public.therapy_faqs', 'SELECT'),
  'anon does not hold table-level SELECT on therapy_faqs'
);

select ok(
  has_column_privilege('anon', 'public.therapy_public_content', 'subtitle', 'SELECT'),
  'anon can select public subtitle column needed by detail view'
);

select ok(
  has_column_privilege('anon', 'public.therapy_highlights', 'title', 'SELECT'),
  'anon can select public highlight title column needed by detail view'
);

select ok(
  has_column_privilege('anon', 'public.therapy_benefits', 'description', 'SELECT'),
  'anon can select public benefit description column needed by detail view'
);

select ok(
  not has_column_privilege('anon', 'public.therapy_faqs', 'answer', 'SELECT'),
  'anon cannot select the retired faq answer column'
);

select ok(
  not has_column_privilege('anon', 'public.therapy_public_content', 'created_at', 'SELECT'),
  'anon cannot select therapy_public_content.created_at'
);

select ok(
  not has_column_privilege('anon', 'public.therapy_highlights', 'id', 'SELECT'),
  'anon cannot select therapy_highlights.id'
);

select ok(
  not has_column_privilege('anon', 'public.therapy_benefits', 'updated_at', 'SELECT'),
  'anon cannot select therapy_benefits.updated_at'
);

select ok(
  not has_column_privilege('anon', 'public.therapy_faqs', 'created_at', 'SELECT'),
  'anon cannot select therapy_faqs.created_at'
);

set local role anon;

select results_eq(
  $$
    select subtitle
    from public.therapy_public_content
    where therapy_id = 'df000000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values ('Subtitulo publico'::text) $$,
  'anon can directly read only granted public editorial columns for published visible therapy'
);

select is_empty(
  $$
    select subtitle
    from public.therapy_public_content
    where therapy_id in (
      'df000000-0000-4000-8000-000000000002'::uuid,
      'df000000-0000-4000-8000-000000000003'::uuid,
      'df000000-0000-4000-8000-000000000004'::uuid
    )
  $$,
  'anon direct editorial reads are RLS-filtered to published visible non-archived therapies'
);

select throws_ok(
  $$
    select created_at
    from public.therapy_public_content
    where therapy_id = 'df000000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select ungranted therapy_public_content.created_at'
);

select throws_ok(
  $$
    select id
    from public.therapy_highlights
    where therapy_id = 'df000000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select ungranted therapy_highlights.id'
);

reset role;

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapy_public_content'
      and policyname = 'Public can read published therapy public content'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapy_public_content has explicit public select policy'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapy_highlights'
      and policyname = 'Public can read published therapy highlights'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapy_highlights has explicit public select policy'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapy_benefits'
      and policyname = 'Public can read published therapy benefits'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'therapy_benefits has explicit public select policy'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'therapy_faqs'
      and policyname = 'Public can read published therapy faqs'
      and roles && array['anon', 'authenticated']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (false) $$,
  'therapy_faqs no longer has a public select policy'
);

select ok(
  has_table_privilege('service_role', 'public.public_therapy_details_v', 'SELECT'),
  'service_role keeps SELECT on public_therapy_details_v'
);

select ok(
  has_table_privilege('authenticated', 'public.public_therapy_details_v', 'SELECT'),
  'authenticated keeps SELECT on public_therapy_details_v'
);

select ok(
  has_table_privilege('service_role', 'public.therapy_public_content', 'SELECT'),
  'service_role keeps direct read access to editorial content for command boundaries'
);

select ok(
  has_table_privilege('authenticated', 'public.therapy_public_content', 'SELECT'),
  'authenticated keeps RLS-gated direct read access to editorial content'
);

select * from finish();

rollback;
