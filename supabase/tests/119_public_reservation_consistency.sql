begin;

select plan(13);

select ok(
  to_regprocedure('public.is_therapist_receiving_account_ready_v1(uuid)') is not null,
  'receiving account readiness predicate exists'
);

select ok(
  public.is_therapist_receiving_account_ready_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  'the explicit local receiving account fixture is ready'
);

select is(
  (select count(*) from public.therapist_services as service
   where service.archived_at is null
     -- The preserved local database also contains manual browser fixtures.
     -- Audit all canonical seed services, not unrelated manually inserted data.
     and service.id::text like 'd1000000-%'
     and not exists (
       select 1 from public.therapist_service_booking_settings as setting
       where setting.service_id = service.id
     )),
  0::bigint,
  'every canonical seed service has booking settings'
);

select is(
  (select buffer_before_minutes
   from public.public_therapist_profile_services_v_internal
   where service_id = 'd1000000-0000-4000-8000-000000000001'),
  0,
  'the public service projection has no hidden pre-session buffer'
);

select is(
  (select max_days_ahead
   from public.public_therapist_profile_services_v_internal
   where service_id = 'd1000000-0000-4000-8000-000000000001'),
  90,
  'the public service projection uses the canonical ninety-day horizon'
);

create temporary table reservation_count_before on commit drop as
select count(*)::bigint as value
from public.bookings
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_connect_accounts
set pending_requirements = '{"currentlyDue":["individual.verification.document"]}'::jsonb,
    operational_status = 'restricted'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and is_current;

select isnt(
  public.is_therapist_receiving_account_ready_v1(
    'c1000000-0000-4000-8000-000000000001'
  ),
  true,
  'current requirements fail the receiving account gate closed'
);

select ok(
  (public.get_therapist_publication_eligibility_v1(
    'c1000000-0000-4000-8000-000000000001'
  )->'blockers') ? 'receiving_account_not_ready',
  'publication reports the receiving account blocker'
);

select is(
  (select count(*) from public.public_therapist_profiles_v
   where id = 'c1000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a profile that loses readiness disappears from the public profile view'
);

select is(
  (select count(*) from public.public_therapist_profile_services_v
   where service_id = 'd1000000-0000-4000-8000-000000000001'),
  0::bigint,
  'services disappear from public reservation surfaces when readiness is lost'
);

select is(
  public.get_service_available_slots_v1(
    'd1000000-0000-4000-8000-000000000001',
    now() + interval '1 day',
    now() + interval '8 days',
    20
  ),
  null::jsonb,
  'the authoritative slot offer fails closed when receiving is unavailable'
);

select throws_ok(
  $$select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      now() + interval '2 days',
      now() + interval '2 days 50 minutes',
      'America/Sao_Paulo',
      'receiving-account-not-ready-test',
      300
    )$$,
  'P0001',
  'SLOT_NOT_AVAILABLE',
  'the transactional hold rejects a service whose receiving account is unavailable'
);

select is(
  (select count(*) from public.bookings
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  (select value from reservation_count_before),
  'losing receiving readiness does not cancel existing bookings'
);

update public.therapist_profiles
set public_status = 'unpublished', is_public = false, is_accepting_bookings = false
where id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.admin_execute_operation_command_v2(
      'professional.publish',
      'c1000000-0000-4000-8000-000000000001',
      'Tentativa sem conta de recebimento pronta.',
      'publication-without-receiving-account'
    )$$,
  '22023',
  'profile does not meet the publication criteria',
  'admin publication is blocked until the receiving account is ready'
);

select * from finish();
rollback;
