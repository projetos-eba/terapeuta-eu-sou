begin;

select plan(12);

select has_column('public', 'message_templates', 'category',
  'historical template category remains stored');
select has_column('public', 'message_templates', 'parameter_schema',
  'historical closed parameter options remain stored');
select has_column('public', 'messages', 'metadata',
  'historical server-resolved message metadata remains stored');
select has_function('public', 'send_structured_participant_message_v2',
  array['uuid', 'text', 'uuid', 'jsonb'], 'legacy V2 send function remains for schema compatibility');
select has_function('public', 'preview_structured_participant_message_v2',
  array['uuid', 'text', 'uuid', 'jsonb'], 'legacy V2 preview function remains for schema compatibility');
select is(has_function_privilege('anon',
  'public.send_structured_participant_message_v2(uuid,text,uuid,jsonb)', 'EXECUTE'),
  false, 'anonymous callers cannot invoke legacy V2 send');
select is(has_function_privilege('authenticated',
  'public.send_structured_participant_message_v2(uuid,text,uuid,jsonb)', 'EXECUTE'),
  false, 'authenticated callers cannot invoke legacy V2 send');
select is(has_function_privilege('authenticated',
  'public.preview_structured_participant_message_v2(uuid,text,uuid,jsonb)', 'EXECUTE'),
  false, 'authenticated callers cannot invoke legacy V2 preview');
select is(has_table_privilege('authenticated', 'public.conversations', 'INSERT'),
  false, 'authenticated callers cannot create participant conversations');
select is(has_table_privilege('authenticated', 'public.conversations', 'UPDATE'),
  false, 'authenticated callers cannot modify participant conversations');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.preview_structured_participant_message_v2(
  'eb000000-0000-4000-8000-000000000001'::uuid,
  'patient_confirm_session', null, '{}'::jsonb) $$, '42501', null,
  'participant preview cannot bypass the closed channel');
select throws_ok($$ select public.send_structured_participant_message_v2(
  'eb000000-0000-4000-8000-000000000001'::uuid,
  'patient_confirm_session', null, '{}'::jsonb) $$, '42501', null,
  'participant send cannot bypass the closed channel');

reset role;
select * from finish();
rollback;
