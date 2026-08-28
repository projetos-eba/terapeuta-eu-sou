begin;

select plan(6);

select has_function(
  'public',
  'mark_structured_participant_messages_read_v1',
  array['uuid'],
  'read-state boundary exists for structured participant messages'
);

select is(
  has_function_privilege(
    'anon',
    'public.mark_structured_participant_messages_read_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot mark participant messages as read'
);

insert into public.conversations (
  id,
  patient_profile_id,
  therapist_profile_id,
  booking_id,
  last_message_at
)
values (
  'eb000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  null,
  now()
)
on conflict (id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  therapist_profile_id = excluded.therapist_profile_id,
  booking_id = excluded.booking_id,
  last_message_at = excluded.last_message_at;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.send_structured_participant_message_v2(
    'eb000000-0000-4000-8000-000000000001'::uuid,
    'therapist_confirm_session',
    null,
    '{}'::jsonb
  ) $$,
  'the therapist can create a requester-visible message for read-state validation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select ok(
  public.mark_structured_participant_messages_read_v1(
    'eb000000-0000-4000-8000-000000000001'::uuid
  ) > 0,
  'the conversation participant marks incoming messages as read'
);
select ok(
  exists (
    select 1
    from public.messages
    where conversation_id = 'eb000000-0000-4000-8000-000000000001'::uuid
      and sender_profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
      and read_at is not null
  ),
  'the incoming therapist message persists its read timestamp'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.mark_structured_participant_messages_read_v1(
    'eb000000-0000-4000-8000-000000000001'::uuid
  ) $$,
  '42501',
  'conversation participant required',
  'a nonparticipant cannot change another conversation read state'
);

reset role;
select * from finish();
rollback;
