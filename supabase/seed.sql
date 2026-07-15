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

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ana.oliveira@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Ana Oliveira"}'::jsonb,
    now(),
    now()
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rafael.santos@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Rafael Santos"}'::jsonb,
    now(),
    now()
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'celia.martins@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Celia Martins"}'::jsonb,
    now(),
    now()
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'juliana.costa@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Juliana Costa"}'::jsonb,
    now(),
    now()
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lucas.pereira@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Lucas Pereira"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.ana@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Paciente Ana"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.rafael@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Paciente Rafael"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.celia@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Paciente Celia"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.juliana@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Paciente Juliana"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.lucas@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Paciente Lucas"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.profiles (id, role, display_name, email, avatar_url)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'therapist', 'Ana Oliveira', 'ana.oliveira@example.test', '/therapists/ana-oliveira.png'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'therapist', 'Rafael Santos', 'rafael.santos@example.test', '/therapists/rafael-santos.png'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'therapist', 'Celia Martins', 'celia.martins@example.test', '/therapists/celia-martins.png'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'therapist', 'Juliana Costa', 'juliana.costa@example.test', '/therapists/juliana-costa.png'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'therapist', 'Lucas Pereira', 'lucas.pereira@example.test', '/therapists/lucas-pereira.png'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'patient', 'Paciente Ana', 'paciente.ana@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'patient', 'Paciente Rafael', 'paciente.rafael@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'patient', 'Paciente Celia', 'paciente.celia@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'patient', 'Paciente Juliana', 'paciente.juliana@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'patient', 'Paciente Lucas', 'paciente.lucas@example.test', null)
on conflict (id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.patient_profiles (
  id,
  user_id,
  display_name,
  timezone,
  marketing_consent,
  sensitive_data_consent_at
)
values
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Paciente Ana', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Paciente Rafael', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000003', 'Paciente Celia', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000004', 'Paciente Juliana', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000005', 'Paciente Lucas', 'America/Sao_Paulo', true, now())
on conflict (id) do update
set
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  marketing_consent = excluded.marketing_consent,
  sensitive_data_consent_at = excluded.sensitive_data_consent_at,
  updated_at = now();

insert into public.therapist_profiles (
  id,
  user_id,
  plan,
  status,
  slug,
  public_name,
  legal_name,
  headline,
  bio,
  photo_url,
  city,
  state,
  languages,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions,
  metadata
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'premium_plus',
    'approved',
    'ana-oliveira',
    'Ana Oliveira',
    'Ana Clara Oliveira',
    'Acolhimento integrativo para ansiedade, autoestima e escolhas com mais presença.',
    'Ana construiu sua prática em torno de escuta, presença e organização emocional. No TES, seu perfil principal apoia a evolução futura da página detalhada, com histórico de atendimentos online, depoimentos publicados e uma linguagem cuidadosa para momentos de transição.',
    '/therapists/ana-oliveira.png',
    'São Paulo',
    'SP',
    array['pt-BR'],
    true,
    true,
    true,
    '{"care_tags":["Ansiedade","Autoestima","Autoconhecimento"],"has_intro_video":true,"highlight":"Destaque TES","highlight_tone":"featured"}'::jsonb
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'aaaaaaaa-0000-4000-8000-000000000002',
    'premium',
    'approved',
    'rafael-santos',
    'Rafael Santos',
    'Rafael Santos',
    'Sessões para mudanças de vida, propósito e reorganização de caminhos.',
    'Rafael acompanha pessoas em fases de mudança com escuta integrativa e combinados claros de sessão.',
    '/therapists/rafael-santos.png',
    'Rio de Janeiro',
    'RJ',
    array['pt-BR'],
    true,
    true,
    true,
    '{"care_tags":["Mudanças de vida","Propósito","Equilíbrio emocional"],"has_intro_video":true,"highlight":"Destaque TES","highlight_tone":"featured"}'::jsonb
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    'aaaaaaaa-0000-4000-8000-000000000003',
    'premium',
    'approved',
    'celia-martins',
    'Celia Martins',
    'Celia Martins',
    'Escuta cuidadosa para relações, luto e processos de transformação.',
    'Celia trabalha com terapia floral e conversas de apoio para quem deseja atravessar fases delicadas com mais gentileza.',
    '/therapists/celia-martins.png',
    'Curitiba',
    'PR',
    array['pt-BR'],
    true,
    true,
    true,
    '{"care_tags":["Relacionamentos","Luto","Autoestima"],"has_intro_video":false,"highlight":"Perfil Verificado","highlight_tone":"verified"}'::jsonb
  ),
  (
    'c1000000-0000-4000-8000-000000000004',
    'aaaaaaaa-0000-4000-8000-000000000004',
    'free',
    'approved',
    'juliana-costa',
    'Juliana Costa',
    'Juliana Costa',
    'Apoio para famílias construírem diálogos mais leves e seguros.',
    'Juliana oferece sessões online com foco em comunicação, vínculos e rotina familiar.',
    '/therapists/juliana-costa.png',
    'Belo Horizonte',
    'MG',
    array['pt-BR'],
    true,
    true,
    true,
    '{"care_tags":["Família","Relacionamentos","Comunicação"],"has_intro_video":false,"highlight":"Perfil Verificado","highlight_tone":"verified"}'::jsonb
  ),
  (
    'c1000000-0000-4000-8000-000000000005',
    'aaaaaaaa-0000-4000-8000-000000000005',
    'premium_plus',
    'approved',
    'lucas-pereira',
    'Lucas Pereira',
    'Lucas Pereira',
    'Cuidado para autoconhecimento, escolhas e transições de vida.',
    'Lucas combina práticas de presença e conversa orientada para apoiar pausas, escolhas e ciclos novos.',
    '/therapists/lucas-pereira.png',
    'Florianópolis',
    'SC',
    array['pt-BR'],
    true,
    true,
    true,
    '{"care_tags":["Autoconhecimento","Propósito","Mudanças de vida"],"has_intro_video":true,"highlight":"Destaque TES","highlight_tone":"featured"}'::jsonb
  )
on conflict (slug) do update
set
  user_id = excluded.user_id,
  plan = excluded.plan,
  status = excluded.status,
  public_name = excluded.public_name,
  legal_name = excluded.legal_name,
  headline = excluded.headline,
  bio = excluded.bio,
  photo_url = excluded.photo_url,
  city = excluded.city,
  state = excluded.state,
  languages = excluded.languages,
  is_public = excluded.is_public,
  is_accepting_bookings = excluded.is_accepting_bookings,
  accepts_online_sessions = excluded.accepts_online_sessions,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  currency,
  status,
  online_only
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222221',
    'Sessão integrativa de acolhimento',
    'Um espaço de acolhimento para quem busca mais clareza, equilíbrio e leveza emocional.',
    50,
    12000,
    'BRL',
    'active',
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222221',
    'Sessão para mudanças de vida',
    'Apoio para quem está vivendo mudanças importantes e deseja encontrar novos caminhos.',
    50,
    12000,
    'BRL',
    'active',
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    'Sessão de escuta integrativa',
    'Escuta cuidadosa para relações, luto e processos de transformação.',
    50,
    14000,
    'BRL',
    'active',
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000004',
    '22222222-2222-4222-8222-222222222222',
    'Sessão de comunicação e vínculos',
    'Apoio para famílias construírem diálogos mais leves e seguros.',
    50,
    9000,
    'BRL',
    'active',
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000005',
    '22222222-2222-4222-8222-222222222223',
    'Sessão de presença e escolhas',
    'Cuidado para autoconhecimento, escolhas e transições de vida.',
    60,
    17000,
    'BRL',
    'active',
    true
  )
on conflict (id) do update
set
  therapist_profile_id = excluded.therapist_profile_id,
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  status = excluded.status,
  online_only = excluded.online_only,
  updated_at = now();

insert into public.availability_rules (
  id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
values
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 2, '18:00', '21:00', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 3, '09:30', '12:30', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', 5, '14:00', '18:00', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000004', 1, '10:00', '13:00', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', 2, '16:30', '19:30', 'America/Sao_Paulo', true)
on conflict (id) do update
set
  therapist_profile_id = excluded.therapist_profile_id,
  service_id = excluded.service_id,
  day_of_week = excluded.day_of_week,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  meeting_provider,
  meeting_url,
  completed_at
)
values
  ('f1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now() - interval '42 days', now() - interval '42 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/ana', now() - interval '42 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', now() - interval '35 days', now() - interval '35 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/rafael', now() - interval '35 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', now() - interval '28 days', now() - interval '28 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/celia', now() - interval '28 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000004', now() - interval '21 days', now() - interval '21 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliana', now() - interval '21 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', now() - interval '14 days', now() - interval '14 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/lucas', now() - interval '14 days' + interval '60 minutes')
on conflict (id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  service_id = excluded.service_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  timezone = excluded.timezone,
  status = excluded.status,
  payment_status = excluded.payment_status,
  meeting_provider = excluded.meeting_provider,
  meeting_url = excluded.meeting_url,
  completed_at = excluded.completed_at,
  updated_at = now();

insert into public.reviews (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  rating,
  comment,
  status,
  published_at
)
values
  ('90000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 5, 'Me senti acolhida desde a primeira sessão.', 'published', now() - interval '40 days'),
  ('90000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 5, 'Ajudou a organizar um momento muito difícil.', 'published', now() - interval '33 days'),
  ('90000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 5, 'Senti segurança para falar do que eu sentia.', 'published', now() - interval '26 days'),
  ('90000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 4, 'Nossas conversas em família ficaram mais leves.', 'published', now() - interval '19 days'),
  ('90000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 5, 'Me ajudou a entender meu propósito com mais calma.', 'published', now() - interval '12 days')
on conflict (id) do update
set
  booking_id = excluded.booking_id,
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  rating = excluded.rating,
  comment = excluded.comment,
  status = excluded.status,
  published_at = excluded.published_at,
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
    '22222222-2222-4222-8222-222222222225',
    '11111111-1111-4111-8111-111111111111',
    'Reiki',
    'reiki',
    'Prática integrativa de presença e equilíbrio energético.',
    'Reiki é apresentado no TES como prática integrativa complementar, sem promessa de cura, diagnóstico ou resultado garantido.',
    'active',
    true,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
  ),
  (
    '22222222-2222-4222-8222-222222222226',
    '11111111-1111-4111-8111-111111111111',
    'Aromaterapia',
    'aromaterapia',
    'Uso cuidadoso de óleos essenciais em práticas de acolhimento e bem-estar.',
    'Aromaterapia é apresentada no TES como prática complementar e deve ser comunicada sem promessa terapêutica garantida.',
    'active',
    true,
    'Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional.'
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

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  currency,
  status,
  online_only
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222225',
    'Reiki',
    'Harmonização dos centros energéticos, equilíbrio e bem-estar profundo.',
    50,
    17000,
    'BRL',
    'active',
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222226',
    'Aromaterapia',
    'Equilíbrio emocional e energético através dos óleos essenciais.',
    60,
    24000,
    'BRL',
    'active',
    true
  )
on conflict (id) do update
set
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  status = excluded.status,
  online_only = excluded.online_only,
  updated_at = now();

insert into public.therapist_profile_content_versions (
  id,
  therapist_profile_id,
  status,
  short_intro,
  essence_body,
  invitation_body,
  video_url,
  video_provider,
  video_thumbnail_url,
  video_title,
  experience_years,
  published_at
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'published',
  'Bem-vinda, alma bonita. Intuição que acolhe, energia que cuida e orientação que ilumina seu caminho de volta para você.',
  'Sou terapeuta integrativa há mais de 8 anos. Minha missão é oferecer acolhimento, escuta e orientação para você se conectar com sua essência, leveza e verdade.',
  'Assista ao vídeo e me conheça um pouco mais. Falo sobre minha jornada e como posso te acompanhar no seu momento atual.',
  'https://example.test/videos/ana-oliveira',
  'external',
  '/home/tablet-video-session.png',
  'Um convite para você',
  8,
  now() - interval '7 days'
)
on conflict (id) do update
set
  status = excluded.status,
  short_intro = excluded.short_intro,
  essence_body = excluded.essence_body,
  invitation_body = excluded.invitation_body,
  video_url = excluded.video_url,
  video_provider = excluded.video_provider,
  video_thumbnail_url = excluded.video_thumbnail_url,
  video_title = excluded.video_title,
  experience_years = excluded.experience_years,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.therapist_profile_guide_items (
  id,
  content_version_id,
  icon,
  label,
  sort_order,
  is_active
)
values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'leaf', 'Clareza emocional', 1, true),
  ('a2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'sparkles', 'Equilíbrio energético', 2, true),
  ('a2100000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'star', 'Reconexão interior', 3, true),
  ('a2100000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'clock', 'Propósito e direção', 4, true),
  ('a2100000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'heart', 'Relacionamentos conscientes', 5, true),
  ('a2100000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000001', 'compass', 'Transições de vida', 6, true)
on conflict (id) do update
set
  icon = excluded.icon,
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.therapist_profile_reflections (
  id,
  content_version_id,
  title,
  excerpt,
  image_url,
  href,
  minutes_to_read,
  sort_order,
  is_public
)
values (
  'a2200000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'Sobre a vida curta',
  'Uma reflexão breve sobre presença, escolhas e cuidado com o próprio tempo.',
  '/home/tablet-video-session.png',
  '/terapeutas/ana-oliveira',
  3,
  1,
  true
)
on conflict (id) do update
set
  title = excluded.title,
  excerpt = excluded.excerpt,
  image_url = excluded.image_url,
  href = excluded.href,
  minutes_to_read = excluded.minutes_to_read,
  sort_order = excluded.sort_order,
  is_public = excluded.is_public,
  updated_at = now();

insert into public.therapist_service_booking_settings (
  id,
  service_id,
  buffer_before_minutes,
  buffer_after_minutes,
  min_notice_minutes,
  max_days_ahead,
  interval_minutes
)
values
  ('a2300000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 10, 10, 120, 30, 30),
  ('a2300000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000006', 15, 15, 180, 30, 30)
on conflict (service_id) do update
set
  buffer_before_minutes = excluded.buffer_before_minutes,
  buffer_after_minutes = excluded.buffer_after_minutes,
  min_notice_minutes = excluded.min_notice_minutes,
  max_days_ahead = excluded.max_days_ahead,
  interval_minutes = excluded.interval_minutes,
  updated_at = now();

insert into public.availability_rules (
  id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
values
  ('e1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 3, '09:00', '18:30', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 3, '09:00', '18:30', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 5, '15:00', '21:00', 'America/Sao_Paulo', true),
  ('e1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 6, '10:00', '18:00', 'America/Sao_Paulo', true)
on conflict (id) do update
set
  service_id = excluded.service_id,
  day_of_week = excluded.day_of_week,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  timezone = excluded.timezone,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.availability_exceptions (
  id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  is_available,
  reason
)
values (
  'a2400000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  date_trunc('day', now()) + interval '2 days' + interval '14 hours',
  date_trunc('day', now()) + interval '2 days' + interval '15 hours',
  false,
  'Bloqueio de agenda mock'
)
on conflict (id) do update
set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  is_available = excluded.is_available,
  reason = excluded.reason,
  updated_at = now();

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  meeting_provider,
  meeting_url,
  completed_at
)
values
  ('f1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now() - interval '9 days', now() - interval '9 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/ana-2', now() - interval '9 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', now() - interval '6 days', now() - interval '6 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/ana-3', now() - interval '6 days' + interval '60 minutes'),
  ('f1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '50 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/ana-4', now() - interval '3 days' + interval '50 minutes'),
  ('f1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', now() - interval '1 day', now() - interval '1 day' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/ana-5', now() - interval '1 day' + interval '60 minutes')
on conflict (id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  service_id = excluded.service_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  payment_status = excluded.payment_status,
  completed_at = excluded.completed_at,
  updated_at = now();

insert into public.reviews (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  rating,
  comment,
  status,
  published_at
)
values
  ('90000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 5, 'As sessões online me deram o acolhimento que eu precisava, no meu tempo e no meu espaço.', 'published', now() - interval '2 days'),
  ('90000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 5, 'Senti clareza e cuidado durante toda a conversa.', 'published', now() - interval '6 days'),
  ('90000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 4, 'Experiência acolhedora e bem conduzida.', 'published', now() - interval '3 days'),
  ('90000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 5, 'Comentário ocultado pela moderação.', 'hidden', null)
on conflict (id) do update
set
  booking_id = excluded.booking_id,
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  rating = excluded.rating,
  comment = excluded.comment,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.therapist_profile_slug_history (
  id,
  therapist_profile_id,
  old_slug,
  current_slug
)
values (
  'a2500000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'ana-clara-oliveira',
  'ana-oliveira'
)
on conflict (old_slug) do update
set
  current_slug = excluded.current_slug;
