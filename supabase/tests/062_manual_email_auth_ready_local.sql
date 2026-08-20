begin;

select plan(15);

select has_table('public', 'email_outbox', 'shared email outbox remains available for auth notifications');
select ok(exists (select 1 from public.email_action_definitions where action_key = 'registration_completed' and active), 'registration completed action is provisioned');
select ok(exists (select 1 from public.email_action_definitions where action_key = 'patient_welcome' and active), 'patient welcome action is provisioned');
select ok(exists (select 1 from public.email_action_definitions where action_key = 'therapist_welcome' and active), 'therapist welcome action is provisioned');
select ok(exists (select 1 from public.email_action_definitions where action_key = 'password_changed' and active), 'password changed action is provisioned');
select is(
  (select count(*)::integer from public.email_action_settings where action_key in ('registration_completed', 'patient_welcome', 'therapist_welcome')),
  0,
  'onboarding actions are not auto-configured before a cadence decision'
);
select ok(has_function_privilege('service_role', 'public.enqueue_transactional_email_v1(text,uuid,text,uuid,uuid,text,jsonb)', 'EXECUTE'), 'trusted runtime can enqueue generic deliveries');
select is(has_function_privilege('authenticated', 'public.enqueue_transactional_email_v1(text,uuid,text,uuid,uuid,text,jsonb)', 'EXECUTE'), false, 'authenticated users cannot enqueue a delivery directly');

insert into public.email_action_settings (action_key, enabled, automatic_dispatch_enabled)
values ('password_changed', false, true);

select is(
  public.enqueue_transactional_email_v1(
    'password_changed',
    'd2000000-0000-4000-8000-000000000001',
    'auth_action_token',
    'd2000000-0000-4000-8000-000000000002',
    (select id from public.profiles where role = 'patient' order by id limit 1),
    'profile:' || (select id from public.profiles where role = 'patient' order by id limit 1)::text,
    '{}'::jsonb
  ),
  null,
  'disabled actions do not create automatic deliveries'
);

delete from public.email_action_settings where action_key = 'password_changed';

select ok(
  public.enqueue_transactional_email_v1(
    'password_changed',
    'd2000000-0000-4000-8000-000000000003',
    'auth_action_token',
    'd2000000-0000-4000-8000-000000000004',
    (select id from public.profiles where role = 'patient' order by id limit 1),
    'profile:' || (select id from public.profiles where role = 'patient' order by id limit 1)::text,
    '{}'::jsonb
  ) is not null,
  'password change creates an outbox item from the authoritative token claim'
);
select is(
  (select count(*)::integer from public.email_outbox where action_key = 'password_changed' and domain_event_id = 'd2000000-0000-4000-8000-000000000003'),
  1,
  'password change has one logical delivery'
);
select is(
  (select template_version from public.email_outbox where action_key = 'password_changed' and domain_event_id = 'd2000000-0000-4000-8000-000000000003'),
  'v1',
  'password change snapshots the versioned default'
);
select is(
  jsonb_typeof((select template_overrides from public.email_outbox where action_key = 'password_changed' and domain_event_id = 'd2000000-0000-4000-8000-000000000003')),
  'object',
  'password change snapshots only override metadata'
);
select is(
  public.enqueue_transactional_email_v1(
    'password_changed',
    'd2000000-0000-4000-8000-000000000003',
    'auth_action_token',
    'd2000000-0000-4000-8000-000000000004',
    (select id from public.profiles where role = 'patient' order by id limit 1),
    'profile:' || (select id from public.profiles where role = 'patient' order by id limit 1)::text,
    '{}'::jsonb
  ),
  (select id from public.email_outbox where action_key = 'password_changed' and domain_event_id = 'd2000000-0000-4000-8000-000000000003'),
  'a replay resolves to the original logical delivery'
);
select throws_ok(
  $$select public.enqueue_transactional_email_v1(
    'password_changed',
    'd2000000-0000-4000-8000-000000000005',
    'unsupported_entity',
    'd2000000-0000-4000-8000-000000000006',
    (select id from public.profiles where role = 'patient' order by id limit 1),
    'profile:' || (select id from public.profiles where role = 'patient' order by id limit 1)::text,
    '{}'::jsonb
  )$$,
  'P0001',
  'EMAIL_OUTBOX_INVALID_ENTITY',
  'generic enqueue rejects unapproved entity types'
);

select * from finish();
rollback;
