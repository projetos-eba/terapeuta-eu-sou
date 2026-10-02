begin;

select plan(7);

select has_function(
  'public',
  'get_therapist_agenda_v2',
  array['timestamp with time zone', 'timestamp with time zone'],
  'the agenda V2 read model exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_agenda_v2(timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'authenticated therapists can read agenda V2'
);

set local role service_role;

create temporary table agenda_v2_exception_fixture as
with created as (
  select public.create_therapist_block_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000157',
    'America/Sao_Paulo',
    current_date + 120,
    null,
    null,
    true,
    'none',
    current_date + 120,
    null,
    'personal',
    'Agenda V2 stale exception test'
  ) as result
)
select
  exception.id,
  (created.result ->> 'scheduleVersion')::bigint as schedule_version,
  exception.starts_at,
  exception.ends_at
from created
join public.availability_exceptions as exception
  on exception.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
 and exception.reason = 'Agenda V2 stale exception test';

grant select on agenda_v2_exception_fixture to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_agenda_v2(
    (select starts_at - interval '1 hour' from agenda_v2_exception_fixture),
    (select ends_at + interval '1 hour' from agenda_v2_exception_fixture)
  ) ->> 'contractVersion',
  '2',
  'agenda V2 identifies its additive contract'
);

select is(
  public.get_therapist_agenda_v2(
    (select starts_at - interval '1 hour' from agenda_v2_exception_fixture),
    (select ends_at + interval '1 hour' from agenda_v2_exception_fixture)
  ) ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'agenda V2 still derives the therapist from auth.uid()'
);

select is(
  (
    select item ->> 'status'
    from jsonb_array_elements(
      public.get_therapist_agenda_v2(
        (select starts_at - interval '1 hour' from agenda_v2_exception_fixture),
        (select ends_at + interval '1 hour' from agenda_v2_exception_fixture)
      ) #> '{availability,exceptions}'
    ) as item
    where item ->> 'id' = (select id::text from agenda_v2_exception_fixture)
  ),
  'active',
  'agenda V2 exposes an active exception as active'
);

reset role;
set local role service_role;

select public.cancel_therapist_block_v1(
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000158',
  (select id from agenda_v2_exception_fixture),
  'occurrence',
  (select schedule_version from agenda_v2_exception_fixture)
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_agenda_v2(
        (select starts_at - interval '1 hour' from agenda_v2_exception_fixture),
        (select ends_at + interval '1 hour' from agenda_v2_exception_fixture)
      ) #> '{availability,exceptions}'
    ) as item
    where item ->> 'id' = (select id::text from agenda_v2_exception_fixture)
  ),
  'a cancelled exception is omitted from the current agenda'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_agenda_v1(
        (select starts_at - interval '1 hour' from agenda_v2_exception_fixture),
        (select ends_at + interval '1 hour' from agenda_v2_exception_fixture)
      ) #> '{availability,exceptions}'
    ) as item
    where item ->> 'id' = (select id::text from agenda_v2_exception_fixture)
  ),
  'agenda V1 remains unchanged for existing consumers'
);

select * from finish();

rollback;
