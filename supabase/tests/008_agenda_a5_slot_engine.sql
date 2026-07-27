begin;

select plan(28);

select has_column(
  'public',
  'therapies',
  'calendar_color_key',
  'therapy calendar colors have a canonical catalog field'
);

select col_has_check(
  'public',
  'therapies',
  'calendar_color_key',
  'therapy calendar colors are constrained to the semantic palette'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_service_available_slots_v1(uuid,timestamptz,timestamptz,integer)',
    'EXECUTE'
  ),
  'anonymous visitors can read the safe public slot endpoint'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.list_service_schedule_candidates_v1(uuid,timestamptz,timestamptz,timestamptz,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the internal candidate function'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_calendar_v1(date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private calendar read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_calendar_v1(date,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the therapist calendar'
);

select is(
  (
    select calendar_color_key
    from public.therapies
    where slug = 'reiki'
  ),
  'purple',
  'Reiki uses the stable purple palette key'
);

select is(
  (
    select calendar_color_key
    from public.therapies
    where slug = 'aromaterapia'
  ),
  'green',
  'Aromatherapy uses the stable green palette key'
);

create temporary table a5_slot_fixture
on commit drop
as
select
  (slot.value ->> 'startsAt')::timestamptz as starts_at,
  (slot.value ->> 'endsAt')::timestamptz as ends_at
from jsonb_array_elements(
  public.get_service_available_slots_v1(
    'd1000000-0000-4000-8000-000000000001',
    now(),
    now() + interval '30 days',
    200
  ) -> 'slots'
) as slot(value)
order by slot.value ->> 'startsAt'
limit 1;

select is(
  public.get_service_available_slots_v1(
    'd1000000-0000-4000-8000-000000000001',
    now(),
    now() + interval '30 days',
    200
  ) ->> 'contractVersion',
  '1',
  'the public slot endpoint is versioned'
);

select ok(
  exists (select 1 from a5_slot_fixture),
  'the seeded Reiki schedule produces an authoritative available slot'
);

select ok(
  not (
    public.get_service_available_slots_v1(
      'd1000000-0000-4000-8000-000000000001',
      now(),
      now() + interval '30 days',
      200
    )::text ~* '(patient|bookingId|holdId|reason)'
  ),
  'the public slot payload does not expose participant or occupancy details'
);

select is(
  (
    select extract(epoch from (ends_at - starts_at))::integer / 60
    from a5_slot_fixture
  ),
  50,
  'slot duration comes from the canonical service'
);

select ok(
  not exists (
    select 1
    from a5_slot_fixture as slot
    join public.availability_exceptions as exception
      on exception.therapist_profile_id =
        'c1000000-0000-4000-8000-000000000001'
      and exception.status = 'active'
      and not exception.is_available
      and tstzrange(exception.starts_at, exception.ends_at, '[)')
        && tstzrange(
          slot.starts_at - interval '10 minutes',
          slot.ends_at + interval '10 minutes',
          '[)'
        )
  ),
  'active unavailable exceptions are subtracted from slots'
);

select ok(
  not exists (
    select 1
    from a5_slot_fixture as slot
    join public.bookings as booking
      on booking.therapist_profile_id =
        'c1000000-0000-4000-8000-000000000001'
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during
        && tstzrange(
          slot.starts_at - interval '10 minutes',
          slot.ends_at + interval '10 minutes',
          '[)'
        )
  ),
  'blocking bookings are subtracted from slots'
);

select ok(
  not exists (
    select 1
    from a5_slot_fixture as slot
    join public.booking_holds as hold
      on hold.therapist_profile_id =
        'c1000000-0000-4000-8000-000000000001'
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during
        && tstzrange(
          slot.starts_at - interval '10 minutes',
          slot.ends_at + interval '10 minutes',
          '[)'
        )
  ),
  'active holds are subtracted from slots'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      (
        (
          (now() at time zone 'America/Sao_Paulo')::date
          + (
            (
              7 - extract(
                dow from (now() at time zone 'America/Sao_Paulo')::date
              )::integer
            ) % 7
          )
          + 7
        ) + time '09:00'
      ) at time zone 'America/Sao_Paulo',
      (
        (
          (now() at time zone 'America/Sao_Paulo')::date
          + (
            (
              7 - extract(
                dow from (now() at time zone 'America/Sao_Paulo')::date
              )::integer
            ) % 7
          )
          + 7
        ) + time '09:50'
      ) at time zone 'America/Sao_Paulo',
      'America/Sao_Paulo',
      'a5-unscheduled-hold-0001',
      600
    )
  $$,
  'P0001',
  'SLOT_NOT_AVAILABLE',
  'the hold command rejects a time outside the authoritative schedule'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at from a5_slot_fixture),
      (select ends_at from a5_slot_fixture),
      'America/Sao_Paulo',
      'a5-valid-hold-0001',
      600
    )
  ).status::text,
  'active',
  'an authoritative slot can be held'
);

select is(
  jsonb_array_length(
    public.get_service_available_slots_v1(
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at - interval '1 minute' from a5_slot_fixture),
      (select ends_at + interval '1 minute' from a5_slot_fixture),
      10
    ) -> 'slots'
  ),
  0,
  'a live hold removes the slot from subsequent reads'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at from a5_slot_fixture),
      (select ends_at from a5_slot_fixture),
      'America/Sao_Paulo',
      'a5-valid-hold-0001',
      600
    )
  ).id,
  (
    select id
    from public.booking_holds
    where idempotency_key = 'a5-valid-hold-0001'
  ),
  'replaying the hold keeps the original idempotent result'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at from a5_slot_fixture),
      (select ends_at from a5_slot_fixture),
      'America/Sao_Paulo',
      'a5-conflicting-hold-0001',
      600
    )
  $$,
  'P0001',
  'SLOT_HELD_BY_ANOTHER_USER',
  'concurrent hold conflicts retain the A2 domain error'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_calendar_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'calendar identity is derived from Ana auth.uid()'
);

select is(
  public.get_therapist_calendar_v1() ->> 'contractVersion',
  '1',
  'the therapist calendar contract is versioned'
);

select ok(
  jsonb_path_exists(
    public.get_therapist_calendar_v1(),
    '$.services[*] ? (@.colorKey == "purple")'
  ),
  'the calendar publishes canonical therapy colors'
);

select is(
  public.get_therapist_calendar_v1() #>> '{range,endExclusive}',
  'true',
  'calendar periods use a semi-open boundary'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_calendar_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000002',
  'Rafael receives only his own calendar identity'
);

select ok(
  not jsonb_path_exists(
    public.get_therapist_calendar_v1(),
    '$.bookings[*] ? (@.bookingId == "f2000000-0000-4000-8000-000000000004")'
  ),
  'Rafael cannot read an Ana booking through the calendar'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_calendar_v1()',
  '42501',
  'therapist_access_required',
  'a patient cannot invoke the therapist calendar'
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
  'select public.get_therapist_calendar_v1()',
  '42501',
  'therapist_access_blocked',
  'a suspended therapist cannot invoke the calendar'
);

select * from finish();

rollback;
