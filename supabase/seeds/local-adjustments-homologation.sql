-- Local-only homologation data for the seven profile/settings adjustments.
-- This file is intentionally not a production migration and is safe to apply
-- repeatedly without resetting the local database.

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
  'aaaaaaaa-0000-4000-8000-000000000006',
  'aaaaaaaa-0000-4000-8000-000000000006',
  jsonb_build_object(
    'sub', 'aaaaaaaa-0000-4000-8000-000000000006',
    'email', 'marina.terapeuta@example.test',
    'email_verified', true
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

update auth.users
set
  encrypted_password = crypt('tes-mock-password', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000006';

insert into public.therapist_private_identity (
  id,
  therapist_profile_id,
  document_type,
  document_number,
  postal_code,
  street,
  street_number,
  complement,
  neighborhood,
  city,
  state,
  country
)
values (
  'd1000000-0000-4000-8000-000000000006',
  'c1000000-0000-4000-8000-000000000006',
  'cpf',
  '52998224725',
  '13060240',
  'Rua de homologação',
  '120',
  'Sala 4',
  'Morumbi',
  'São Paulo',
  'SP',
  'BR'
)
on conflict (therapist_profile_id) do update
set
  document_type = excluded.document_type,
  document_number = excluded.document_number,
  postal_code = excluded.postal_code,
  street = excluded.street,
  street_number = excluded.street_number,
  complement = excluded.complement,
  neighborhood = excluded.neighborhood,
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
  updated_at = now();

insert into public.therapist_profile_content_versions (
  id,
  therapist_profile_id,
  status,
  short_intro,
  essence_body,
  invitation_body,
  experience_years,
  profile_payload,
  base_profile_version,
  public_profile_theme
)
values (
  'd2000000-0000-4000-8000-000000000006',
  'c1000000-0000-4000-8000-000000000006',
  'draft',
  'Um espaço de escuta para olhar para o seu momento com presença.',
  'Acolhimento e organização para que você possa reconhecer seus próximos passos.',
  'Conheça meu trabalho e veja como posso acompanhar o seu processo.',
  4,
  jsonb_build_object(
    'publicName', 'Marina Sem Serviços',
    'headline', 'Acolhimento para processos de mudança',
    'bio', 'Um perfil local para homologar a edição com segurança e clareza.',
    'city', 'São Paulo',
    'state', 'SP',
    'guideItems', jsonb_build_array(),
    'reflections', jsonb_build_array()
  ),
  1,
  'serene'
)
on conflict (id) do update
set
  status = excluded.status,
  short_intro = excluded.short_intro,
  essence_body = excluded.essence_body,
  invitation_body = excluded.invitation_body,
  experience_years = excluded.experience_years,
  profile_payload = excluded.profile_payload,
  base_profile_version = excluded.base_profile_version,
  public_profile_theme = excluded.public_profile_theme,
  updated_at = now();
