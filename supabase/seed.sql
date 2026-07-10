insert into public.therapy_categories (id, name, slug, description, sort_order, is_active)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Terapias Integrativas',
    'terapias-integrativas',
    'Caminhos terapêuticos complementares, apresentados com linguagem cuidadosa e sem promessa de resultado.',
    1,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111112',
    'Práticas de Presença',
    'praticas-de-presenca',
    'Práticas voltadas a presença, respiração e escuta de si.',
    2,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.therapies (
  id,
  category_id,
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
    '11111111-1111-4111-8111-111111111111',
    'Terapia Integrativa',
    'terapia-integrativa',
    'Um caminho amplo para organizar sentimentos, escolhas e momentos de transição.',
    'A Terapia Integrativa reúne práticas de escuta e cuidado complementar para apoiar a pessoa a perceber o que faz sentido no momento atual.',
    'active',
    true,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Terapia Floral',
    'terapia-floral',
    'Uma possibilidade para quem busca apoio em equilíbrio emocional e autoconhecimento.',
    'A Terapia Floral pode ser apresentada como uma prática complementar, sempre sem promessa de cura ou resultado garantido.',
    'active',
    false,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    '11111111-1111-4111-8111-111111111112',
    'Meditação Guiada',
    'meditacao-guiada',
    'Uma prática para cultivar presença, pausa e percepção do próprio ritmo.',
    'A Meditação Guiada ajuda a criar um espaço de presença e observação, sem substituir cuidados profissionais quando necessários.',
    'active',
    false,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222224',
    '11111111-1111-4111-8111-111111111111',
    'Cristaloterapia',
    'cristaloterapia',
    'Terapia inativa usada apenas para validar exclusão no match.',
    'Registro de seed para garantir que terapias inativas não sejam retornadas pelo match.',
    'inactive',
    false,
    'Terapia inativa no MVP.'
  )
on conflict (slug) do update
set
  category_id = excluded.category_id,
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
