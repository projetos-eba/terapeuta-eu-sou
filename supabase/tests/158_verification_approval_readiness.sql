begin;

\ir fixtures/publication-ready-local.inc

select plan(17);

select ok(
  exists (
    select 1
    from public.availability_rules
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and is_active
  ),
  'the publication-ready fixture starts with active recurring availability'
);

update public.availability_rules
set is_active = false
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

insert into public.therapist_verifications (id, therapist_profile_id, status)
values (
  'a9000000-0000-4000-8000-000000000158',
  'c1000000-0000-4000-8000-000000000001',
  'submitted'::public.therapist_status
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.reopen_review',
    'a9000000-0000-4000-8000-000000000158',
    'Início da análise administrativa',
    'verification-readiness-review-158'
  ) $$,
  'an eligible administrator can start the review'
);

select throws_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.approve',
    'a9000000-0000-4000-8000-000000000158',
    'Aprovação revisada pela operação',
    'verification-readiness-no-availability-158'
  ) $$,
  '22023',
  'THERAPIST_ACTIVE_AVAILABILITY_REQUIRED',
  'approval is blocked when no recurring availability remains active'
);

reset role;

select is(
  (select status::text from public.therapist_verifications
   where id = 'a9000000-0000-4000-8000-000000000158'),
  'in_review',
  'a rejected approval leaves the verification in review'
);

select is(
  (select status::text from public.therapist_profiles
   where id = 'c1000000-0000-4000-8000-000000000001'),
  'in_review',
  'a rejected approval does not change the therapist state'
);

select is(
  (select count(*)::integer
   from public.admin_audit_events
   where request_id = 'verification-readiness-no-availability-158'),
  0,
  'a rejected approval does not write an audit event'
);

update public.availability_rules
set is_active = true
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.approve',
    'a9000000-0000-4000-8000-000000000158',
    'Aprovação revisada pela operação',
    'verification-readiness-approve-158'
  ) $$,
  'approval succeeds once recurring availability is restored'
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.approve',
    'a9000000-0000-4000-8000-000000000158',
    'Aprovação revisada pela operação',
    'verification-readiness-approve-158'
  ) $$,
  'the successful approval remains idempotent'
);

reset role;

select is(
  (select status::text from public.therapist_verifications
   where id = 'a9000000-0000-4000-8000-000000000158'),
  'approved',
  'restoring availability permits the administrative decision'
);

select is(
  (select count(*)::integer
   from public.admin_audit_events
   where request_id = 'verification-readiness-approve-158'
     and action = 'verification.approve'),
  1,
  'one successful approval writes one audit event'
);

update public.therapist_profile_guide_items
set is_active = false
where content_version_id in (
  select id
  from public.therapist_profile_content_versions
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and status = 'published'
);

insert into public.therapist_verifications (id, therapist_profile_id, status)
values (
  'a9000000-0000-4000-8000-000000000159',
  'c1000000-0000-4000-8000-000000000001',
  'submitted'::public.therapist_status
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.reopen_review',
    'a9000000-0000-4000-8000-000000000159',
    'Início da análise administrativa',
    'verification-readiness-profile-review-158'
  ) $$,
  'a later review can still start after the first decision'
);

select throws_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.approve',
    'a9000000-0000-4000-8000-000000000159',
    'Aprovação revisada pela operação',
    'verification-readiness-profile-incomplete-158'
  ) $$,
  '22023',
  'THERAPIST_PROFILE_INCOMPLETE',
  'approval is blocked when canonical profile completeness is below 100 percent'
);

reset role;

select is(
  (select status::text from public.therapist_verifications
   where id = 'a9000000-0000-4000-8000-000000000159'),
  'in_review',
  'an incomplete profile leaves the review open'
);

select is(
  (select count(*)::integer
   from public.admin_audit_events
   where request_id = 'verification-readiness-profile-incomplete-158'),
  0,
  'an incomplete profile rejection does not write an audit event'
);

update public.therapist_profile_guide_items
set is_active = true
where content_version_id in (
  select id
  from public.therapist_profile_content_versions
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and status = 'published'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.admin_execute_operation_command_v2(
    'verification.approve',
    'a9000000-0000-4000-8000-000000000159',
    'Aprovação revisada pela operação',
    'verification-readiness-profile-approve-158'
  ) $$,
  'approval succeeds after canonical profile completion is restored'
);

reset role;

select is(
  (select status::text from public.therapist_verifications
   where id = 'a9000000-0000-4000-8000-000000000159'),
  'approved',
  'the restored canonical profile can be approved'
);

select is(
  (select count(*)::integer
   from public.admin_audit_events
   where request_id = 'verification-readiness-profile-approve-158'
     and action = 'verification.approve'),
  1,
  'the restored canonical profile writes one approval audit event'
);

select * from finish();
rollback;
