begin;

select plan(24);

select has_column('public', 'message_templates', 'category', 'catalog stores a participant-message category');
select has_column('public', 'message_templates', 'parameter_schema', 'catalog stores closed parameter options');
select has_column('public', 'messages', 'metadata', 'sent messages store server-resolved metadata');
select has_function('public', 'send_structured_participant_message_v2', array['uuid', 'text', 'uuid', 'jsonb'], 'V2 send boundary exists');
select has_function('public', 'preview_structured_participant_message_v2', array['uuid', 'text', 'uuid', 'jsonb'], 'V2 preview boundary exists');
select is(has_function_privilege('anon', 'public.send_structured_participant_message_v2(uuid,text,uuid,jsonb)', 'EXECUTE'), false, 'anonymous users cannot send structured messages');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (public.preview_structured_participant_message_v2(
    'eb000000-0000-4000-8000-000000000001'::uuid,
    'patient_confirm_session',
    'f2000000-0000-4000-8000-000000000001'::uuid,
    '{}'::jsonb
  )->>'body') = 'Confirmo que estarei presente na sessão agendada.',
  'patient preview resolves approved body on the server'
);
select ok(
  (public.preview_structured_participant_message_v2(
    'eb000000-0000-4000-8000-000000000001'::uuid,
    'patient_confirm_session',
    'f2000000-0000-4000-8000-000000000001'::uuid,
    '{}'::jsonb
  )->'cta'->>'href') = '/terapeuta/sessoes/f2000000-0000-4000-8000-000000000001',
  'patient-to-therapist CTA is a canonical therapist session route'
);
select lives_ok(
  $$ select public.send_structured_participant_message_v2(
    'eb000000-0000-4000-8000-000000000001'::uuid,
    'patient_confirm_session',
    null,
    '{}'::jsonb
  ) $$,
  'patient can send an approved template using derived booking context'
);
select ok(
  exists(select 1 from public.messages where template_id is not null and body = 'Confirmo que estarei presente na sessão agendada.'),
  'persisted participant body is the server template body'
);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'therapist_confirm_session', null, '{}'::jsonb) $$,
  '22023',
  'participant template is unavailable for this direction',
  'wrong direction is rejected'
);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'template_not_known', null, '{}'::jsonb) $$,
  '22023',
  'participant template is unavailable for this direction',
  'unknown template is rejected'
);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000002'::uuid, 'patient_confirm_session', null, '{}'::jsonb) $$,
  '42501',
  'conversation participant required',
  'participant outside the conversation is rejected'
);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'patient_confirm_session', null, '{"body":"texto livre"}'::jsonb) $$,
  '22023',
  'structured message parameter is not allowed',
  'arbitrary body parameter is rejected by the database boundary'
);
set local role postgres;
update public.message_templates set is_active = false where key = 'patient_practical_question';
set local role authenticated;
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'patient_practical_question', null, '{}'::jsonb) $$,
  '22023',
  'participant template is unavailable for this direction',
  'inactive template is rejected'
);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'patient_confirm_session', 'f2000000-0000-4000-8000-000000000002'::uuid, '{}'::jsonb) $$,
  '42501',
  'booking context is not authorized for this conversation',
  'unrelated booking context is rejected'
);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'therapist_delay', null, '{"delay_window":"invalid"}'::jsonb) $$,
  '22023',
  'participant template is unavailable for this direction',
  'wrong-direction parameter request is rejected before option resolution'
);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok(
  (public.preview_structured_participant_message_v2(
    'eb000000-0000-4000-8000-000000000001'::uuid,
    'therapist_delay',
    null,
    '{"delay_window":"up_to_5_minutes"}'::jsonb
  )->>'body') = 'Tive um pequeno atraso. Devo conseguir estar com você em até 5 minutos.',
  'therapist closed parameter is resolved into the approved body'
);
select lives_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'therapist_delay', null, '{"delay_window":"up_to_5_minutes"}'::jsonb) $$,
  'therapist can send a valid structured template in the opposite direction'
);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select public.preview_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'therapist_delay', null, '{"delay_window":"invalid"}'::jsonb) $$,
  '22023',
  'structured message parameter value is not allowed',
  'invalid parameter preview does not produce a message'
);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select public.send_structured_participant_message_v2('eb000000-0000-4000-8000-000000000001'::uuid, 'patient_confirm_session', null, '{"cta":"https://evil.test"}'::jsonb) $$,
  '22023',
  'structured message parameter is not allowed',
  'browser CTA data cannot be injected'
);
select lives_ok(
  $$ select public.send_structured_participant_message_v1('eb000000-0000-4000-8000-000000000001'::uuid, 'patient_confirm_session') $$,
  'legacy V1 remains callable through the V2 server-authoritative boundary'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_profile_id, body) values ('eb000000-0000-4000-8000-000000000001'::uuid, auth.uid(), 'texto livre') $$,
  '42501',
  null,
  'authenticated direct message insert remains blocked'
);
set local role postgres;
update public.conversations set booking_id = null where id = 'eb000000-0000-4000-8000-000000000002'::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$ select public.send_structured_participant_message_v1('eb000000-0000-4000-8000-000000000002'::uuid, 'patient_confirm_session') $$,
  'legacy V1 remains compatible with a conversation that has no booking context'
);

reset role;
select * from finish();
rollback;
