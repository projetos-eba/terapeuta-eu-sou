begin;

select plan(14);

select has_column(
  'public',
  'messages',
  'template_id',
  'structured participant messages retain their approved template provenance'
);

select ok(
  to_regprocedure('public.send_structured_participant_message_v1(uuid,text)')
    is not null,
  'structured participant message RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.send_structured_participant_message_v1(uuid,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute the structured participant message RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.send_structured_participant_message_v1(uuid,text)',
    'EXECUTE'
  ),
  'authenticated callers can use the in-function participant boundary'
);

select is(
  has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  false,
  'authenticated callers cannot directly insert arbitrary participant message bodies'
);

select is(
  has_table_privilege('authenticated', 'public.messages', 'UPDATE'),
  false,
  'authenticated callers cannot directly rewrite participant messages'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    insert into public.messages (conversation_id, sender_profile_id, body)
    values (
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      'Corpo arbitrário proibido.'
    )
  $$,
  '42501',
  null,
  'direct participant message insert is blocked before arbitrary text can persist'
);

select lives_ok(
  $$
    select public.send_structured_participant_message_v1(
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'patient_confirm_session'
    )
  $$,
  'an authorized patient can send an approved template in the correct direction'
);

select is(
  (
    select body
    from public.messages
    where conversation_id = 'eb000000-0000-4000-8000-000000000001'::uuid
      and sender_profile_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid
      and template_id is not null
    order by created_at desc, id desc
    limit 1
  ),
  'Confirmo que estarei presente na sessão agendada.',
  'the server resolves and persists the approved template body'
);

select ok(
  exists (
    select 1
    from public.messages
    where conversation_id = 'eb000000-0000-4000-8000-000000000001'::uuid
      and sender_profile_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid
      and template_id is not null
  ),
  'the participant message persists the approved template reference'
);

select throws_ok(
  $$
    select public.send_structured_participant_message_v1(
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'therapist_confirm_session'
    )
  $$,
  '22023',
  'participant template is unavailable for this direction',
  'a template from the opposite direction is rejected'
);

select throws_ok(
  $$
    select public.send_structured_participant_message_v1(
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'unknown_participant_template'
    )
  $$,
  '22023',
  'participant template is unavailable for this direction',
  'an unknown participant template is rejected'
);

reset role;

update public.message_templates
set is_active = false
where key = 'patient_practical_question';

set local role authenticated;

select throws_ok(
  $$
    select public.send_structured_participant_message_v1(
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'patient_practical_question'
    )
  $$,
  '22023',
  'participant template is unavailable for this direction',
  'an inactive participant template is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.send_structured_participant_message_v1(
      'eb000000-0000-4000-8000-000000000001'::uuid,
      'patient_confirm_session'
    )
  $$,
  '42501',
  'conversation participant required',
  'a participant cannot send into another requester conversation'
);

reset role;

select * from finish();

rollback;
