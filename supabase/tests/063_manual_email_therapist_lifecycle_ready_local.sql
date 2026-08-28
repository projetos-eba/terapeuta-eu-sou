begin;

select plan(16);

delete from public.email_outbox
where action_key in (
  'therapist_profile_submitted_for_review',
  'therapist_documents_requested',
  'therapist_profile_approved',
  'therapist_profile_rejected',
  'therapist_profile_suspended',
  'therapist_profile_reactivated'
);

select has_trigger('public', 'therapist_verifications', 'enqueue_therapist_verification_email', 'verification transitions enqueue after persistence');
select has_trigger('public', 'therapist_profiles', 'enqueue_therapist_profile_lifecycle_email', 'profile lifecycle transitions enqueue after persistence');
select is(has_function_privilege('anon', 'public.enqueue_therapist_verification_email_v1()', 'EXECUTE'), false, 'anonymous users cannot invoke the verification e-mail trigger');
select is(has_function_privilege('anon', 'public.enqueue_therapist_profile_lifecycle_email_v1()', 'EXECUTE'), false, 'anonymous users cannot invoke the profile e-mail trigger');

select is(
  (select count(*)::integer from public.email_action_definitions where action_key in (
    'therapist_profile_submitted_for_review',
    'therapist_documents_requested',
    'therapist_profile_approved',
    'therapist_profile_rejected',
    'therapist_profile_suspended',
    'therapist_profile_reactivated'
  )),
  6,
  'all therapist lifecycle actions are provisioned'
);

delete from public.email_outbox
where related_entity_id in (
  'c1000000-0000-4000-8000-000000000001',
  'a9000000-0000-4000-8000-000000000601'
);
delete from public.therapist_verifications
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set status = 'draft'::public.therapist_status,
    is_public = false,
    public_status = 'draft',
    updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_profiles
set is_public = true,
    public_status = 'published',
    updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_submitted_for_review' and related_entity_type = 'therapist_verification'),
  1,
  'submitted verification queues one email after the authoritative insert'
);

update public.therapist_profiles
set is_public = true,
    public_status = 'published',
    updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_submitted_for_review' and related_entity_type = 'therapist_verification'),
  1,
  'replaying a publication without a persisted status transition does not duplicate delivery'
);

update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'changes_requested'::public.therapist_status,
    changes_requested = 'Informação sensível que não pode entrar no e-mail.',
    reviewed_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_documents_requested'),
  1,
  'persisted request for changes queues the documents action'
);
select is(
  (select payload from public.email_outbox where action_key = 'therapist_documents_requested'),
  '{}'::jsonb,
  'documents action does not persist a reason or document data in the outbox payload'
);

update public.therapist_verifications
set status = 'submitted'::public.therapist_status,
    changes_requested = null,
    reviewed_at = null
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'rejected'::public.therapist_status,
    reviewed_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_rejected'),
  1,
  'persisted rejection queues one rejection delivery'
);

insert into public.email_action_settings (action_key, enabled, automatic_dispatch_enabled)
values ('therapist_profile_rejected', false, true);
update public.therapist_verifications
set status = 'submitted'::public.therapist_status,
    reviewed_at = null
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'rejected'::public.therapist_status,
    reviewed_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_rejected'),
  1,
  'disabled lifecycle actions do not enqueue a later automatic delivery'
);

delete from public.email_action_settings
where action_key = 'therapist_profile_rejected';
update public.therapist_verifications
set status = 'submitted'::public.therapist_status,
    reviewed_at = null
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'in_review'::public.therapist_status
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_verifications
set status = 'approved'::public.therapist_status,
    reviewed_at = now()
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_approved'),
  1,
  'persisted approval queues one approval delivery'
);

update public.therapist_profiles
set status = 'suspended'::public.therapist_status,
    updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_suspended'),
  1,
  'persisted suspension queues one suspension delivery'
);

update public.therapist_profiles
set status = 'approved'::public.therapist_status,
    updated_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.email_outbox where action_key = 'therapist_profile_reactivated'),
  1,
  'persisted reactivation queues one reactivation delivery'
);

select ok(
  (select count(*) = count(distinct (action_key, domain_event_id, recipient_key)) from public.email_outbox),
  'each therapist lifecycle delivery preserves the logical outbox dedupe key'
);
select is(
  (select count(*)::integer from public.email_outbox where recipient_key !~ '^profile:'),
  0,
  'therapist lifecycle deliveries keep recipients opaque'
);

select * from finish();
rollback;
