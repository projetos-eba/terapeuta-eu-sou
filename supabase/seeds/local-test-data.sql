-- Local development and test data seed.
-- Loaded after seeds/catalog.sql by supabase/seed.sql.
-- Do not execute this file in homologation or production environments.


insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active
)
values
  (
    'email_verification',
    'auth',
    'Confirmacao de e-mail',
    'Mensagem transacional enviada para confirmar o e-mail de pacientes e terapeutas.',
    true
  ),
  (
    'password_reset',
    'auth',
    'Recuperacao de senha',
    'Mensagem transacional enviada para redefinicao segura de senha.',
    true
  )
on conflict (action_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  active = excluded.active;

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
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.marina@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Marina Alves"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.amanda@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Amanda Ribeiro"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.carlos@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Carlos Mendes"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.juliana.s@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Juliana Souza"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'paciente.luiza@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Luiza Martins"}'::jsonb,
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
  ('aaaaaaaa-0000-4000-8000-000000000002', 'therapist', 'Rafael Santos', 'rafael.santos@example.test', '/therapists/rafael-santos-avatar.png'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'therapist', 'Celia Martins', 'celia.martins@example.test', '/therapists/celia-martins.png'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'therapist', 'Juliana Costa', 'juliana.costa@example.test', '/therapists/juliana-costa.png'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'therapist', 'Lucas Pereira', 'lucas.pereira@example.test', '/therapists/lucas-pereira-avatar.png'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'patient', 'Paciente Ana', 'paciente.ana@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'patient', 'Paciente Rafael', 'paciente.rafael@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'patient', 'Paciente Celia', 'paciente.celia@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'patient', 'Paciente Juliana', 'paciente.juliana@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'patient', 'Paciente Lucas', 'paciente.lucas@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'patient', 'Marina Alves', 'paciente.marina@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000007', 'patient', 'Amanda Ribeiro', 'paciente.amanda@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000008', 'patient', 'Carlos Mendes', 'paciente.carlos@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000009', 'patient', 'Juliana Souza', 'paciente.juliana.s@example.test', null),
  ('bbbbbbbb-0000-4000-8000-000000000010', 'patient', 'Luiza Martins', 'paciente.luiza@example.test', null)
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
  ('b1000000-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000005', 'Paciente Lucas', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000006', 'Marina Alves', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000007', 'bbbbbbbb-0000-4000-8000-000000000007', 'Amanda Ribeiro', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000008', 'bbbbbbbb-0000-4000-8000-000000000008', 'Carlos Mendes', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000009', 'Juliana Souza', 'America/Sao_Paulo', true, now()),
  ('b1000000-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000010', 'Luiza Martins', 'America/Sao_Paulo', true, now())
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
  free_public_slug,
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
    '1100001',
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
    '1100002',
    'Rafael Santos',
    'Rafael Santos',
    'Sessões para mudanças de vida, propósito e reorganização de caminhos.',
    'Rafael acompanha pessoas em fases de mudança com escuta integrativa e combinados claros de sessão.',
    '/therapists/rafael-santos-avatar.png',
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
    '1100003',
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
    '1100004',
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
    '1100005',
    'Lucas Pereira',
    'Lucas Pereira',
    'Cuidado para autoconhecimento, escolhas e transições de vida.',
    'Lucas combina práticas de presença e conversa orientada para apoiar pausas, escolhas e ciclos novos.',
    '/therapists/lucas-pereira-avatar.png',
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
  online_only,
  is_bookable,
  archived_at
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
    true,
    true,
    null
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
    'archived',
    true,
    false,
    now()
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
  is_bookable = excluded.is_bookable,
  archived_at = excluded.archived_at,
  updated_at = now();

-- Approved local fixtures keep the profile preview E2E independent from the
-- private-document onboarding surface. Paths are inert test metadata only.
insert into public.therapist_private_documents (
  id,
  therapist_profile_id,
  uploaded_by,
  storage_object_path,
  document_kind,
  file_name,
  mime_type,
  file_size_bytes,
  status,
  validation_state
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'fixtures/ana-oliveira/identity-document.pdf',
    'identity_document',
    'identity-document.pdf',
    'application/pdf',
    1024,
    'accepted',
    'passed'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'fixtures/ana-oliveira/address-proof.pdf',
    'address_proof',
    'address-proof.pdf',
    'application/pdf',
    1024,
    'accepted',
    'passed'
  )
on conflict (id) do update
set
  document_kind = excluded.document_kind,
  file_name = excluded.file_name,
  file_size_bytes = excluded.file_size_bytes,
  mime_type = excluded.mime_type,
  status = excluded.status,
  storage_object_path = excluded.storage_object_path,
  updated_at = now(),
  uploaded_by = excluded.uploaded_by,
  validation_state = excluded.validation_state;

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status,
  reviewed_at,
  submitted_at
)
values (
  'e1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  'approved',
  now(),
  now() - interval '1 day'
)
on conflict (id) do update
set
  status = excluded.status,
  reviewed_at = excluded.reviewed_at,
  submitted_at = excluded.submitted_at,
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
  public_profile_theme,
  bio_illustration_id,
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
  'serene',
  'organic_flow',
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
  public_profile_theme = excluded.public_profile_theme,
  bio_illustration_id = excluded.bio_illustration_id,
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


-- Patient overview demo data. Stable IDs keep this block idempotent across db reset runs.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos.paciente@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Carlos"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juliane.moore@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Juliane Moore"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus.silva@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Marcus Silva"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beatriz.lima@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Beatriz Lima"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'andre.lima@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"André Lima"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.mendes@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Sofia Mendes"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000016', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roberto.vaz@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Roberto Vaz"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucas.ferreira@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Lucas Ferreira"}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camila.rocha@example.test', crypt('tes-mock-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Camila Rocha"}'::jsonb, now(), now())
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@example.test';

with seeded_auth_users(id, email) as (
  values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'ana.oliveira@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'rafael.santos@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'celia.martins@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'juliana.costa@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'lucas.pereira@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'paciente.ana@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'paciente.rafael@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'paciente.celia@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000004'::uuid, 'paciente.juliana@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000005'::uuid, 'paciente.lucas@example.test'),
    ('90000000-0000-4000-8000-000000000001'::uuid, 'carlos@example.test'),
    ('90000000-0000-4000-8000-000000000011'::uuid, 'juliane.moore@example.test'),
    ('90000000-0000-4000-8000-000000000012'::uuid, 'marcus.silva@example.test'),
    ('90000000-0000-4000-8000-000000000013'::uuid, 'beatriz.lima@example.test'),
    ('90000000-0000-4000-8000-000000000014'::uuid, 'andre.lima@example.test'),
    ('90000000-0000-4000-8000-000000000015'::uuid, 'sofia.mendes@example.test'),
    ('90000000-0000-4000-8000-000000000016'::uuid, 'roberto.vaz@example.test'),
    ('90000000-0000-4000-8000-000000000017'::uuid, 'lucas.ferreira@example.test'),
    ('90000000-0000-4000-8000-000000000018'::uuid, 'camila.rocha@example.test')
)
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  updated_at = now()
from seeded_auth_users
where auth.users.id = seeded_auth_users.id;

with seeded_auth_users(id, email) as (
  values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'ana.oliveira@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'rafael.santos@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'celia.martins@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'juliana.costa@example.test'),
    ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'lucas.pereira@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'paciente.ana@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'paciente.rafael@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'paciente.celia@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000004'::uuid, 'paciente.juliana@example.test'),
    ('bbbbbbbb-0000-4000-8000-000000000005'::uuid, 'paciente.lucas@example.test'),
    ('90000000-0000-4000-8000-000000000001'::uuid, 'carlos@example.test'),
    ('90000000-0000-4000-8000-000000000011'::uuid, 'juliane.moore@example.test'),
    ('90000000-0000-4000-8000-000000000012'::uuid, 'marcus.silva@example.test'),
    ('90000000-0000-4000-8000-000000000013'::uuid, 'beatriz.lima@example.test'),
    ('90000000-0000-4000-8000-000000000014'::uuid, 'andre.lima@example.test'),
    ('90000000-0000-4000-8000-000000000015'::uuid, 'sofia.mendes@example.test'),
    ('90000000-0000-4000-8000-000000000016'::uuid, 'roberto.vaz@example.test'),
    ('90000000-0000-4000-8000-000000000017'::uuid, 'lucas.ferreira@example.test'),
    ('90000000-0000-4000-8000-000000000018'::uuid, 'camila.rocha@example.test')
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  seeded_auth_users.id::text,
  seeded_auth_users.id,
  jsonb_build_object('sub', seeded_auth_users.id::text, 'email', seeded_auth_users.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from seeded_auth_users
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, role, display_name, email, avatar_url)
values
  ('90000000-0000-4000-8000-000000000001', 'patient', 'Carlos', 'carlos.paciente@example.test', null),
  ('90000000-0000-4000-8000-000000000011', 'therapist', 'Juliane Moore', 'juliane.moore@example.test', '/therapists/juliana-costa.png'),
  ('90000000-0000-4000-8000-000000000012', 'therapist', 'Marcus Silva', 'marcus.silva@example.test', '/therapists/rafael-santos-avatar.png'),
  ('90000000-0000-4000-8000-000000000013', 'therapist', 'Beatriz Lima', 'beatriz.lima@example.test', '/therapists/celia-martins.png'),
  ('90000000-0000-4000-8000-000000000014', 'therapist', 'André Lima', 'andre.lima@example.test', '/therapists/andre-lima.png'),
  ('90000000-0000-4000-8000-000000000015', 'therapist', 'Sofia Mendes', 'sofia.mendes@example.test', '/therapists/ana-oliveira.png'),
  ('90000000-0000-4000-8000-000000000016', 'therapist', 'Roberto Vaz', 'roberto.vaz@example.test', '/therapists/marcio-andrade.png'),
  ('90000000-0000-4000-8000-000000000017', 'therapist', 'Lucas Ferreira', 'lucas.ferreira@example.test', '/therapists/rafael-santos-avatar.png'),
  ('90000000-0000-4000-8000-000000000018', 'therapist', 'Camila Rocha', 'camila.rocha@example.test', '/therapists/fernanda-rocha.png')
on conflict (id) do update
set role = excluded.role, display_name = excluded.display_name, email = excluded.email, avatar_url = excluded.avatar_url, updated_at = now();

insert into public.patient_profiles (id, user_id, display_name, timezone, marketing_consent, sensitive_data_consent_at)
values ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'Carlos', 'America/Sao_Paulo', true, now())
on conflict (id) do update
set display_name = excluded.display_name, timezone = excluded.timezone, marketing_consent = excluded.marketing_consent, sensitive_data_consent_at = excluded.sensitive_data_consent_at, updated_at = now();


insert into public.therapist_profiles (
  id, user_id, plan, status, slug, public_name, legal_name, headline, photo_url,
  city, state, languages, is_public, is_accepting_bookings, accepts_online_sessions
)
values
  ('92000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000011', 'premium', 'approved', 'juliane-moore', 'Juliane Moore', 'Juliane Moore', 'Terapeuta Holística', '/therapists/juliana-costa.png', 'São Paulo', 'SP', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000012', 'premium', 'approved', 'marcus-silva', 'Marcus Silva', 'Marcus Silva', 'Terapeuta Holístico', '/therapists/rafael-santos-avatar.png', 'Rio de Janeiro', 'RJ', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000013', '90000000-0000-4000-8000-000000000013', 'premium', 'approved', 'beatriz-lima', 'Beatriz Lima', 'Beatriz Lima', 'Terapeuta Holística', '/therapists/celia-martins.png', 'Curitiba', 'PR', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000014', '90000000-0000-4000-8000-000000000014', 'premium', 'approved', 'andre-lima', 'André Lima', 'André Lima', 'Terapeuta Holístico', '/therapists/andre-lima.png', 'Florianópolis', 'SC', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000015', '90000000-0000-4000-8000-000000000015', 'premium', 'approved', 'sofia-mendes', 'Sofia Mendes', 'Sofia Mendes', 'Terapeuta Holística', '/therapists/ana-oliveira.png', 'Belo Horizonte', 'MG', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000016', '90000000-0000-4000-8000-000000000016', 'premium', 'approved', 'roberto-vaz', 'Roberto Vaz', 'Roberto Vaz', 'Terapeuta Holístico', '/therapists/marcio-andrade.png', 'Porto Alegre', 'RS', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000017', '90000000-0000-4000-8000-000000000017', 'premium', 'approved', 'lucas-ferreira', 'Lucas Ferreira', 'Lucas Ferreira', 'Terapeuta Holístico', '/therapists/rafael-santos-avatar.png', 'Rio de Janeiro', 'RJ', array['pt-BR'], true, true, true),
  ('92000000-0000-4000-8000-000000000018', '90000000-0000-4000-8000-000000000018', 'premium', 'approved', 'camila-rocha', 'Camila Rocha', 'Camila Rocha', 'Terapeuta Holística', '/therapists/fernanda-rocha.png', 'São Paulo', 'SP', array['pt-BR'], true, true, true)
on conflict (id) do update
set public_name = excluded.public_name, headline = excluded.headline, photo_url = excluded.photo_url, is_public = excluded.is_public, is_accepting_bookings = excluded.is_accepting_bookings, updated_at = now();


insert into public.therapist_services (id, therapist_profile_id, therapy_id, title, description, duration_minutes, price_cents, status)
values
  ('93000000-0000-4000-8000-000000000011', '92000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222225', 'Terapia Holística', 'Sessão online de cuidado integrativo.', 60, 17000, 'active'),
  ('93000000-0000-4000-8000-000000000012', '92000000-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222228', 'Tarô', 'Leitura simbólica para reflexão e autoconhecimento.', 60, 17000, 'active'),
  ('93000000-0000-4000-8000-000000000013', '92000000-0000-4000-8000-000000000013', '22222222-2222-4222-8222-222222222225', 'Reiki', 'Prática complementar online.', 60, 17000, 'active'),
  ('93000000-0000-4000-8000-000000000014', '92000000-0000-4000-8000-000000000014', '22222222-2222-4222-8222-222222222225', 'Reiki', 'Prática complementar online com foco em presença e cuidado energético responsável.', 60, 12000, 'active'),
  ('93000000-0000-4000-8000-000000000015', '92000000-0000-4000-8000-000000000015', '22222222-2222-4222-8222-222222222230', 'Constelação Familiar', 'Experiência simbólica online para observar vínculos e padrões com cuidado.', 60, 14000, 'active'),
  ('93000000-0000-4000-8000-000000000016', '92000000-0000-4000-8000-000000000016', '22222222-2222-4222-8222-222222222228', 'Tarô', 'Leitura simbólica para reflexão e autoconhecimento.', 60, 12000, 'active'),
  ('93000000-0000-4000-8000-000000000017', 'c1000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222230', 'Constelação Familiar', 'Experiência simbólica para observar vínculos sem diagnóstico ou promessa de resolução.', 60, 13000, 'active'),
  ('93000000-0000-4000-8000-000000000018', '92000000-0000-4000-8000-000000000017', '22222222-2222-4222-8222-222222222228', 'Tarô', 'Leitura simbólica para refletir sobre escolhas e caminhos possíveis.', 60, 13000, 'active'),
  ('93000000-0000-4000-8000-000000000019', '92000000-0000-4000-8000-000000000018', '22222222-2222-4222-8222-222222222230', 'Constelação Familiar', 'Experiência simbólica online para observar vínculos e padrões com cuidado.', 60, 14000, 'active'),
  ('93000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222225', 'Reiki', 'Promover equilíbrio, clareza e conexão interna através do Reiki.', 60, 17000, 'active')
on conflict (id) do update
set therapist_profile_id = excluded.therapist_profile_id, therapy_id = excluded.therapy_id, title = excluded.title, description = excluded.description, duration_minutes = excluded.duration_minutes, price_cents = excluded.price_cents, status = excluded.status, updated_at = now();

insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status, meeting_provider, meeting_url, completed_at)
values
  ('94000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000011', now() - interval '30 minutes', now() + interval '30 minutes', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/juliane-live', null),
  ('94000000-0000-4000-8000-000000000012', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000012', '93000000-0000-4000-8000-000000000012', current_date + interval '1 day' + time '10:30', current_date + interval '1 day' + time '11:30', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/marcus', null),
  ('94000000-0000-4000-8000-000000000013', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000013', '93000000-0000-4000-8000-000000000013', current_date + ((9 - extract(dow from current_date)::integer) % 7) + time '16:00', current_date + ((9 - extract(dow from current_date)::integer) % 7) + time '17:00', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/beatriz', null),
  ('94000000-0000-4000-8000-000000000014', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000011', now() - interval '2 days', now() - interval '2 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliane-last', now() - interval '2 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000021', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000014', '93000000-0000-4000-8000-000000000014', now() - interval '5 minutes', now() + interval '55 minutes', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/andre-live', null),
  ('94000000-0000-4000-8000-000000000022', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000015', '93000000-0000-4000-8000-000000000015', now() + interval '2 hours', now() + interval '3 hours', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/sofia', null),
  ('94000000-0000-4000-8000-000000000023', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000016', '93000000-0000-4000-8000-000000000016', current_date + interval '1 day' + time '09:00', current_date + interval '1 day' + time '10:00', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/roberto', null),
  ('94000000-0000-4000-8000-000000000024', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000014', '93000000-0000-4000-8000-000000000014', current_date + interval '3 days' + time '11:00', current_date + interval '3 days' + time '12:00', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/andre-followup', null),
  ('94000000-0000-4000-8000-000000000025', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000015', '93000000-0000-4000-8000-000000000015', current_date + interval '5 days' + time '15:00', current_date + interval '5 days' + time '16:00', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://example.test/meeting/sofia-followup', null),
  ('94000000-0000-4000-8000-000000000031', '91000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000017', now() - interval '3 hours', now() - interval '2 hours', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliana-history', now() - interval '2 hours'),
  ('94000000-0000-4000-8000-000000000032', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000017', '93000000-0000-4000-8000-000000000018', now() - interval '5 hours', now() - interval '4 hours', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/lucas-history', now() - interval '4 hours'),
  ('94000000-0000-4000-8000-000000000033', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000018', '93000000-0000-4000-8000-000000000019', now() - interval '7 hours', now() - interval '6 hours', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/camila-history', now() - interval '6 hours'),
  ('94000000-0000-4000-8000-000000000034', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000014', '93000000-0000-4000-8000-000000000014', now() - interval '4 days', now() - interval '4 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/andre-history-1', now() - interval '4 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000035', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000015', '93000000-0000-4000-8000-000000000015', now() - interval '5 days', now() - interval '5 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/sofia-history-1', now() - interval '5 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000036', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000016', '93000000-0000-4000-8000-000000000016', now() - interval '6 days', now() - interval '6 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/roberto-history-1', now() - interval '6 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000037', '91000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000017', now() - interval '7 days', now() - interval '7 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliana-history-2', now() - interval '7 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000038', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000017', '93000000-0000-4000-8000-000000000018', now() - interval '8 days', now() - interval '8 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/lucas-history-2', now() - interval '8 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000039', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000018', '93000000-0000-4000-8000-000000000019', now() - interval '9 days', now() - interval '9 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/camila-history-2', now() - interval '9 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000040', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000014', '93000000-0000-4000-8000-000000000014', now() - interval '10 days', now() - interval '10 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/andre-history-2', now() - interval '10 days' + interval '60 minutes'),
  ('94000000-0000-4000-8000-000000000041', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000015', '93000000-0000-4000-8000-000000000015', now() - interval '11 days', now() - interval '11 days' + interval '60 minutes', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/sofia-history-2', now() - interval '11 days' + interval '60 minutes'),
  ('96000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000020', date_trunc('minute', now()) + interval '90 minutes', date_trunc('minute', now()) + interval '150 minutes', 'America/Sao_Paulo', 'confirmed', 'paid', 'zoom', 'https://us02web.zoom.us/j/1234567890?pwd=terapiaeusou', null),
  ('96000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000020', '2024-05-08 14:00:00-03', '2024-05-08 15:00:00-03', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliane-may-1', '2024-05-08 15:00:00-03'),
  ('96000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000020', '2024-05-15 14:00:00-03', '2024-05-15 15:00:00-03', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliane-may-2', '2024-05-15 15:00:00-03'),
  ('96000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '93000000-0000-4000-8000-000000000020', '2024-05-22 14:00:00-03', '2024-05-22 15:00:00-03', 'America/Sao_Paulo', 'completed', 'paid', 'zoom', 'https://example.test/meeting/juliane-may-3', '2024-05-22 15:00:00-03')
on conflict (id) do update
set starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status, payment_status = excluded.payment_status, meeting_url = excluded.meeting_url, completed_at = excluded.completed_at, updated_at = now();

insert into public.booking_intake_responses (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  focus_area,
  shared_note,
  therapy_goal,
  visibility
)
values (
  '96100000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  'Autoconhecimento',
  'Gostaria de entender melhor um momento de mudança que estou vivendo e buscar mais clareza para tomar decisões importantes.',
  'Promover equilíbrio, clareza e conexão interna através do Reiki.',
  'patient_therapist'
)
on conflict (booking_id) do update
set
  focus_area = excluded.focus_area,
  shared_note = excluded.shared_note,
  therapy_goal = excluded.therapy_goal,
  visibility = excluded.visibility,
  updated_at = now();

insert into public.booking_payment_receipts (
  id,
  booking_id,
  amount_cents,
  currency,
  provider,
  receipt_url,
  paid_at
)
values (
  '96200000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  17000,
  'BRL',
  'mock',
  '/app/pagamentos/comprovantes/96000000-0000-4000-8000-000000000001',
  now() - interval '1 day'
)
on conflict (booking_id) do update
set
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  provider = excluded.provider,
  receipt_url = excluded.receipt_url,
  paid_at = excluded.paid_at,
  updated_at = now();

insert into public.therapist_service_cancellation_policies (
  id,
  service_id,
  free_until_hours,
  late_cancel_fee_percent,
  no_show_fee_percent,
  description
)
values (
  '96300000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000020',
  24,
  50,
  100,
  'Política demo para sessão de Reiki com Juliane Moore.'
)
on conflict (service_id) do update
set
  free_until_hours = excluded.free_until_hours,
  late_cancel_fee_percent = excluded.late_cancel_fee_percent,
  no_show_fee_percent = excluded.no_show_fee_percent,
  description = excluded.description,
  updated_at = now();

insert into public.booking_events (id, booking_id, actor_profile_id, event_type, payload)
values
  ('96400000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'booking_created', '{"source":"seed"}'::jsonb),
  ('96400000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'payment_confirmed', '{"provider":"mock"}'::jsonb)
on conflict (id) do update
set
  event_type = excluded.event_type,
  payload = excluded.payload;

insert into public.booking_session_summaries (
  id,
  booking_id,
  therapist_profile_id,
  patient_profile_id,
  title,
  summary,
  visibility
)
values
  ('94100000-0000-4000-8000-000000000031', '94000000-0000-4000-8000-000000000031', 'c1000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000001', 'Registro de presença', 'Resumo breve da sessão de mindfulness com combinados de continuidade para o paciente.', 'patient'),
  ('94100000-0000-4000-8000-000000000032', '94000000-0000-4000-8000-000000000032', '92000000-0000-4000-8000-000000000017', '91000000-0000-4000-8000-000000000001', 'Pausa guiada', 'Registro da prática de meditação guiada e próximos cuidados combinados.', 'patient'),
  ('94100000-0000-4000-8000-000000000033', '94000000-0000-4000-8000-000000000033', '92000000-0000-4000-8000-000000000018', '91000000-0000-4000-8000-000000000001', 'Aromas e autocuidado', 'Resumo da sessão de aromaterapia com observações privadas para continuidade.', 'patient'),
  ('96100000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', 'Autoconhecimento', 'Registro de Reiki voltado a clareza e percepção do momento de vida.', 'patient'),
  ('96100000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', 'Autoconhecimento', 'Resumo de continuidade da jornada de autoconhecimento.', 'patient'),
  ('96100000-0000-4000-8000-000000000004', '96000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', 'Autoconhecimento', 'Registro de fechamento do ciclo de maio com próximos cuidados.', 'patient')
on conflict (booking_id) do update
set
  therapist_profile_id = excluded.therapist_profile_id,
  patient_profile_id = excluded.patient_profile_id,
  title = excluded.title,
  summary = excluded.summary,
  visibility = excluded.visibility,
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
  ('96500000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', 5, 'Sessão acolhedora e conduzida com presença.', 'published', '2024-05-08 16:00:00-03'),
  ('96500000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', 5, 'Senti clareza para organizar minhas reflexões.', 'published', '2024-05-15 16:00:00-03'),
  ('96500000-0000-4000-8000-000000000004', '96000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', 5, 'Foi um encontro cuidadoso para seguir minha jornada.', 'published', '2024-05-22 16:00:00-03')
on conflict (booking_id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  rating = excluded.rating,
  comment = excluded.comment,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.favorite_therapists (id, patient_profile_id, therapist_profile_id)
values
  ('95000000-0000-4000-8000-000000000014', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000014'),
  ('95000000-0000-4000-8000-000000000015', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000015'),
  ('95000000-0000-4000-8000-000000000016', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000016')
on conflict (id) do update
set therapist_profile_id = excluded.therapist_profile_id;

insert into public.conversations (id, patient_profile_id, therapist_profile_id, booking_id, last_message_at)
values ('96000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '94000000-0000-4000-8000-000000000011', now())
on conflict (id) do update
set last_message_at = excluded.last_message_at, updated_at = now();

insert into public.messages (id, conversation_id, sender_profile_id, body, read_at)
values
  ('97000000-0000-4000-8000-000000000011', '96000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000011', 'Sua sessão está pronta para começar.', null),
  ('97000000-0000-4000-8000-000000000012', '96000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000011', 'Estou disponível caso precise de algo antes do encontro.', null)
on conflict (id) do update
set body = excluded.body, read_at = excluded.read_at;

insert into public.notifications (id, profile_id, kind, title, body, href, read_at)
values ('98000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001', 'appointment', 'Sessão ao vivo', 'Sua sessão com Juliane Moore está disponível.', '/app/sessoes', null)
on conflict (id) do update
set title = excluded.title, body = excluded.body, href = excluded.href, read_at = excluded.read_at;

insert into public.mood_checkins (id, patient_profile_id, mood, checked_on)
values ('99000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', 'calm', current_date)
on conflict (id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  mood = excluded.mood,
  checked_on = excluded.checked_on,
  updated_at = now();

insert into public.support_tickets (id, requester_profile_id, booking_id, category, subject, description, status, priority, resolution_summary, reviewed_at)
values
  ('a0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000014', 'payment', 'Reembolso de sessão', 'O valor foi estornado para o seu cartão Visa.', 'resolved', 'normal', 'O reembolso foi concluído.', current_date - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000011', 'technical', 'Problema com áudio', 'Nossa equipe técnica está verificando o log...', 'in_review', 'normal', null, current_date - interval '2 days')
on conflict (id) do update
set subject = excluded.subject, description = excluded.description, status = excluded.status, resolution_summary = excluded.resolution_summary, reviewed_at = excluded.reviewed_at, updated_at = now();

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

-- Public therapy detail editorial scope: Reiki, Taro and Constelacao Familiar.
-- This block intentionally runs at the end of the seed so older development
-- fixtures cannot publish therapies outside the current catalog phase.
update public.therapies
set
  status = 'draft',
  is_public_visible = false,
  is_featured = false,
  updated_at = now()
where slug not in (
  'reiki',
  'taro',
  'constelacao-familiar',
  'aromaterapia',
  'cristaloterapia'
);


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
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222225', 'Reiki online', 'Sessão complementar de Reiki conduzida por vídeo, com foco em presença e cuidado energético responsável.', 50, 17000, 'BRL', 'active', true),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222228', 'Leitura simbólica de Tarô', 'Leitura de cartas voltada a reflexão, autoconhecimento e perguntas do momento.', 60, 12000, 'BRL', 'active', true),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222230', 'Constelação Familiar online', 'Experiência simbólica online para observar vínculos e padrões com cuidado.', 60, 14000, 'BRL', 'active', true),
  ('d1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222230', 'Constelação de vínculos', 'Atendimento simbólico para olhar relações familiares sem diagnóstico ou promessa de resolução.', 60, 9000, 'BRL', 'active', true),
  ('d1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222228', 'Tarô e autoconhecimento', 'Leitura simbólica para refletir sobre escolhas, padrões e caminhos possíveis.', 60, 17000, 'BRL', 'active', true)
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


insert into public.therapist_service_matching_themes (
  therapist_service_id,
  theme_id
)
select
  therapist_services.id,
  therapy_matching_themes.theme_id
from public.therapist_services
join public.therapy_matching_themes
  on therapy_matching_themes.therapy_id = therapist_services.therapy_id
where therapist_services.status = 'active'
  and therapist_services.therapy_id in (
    select id
    from public.therapies
    where slug in ('reiki', 'taro', 'constelacao-familiar')
  )
on conflict (therapist_service_id, theme_id) do nothing;

insert into public.therapist_service_matching_interests (
  therapist_service_id,
  interest_id
)
select fixtures.service_id::uuid, matching_interests.id
from (
  values
    ('93000000-0000-4000-8000-000000000013', 'desequilibrio-energetico'),
    ('93000000-0000-4000-8000-000000000014', 'desequilibrio-energetico'),
    ('93000000-0000-4000-8000-000000000014', 'estresse'),
    ('93000000-0000-4000-8000-000000000020', 'estresse'),
    ('93000000-0000-4000-8000-000000000012', 'entender-a-si-mesmo'),
    ('93000000-0000-4000-8000-000000000016', 'relacionamentos-amorosos'),
    ('93000000-0000-4000-8000-000000000017', 'conflitos-familiares')
) as fixtures(service_id, interest_slug)
join public.matching_interests
  on matching_interests.slug = fixtures.interest_slug
where matching_interests.is_active = true
on conflict (therapist_service_id, interest_id) do nothing;

-- Premium Plus therapist dashboard demo data for Ana Oliveira.
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
  cancellation_reason,
  cancelled_at,
  completed_at
)
values
  (
    'f2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '9 hours') at time zone 'America/Sao_Paulo'),
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '9 hours 50 minutes') at time zone 'America/Sao_Paulo'),
    'America/Sao_Paulo',
    'confirmed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-today-1',
    null,
    null,
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '14 hours') at time zone 'America/Sao_Paulo'),
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '15 hours') at time zone 'America/Sao_Paulo'),
    'America/Sao_Paulo',
    'confirmed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-today-2',
    null,
    null,
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '18 hours') at time zone 'America/Sao_Paulo'),
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '18 hours 50 minutes') at time zone 'America/Sao_Paulo'),
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-today-3',
    null,
    null,
    ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '18 hours 50 minutes') at time zone 'America/Sao_Paulo')
  ),
  (
    'f2000000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    now() + interval '1 day',
    now() + interval '1 day 60 minutes',
    'America/Sao_Paulo',
    'confirmed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-future-1',
    null,
    null,
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() + interval '2 days',
    now() + interval '2 days 50 minutes',
    'America/Sao_Paulo',
    'pending_payment',
    'pending',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    now() - interval '3 days',
    now() - interval '3 days' + interval '60 minutes',
    'America/Sao_Paulo',
    'cancelled_by_patient',
    'refunded',
    null,
    null,
    'Imprevisto informado pela pessoa atendida.',
    now() - interval '4 days',
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000007',
    'b1000000-0000-4000-8000-000000000007',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '2 days',
    now() - interval '2 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'no_show_patient',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-no-show',
    null,
    null,
    null
  ),
  (
    'f2000000-0000-4000-8000-000000000008',
    'b1000000-0000-4000-8000-000000000008',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    now() - interval '4 days',
    now() - interval '4 days' + interval '60 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-history-8',
    null,
    null,
    now() - interval '4 days' + interval '60 minutes'
  ),
  (
    'f2000000-0000-4000-8000-000000000009',
    'b1000000-0000-4000-8000-000000000009',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '7 days',
    now() - interval '7 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-history-9',
    null,
    null,
    now() - interval '7 days' + interval '50 minutes'
  ),
  (
    'f2000000-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    date_trunc('month', now()) - interval '10 days',
    date_trunc('month', now()) - interval '10 days' + interval '60 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-previous-month',
    null,
    null,
    date_trunc('month', now()) - interval '10 days' + interval '60 minutes'
  ),
  (
    'f2000000-0000-4000-8000-000000000011',
    'b1000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    date_trunc('month', now()) + interval '2 days',
    date_trunc('month', now()) + interval '2 days 50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    'zoom',
    'https://example.test/meeting/ana-current-month',
    null,
    null,
    date_trunc('month', now()) + interval '2 days 50 minutes'
  )
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
  cancellation_reason = excluded.cancellation_reason,
  cancelled_at = excluded.cancelled_at,
  completed_at = excluded.completed_at,
  updated_at = now();

-- A4 therapist block demo data. Existing bookings remain unchanged.
insert into public.availability_exception_series (
  id,
  therapist_profile_id,
  service_id,
  timezone,
  starts_on,
  start_time,
  end_time,
  all_day,
  recurrence_frequency,
  recurrence_ends_on,
  reason_code,
  reason,
  status,
  created_by_user_id
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    null,
    'America/Sao_Paulo',
    current_date + 1,
    null,
    null,
    true,
    'none',
    current_date + 1,
    'personal',
    'Compromisso pessoal',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'America/Sao_Paulo',
    current_date + 3,
    time '12:00',
    time '14:00',
    false,
    'weekly',
    current_date + 17,
    'training',
    'Formação profissional',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  starts_on = excluded.starts_on,
  recurrence_ends_on = excluded.recurrence_ends_on,
  reason = excluded.reason,
  status = excluded.status,
  updated_at = now();

insert into public.availability_exceptions (
  id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  is_available,
  reason,
  series_id,
  occurrence_date,
  timezone,
  all_day,
  reason_code,
  status,
  created_by_user_id
)
values
  (
    'a4100000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    null,
    (current_date + 1)::timestamp at time zone 'America/Sao_Paulo',
    (current_date + 2)::timestamp at time zone 'America/Sao_Paulo',
    false,
    'Compromisso pessoal',
    'a4000000-0000-4000-8000-000000000001',
    current_date + 1,
    'America/Sao_Paulo',
    true,
    'personal',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  (
    'a4100000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((current_date + 3) + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 3) + time '14:00') at time zone 'America/Sao_Paulo',
    false,
    'Formação profissional',
    'a4000000-0000-4000-8000-000000000002',
    current_date + 3,
    'America/Sao_Paulo',
    false,
    'training',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  (
    'a4100000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((current_date + 10) + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 10) + time '14:00') at time zone 'America/Sao_Paulo',
    false,
    'Formação profissional',
    'a4000000-0000-4000-8000-000000000002',
    current_date + 10,
    'America/Sao_Paulo',
    false,
    'training',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  (
    'a4100000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((current_date + 17) + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 17) + time '14:00') at time zone 'America/Sao_Paulo',
    false,
    'Formação profissional',
    'a4000000-0000-4000-8000-000000000002',
    current_date + 17,
    'America/Sao_Paulo',
    false,
    'training',
    'active',
    'aaaaaaaa-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  reason = excluded.reason,
  status = excluded.status,
  updated_at = now();

insert into public.availability_exception_booking_impacts (
  id,
  exception_id,
  booking_id,
  therapist_profile_id,
  status
)
values (
  'a4200000-0000-4000-8000-000000000001',
  'a4100000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000004',
  'c1000000-0000-4000-8000-000000000001',
  'pending'
)
on conflict (exception_id, booking_id) do update
set
  status = excluded.status,
  resolution = null,
  resolved_by_user_id = null,
  resolved_at = null,
  updated_at = now();

insert into public.therapist_patient_relationships (
  id,
  therapist_profile_id,
  patient_profile_id,
  status,
  source_booking_id,
  started_at
)
values
  ('e3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'active', 'f2000000-0000-4000-8000-000000000001', now()),
  ('e3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'active', 'f2000000-0000-4000-8000-000000000002', now()),
  ('e3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'active', 'f2000000-0000-4000-8000-000000000003', now() - interval '12 days'),
  ('e3000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'active', 'f2000000-0000-4000-8000-000000000004', now() - interval '18 days'),
  ('e3000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'active', 'f2000000-0000-4000-8000-000000000005', now() - interval '24 days'),
  ('e3000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000006', 'active', 'f2000000-0000-4000-8000-000000000011', now() - interval '31 days'),
  ('e3000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000007', 'active', 'f2000000-0000-4000-8000-000000000007', now() - interval '35 days'),
  ('e3000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000008', 'active', 'f2000000-0000-4000-8000-000000000008', now() - interval '41 days'),
  ('e3000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000009', 'active', 'f2000000-0000-4000-8000-000000000009', now() - interval '47 days'),
  ('e3000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000010', 'paused', 'f2000000-0000-4000-8000-000000000010', now() - interval '55 days')
on conflict (therapist_profile_id, patient_profile_id) do update
set
  status = excluded.status,
  source_booking_id = excluded.source_booking_id,
  started_at = excluded.started_at,
  updated_at = now();

insert into public.payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  provider,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  amount_cents,
  platform_fee_cents,
  therapist_amount_cents,
  currency,
  status,
  paid_at,
  refunded_at
)
values
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_001', 'pi_test_ana_001', 17000, 2550, 14450, 'BRL', 'paid', now(), null),
  ('e2000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_002', 'pi_test_ana_002', 24000, 3600, 20400, 'BRL', 'paid', now(), null),
  ('e2000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_003', 'pi_test_ana_003', 17000, 2550, 14450, 'BRL', 'paid', now(), null),
  ('e2000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_004', 'pi_test_ana_004', 24000, 3600, 20400, 'BRL', 'paid', now(), null),
  ('e2000000-0000-4000-8000-000000000005', 'f2000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_005', null, 17000, 2550, 14450, 'BRL', 'pending', null, null),
  ('e2000000-0000-4000-8000-000000000006', 'f2000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_006', 'pi_test_ana_006', 24000, 3600, 20400, 'BRL', 'refunded', now() - interval '5 days', now() - interval '4 days'),
  ('e2000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_007', 'pi_test_ana_007', 17000, 2550, 14450, 'BRL', 'paid', now() - interval '3 days', null),
  ('e2000000-0000-4000-8000-000000000008', 'f2000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_008', 'pi_test_ana_008', 24000, 3600, 20400, 'BRL', 'paid', now() - interval '4 days', null),
  ('e2000000-0000-4000-8000-000000000009', 'f2000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_009', 'pi_test_ana_009', 17000, 2550, 14450, 'BRL', 'paid', now() - interval '7 days', null),
  ('e2000000-0000-4000-8000-000000000010', 'f2000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_010', 'pi_test_ana_010', 24000, 3600, 20400, 'BRL', 'paid', date_trunc('month', now()) - interval '10 days', null),
  ('e2000000-0000-4000-8000-000000000011', 'f2000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_ana_011', 'pi_test_ana_011', 17000, 2550, 14450, 'BRL', 'paid', date_trunc('month', now()) + interval '2 days', null)
on conflict (booking_id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  amount_cents = excluded.amount_cents,
  platform_fee_cents = excluded.platform_fee_cents,
  therapist_amount_cents = excluded.therapist_amount_cents,
  status = excluded.status,
  paid_at = excluded.paid_at,
  refunded_at = excluded.refunded_at,
  updated_at = now();

insert into public.booking_reschedule_requests (
  id,
  booking_id,
  requested_by_profile_id,
  proposed_starts_at,
  proposed_ends_at,
  reason,
  status
)
values (
  'e7000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000004',
  'bbbbbbbb-0000-4000-8000-000000000004',
  now() + interval '3 days',
  now() + interval '3 days 60 minutes',
  'Preciso ajustar o horário desta semana.',
  'pending'
)
on conflict (id) do update
set
  proposed_starts_at = excluded.proposed_starts_at,
  proposed_ends_at = excluded.proposed_ends_at,
  reason = excluded.reason,
  status = excluded.status,
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
  ('e8000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 5, 'A sessão foi conduzida com presença e cuidado.', 'published', now()),
  ('e8000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000001', 5, 'Encontrei um espaço acolhedor para organizar minhas escolhas.', 'published', now() - interval '4 days'),
  ('e8000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000001', 4, 'Conversa atenta e respeitosa com o meu momento.', 'published', now() - interval '7 days'),
  ('e8000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 5, 'A condução foi clara e acolhedora.', 'published', date_trunc('month', now()) + interval '3 days')
on conflict (booking_id) do update
set
  rating = excluded.rating,
  comment = excluded.comment,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.review_replies (
  id,
  review_id,
  therapist_profile_id,
  body,
  status,
  published_at
)
values (
  'e9000000-0000-4000-8000-000000000001',
  'e8000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  'Obrigada por compartilhar sua experiência com tanto cuidado.',
  'published',
  now() - interval '6 days'
)
on conflict (review_id) do update
set
  body = excluded.body,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.therapist_profile_daily_analytics (
  therapist_profile_id,
  metric_date,
  profile_views,
  search_impressions,
  profile_clicks,
  favorites_added,
  contact_clicks
)
select
  'c1000000-0000-4000-8000-000000000001',
  day_value::date,
  14 + extract(day from day_value)::integer % 8,
  31 + extract(day from day_value)::integer % 15,
  7 + extract(day from day_value)::integer % 6,
  extract(day from day_value)::integer % 3,
  2 + extract(day from day_value)::integer % 4
from generate_series(current_date - 59, current_date, interval '1 day') day_value
on conflict (therapist_profile_id, metric_date) do update
set
  profile_views = excluded.profile_views,
  search_impressions = excluded.search_impressions,
  profile_clicks = excluded.profile_clicks,
  favorites_added = excluded.favorites_added,
  contact_clicks = excluded.contact_clicks,
  updated_at = now();

insert into public.aura_recommendations (
  id,
  therapist_profile_id,
  source_rule_key,
  title,
  body,
  plan_required,
  context,
  evidence,
  priority,
  expires_at,
  is_active
)
values
  ('ea000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'weekly_service_interest', 'Interesse em Reiki', 'Seu serviço de Reiki recebeu mais visitas agregadas nesta semana.', 'premium_plus', '{"kind":"observation","source":"demo_seed"}'::jsonb, '{"source":"seed"}'::jsonb, 30, now() + interval '14 days', true),
  ('ea000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'profile_views_growth', 'Visitas ao perfil', 'As visitas agregadas ao seu perfil cresceram em relação ao período anterior.', 'premium_plus', '{"kind":"observation","source":"demo_seed"}'::jsonb, '{"source":"seed"}'::jsonb, 25, now() + interval '14 days', true),
  ('ea000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'open_schedule', 'Horários disponíveis', 'Considere abrir horários adicionais nos dias com maior procura agregada.', 'premium_plus', '{"kind":"suggestion","source":"demo_seed"}'::jsonb, '{"source":"seed"}'::jsonb, 20, now() + interval '14 days', true),
  ('ea000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'reply_reviews', 'Responda às avaliações', 'Há avaliações publicadas aguardando uma resposta sua.', 'premium_plus', '{"kind":"action","action_href":"/plus/avaliacoes","source":"demo_seed"}'::jsonb, '{"source":"seed"}'::jsonb, 40, now() + interval '14 days', true),
  ('ea000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'profile_video', 'Atualize seu perfil', 'Revise os conteúdos do perfil para manter sua apresentação atualizada.', 'premium_plus', '{"kind":"action","action_href":"/plus/perfil","source":"demo_seed"}'::jsonb, '{"source":"seed"}'::jsonb, 15, now() + interval '14 days', true)
on conflict (id) do update
set
  title = excluded.title,
  body = excluded.body,
  plan_required = excluded.plan_required,
  context = excluded.context,
  evidence = excluded.evidence,
  priority = excluded.priority,
  expires_at = excluded.expires_at,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.conversations (
  id,
  patient_profile_id,
  therapist_profile_id,
  booking_id,
  last_message_at
)
values
  ('eb000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', now()),
  ('eb000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', now() - interval '1 hour')
on conflict (patient_profile_id, therapist_profile_id) do update
set
  booking_id = excluded.booking_id,
  last_message_at = excluded.last_message_at,
  updated_at = now();

insert into public.messages (
  id,
  conversation_id,
  sender_profile_id,
  body,
  read_at
)
values
  ('ec000000-0000-4000-8000-000000000001', 'eb000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Obrigada pelas orientações para o encontro.', null),
  ('ec000000-0000-4000-8000-000000000002', 'eb000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Podemos confirmar o horário de hoje?', null)
on conflict (id) do update
set
  body = excluded.body,
  read_at = excluded.read_at;

insert into public.notifications (
  id,
  profile_id,
  kind,
  title,
  body,
  href,
  read_at
)
values
  ('ed000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'review', 'Nova avaliação publicada', 'Uma pessoa compartilhou uma avaliação sobre seu atendimento.', '/plus/avaliacoes', null),
  ('ed000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'reschedule', 'Pedido de reagendamento', 'Há um novo pedido de mudança de horário.', '/plus/agenda', null)
on conflict (id) do update
set
  title = excluded.title,
  body = excluded.body,
  href = excluded.href,
  read_at = excluded.read_at;


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
values (
  'aaaaaaaa-0000-4000-8000-000000000006',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'marina.terapeuta@example.test',
  crypt('tes-mock-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Marina Sem Serviços"}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set
  email = excluded.email,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.profiles (id, role, display_name, email, avatar_url)
values (
  'aaaaaaaa-0000-4000-8000-000000000006',
  'therapist',
  'Marina Sem Serviços',
  'marina.terapeuta@example.test',
  null
)
on conflict (id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.therapist_profiles (
  id,
  user_id,
  plan,
  status,
  slug,
  free_public_slug,
  public_name,
  legal_name,
  headline,
  bio,
  city,
  state,
  languages,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions,
  metadata
)
values (
  'c1000000-0000-4000-8000-000000000006',
  'aaaaaaaa-0000-4000-8000-000000000006',
  'free',
  'approved',
  'marina-sem-servicos',
  '1100006',
  'Marina Sem Serviços',
  'Marina Sem Serviços',
  'Perfil de fixture sem serviços publicados.',
  'Fixture para validar estados vazios do shell de serviços.',
  'São Paulo',
  'SP',
  array['pt-BR'],
  false,
  false,
  true,
  '{}'::jsonb
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
  online_only,
  delivery_format,
  is_bookable,
  position
)
values
  (
    'd1000000-0000-4000-8000-000000000021',
    'c1000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222228',
    'Tarô em pausa',
    'Fixture de servico pausado para validar que nao aparece como reservavel.',
    60,
    12000,
    'BRL',
    'paused',
    true,
    'online',
    false,
    90
  ),
  (
    'd1000000-0000-4000-8000-000000000022',
    'c1000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222230',
    'Constelação em rascunho',
    'Fixture de servico em rascunho para validar fluxo privado.',
    60,
    14000,
    'BRL',
    'draft',
    true,
    'online',
    false,
    100
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
  delivery_format = excluded.delivery_format,
  is_bookable = excluded.is_bookable,
  position = excluded.position,
  updated_at = now();

-- Fase 3: local admin fixture for catalog governance.
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
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin.tes@example.test',
  crypt('tes-mock-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Admin TES"}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  updated_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000090';

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  'aaaaaaaa-0000-4000-8000-000000000090',
  jsonb_build_object(
    'sub',
    'aaaaaaaa-0000-4000-8000-000000000090',
    'email',
    'admin.tes@example.test',
    'email_verified',
    true
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, role, display_name, email, avatar_url)
values (
  'aaaaaaaa-0000-4000-8000-000000000090',
  'admin',
  'Admin TES',
  'admin.tes@example.test',
  null
)
on conflict (id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  updated_at = now();

-- Legal fixtures required by authenticated reservation Checkout in local/test
-- resets. The Edge Function blocks session payment creation unless all three
-- published versions are available.
insert into public.legal_document_versions (
  id,
  document_key,
  title,
  audience,
  version,
  content_hash,
  canonical_path,
  language,
  status,
  approved_at,
  approved_by,
  effective_at,
  published_at,
  requires_new_acceptance,
  change_summary,
  source_reference
)
values
  (
    'dddddddd-0000-4000-8000-000000000101',
    'terms-of-use',
    'Termos de Uso TES',
    array['patient', 'therapist']::text[],
    'local-seed-v1',
    'sha256:tes-local-seed-terms-of-use',
    '/termos',
    'pt-BR',
    'published',
    now() - interval '1 day',
    'local-seed',
    now() - interval '1 day',
    now() - interval '1 day',
    false,
    'Fixture local para testes transacionais; nao substitui revisao juridica.',
    'supabase/seed.sql'
  ),
  (
    'dddddddd-0000-4000-8000-000000000102',
    'privacy-policy',
    'Politica de Privacidade TES',
    array['patient', 'therapist']::text[],
    'local-seed-v1',
    'sha256:tes-local-seed-privacy-policy',
    '/privacidade',
    'pt-BR',
    'published',
    now() - interval '1 day',
    'local-seed',
    now() - interval '1 day',
    now() - interval '1 day',
    false,
    'Fixture local para testes transacionais; nao substitui revisao juridica.',
    'supabase/seed.sql'
  ),
  (
    'dddddddd-0000-4000-8000-000000000103',
    'cancellation-reschedule-refund-policy',
    'Politica de Cancelamento, Reagendamento e Reembolso TES',
    array['patient', 'therapist']::text[],
    'local-seed-v1',
    'sha256:tes-local-seed-cancellation-policy',
    '/termos#cancelamentos',
    'pt-BR',
    'published',
    now() - interval '1 day',
    'local-seed',
    now() - interval '1 day',
    now() - interval '1 day',
    false,
    'Fixture local para testes transacionais; nao substitui revisao juridica.',
    'supabase/seed.sql'
  )
on conflict (id) do nothing;
