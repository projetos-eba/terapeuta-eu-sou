begin;

select plan(19);

select has_column(
  'public',
  'therapist_profiles',
  'profile_version',
  'therapist profiles expose an optimistic editor version'
);

select has_column(
  'public',
  'therapist_profiles',
  'public_status',
  'public profile lifecycle is separated from account status'
);

select has_table(
  'public',
  'therapist_profile_mutation_requests',
  'profile mutations have an idempotency ledger'
);

select has_table(
  'public',
  'therapist_private_documents',
  'private therapist documents have a separate table'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.save_therapist_profile_draft_v1(uuid,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  'service role can invoke profile draft mutation through Edge Functions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.save_therapist_profile_draft_v1(uuid,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke profile draft mutation directly'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'public_therapist_profiles_v',
        'public_therapist_profile_content_v',
        'public_therapist_search'
      )
      and column_name in (
        'legal_name',
        'documents_metadata',
        'storage_object_path',
        'uploaded_by',
        'profile_payload'
      )
  ),
  'public profile views do not expose private or administrative fields'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  exists (
    select 1
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'therapist reads their own private profile'
);

select ok(
  not exists (
    select 1
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000002'
  ),
  'therapist cannot read another private profile'
);

select throws_ok(
  $$
    update public.therapist_profiles
    set public_name = 'Tentativa indevida'
    where id = 'c1000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'therapist cannot update canonical profile table directly'
);

reset role;

insert into public.therapist_private_documents (
  id,
  therapist_profile_id,
  uploaded_by,
  storage_object_path,
  file_name,
  mime_type,
  file_size_bytes
)
values (
  'a7000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001/documentos/certificado.pdf',
  'certificado.pdf',
  'application/pdf',
  2048
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.therapist_private_documents),
  1,
  'therapist reads own private documents'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.therapist_private_documents),
  0,
  'therapist cannot read documents from another therapist'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.therapist_private_documents),
  0,
  'patient cannot read private therapist documents'
);

reset role;

select ok(
  (
    public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000601',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
      jsonb_build_object(
        'publicName', 'Ana Oliveira M1',
        'shortIntro', 'Perfil salvo como rascunho sem alterar a area publica.',
        'essenceBody', 'Cuidado online com presenca e responsabilidade.',
        'bio', 'Atendimento online com linguagem clara e sem promessa de resultado.',
        'guideItems', jsonb_build_array(jsonb_build_object('icon', 'sparkles', 'label', 'Escuta acolhedora')),
        'reflections', '[]'::jsonb
      )
    ) -> 'editor' -> 'draft' is not null
  ),
  'therapist can save a private draft through the service-role authority'
);

select isnt(
  (select public_name from public.public_therapist_profiles_v where slug = 'ana-oliveira'),
  'Ana Oliveira M1',
  'draft does not alter public profile projections'
);

select ok(
  (
    public.publish_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000602',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
    ) -> 'editor' ->> 'draft'
  ) is null,
  'publishing consumes the draft'
);

select is(
  (select public_name from public.public_therapist_profiles_v where slug = 'ana-oliveira'),
  'Ana Oliveira M1',
  'published profile updates the public projection'
);

select throws_ok(
  $$
    select public.unpublish_therapist_profile_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000603',
      1
    )
  $$,
  'P0001',
  'VERSION_CONFLICT',
  'profile mutations enforce optimistic version conflicts'
);

select ok(
  (
    public.unpublish_therapist_profile_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000604',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
    ) -> 'editor' -> 'derived' ->> 'publicStatus'
  ) = 'unpublished',
  'therapist can unpublish without deleting history'
);

select * from finish();

rollback;
