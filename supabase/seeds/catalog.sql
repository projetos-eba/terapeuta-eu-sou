-- Institutional therapy catalog and public Match seed.
-- Safe to run manually in homologation/producao-like environments.
-- This file intentionally contains no auth users, profiles, therapist services, bookings, payments or mock data.

insert into public.therapies (
  id,
  name,
  slug,
  short_description,
  description,
  status,
  is_featured,
  safety_note
)
values
  (
    '22222222-2222-4222-8222-222222222221',
    'Terapia Integrativa',
    'terapia-integrativa',
    'Um caminho amplo para organizar sentimentos, escolhas e momentos de transição.',
    'A Terapia Integrativa reúne práticas de escuta e cuidado complementar para apoiar a pessoa a perceber o que faz sentido no momento atual.',
    'draft',
    false,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Terapia Floral',
    'terapia-floral',
    'Uma possibilidade para quem busca apoio em equilíbrio emocional e autoconhecimento.',
    'A Terapia Floral pode ser apresentada como uma prática complementar, sempre sem promessa de cura ou resultado garantido.',
    'draft',
    false,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    'Meditação Guiada',
    'meditacao-guiada',
    'Uma prática para cultivar presença, pausa e percepção do próprio ritmo.',
    'A Meditação Guiada ajuda a criar um espaço de presença e observação, sem substituir cuidados profissionais quando necessários.',
    'draft',
    false,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222224',
    'Cristaloterapia',
    'cristaloterapia',
    'Terapia inativa usada apenas para validar exclusão no match.',
    'Registro de seed para garantir que terapias inativas não sejam retornadas pelo match.',
    'inactive',
    false,
    'Terapia inativa no MVP.'
  )
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  status = excluded.status,
  is_featured = excluded.is_featured,
  safety_note = excluded.safety_note,
  updated_at = now();

insert into public.therapy_themes (
  id,
  parent_theme_id,
  name,
  slug,
  description,
  is_active
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    null,
    'Equilíbrio emocional',
    'equilibrio-emocional',
    'Tema para momentos em que a pessoa busca mais estabilidade, pausa e cuidado.',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    null,
    'Autoconhecimento',
    'autoconhecimento',
    'Tema para escolhas, clareza pessoal e escuta de si.',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    null,
    'Mudanças de vida',
    'mudancas-de-vida',
    'Tema para transições, recomeços e reorganização de caminhos.',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333341',
    '33333333-3333-4333-8333-333333333331',
    'Estresse e sobrecarga',
    'estresse-e-sobrecarga',
    'Interesse ligado a momentos de cansaço, rotina intensa e necessidade de pausa.',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333342',
    '33333333-3333-4333-8333-333333333332',
    'Clareza nas escolhas',
    'clareza-nas-escolhas',
    'Interesse ligado a decisões, prioridades e percepção de caminho.',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333343',
    '33333333-3333-4333-8333-333333333333',
    'Recomeços',
    'recomecos',
    'Interesse ligado a fases novas, fechamento de ciclos e construção de próximos passos.',
    true
  )
on conflict (slug) do update
set
  parent_theme_id = excluded.parent_theme_id,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.therapy_theme_weights (
  id,
  therapy_id,
  theme_id,
  subtheme_id,
  weight,
  reason,
  source,
  is_active
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '22222222-2222-4222-8222-222222222221',
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333341',
    18,
    'Seed MVP: terapia integrativa aparece bem para equilíbrio emocional e sobrecarga.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '22222222-2222-4222-8222-222222222221',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333343',
    15,
    'Seed MVP: terapia integrativa também apoia momentos de transição.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444443',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333341',
    14,
    'Seed MVP: terapia floral aparece como possibilidade para equilíbrio emocional.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333332',
    '33333333-3333-4333-8333-333333333342',
    16,
    'Seed MVP: terapia floral aparece para autoconhecimento e escolhas.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444445',
    '22222222-2222-4222-8222-222222222223',
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333341',
    12,
    'Seed MVP: meditação guiada aparece para pausa e presença.',
    'journey',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444446',
    '22222222-2222-4222-8222-222222222224',
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333341',
    99,
    'Seed MVP: peso alto em terapia inativa para validar que ela não retorna.',
    'journey',
    true
  )
on conflict (id) do update
set
  therapy_id = excluded.therapy_id,
  theme_id = excluded.theme_id,
  subtheme_id = excluded.subtheme_id,
  weight = excluded.weight,
  reason = excluded.reason,
  source = excluded.source,
  is_active = excluded.is_active,
  updated_at = now();


insert into public.therapies (
  id,
  name,
  slug,
  short_description,
  description,
  status,
  is_featured,
  safety_note,
  image_url,
  published_at,
  popularity_score,
  search_aliases,
  is_public_visible
)
values
  ('22222222-2222-4222-8222-222222222225', 'Reiki', 'reiki', 'Prática integrativa de presença e equilíbrio energético.', 'Reiki é apresentado no TES como prática integrativa complementar, sem promessa de cura, diagnóstico ou resultado garantido.', 'published', true, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/reiki.png', now() - interval '80 days', 96, array['energia', 'equilibrio energético', 'espiritualidade'], true),
  ('22222222-2222-4222-8222-222222222227', 'Mindfulness', 'mindfulness', 'Prática de atenção plena para cultivar presença e pausa.', 'Mindfulness é apresentado como prática de atenção plena e autocuidado, sem substituir acompanhamento profissional quando necessário.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/mindfulness.png', null, 82, array['atenção plena', 'presença', 'meditacao'], false),
  ('22222222-2222-4222-8222-222222222228', 'Tarô', 'taro', 'Leitura simbólica para reflexão, escolhas e autoconhecimento.', 'Tarô usa símbolos como convite de reflexão e não deve ser comunicado como previsão determinista.', 'published', false, 'Este conteúdo é informativo e não substitui diagnóstico, tratamento ou orientação profissional especializada.', '/therapies/taro-editorial.png', now() - interval '38 days', 76, array['taro', 'tarot', 'oraculo', 'autoconhecimento'], true),
  ('22222222-2222-4222-8222-222222222226', 'Aromaterapia', 'aromaterapia', 'Uso cuidadoso de óleos essenciais em práticas de acolhimento e bem-estar.', 'Aromaterapia é apresentada no TES como prática complementar e deve ser comunicada sem promessa terapêutica garantida.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/aromaterapia.png', null, 88, array['oleos essenciais', 'aromas', 'relaxamento'], false),
  ('22222222-2222-4222-8222-222222222223', 'Meditação Guiada', 'meditacao-guiada', 'Uma prática para cultivar presença, pausa e percepção do próprio ritmo.', 'A Meditação Guiada ajuda a criar um espaço de presença e observação, sem substituir cuidados profissionais quando necessários.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/meditacao-guiada.png', null, 84, array['meditacao', 'presença', 'respiracao'], false),
  ('22222222-2222-4222-8222-222222222229', 'Apometria', 'apometria', 'Prática espiritualista complementar para reflexão e cuidado energético.', 'Apometria é apresentada no TES com linguagem responsável, como prática complementar e sem promessa de cura.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/apometria.png', null, 72, array['espiritualidade', 'energia', 'campo energético'], false),
  ('22222222-2222-4222-8222-222222222222', 'Florais', 'terapia-floral', 'Uma possibilidade para quem busca apoio em equilíbrio emocional e autoconhecimento.', 'Florais podem ser apresentados como prática complementar, sempre sem promessa de cura ou resultado garantido.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/florais.png', null, 79, array['terapia floral', 'florais de bach', 'emocional'], false),
  ('22222222-2222-4222-8222-222222222224', 'Cristaloterapia', 'cristaloterapia', 'Prática complementar com cristais, presença e intenção simbólica.', 'Cristaloterapia é apresentada como prática complementar e simbólica, sem promessa de cura, diagnóstico ou resultado garantido.', 'draft', false, 'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.', '/therapies/cristaloterapia.png', null, 70, array['cristais', 'energia', 'equilibrio'], false)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  status = excluded.status,
  is_featured = excluded.is_featured,
  safety_note = excluded.safety_note,
  image_url = excluded.image_url,
  published_at = excluded.published_at,
  popularity_score = excluded.popularity_score,
  search_aliases = excluded.search_aliases,
  is_public_visible = excluded.is_public_visible,
  updated_at = now();

insert into public.therapy_public_content (
  therapy_id,
  hero_image_url,
  subtitle,
  introduction,
  complementary_description,
  safety_note,
  seo_title,
  seo_description
)
values
  (
    '22222222-2222-4222-8222-222222222225',
    '/therapies/reiki-detail-hero-crop.png',
    'Uma prática que convida ao equilíbrio, à presença e ao cuidado consigo mesmo.',
    'Reiki é uma técnica complementar de imposição de mãos associada ao cuidado energético, à presença e à harmonização entre corpo, mente e emoções.',
    'No TES, esta terapia é apresentada como um caminho de autocuidado e escuta sensível. Ela pode ser explorada no seu tempo, sempre respeitando sua história e suas necessidades.',
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.',
    'Reiki | Terapeuta Eu Sou',
    'Conheça Reiki, entenda a abordagem e encontre profissionais publicados que oferecem sessões online pela plataforma.'
  ),
  (
    '22222222-2222-4222-8222-222222222226',
    '/therapies/aromaterapia.png',
    'Uma prática sensorial para criar pausas, presença e rituais de autocuidado.',
    'Aromaterapia usa aromas e óleos essenciais em contextos de bem-estar, presença e cuidado complementar.',
    'No TES, a Aromaterapia é apresentada com orientação responsável, respeitando limites, preferências e segurança de cada pessoa.',
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.',
    'Aromaterapia | Terapeuta Eu Sou',
    'Conheça Aromaterapia e siga para profissionais relacionados quando fizer sentido para você.'
  )
on conflict (therapy_id) do update
set
  hero_image_url = excluded.hero_image_url,
  subtitle = excluded.subtitle,
  introduction = excluded.introduction,
  complementary_description = excluded.complementary_description,
  safety_note = excluded.safety_note,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.therapy_highlights (
  id,
  therapy_id,
  title,
  icon_key,
  sort_order
)
values
  ('76000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222225', 'Equilíbrio energético', 'energy', 1),
  ('76000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222225', 'Redução do estresse', 'heart', 2),
  ('76000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222225', 'Bem-estar integral', 'sparkles', 3),
  ('76000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222226', 'Pausa sensorial', 'flower', 1),
  ('76000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222226', 'Rituais de presença', 'leaf', 2),
  ('76000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222226', 'Cuidado complementar', 'shield', 3)
on conflict (therapy_id, sort_order) do update
set
  id = excluded.id,
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.therapy_benefits (
  id,
  therapy_id,
  title,
  description,
  icon_key,
  sort_order
)
values
  ('77000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222225', 'Mais calma e relaxamento', 'Pode apoiar uma pausa de presença em rotinas intensas.', 'lotus', 1),
  ('77000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222225', 'Apoio em ansiedade e estresse', 'Um convite complementar para desacelerar com cuidado.', 'heart', 2),
  ('77000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222225', 'Mais energia vital e disposição', 'Pode favorecer percepção corporal e presença.', 'sun', 3),
  ('77000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222225', 'Qualidade do descanso', 'Pode compor uma rotina de relaxamento antes do sono.', 'moon', 4),
  ('77000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222225', 'Equilíbrio emocional e mental', 'Apoia uma experiência de autocuidado sem substituir acompanhamento profissional.', 'balance', 5),
  ('77000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222225', 'Sensação de leveza e bem-estar', 'Um espaço para perceber o corpo e acolher o momento presente.', 'diamond', 6),
  ('77000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222226', 'Pausa e relaxamento', 'Pode apoiar rituais simples de presença.', 'leaf', 1),
  ('77000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222226', 'Atenção aos sentidos', 'Convida a observar aromas, corpo e ambiente com cuidado.', 'flower', 2),
  ('77000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222226', 'Autocuidado complementar', 'Deve ser usada com orientação responsável e sem promessa de resultado.', 'shield', 3)
on conflict (therapy_id, sort_order) do update
set
  id = excluded.id,
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  updated_at = now();

with source_themes(slug, name, description, image_url, sort_order) as (
  values
    ('emocoes-bem-estar', 'Emoções e Bem-Estar', 'Sentimentos, ansiedade, estresse e sobrecarga emocional apresentados como temas de cuidado e reflexão.', '/journey/emocoes-bem-estar.png', 1),
    ('autoconhecimento-transformacao', 'Autoconhecimento e Transformação', 'Perguntas sobre identidade, padrões, autoaceitação e desenvolvimento pessoal.', '/journey/autoconhecimento-transformacao.png', 2),
    ('relacionamentos', 'Relacionamentos', 'Vínculos familiares, amorosos e sociais observados com responsabilidade e sem promessa de resultado.', '/journey/relacionamentos.png', 3),
    ('autoestima-poder-pessoal', 'Autoestima e Poder Pessoal', 'Confiança, autoimagem, insegurança e amor próprio em linguagem acolhedora.', '/journey/autoestima-poder-pessoal.png', 4),
    ('proposito-direcao', 'Propósito e Direção', 'Clareza de vida, escolhas, vocação e recomeços tratados como caminhos de reflexão.', '/journey/proposito-direcao.png', 5),
    ('espiritualidade', 'Espiritualidade e Conexão Interior', 'Conexão espiritual, intuição e alinhamento interior sem prometer previsões ou garantias.', '/journey/espiritualidade.png', 6),
    ('energia-equilibrio-energetico', 'Energia e Equilíbrio Energético', 'Percepções de cansaço, bloqueio e equilíbrio energético dentro de práticas complementares.', '/journey/energia-equilibrio-energetico.png', 7),
    ('libertacao-renovacao', 'Libertação e Renovação', 'Encerramento de ciclos, passado, mágoas e abertura para novos caminhos.', '/journey/libertacao-renovacao.png', 8),
    ('corpo-relaxamento-qualidade-vida', 'Corpo, Relaxamento e Qualidade de Vida', 'Relaxamento, sono, tensões e reconexão corporal em contexto exclusivamente online.', '/journey/corpo-relaxamento-qualidade-vida.png', 9),
    ('vida-profissional-prosperidade', 'Vida Profissional e Prosperidade', 'Trabalho, carreira, prosperidade e relação com dinheiro sem aconselhamento financeiro.', '/journey/vida-profissional-prosperidade.png', 10)
)
insert into public.matching_themes (
  name,
  slug,
  description,
  image_url,
  sort_order,
  is_active
)
select
  name,
  slug,
  description,
  image_url,
  sort_order,
  true
from source_themes
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with canonical_theme_slugs(slug) as (
  values
    ('emocoes-bem-estar'),
    ('autoconhecimento-transformacao'),
    ('relacionamentos'),
    ('autoestima-poder-pessoal'),
    ('proposito-direcao'),
    ('espiritualidade'),
    ('energia-equilibrio-energetico'),
    ('libertacao-renovacao'),
    ('corpo-relaxamento-qualidade-vida'),
    ('vida-profissional-prosperidade')
)
update public.matching_themes as theme
set
  is_active = false,
  updated_at = now()
where theme.slug not in (select slug from canonical_theme_slugs)
  and not exists (
    select 1
    from public.therapy_matching_themes as therapy_theme
    where therapy_theme.theme_id = theme.id
  )
  and not exists (
    select 1
    from public.therapist_service_matching_themes as service_theme
    where service_theme.theme_id = theme.id
  );

with source_interests(theme_slug, slug, name, sort_order) as (
  values
    ('emocoes-bem-estar', 'ansiedade', 'Ansiedade', 1),
    ('emocoes-bem-estar', 'estresse', 'Estresse', 2),
    ('emocoes-bem-estar', 'medo', 'Medo', 3),
    ('emocoes-bem-estar', 'tristeza', 'Tristeza', 4),
    ('emocoes-bem-estar', 'irritacao', 'Irritação', 5),
    ('emocoes-bem-estar', 'sobrecarga-emocional', 'Sobrecarga emocional', 6),
    ('emocoes-bem-estar', 'sensibilidade-excessiva', 'Sensibilidade excessiva', 7),
    ('autoconhecimento-transformacao', 'entender-a-si-mesmo', 'Entender a si mesmo', 1),
    ('autoconhecimento-transformacao', 'identificar-padroes', 'Identificar padrões', 2),
    ('autoconhecimento-transformacao', 'clareza-emocional', 'Clareza emocional', 3),
    ('autoconhecimento-transformacao', 'autoaceitacao', 'Autoaceitação', 4),
    ('autoconhecimento-transformacao', 'desenvolvimento-pessoal', 'Desenvolvimento pessoal', 5),
    ('relacionamentos', 'conflitos-familiares', 'Conflitos familiares', 1),
    ('relacionamentos', 'relacionamentos-amorosos', 'Relacionamentos amorosos', 2),
    ('relacionamentos', 'separacoes', 'Separações', 3),
    ('relacionamentos', 'dependencia-emocional', 'Dependência emocional', 4),
    ('relacionamentos', 'perdao', 'Perdão', 5),
    ('relacionamentos', 'solidao', 'Solidão', 6),
    ('relacionamentos', 'dificuldade-de-impor-limites', 'Dificuldade de impor limites', 7),
    ('autoestima-poder-pessoal', 'fortalecer-a-confianca', 'Fortalecer a confiança', 1),
    ('autoestima-poder-pessoal', 'melhorar-a-autoimagem', 'Melhorar a autoimagem', 2),
    ('autoestima-poder-pessoal', 'trabalhar-a-inseguranca', 'Trabalhar a insegurança', 3),
    ('autoestima-poder-pessoal', 'desenvolver-amor-proprio', 'Desenvolver amor próprio', 4),
    ('autoestima-poder-pessoal', 'superar-a-autocritica', 'Superar a autocrítica', 5),
    ('proposito-direcao', 'clareza-de-vida', 'Clareza de vida', 1),
    ('proposito-direcao', 'proposito', 'Propósito', 2),
    ('proposito-direcao', 'vocacao', 'Vocação', 3),
    ('proposito-direcao', 'decisoes-importantes', 'Decisões importantes', 4),
    ('proposito-direcao', 'recomecos', 'Recomeços', 5),
    ('espiritualidade', 'conexao-espiritual', 'Conexão espiritual', 1),
    ('espiritualidade', 'expansao-de-consciencia', 'Expansão de consciência', 2),
    ('espiritualidade', 'intuicao', 'Intuição', 3),
    ('espiritualidade', 'desenvolvimento-espiritual', 'Desenvolvimento espiritual', 4),
    ('espiritualidade', 'alinhamento-interior', 'Alinhamento interior', 5),
    ('energia-equilibrio-energetico', 'cansaco-energetico', 'Cansaço energético', 1),
    ('energia-equilibrio-energetico', 'bloqueios-energeticos', 'Bloqueios energéticos', 2),
    ('energia-equilibrio-energetico', 'sensacao-de-peso', 'Sensação de peso', 3),
    ('energia-equilibrio-energetico', 'desequilibrio-energetico', 'Desequilíbrio energético', 4),
    ('energia-equilibrio-energetico', 'necessidade-de-revitalizacao', 'Necessidade de revitalização', 5),
    ('energia-equilibrio-energetico', 'protecao-energetica', 'Proteção energética', 6),
    ('libertacao-renovacao', 'encerrar-ciclos', 'Encerrar ciclos', 1),
    ('libertacao-renovacao', 'soltar-o-passado', 'Soltar o passado', 2),
    ('libertacao-renovacao', 'liberar-crencas-limitantes', 'Liberar crenças limitantes', 3),
    ('libertacao-renovacao', 'trabalhar-magoas', 'Trabalhar mágoas', 4),
    ('libertacao-renovacao', 'superar-bloqueios-emocionais', 'Superar bloqueios emocionais', 5),
    ('libertacao-renovacao', 'abrir-espaco-para-o-novo', 'Abrir espaço para o novo', 6),
    ('corpo-relaxamento-qualidade-vida', 'relaxamento-profundo', 'Relaxamento profundo', 1),
    ('corpo-relaxamento-qualidade-vida', 'melhora-do-sono', 'Melhora do sono', 2),
    ('corpo-relaxamento-qualidade-vida', 'reducao-de-tensoes', 'Redução de tensões', 3),
    ('corpo-relaxamento-qualidade-vida', 'reconexao-corporal', 'Reconexão corporal', 4),
    ('corpo-relaxamento-qualidade-vida', 'presenca', 'Presença', 5),
    ('corpo-relaxamento-qualidade-vida', 'equilibrio-corpo-mente', 'Equilíbrio corpo-mente', 6),
    ('vida-profissional-prosperidade', 'prosperidade-e-abundancia', 'Prosperidade e abundância', 1),
    ('vida-profissional-prosperidade', 'bloqueios-financeiros', 'Bloqueios financeiros', 2),
    ('vida-profissional-prosperidade', 'relacao-com-dinheiro', 'Relação com dinheiro', 3),
    ('vida-profissional-prosperidade', 'crescimento-na-carreira', 'Crescimento na carreira', 4),
    ('vida-profissional-prosperidade', 'transicao-profissional', 'Transição profissional', 5),
    ('vida-profissional-prosperidade', 'produtividade', 'Produtividade', 6)
),
resolved as (
  select
    theme.id as theme_id,
    source_interests.slug,
    source_interests.name,
    source_interests.sort_order
  from source_interests
  join public.matching_themes as theme
    on theme.slug = source_interests.theme_slug
)
insert into public.matching_interests (
  theme_id,
  name,
  slug,
  sort_order,
  is_active
)
select
  theme_id,
  name,
  slug,
  sort_order,
  true
from resolved
on conflict (slug) do update
set
  name = excluded.name,
  theme_id = case
    when not exists (
      select 1
      from public.therapist_service_matching_interests as service_interest
      where service_interest.interest_id = matching_interests.id
    ) then excluded.theme_id
    else matching_interests.theme_id
  end,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with canonical_interest_slugs(slug) as (
  values
    ('ansiedade'),
    ('estresse'),
    ('medo'),
    ('tristeza'),
    ('irritacao'),
    ('sobrecarga-emocional'),
    ('sensibilidade-excessiva'),
    ('entender-a-si-mesmo'),
    ('identificar-padroes'),
    ('clareza-emocional'),
    ('autoaceitacao'),
    ('desenvolvimento-pessoal'),
    ('conflitos-familiares'),
    ('relacionamentos-amorosos'),
    ('separacoes'),
    ('dependencia-emocional'),
    ('perdao'),
    ('solidao'),
    ('dificuldade-de-impor-limites'),
    ('fortalecer-a-confianca'),
    ('melhorar-a-autoimagem'),
    ('trabalhar-a-inseguranca'),
    ('desenvolver-amor-proprio'),
    ('superar-a-autocritica'),
    ('clareza-de-vida'),
    ('proposito'),
    ('vocacao'),
    ('decisoes-importantes'),
    ('recomecos'),
    ('conexao-espiritual'),
    ('expansao-de-consciencia'),
    ('intuicao'),
    ('desenvolvimento-espiritual'),
    ('alinhamento-interior'),
    ('cansaco-energetico'),
    ('bloqueios-energeticos'),
    ('sensacao-de-peso'),
    ('desequilibrio-energetico'),
    ('necessidade-de-revitalizacao'),
    ('protecao-energetica'),
    ('encerrar-ciclos'),
    ('soltar-o-passado'),
    ('liberar-crencas-limitantes'),
    ('trabalhar-magoas'),
    ('superar-bloqueios-emocionais'),
    ('abrir-espaco-para-o-novo'),
    ('relaxamento-profundo'),
    ('melhora-do-sono'),
    ('reducao-de-tensoes'),
    ('reconexao-corporal'),
    ('presenca'),
    ('equilibrio-corpo-mente'),
    ('prosperidade-e-abundancia'),
    ('bloqueios-financeiros'),
    ('relacao-com-dinheiro'),
    ('crescimento-na-carreira'),
    ('transicao-profissional'),
    ('produtividade')
)
update public.matching_interests as interest
set
  is_active = false,
  updated_at = now()
where interest.slug not in (select slug from canonical_interest_slugs)
  and not exists (
    select 1
    from public.therapist_service_matching_interests as service_interest
    where service_interest.interest_id = interest.id
  );

insert into public.matching_versions (
  id,
  status,
  version,
  published_at
)
select
  gen_random_uuid(),
  'published',
  coalesce((select max(version) from public.matching_versions), 0) + 1,
  now()
where not exists (
  select 1
  from public.matching_versions
  where status = 'published'
)
on conflict (version) do nothing;



update public.therapies
set slug = 'taro'
where id = '22222222-2222-4222-8222-222222222228'
  and slug <> 'taro';

insert into public.therapies (
  id,
  name,
  slug,
  short_description,
  description,
  status,
  is_featured,
  safety_note,
  image_url,
  published_at,
  popularity_score,
  search_aliases,
  is_public_visible
)
values
  (
    '22222222-2222-4222-8222-222222222225',
    'Reiki',
    'reiki',
    'Prática complementar de imposição ou aproximação das mãos, associada a relaxamento e cuidado energético.',
    'No TES, Reiki é apresentado como prática complementar online, conduzida por vídeo, com espaço para desacelerar e voltar a atenção para si. A experiência não substitui cuidados de saúde.',
    'published',
    true,
    'Reiki é uma prática complementar e não substitui acompanhamento médico, psicológico, diagnóstico ou tratamento de saúde.',
    '/therapies/reiki-editorial.png',
    now() - interval '80 days',
    96,
    array['reiki', 'energia', 'equilibrio energetico', 'pratica energetica'],
    true
  ),
  (
    '22222222-2222-4222-8222-222222222228',
    'Tarô',
    'taro',
    'Leitura simbólica de cartas como ferramenta de reflexão sobre situações e possibilidades.',
    'No TES, Tarô é apresentado como leitura simbólica e reflexiva. Não promete previsão, decisão correta ou resultado garantido, e não substitui orientação médica, psicológica, jurídica ou financeira.',
    'published',
    false,
    'Tarô é uma leitura simbólica e reflexiva; não substitui orientação médica, psicológica, jurídica, financeira ou outras decisões profissionais.',
    '/therapies/taro-editorial.png',
    now() - interval '38 days',
    76,
    array['taro', 'tarot', 'cartas', 'oraculo', 'autoconhecimento'],
    true
  ),
  (
    '22222222-2222-4222-8222-222222222230',
    'Constelação Familiar',
    'constelacao-familiar',
    'Prática vivencial e simbólica voltada a observação de vínculos e dinâmicas familiares.',
    'No TES, Constelação Familiar é apresentada como experiência simbólica e reflexiva. A prática não diagnostica, não reconstrói memórias, não atribui culpa e não promete resolução.',
    'published',
    false,
    'Constelação Familiar é uma experiência simbólica; não diagnostica, não reconstrói memórias, não atribui culpa e não promete resolução.',
    '/therapies/constelacao-familiar-editorial.png',
    now() - interval '26 days',
    74,
    array['constelacao familiar', 'sistemica', 'familia', 'vinculos', 'padroes'],
    true
  )
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  status = excluded.status,
  is_featured = excluded.is_featured,
  safety_note = excluded.safety_note,
  image_url = excluded.image_url,
  published_at = excluded.published_at,
  popularity_score = excluded.popularity_score,
  search_aliases = excluded.search_aliases,
  is_public_visible = excluded.is_public_visible,
  updated_at = now();

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
    '22222222-2222-4222-8222-222222222225',
    '/therapies/reiki-editorial.png',
    'Uma prática complementar para desacelerar, voltar a atenção para si e reservar um tempo de presença.',
    'Reiki é uma prática de imposição ou aproximação das mãos associada ao cuidado energético e ao relaxamento. No atendimento online, o terapeuta conduz a experiência por vídeo enquanto a pessoa acompanha em um lugar confortável.',
    'Dentro do TES, Reiki aparece como caminho complementar de autocuidado. Ele pode apoiar uma pausa consciente, mas não substitui cuidados de saúde nem garante redução de sintomas.',
    'Reiki é uma prática complementar e não substitui acompanhamento médico, psicológico, diagnóstico ou tratamento de saúde.',
    'Reiki | Terapeuta Eu Sou',
    'Conheça Reiki como prática complementar online e encontre profissionais publicados que oferecem esse caminho pela plataforma.',
    'Prática complementar',
    'energy',
    'energy'::public.therapy_visual_theme_key,
    'center'
  ),
  (
    '22222222-2222-4222-8222-222222222228',
    '/therapies/taro-editorial.png',
    'Uma leitura simbólica para refletir sobre escolhas, caminhos e perguntas internas com mais clareza.',
    'Tarô é uma leitura simbólica de cartas utilizada como ferramenta de reflexão. Durante o encontro online, as cartas são apresentadas e interpretadas como linguagem de imagens, perguntas e possibilidades.',
    'No TES, Tarô não é apresentado como previsão. A leitura não substitui orientação médica, psicológica, jurídica, financeira ou qualquer decisão profissional especializada.',
    'Tarô é uma leitura simbólica e reflexiva; não substitui orientação médica, psicológica, jurídica, financeira ou outras decisões profissionais.',
    'Tarô | Terapeuta Eu Sou',
    'Conheça Tarô como leitura simbólica e reflexiva, sem promessa de previsão ou resultado garantido.',
    'Leitura simbólica',
    'oracle',
    'oracle'::public.therapy_visual_theme_key,
    'center'
  ),
  (
    '22222222-2222-4222-8222-222222222230',
    '/therapies/constelacao-familiar-editorial.png',
    'Uma experiência simbólica para observar vínculos, padrões e movimentos relacionais com cuidado.',
    'Constelação Familiar online utiliza recursos simbólicos, como objetos, figuras ou cartões, para representar relações e situações de forma reflexiva.',
    'No TES, a prática não diagnostica, não reconstrói memórias, não atribui culpa e não promete resolução. Ela é apresentada como experiência simbólica de observação.',
    'Constelação Familiar é uma experiência simbólica; não diagnostica, não reconstrói memórias, não atribui culpa e não promete resolução.',
    'Constelação Familiar | Terapeuta Eu Sou',
    'Conheça Constelação Familiar como experiência simbólica e reflexiva para observar vínculos e padrões, sem promessa de resolução.',
    'Experiência simbólica',
    'systemic',
    'systemic'::public.therapy_visual_theme_key,
    'center'
  )
on conflict (therapy_id) do update
set
  hero_image_url = excluded.hero_image_url,
  subtitle = excluded.subtitle,
  introduction = excluded.introduction,
  complementary_description = excluded.complementary_description,
  safety_note = excluded.safety_note,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  approach_label = excluded.approach_label,
  approach_icon_key = excluded.approach_icon_key,
  visual_theme_key = excluded.visual_theme_key,
  hero_focal_point = excluded.hero_focal_point,
  updated_at = now();

delete from public.therapy_highlights
where therapy_id in (
  '22222222-2222-4222-8222-222222222225',
  '22222222-2222-4222-8222-222222222228',
  '22222222-2222-4222-8222-222222222230'
);

insert into public.therapy_highlights (id, therapy_id, title, icon_key, sort_order)
values
  ('76000000-0000-4000-8000-000000000101', '22222222-2222-4222-8222-222222222225', 'Atendimento online', 'shield', 1),
  ('76000000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222225', 'Cuidado energético', 'energy', 2),
  ('76000000-0000-4000-8000-000000000103', '22222222-2222-4222-8222-222222222225', 'Prática complementar', 'sparkles', 3),
  ('76000000-0000-4000-8000-000000000104', '22222222-2222-4222-8222-222222222228', 'Leitura por vídeo', 'oracle', 1),
  ('76000000-0000-4000-8000-000000000105', '22222222-2222-4222-8222-222222222228', 'Reflexão simbólica', 'moon', 2),
  ('76000000-0000-4000-8000-000000000106', '22222222-2222-4222-8222-222222222228', 'Perguntas e caminhos', 'sparkles', 3),
  ('76000000-0000-4000-8000-000000000107', '22222222-2222-4222-8222-222222222230', 'Experiência simbólica', 'systemic', 1),
  ('76000000-0000-4000-8000-000000000108', '22222222-2222-4222-8222-222222222230', 'Vínculos e relações', 'heart', 2),
  ('76000000-0000-4000-8000-000000000109', '22222222-2222-4222-8222-222222222230', 'Observação de padrões', 'pattern', 3)
on conflict (id) do update
set
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  updated_at = now();

delete from public.therapy_benefits
where therapy_id in (
  '22222222-2222-4222-8222-222222222225',
  '22222222-2222-4222-8222-222222222228',
  '22222222-2222-4222-8222-222222222230'
);

insert into public.therapy_benefits (id, therapy_id, title, description, icon_key, sort_order)
values
  ('77000000-0000-4000-8000-000000000101', '22222222-2222-4222-8222-222222222225', 'Pausa de presença', 'Um tempo reservado para desacelerar e perceber o corpo com mais calma.', 'leaf', 1),
  ('77000000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222225', 'Cuidado energético complementar', 'A prática é apresentada como complemento, sem substituir cuidados de saúde.', 'energy', 2),
  ('77000000-0000-4000-8000-000000000103', '22222222-2222-4222-8222-222222222225', 'Rotina de autocuidado', 'Pode compor rituais pessoais de relaxamento e presença.', 'lotus', 3),
  ('77000000-0000-4000-8000-000000000104', '22222222-2222-4222-8222-222222222225', 'Ambiente acolhedor', 'O atendimento por vídeo permite acompanhar a experiência em um lugar confortável.', 'shield', 4),
  ('77000000-0000-4000-8000-000000000105', '22222222-2222-4222-8222-222222222228', 'Clareza reflexiva', 'As cartas ajudam a organizar perguntas e possibilidades sem prometer previsões.', 'oracle', 1),
  ('77000000-0000-4000-8000-000000000106', '22222222-2222-4222-8222-222222222228', 'Autoconhecimento', 'A leitura pode apoiar uma conversa sobre escolhas, padrões e percepções.', 'moon', 2),
  ('77000000-0000-4000-8000-000000000107', '22222222-2222-4222-8222-222222222228', 'Símbolos e narrativas', 'O foco está na interpretação simbólica, não em decisões deterministas.', 'sparkles', 3),
  ('77000000-0000-4000-8000-000000000108', '22222222-2222-4222-8222-222222222228', 'Conversa responsável', 'Não substitui orientações profissionais médicas, jurídicas, financeiras ou psicológicas.', 'shield', 4),
  ('77000000-0000-4000-8000-000000000109', '22222222-2222-4222-8222-222222222230', 'Observação de vínculos', 'A experiência usa representações simbólicas para olhar relações e movimentos.', 'systemic', 1),
  ('77000000-0000-4000-8000-000000000110', '22222222-2222-4222-8222-222222222230', 'Identificação de padrões', 'Pode apoiar uma reflexão cuidadosa sobre repetições percebidas pela pessoa.', 'pattern', 2),
  ('77000000-0000-4000-8000-000000000111', '22222222-2222-4222-8222-222222222230', 'Cuidado com histórias familiares', 'A prática deve evitar culpa, diagnóstico ou reconstrução de memórias.', 'heart', 3),
  ('77000000-0000-4000-8000-000000000112', '22222222-2222-4222-8222-222222222230', 'Processo simbólico', 'A proposta é observar sentidos possíveis, sem prometer resolução.', 'shield', 4)
on conflict (id) do update
set
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  updated_at = now();

delete from public.therapy_faqs
where therapy_id in (
  '22222222-2222-4222-8222-222222222225',
  '22222222-2222-4222-8222-222222222228',
  '22222222-2222-4222-8222-222222222230'
);

insert into public.therapy_faqs (id, therapy_id, question, answer, sort_order)
values
  ('78000000-0000-4000-8000-000000000101', '22222222-2222-4222-8222-222222222225', 'Reiki substitui atendimento de saúde?', 'Não. Reiki é apresentado como prática complementar e não substitui acompanhamento médico, psicológico, diagnóstico ou tratamento.', 1),
  ('78000000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222225', 'O atendimento online faz sentido?', 'No TES, o atendimento acontece por vídeo, com orientação do terapeuta e um ambiente escolhido pela pessoa para acompanhar a prática.', 2),
  ('78000000-0000-4000-8000-000000000103', '22222222-2222-4222-8222-222222222225', 'Existe garantia de melhora?', 'Não. A página não promete equilíbrio, redução de sintomas ou qualquer resultado garantido.', 3),
  ('78000000-0000-4000-8000-000000000104', '22222222-2222-4222-8222-222222222228', 'Tarô faz previsões?', 'No TES, Tarô é apresentado como leitura simbólica e reflexiva, sem promessa de previsão ou determinação do futuro.', 1),
  ('78000000-0000-4000-8000-000000000105', '22222222-2222-4222-8222-222222222228', 'Posso usar a leitura para decisões importantes?', 'A leitura pode apoiar reflexão, mas não substitui orientação médica, psicológica, jurídica, financeira ou outras decisões profissionais.', 2),
  ('78000000-0000-4000-8000-000000000106', '22222222-2222-4222-8222-222222222228', 'Como acontece online?', 'O terapeuta apresenta as cartas por vídeo e conduz a interpretação como conversa simbólica e responsável.', 3),
  ('78000000-0000-4000-8000-000000000107', '22222222-2222-4222-8222-222222222230', 'Constelação Familiar diagnostica problemas?', 'Não. No TES, a prática é apresentada como experiência simbólica e não como diagnóstico ou tratamento.', 1),
  ('78000000-0000-4000-8000-000000000108', '22222222-2222-4222-8222-222222222230', 'A prática reconstrói memórias?', 'Não. A proposta não é reconstruir memórias, atribuir culpa ou afirmar verdades sobre pessoas e famílias.', 2),
  ('78000000-0000-4000-8000-000000000109', '22222222-2222-4222-8222-222222222230', 'Ela garante resolução de conflitos?', 'Não. A prática pode apoiar uma reflexão simbólica, mas não promete resolução ou resultado garantido.', 3)
on conflict (id) do update
set
  therapy_id = excluded.therapy_id,
  question = excluded.question,
  answer = excluded.answer,
  sort_order = excluded.sort_order,
  updated_at = now();



update public.matching_therapy_settings
set is_visible_in_matching = false, updated_at = now();

insert into public.matching_therapy_settings (therapy_id, is_visible_in_matching)
select id, true
from public.therapies
where slug in ('reiki', 'taro', 'constelacao-familiar')
on conflict (therapy_id) do update
set
  is_visible_in_matching = excluded.is_visible_in_matching,
  updated_at = now();

delete from public.matching_weights
where version_id in (
  select id
  from public.matching_versions
  where status = 'published'
  order by version desc
  limit 1
);

insert into public.matching_weights (
  version_id,
  therapy_id,
  theme_id,
  interest_id,
  weight,
  reason,
  is_active
)
select
  (
    select id
    from public.matching_versions
    where status = 'published'
    order by version desc
    limit 1
  ),
  therapies.id,
  matching_themes.id,
  null::uuid,
  weights.weight,
  weights.reason,
  true
from (
  values
    ('reiki', 'emocoes-bem-estar', 4, 'Pode conversar com busca por pausa e bem-estar emocional.'),
    ('reiki', 'energia-equilibrio-energetico', 5, 'Relação direta com cuidado energético complementar.'),
    ('taro', 'autoconhecimento-transformacao', 5, 'Leitura simbólica voltada a reflexão e autoconhecimento.'),
    ('taro', 'relacionamentos', 4, 'Pode apoiar perguntas sobre vínculos e escolhas.'),
    ('taro', 'emocoes-bem-estar', 3, 'Pode organizar percepções emocionais sem substituir cuidado clínico.'),
    ('constelacao-familiar', 'relacionamentos', 5, 'Experiência simbólica voltada a vínculos e dinâmicas familiares.'),
    ('constelacao-familiar', 'autoconhecimento-transformacao', 4, 'Apoia observação de padrões percebidos.'),
    ('constelacao-familiar', 'libertacao-renovacao', 4, 'Pode apoiar reflexão sobre encerramentos e ciclos.')
) as weights(therapy_slug, theme_slug, weight, reason)
join public.therapies on therapies.slug = weights.therapy_slug
join public.matching_themes on matching_themes.slug = weights.theme_slug;

insert into public.matching_weights (
  version_id,
  therapy_id,
  theme_id,
  interest_id,
  weight,
  reason,
  is_active
)
select
  (
    select id
    from public.matching_versions
    where status = 'published'
    order by version desc
    limit 1
  ),
  therapies.id,
  null::uuid,
  matching_interests.id,
  weights.weight,
  weights.reason,
  true
from (
  values
    ('reiki', 'ansiedade', 4, 'Pode apoiar uma pausa complementar em momentos de ansiedade.'),
    ('reiki', 'desequilibrio-energetico', 5, 'Associado diretamente ao cuidado energético complementar.'),
    ('reiki', 'estresse', 4, 'Pode compor uma rotina de desaceleracao.'),
    ('taro', 'entender-a-si-mesmo', 5, 'Leitura simbólica para autoconhecimento.'),
    ('taro', 'relacionamentos-amorosos', 4, 'Pode apoiar reflexão sobre vínculos afetivos.'),
    ('taro', 'ansiedade', 3, 'Pode organizar perguntas sem promessa de previsão ou resultado.'),
    ('constelacao-familiar', 'conflitos-familiares', 5, 'Experiência simbólica voltada a vínculos familiares.'),
    ('constelacao-familiar', 'identificar-padroes', 5, 'Apoia observação de padrões percebidos.'),
    ('constelacao-familiar', 'encerrar-ciclos', 4, 'Pode apoiar reflexão simbólica sobre encerramentos.')
) as weights(therapy_slug, interest_slug, weight, reason)
join public.therapies on therapies.slug = weights.therapy_slug
join public.matching_interests on matching_interests.slug = weights.interest_slug;

delete from public.therapy_matching_themes
where therapy_id in (
  select distinct matching_weights.therapy_id
  from public.matching_weights
  where matching_weights.version_id in (
      select id
      from public.matching_versions
      where status = 'published'
      order by version desc
      limit 1
    )
    and matching_weights.theme_id is not null
);

insert into public.therapy_matching_themes (
  therapy_id,
  theme_id,
  sort_order
)
select
  matching_weights.therapy_id,
  matching_weights.theme_id,
  row_number() over (
    partition by matching_weights.therapy_id
    order by matching_weights.weight desc, matching_themes.sort_order asc, matching_themes.name asc
  )::integer as sort_order
from public.matching_weights
join public.matching_themes
  on matching_themes.id = matching_weights.theme_id
where matching_weights.version_id in (
    select id
    from public.matching_versions
    where status = 'published'
    order by version desc
    limit 1
  )
  and matching_weights.is_active = true
  and matching_weights.theme_id is not null
  and matching_themes.is_active = true
on conflict (therapy_id, theme_id) do update
set
  sort_order = excluded.sort_order,
  updated_at = now();

-- Stable therapy palette shared by Agenda and the future therapy editor.
update public.therapies
set calendar_color_key = case
  when slug in ('reiki', 'thetahealing') then 'purple'
  when slug in ('aromaterapia', 'fitoterapia') then 'green'
  when slug in ('mesa-radionica', 'constelacao-familiar') then 'orange'
  when slug in ('mindfulness', 'meditacao') then 'blue'
  when slug in ('taro', 'tarologia') then 'pink'
  else 'neutral'
end
where slug in (
  'reiki',
  'thetahealing',
  'aromaterapia',
  'fitoterapia',
  'mesa-radionica',
  'constelacao-familiar',
  'mindfulness',
  'meditacao',
  'taro',
  'tarologia',
  'cristaloterapia'
);

-- Fase 1: canonical platform therapies and therapist service fixtures.
update public.therapies
set
  is_available_for_services = slug in (
    'reiki',
    'taro',
    'constelacao-familiar'
  ),
  updated_at = now()
where slug in (
  'reiki',
  'taro',
  'constelacao-familiar',
  'mindfulness',
  'aromaterapia',
  'cristaloterapia'
);

update public.therapies
set
  status = 'published',
  is_public_visible = false,
  is_available_for_services = false,
  updated_at = now()
where slug = 'aromaterapia';

update public.matching_therapy_settings
set
  is_visible_in_matching = false,
  updated_at = now()
where therapy_id in (
  select id from public.therapies where slug = 'aromaterapia'
);

update public.therapies
set
  status = 'deprecated',
  is_public_visible = false,
  is_available_for_services = false,
  updated_at = now()
where slug = 'cristaloterapia';
