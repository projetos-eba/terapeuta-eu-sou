begin;

select plan(33);

create temporary table a3_test_baseline as
select version
from public.therapist_schedule_settings
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

grant select on a3_test_baseline to service_role;

select has_table(
  'public',
  'therapist_schedule_settings',
  'A3 has canonical therapist schedule settings'
);

select has_table(
  'public',
  'therapist_schedule_events',
  'A3 has a sanitized schedule audit trail'
);

select ok(
  to_regprocedure('public.get_therapist_schedule_v1()') is not null,
  'the versioned schedule read model exists'
);

select ok(
  to_regprocedure(
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)'
  ) is not null,
  'the versioned atomic schedule command exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_schedule_v1()',
    'EXECUTE'
  ),
  'authenticated therapists can execute the schedule read model'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the schedule command directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  'trusted Edge Functions can execute the schedule command'
);

select ok(
  pg_get_functiondef(
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'the command serializes writes per therapist with an advisory lock'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_schedule_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'Ana schedule identity is derived from auth.uid()'
);

select is(
  public.get_therapist_schedule_v1() ->> 'contractVersion',
  '1',
  'the schedule read model publishes contract version 1'
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_settings
  ),
  1,
  'Ana reads exactly one schedule settings row through RLS'
);

select ok(
  not exists (
    select 1
    from public.therapist_schedule_settings
    where therapist_profile_id <> 'c1000000-0000-4000-8000-000000000001'
  ),
  'Ana cannot read another therapist schedule settings'
);

select ok(
  jsonb_array_length(public.get_therapist_schedule_v1() -> 'rules') > 0,
  'Ana reads her schedule rules'
);

select ok(
  jsonb_array_length(public.get_therapist_schedule_v1() -> 'services') > 0,
  'Ana reads her service scheduling settings'
);

select ok(
  not (
    public.get_therapist_schedule_v1()
    ?| array['actorUserId', 'events', 'requestId']
  ),
  'the read model excludes audit actors and idempotency identifiers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_schedule_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000002',
  'Rafael receives his own schedule read model'
);

select is(
  (
    select therapist_profile_id::text
    from public.therapist_schedule_settings
  ),
  'c1000000-0000-4000-8000-000000000002',
  'Rafael direct RLS reads resolve only to his settings'
);

select ok(
  not exists (
    select 1
    from public.therapist_schedule_settings
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'Rafael cannot read Ana schedule settings'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_schedule_v1()',
  '42501',
  'therapist_access_required',
  'a patient cannot invoke the therapist schedule read model'
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_settings
  ),
  0,
  'a patient cannot read therapist schedule settings directly'
);

reset role;
set local role service_role;

select is(
  (
    public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version from a3_test_baseline),
      'America/Sao_Paulo',
      jsonb_build_array(
        jsonb_build_object(
          'id', null,
          'serviceId', 'd1000000-0000-4000-8000-000000000001',
          'dayOfWeek', 1,
          'startTime', '08:00',
          'endTime', '12:00',
          'isActive', true
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'serviceId', 'd1000000-0000-4000-8000-000000000001',
          'bufferBeforeMinutes', 10,
          'bufferAfterMinutes', 15,
          'minimumNoticeMinutes', 180,
          'bookingHorizonDays', 45,
          'slotStepMinutes', 45
        )
      ),
      'a3000000-0000-4000-8000-000000000001'
    ) ->> 'idempotentReplay'
  ),
  'false',
  'the first schedule command applies the change'
);

select is(
  (
    select version
    from public.therapist_schedule_settings
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  (select version + 1 from a3_test_baseline),
  'a successful command increments the optimistic version once'
);

select is(
  (
    select interval_minutes
    from public.therapist_service_booking_settings
    where service_id = 'd1000000-0000-4000-8000-000000000001'
  ),
  45,
  'the command updates the canonical service slot step'
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_events
    where request_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  1,
  'the command records exactly one sanitized audit event'
);

select is(
  (
    public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version from a3_test_baseline),
      'America/Sao_Paulo',
      '[]'::jsonb,
      '[]'::jsonb,
      'a3000000-0000-4000-8000-000000000001'
    ) ->> 'idempotentReplay'
  ),
  'true',
  'repeating a request ID returns an idempotent replay'
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_events
    where request_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  1,
  'an idempotent replay does not duplicate audit events'
);

select throws_ok(
  $$
    select public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version from a3_test_baseline),
      'America/Sao_Paulo',
      '[]'::jsonb,
      '[]'::jsonb,
      'a3000000-0000-4000-8000-000000000002'
    )
  $$,
  '40001',
  'schedule_version_conflict',
  'a stale version is rejected instead of overwriting a newer schedule'
);

select throws_ok(
  $$
    select public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version + 1 from a3_test_baseline),
      'America/Sao_Paulo',
      jsonb_build_array(
        jsonb_build_object(
          'id', null,
          'serviceId', null,
          'dayOfWeek', 2,
          'startTime', '09:00',
          'endTime', '12:00',
          'isActive', true
        ),
        jsonb_build_object(
          'id', null,
          'serviceId', 'd1000000-0000-4000-8000-000000000001',
          'dayOfWeek', 2,
          'startTime', '10:00',
          'endTime', '11:00',
          'isActive', true
        )
      ),
      '[]'::jsonb,
      'a3000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'schedule_service_forbidden',
  'retired general availability rules are rejected'
);

select throws_ok(
  $$
    select public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version + 1 from a3_test_baseline),
      'America/Sao_Paulo',
      jsonb_build_array(
        jsonb_build_object(
          'id', null,
          'serviceId', 'd1000000-0000-4000-8000-000000000002',
          'dayOfWeek', 2,
          'startTime', '09:00',
          'endTime', '10:00',
          'isActive', true
        )
      ),
      '[]'::jsonb,
      'a3000000-0000-4000-8000-000000000004'
    )
  $$,
  '42501',
  'schedule_service_forbidden',
  'Ana cannot configure a service owned by Rafael'
);

select throws_ok(
  $$
    select public.save_therapist_schedule_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select version + 1 from a3_test_baseline),
      'Invalid/Timezone',
      '[]'::jsonb,
      '[]'::jsonb,
      'a3000000-0000-4000-8000-000000000005'
    )
  $$,
  '22023',
  'invalid_schedule_timezone',
  'the command rejects an invalid IANA timezone'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_events
    where request_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  1,
  'Ana reads her own sanitized schedule event through RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.therapist_schedule_events
    where request_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  0,
  'Rafael cannot read Ana schedule events'
);

reset role;
update public.therapist_profiles
set status = 'suspended'
where id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_schedule_v1()',
  '42501',
  'therapist_access_blocked',
  'a suspended therapist cannot read schedule configuration'
);

select * from finish();

rollback;
