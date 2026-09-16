begin;

select plan(6);

select has_function('public', 'mark_structured_participant_messages_read_v1',
  array['uuid'], 'legacy read-state RPC remains in schema');
select is(has_function_privilege('anon',
  'public.mark_structured_participant_messages_read_v1(uuid)', 'EXECUTE'),
  false, 'anonymous callers cannot mutate historical read state');
select is(has_function_privilege('authenticated',
  'public.mark_structured_participant_messages_read_v1(uuid)', 'EXECUTE'),
  false, 'authenticated callers cannot mutate historical read state');
select is(has_table_privilege('authenticated', 'public.messages', 'SELECT'),
  true, 'historical messages retain read-only access under RLS');
select is(has_table_privilege('authenticated', 'public.messages', 'UPDATE'),
  false, 'authenticated callers cannot directly mark messages read');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.mark_structured_participant_messages_read_v1(
  'eb000000-0000-4000-8000-000000000001'::uuid) $$,
  '42501', null, 'the legacy RPC rejects participant read-state mutation');

reset role;
select * from finish();
rollback;
