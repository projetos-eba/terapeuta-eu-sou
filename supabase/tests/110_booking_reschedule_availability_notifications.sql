begin;

select plan(26);

create temporary table reschedule_slots as
with payload as (
  select public.get_booking_reschedule_availability_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    'next',
    null,
    20
  ) as value
)
select
  slot."startsAt" as starts_at,
  slot."endsAt" as ends_at,
  payload.value ->> 'timezone' as timezone
from payload
cross join lateral jsonb_to_recordset(payload.value -> 'slots')
  as slot("startsAt" timestamptz, "endsAt" timestamptz)
limit 4;

update public.bookings
set starts_at = (select starts_at from reschedule_slots offset 0 limit 1),
    ends_at = (select ends_at from reschedule_slots offset 0 limit 1),
    timezone = (select timezone from reschedule_slots offset 0 limit 1),
    updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000001';

select is(
  has_function_privilege(
    'authenticated',
    'public.get_booking_reschedule_availability_v1(uuid,uuid,text,date,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke booking availability directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.get_booking_reschedule_availability_v1(uuid,uuid,text,date,integer)',
    'EXECUTE'
  ),
  true,
  'service_role can invoke booking availability'
);

select ok(
  position(
    'patient_blockers as materialized' in lower(
      pg_get_functiondef(
        'public.get_booking_reschedule_availability_v1(uuid,uuid,text,date,integer)'::regprocedure
      )
    )
  ) > 0
  and position(
    'patient_has_schedule_conflict_v1' in lower(
      pg_get_functiondef(
        'public.get_booking_reschedule_availability_v1(uuid,uuid,text,date,integer)'::regprocedure
      )
    )
  ) = 0,
  'booking availability materializes patient blockers instead of evaluating one conflict RPC per candidate'
);

select ok(
  (select count(*) > 0 from reschedule_slots),
  'booking-scoped availability returns current schedule candidates'
);

select is(
  (
    public.get_booking_reschedule_availability_v1(
      'f2000000-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000001',
      'next', null, 20
    ) #>> '{service,id}'
  )::uuid,
  (select service_id from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  'availability fixes the original booking service'
);

select is(
  (
    public.get_booking_reschedule_availability_v1(
      'f2000000-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000001',
      'next', null, 20
    ) #>> '{service,durationMinutes}'
  )::integer,
  (select service_duration_minutes_snapshot from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  'availability exposes the immutable duration snapshot'
);

select throws_ok(
  $$ select public.get_booking_reschedule_availability_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000005',
    'next', null, 20
  ) $$,
  '42501',
  'BOOKING_ACTOR_FORBIDDEN',
  'non-participants cannot inspect booking availability'
);

select is(
  (
    public.request_booking_reschedule_v1(
      'f2000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select starts_at from reschedule_slots offset 1 limit 1),
      (select ends_at from reschedule_slots offset 1 limit 1),
      (select timezone from reschedule_slots offset 1 limit 1),
      'Teste de proposta.',
      'reschedule-security-request-0001',
      172800,
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    )
  ).status,
  'pending',
  'a current authoritative candidate creates a pending proposal'
);

select is(
  (select starts_at from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select original_starts_at from public.booking_reschedule_requests where request_id = 'reschedule-security-request-0001'),
  'the original slot remains claimed while the proposal is pending'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where kind = 'booking_reschedule_requested_patient'
      and event_key like 'booking-event:%:patient'
  ),
  1,
  'proposal creation notifies only the counterparty in app'
);

select is(
  (
    select count(*)::integer from public.email_outbox
    where action_key = 'booking_reschedule_requested_patient'
      and related_entity_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  1,
  'proposal creation enqueues one counterpart email'
);

select is(
  (
    public.resolve_booking_reschedule_v1(
      (select id from public.booking_reschedule_requests where request_id = 'reschedule-security-request-0001'),
      'bbbbbbbb-0000-4000-8000-000000000001',
      'rejected',
      'reschedule-security-reject-0001',
      null
    ) ->> 'status'
  ),
  'rejected',
  'the counterparty can reject a proposal'
);

select is(
  (select starts_at from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select original_starts_at from public.booking_reschedule_requests where request_id = 'reschedule-security-request-0001'),
  'rejection preserves the original slot'
);

select is(
  (
    select count(*)::integer from public.notifications
    where kind = 'booking_reschedule_rejected_therapist'
  ),
  1,
  'rejection notifies the requester'
);

select lives_ok(
  $$ select public.request_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select starts_at from reschedule_slots offset 2 limit 1),
    (select ends_at from reschedule_slots offset 2 limit 1),
    (select timezone from reschedule_slots offset 2 limit 1),
    null,
    'reschedule-security-request-0002',
    172800,
    (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
  ) $$,
  'a new proposal can be created after rejection'
);

update public.booking_reschedule_requests
set expires_at = now() - interval '1 second'
where request_id = 'reschedule-security-request-0002';

select is(
  public.expire_booking_reschedule_requests_v1(now()),
  1,
  'expiration closes exactly one pending proposal'
);

select is(
  (
    select count(*)::integer from public.booking_events
    where request_id = 'reschedule-expired:' || (
      select id::text from public.booking_reschedule_requests
      where request_id = 'reschedule-security-request-0002'
    )
  ),
  1,
  'expiration emits one deterministic booking event'
);

select is(
  (
    select count(*)::integer from public.notifications
    where kind in (
      'booking_reschedule_expired_patient',
      'booking_reschedule_expired_therapist'
    )
  ),
  2,
  'expiration notifies both participants exactly once'
);

select is(
  (
    select count(*)::integer from public.email_outbox
    where action_key in (
      'booking_reschedule_expired_patient',
      'booking_reschedule_expired_therapist'
    )
      and related_entity_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  2,
  'expiration enqueues email for both participants'
);

select lives_ok(
  $$ select public.request_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select starts_at from reschedule_slots offset 3 limit 1),
    (select ends_at from reschedule_slots offset 3 limit 1),
    (select timezone from reschedule_slots offset 3 limit 1),
    null,
    'reschedule-security-request-0003',
    172800,
    (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
  ) $$,
  'a proposal can be created after an earlier proposal expires'
);

select is(
  (
    public.resolve_booking_reschedule_v1(
      (select id from public.booking_reschedule_requests where request_id = 'reschedule-security-request-0003'),
      'bbbbbbbb-0000-4000-8000-000000000001',
      'accepted',
      'reschedule-security-accept-0001',
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    ) ->> 'status'
  ),
  'applied',
  'acceptance atomically applies an available proposed slot'
);

select is(
  (select starts_at from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select starts_at from reschedule_slots offset 3 limit 1),
  'the same booking now claims the proposed interval'
);

select ok(
  not (
    select occupied_during && tstzrange(original_starts_at, original_ends_at, '[)')
    from public.bookings
    cross join public.booking_reschedule_requests
    where bookings.id = 'f2000000-0000-4000-8000-000000000001'
      and booking_reschedule_requests.request_id = 'reschedule-security-request-0003'
  ),
  'the accepted booking no longer claims its original interval'
);

select ok(
  exists (
    select 1
    from jsonb_to_recordset(
      public.get_booking_reschedule_availability_v1(
        'f2000000-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000001',
        'next', null, 100
      ) -> 'slots'
    ) as slot("startsAt" timestamptz, "endsAt" timestamptz)
    where slot."startsAt" = (select starts_at from reschedule_slots offset 0 limit 1)
  ),
  'the original slot reappears after acceptance when current rules still allow it'
);

select is(
  (
    select count(*)::integer from public.notifications
    where kind in ('booking_rescheduled_patient', 'booking_rescheduled_therapist')
  ),
  2,
  'an applied reschedule notifies both participants'
);

select is(
  (
    select count(*)::integer from public.email_outbox
    where action_key in ('booking_rescheduled_patient', 'booking_rescheduled_therapist')
      and related_entity_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  2,
  'an applied reschedule enqueues final email for both participants'
);

select * from finish();
rollback;
