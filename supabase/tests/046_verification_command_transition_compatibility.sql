begin;

select plan(13);

select ok(
  to_regprocedure(
    'public.enforce_therapist_verification_transition_v1()'
  ) is not null,
  'verification transition guard exists'
);

insert into public.therapist_verifications (
  id,
  therapist_profile_id,
  status
)
values
  (
    'a9000000-0000-4000-8000-000000000461',
    'c1000000-0000-4000-8000-000000000001',
    'submitted'::public.therapist_status
  ),
  (
    'a9000000-0000-4000-8000-000000000462',
    'c1000000-0000-4000-8000-000000000002',
    'submitted'::public.therapist_status
  ),
  (
    'a9000000-0000-4000-8000-000000000463',
    'c1000000-0000-4000-8000-000000000002',
    'draft'::public.therapist_status
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.admin_execute_operation_command_v1(
      'verification.reopen_review',
      'a9000000-0000-4000-8000-000000000461'::uuid,
      'Inicio formal da analise administrativa',
      'verification-transition-review-461'
    )
  $$,
  'audited admin command starts review from submitted'
);

select lives_ok(
  $$
    select public.admin_execute_operation_command_v1(
      'verification.approve',
      'a9000000-0000-4000-8000-000000000461'::uuid,
      'Documentacao revisada e aprovada',
      'verification-transition-approve-461'
    )
  $$,
  'audited admin command can decide a verification in review'
);

reset role;

select is(
  (
    select status::text
    from public.therapist_verifications
    where id = 'a9000000-0000-4000-8000-000000000461'
  ),
  'approved',
  'immediate approval stores the terminal decision'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'verification-transition-approve-461'
      and action = 'verification.approve'
  ),
  1,
  'immediate approval remains audited once'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.admin_execute_operation_command_v2(
      'verification.reopen_review',
      'a9000000-0000-4000-8000-000000000462'::uuid,
      'Inicio formal da analise administrativa',
      'verification-transition-review-462'
    )
  $$,
  'review can be started before requesting changes'
);

select lives_ok(
  $$
    select public.admin_execute_operation_command_v2(
      'verification.pause_review',
      'a9000000-0000-4000-8000-000000000462'::uuid,
      'Revisao pausada para ajustes documentais',
      'verification-transition-pause-462'
    )
  $$,
  'audited admin command can request changes from review'
);

reset role;

select is(
  (
    select status::text
    from public.therapist_verifications
    where id = 'a9000000-0000-4000-8000-000000000462'
  ),
  'changes_requested',
  'requesting changes stores the expected review state'
);

select is(
  (
    select count(*)::integer
    from public.admin_audit_events
    where request_id = 'verification-transition-pause-462'
      and action = 'verification.pause_review'
  ),
  1,
  'requesting changes remains audited once'
);

select throws_ok(
  $$
    update public.therapist_verifications
    set status = 'approved'::public.therapist_status
    where id = 'a9000000-0000-4000-8000-000000000463'
  $$,
  '22023',
  'invalid therapist verification status transition',
  'draft verification cannot skip submission'
);

select throws_ok(
  $$
    update public.therapist_verifications
    set status = 'approved'::public.therapist_status
    where id = 'a9000000-0000-4000-8000-000000000462'
  $$,
  '22023',
  'invalid therapist verification status transition',
  'changes requested cannot skip resubmission or review'
);

select lives_ok(
  $$
    update public.therapist_verifications
    set status = 'submitted'::public.therapist_status
    where id = 'a9000000-0000-4000-8000-000000000462'
  $$,
  'changes requested can return to the submitted queue'
);

select is(
  (
    select status::text
    from public.therapist_verifications
    where id = 'a9000000-0000-4000-8000-000000000462'
  ),
  'submitted',
  'resubmission restores the queue state'
);

select * from finish();

rollback;
