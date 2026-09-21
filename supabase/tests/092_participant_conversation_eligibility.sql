begin;

select plan(8);

select has_function(
  'public',
  'upsert_participant_conversation_for_booking_v1',
  array['uuid'],
  'eligible booking conversation upsert exists'
);
select hasnt_trigger(
  'public',
  'bookings',
  'ensure_participant_conversation_after_booking',
  'booking confirmation no longer creates participant conversations'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_participant_conversation_for_booking_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'participants cannot invoke relationship maintenance directly'
);
select lives_ok(
  $$ select public.upsert_participant_conversation_for_booking_v1(
    'f2000000-0000-4000-8000-000000000003'::uuid
  ) $$,
  'a completed booking keeps an eligible participant conversation'
);
select is(
  (
    select count(*)
    from public.conversations
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000003'::uuid
      and therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'::uuid
  ),
  1::bigint,
  'one patient and therapist share exactly one conversation across bookings'
);
select is(
  (
    select booking_id
    from public.conversations
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000003'::uuid
      and therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'::uuid
  ),
  'f2000000-0000-4000-8000-000000000003'::uuid,
  'the conversation retains an authorized session context'
);
select lives_ok(
  $$
    update public.bookings
    set status = 'confirmed'::public.booking_status
    where id = 'f2000000-0000-4000-8000-000000000005'::uuid
  $$,
  'a booking can become confirmed without opening a messaging channel'
);
select is(
  (
    select count(*)
    from public.conversations
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000005'::uuid
      and therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'::uuid
  ),
  0::bigint,
  'confirmation does not create a new participant conversation'
);

select * from finish();
rollback;
