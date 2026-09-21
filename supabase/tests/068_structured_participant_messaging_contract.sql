begin;

-- This is a retirement contract, not a deletion of historical records.
select plan(10);

select has_column('public', 'messages', 'template_id',
  'historical template provenance remains available');
select has_function('public', 'send_structured_participant_message_v1',
  array['uuid', 'text'], 'legacy RPC remains present for stored history');
select is(has_function_privilege('anon',
  'public.send_structured_participant_message_v1(uuid,text)', 'EXECUTE'),
  false, 'anonymous callers cannot send participant messages');
select is(has_function_privilege('authenticated',
  'public.send_structured_participant_message_v1(uuid,text)', 'EXECUTE'),
  false, 'authenticated callers cannot use the retired send RPC');
select is(has_table_privilege('authenticated', 'public.messages', 'SELECT'),
  true, 'historical messages remain readable subject to RLS');
select is(has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  false, 'authenticated callers cannot insert participant messages');
select is(has_table_privilege('authenticated', 'public.messages', 'UPDATE'),
  false, 'authenticated callers cannot rewrite participant messages');
select is(has_table_privilege('authenticated', 'public.messages', 'DELETE'),
  false, 'authenticated callers cannot delete participant messages');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok($$ select public.send_structured_participant_message_v1(
  'eb000000-0000-4000-8000-000000000001'::uuid,
  'patient_confirm_session') $$, '42501', null,
  'the retired send RPC is inaccessible to an authenticated participant');
select throws_ok($$ insert into public.messages
  (conversation_id, sender_profile_id, body)
  values ('eb000000-0000-4000-8000-000000000001'::uuid,
    auth.uid(), 'Mensagem proibida.') $$, '42501', null,
  'direct participant message insertion is inaccessible');

reset role;
select * from finish();
rollback;
