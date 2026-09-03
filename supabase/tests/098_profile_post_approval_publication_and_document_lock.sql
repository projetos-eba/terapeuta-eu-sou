begin;

select plan(15);

select has_function(
  'public',
  'prevent_accepted_therapist_private_document_replacement_v1',
  array[]::text[],
  'accepted private document replacement has a database guard'
);

select has_trigger(
  'public',
  'therapist_private_documents',
  'prevent_accepted_therapist_private_document_replacement',
  'required private documents are protected from direct replacement'
);

-- Keep this fixture-independent. The test transaction is rolled back below,
-- so an existing local accepted document is restored after the assertion.
delete from public.therapist_private_documents
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and document_kind = 'identity_document';

insert into public.therapist_private_documents (
  id,
  therapist_profile_id,
  uploaded_by,
  document_kind,
  file_name,
  file_size_bytes,
  mime_type,
  status,
  storage_object_path,
  validation_state
) values (
  'b9800000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'identity_document',
  'identidade-aprovada.pdf',
  2048,
  'application/pdf',
  'accepted',
  'c1000000-0000-4000-8000-000000000001/identity_document/accepted.pdf',
  'passed'
);

select throws_ok(
  $$
    insert into public.therapist_private_documents (
      id, therapist_profile_id, uploaded_by, document_kind, file_name,
      file_size_bytes, mime_type, status, storage_object_path, validation_state
    ) values (
      'b9800000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'identity_document', 'identidade-substituta.pdf', 2048,
      'application/pdf', 'uploaded',
      'c1000000-0000-4000-8000-000000000001/identity_document/replacement.pdf',
      'pending'
    )
  $$,
  'P0001',
  'DOCUMENT_ALREADY_ACCEPTED',
  'an accepted document cannot be replaced through a direct database write'
);

-- This is the persisted state set by the existing admin.resubmission_requested
-- command. Once it is requested, only that document kind becomes uploadable.
update public.therapist_private_documents
set status = 'rejected', validation_state = 'failed'
where id = 'b9800000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    insert into public.therapist_private_documents (
      id, therapist_profile_id, uploaded_by, document_kind, file_name,
      file_size_bytes, mime_type, status, storage_object_path, validation_state
    ) values (
      'b9800000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'identity_document', 'identidade-reenviada.pdf', 2048,
      'application/pdf', 'uploaded',
      'c1000000-0000-4000-8000-000000000001/identity_document/resubmitted.pdf',
      'pending'
    )
  $$,
  'a document becomes uploadable again after the Admin requests re-submission'
);

delete from public.therapist_verifications
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

delete from public.therapist_profile_content_versions
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status = 'draft';

update public.therapist_profiles
set
  status = 'draft',
  public_status = 'draft',
  is_public = false,
  is_accepting_bookings = false
where id = 'c1000000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'b9800000-0000-4000-8000-000000000101',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
      jsonb_build_object(
        'publicName', 'Ana Oliveira Pós Aprovação',
        'shortIntro', 'Uma apresentação completa para a primeira análise administrativa.',
        'essenceBody', 'Cuidado online com presença, clareza e responsabilidade.',
        'bio', 'Atendimento online com linguagem clara e responsável.',
        'guideItems', jsonb_build_array(jsonb_build_object('icon', 'sparkles', 'label', 'Escuta acolhedora')),
        'reflections', '[]'::jsonb
      )
    )
  $$,
  'a first profile draft can be saved before submission'
);

select lives_ok(
  $$
    select public.publish_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'b9800000-0000-4000-8000-000000000102',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
    )
  $$,
  'a first profile publication remains valid'
);

select is(
  (select status::text from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'submitted',
  'the first publication remains submitted for administrative review'
);

select is(
  (select is_public from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  false,
  'the first publication remains hidden until approval'
);

update public.therapist_verifications
set status = 'in_review'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_verifications
set status = 'approved'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set
  status = 'approved',
  public_status = 'published',
  is_public = true,
  is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'b9800000-0000-4000-8000-000000000103',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
      jsonb_build_object(
        'publicName', 'Ana Oliveira Atualizada',
        'shortIntro', 'Uma apresentação atualizada após a aprovação inicial.',
        'essenceBody', 'Cuidado online com presença, clareza e responsabilidade.',
        'bio', 'Atendimento online com linguagem clara e responsável.',
        'guideItems', jsonb_build_array(jsonb_build_object('icon', 'sparkles', 'label', 'Escuta acolhedora')),
        'reflections', '[]'::jsonb
      )
    )
  $$,
  'an approved profile can save a later editorial draft'
);

select lives_ok(
  $$
    select public.publish_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'b9800000-0000-4000-8000-000000000104',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
    )
  $$,
  'an approved profile can publish a later editorial update directly'
);

select is(
  (select count(*)::integer from public.therapist_verifications where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  1,
  'a post-approval publication does not create or reopen a verification'
);

select ok(
  (
    select status = 'approved'::public.therapist_status
      and public_status = 'published'
      and is_public
      and is_accepting_bookings
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'a post-approval publication preserves approval, visibility and booking eligibility'
);

select ok(
  exists (
    select 1
    from public.therapist_profile_events
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and request_id = 'b9800000-0000-4000-8000-000000000104'
      and event_type = 'profile_published'
  ),
  'a post-approval publication remains recorded in the immutable profile audit'
);

select lives_ok(
  $$
    update public.therapist_profiles
    set status = 'suspended'
    where id = 'c1000000-0000-4000-8000-000000000001'
  $$,
  'an administrative suspension remains a valid protected state'
);

select throws_ok(
  $$
    select public.publish_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'b9800000-0000-4000-8000-000000000105',
      (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
    )
  $$,
  'P0001',
  'PROFILE_LOCKED',
  'a suspended profile cannot bypass the administrative protection'
);

select * from finish();

rollback;
