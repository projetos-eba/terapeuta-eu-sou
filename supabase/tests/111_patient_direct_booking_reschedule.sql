begin;

select plan(22);

create temporary table patient_direct_slots as
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
set starts_at = (select starts_at from patient_direct_slots offset 0 limit 1),
    ends_at = (select ends_at from patient_direct_slots offset 0 limit 1),
    timezone = (select timezone from patient_direct_slots offset 0 limit 1),
    updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000001';

create temporary table patient_direct_original as
select starts_at, ends_at, timezone, version
from public.bookings
where id = 'f2000000-0000-4000-8000-000000000001';

select is(
  has_function_privilege(
    'authenticated',
    'public.apply_patient_booking_reschedule_v1(uuid,uuid,timestamptz,timestamptz,text,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke direct patient rescheduling'
);

select is(
  has_function_privilege(
    'service_role',
    'public.apply_patient_booking_reschedule_v1(uuid,uuid,timestamptz,timestamptz,text,text,text,integer)',
    'EXECUTE'
  ),
  true,
  'service_role can invoke direct patient rescheduling'
);

select ok(
  position(
    'tes:patient-reschedule-request:' in pg_get_functiondef(
      'public.apply_patient_booking_reschedule_v1(uuid,uuid,timestamptz,timestamptz,text,text,text,integer)'::regprocedure
    )
  ) > 0,
  'the patient command serializes concurrent retries of the same request id'
);

select is(
  public.apply_patient_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 1 limit 1),
    (select ends_at from patient_direct_slots offset 1 limit 1),
    (select timezone from patient_direct_slots offset 1 limit 1),
    'Ajuste solicitado pela pessoa.',
    'patient-direct-reschedule-0001',
    (select version from patient_direct_original)
  ) ->> 'status',
  'applied',
  'a patient request is immediately applied after authoritative validation'
);

select is(
  (select starts_at from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select starts_at from patient_direct_slots offset 1 limit 1),
  'the same booking claims the patient-selected interval'
);

select is(
  (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select version + 1 from patient_direct_original),
  'the atomic reschedule advances the booking version once'
);

select is(
  (select status from public.booking_reschedule_requests where request_id = 'patient-direct-reschedule-0001'),
  'applied',
  'the audit record is terminal and never waits for acceptance'
);

select is(
  (
    select count(*)::integer
    from public.booking_reschedule_requests
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
      and status = 'pending'
  ),
  0,
  'patient direct rescheduling does not leave a pending proposal'
);

select is(
  (
    select count(*)::integer
    from public.booking_events
    where request_id = 'patient-direct-reschedule-0001'
      and event_type = 'booking_reschedule_requested'
  ),
  0,
  'patient direct rescheduling does not emit a proposal-created event'
);

select is(
  (
    select count(*)::integer
    from public.booking_events
    where request_id = 'patient-direct-reschedule-0001'
      and event_type = 'booking_reschedule_resolved'
      and payload ->> 'status' = 'applied'
  ),
  1,
  'patient direct rescheduling emits one final applied event'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where event_key in (
      'booking-event:' || (
        select id::text from public.booking_events
        where request_id = 'patient-direct-reschedule-0001'
          and event_type = 'booking_reschedule_resolved'
      ) || ':patient',
      'booking-event:' || (
        select id::text from public.booking_events
        where request_id = 'patient-direct-reschedule-0001'
          and event_type = 'booking_reschedule_resolved'
      ) || ':therapist'
    )
  ),
  2,
  'the final reschedule notifies both participants in app'
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'f2000000-0000-4000-8000-000000000001'
      and action_key in ('booking_rescheduled_patient', 'booking_rescheduled_therapist')
  ),
  2,
  'the final reschedule enqueues email for both participants'
);

select ok(
  exists (
    select 1
    from public.video_sessions as video
    join public.bookings as booking on booking.id = video.booking_id
    where booking.id = 'f2000000-0000-4000-8000-000000000001'
      and video.scheduled_starts_at = booking.starts_at
      and video.scheduled_ends_at = booking.ends_at
  ),
  'the existing video session remains linked and follows the new interval'
);

select ok(
  exists (
    select 1
    from public.booking_reminder_jobs
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
      and booking_version = (
        select version from public.bookings
        where id = 'f2000000-0000-4000-8000-000000000001'
      )
      and status = 'scheduled'
  ),
  'reminders are scheduled against the new booking version'
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
    where slot."startsAt" = (select starts_at from patient_direct_original)
  ),
  'the original interval reappears only after commit when current rules allow it'
);

select is(
  public.apply_patient_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 1 limit 1),
    (select ends_at from patient_direct_slots offset 1 limit 1),
    (select timezone from patient_direct_slots offset 1 limit 1),
    'Ajuste solicitado pela pessoa.',
    'patient-direct-reschedule-0001',
    (select version from patient_direct_original)
  ) ->> 'status',
  'applied',
  'an identical idempotent replay returns the completed result'
);

select is(
  (
    select count(*)::integer from public.booking_events
    where request_id = 'patient-direct-reschedule-0001'
      and event_type = 'booking_reschedule_resolved'
  ),
  1,
  'an idempotent replay does not duplicate lifecycle events'
);

select throws_ok(
  $$ select public.apply_patient_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 2 limit 1),
    (select ends_at from patient_direct_slots offset 2 limit 1),
    (select timezone from patient_direct_slots offset 2 limit 1),
    null,
    'patient-direct-reschedule-0001',
    null
  ) $$,
  '22023',
  'IDEMPOTENCY_KEY_REUSED',
  'a divergent replay cannot reuse the completed command id'
);

select throws_ok(
  $$ select public.apply_patient_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 2 limit 1),
    (select ends_at from patient_direct_slots offset 2 limit 1),
    (select timezone from patient_direct_slots offset 2 limit 1),
    null,
    'patient-direct-reschedule-therapist-forbidden',
    null
  ) $$,
  '42501',
  'BOOKING_ACTOR_NOT_PATIENT',
  'a therapist cannot use the patient direct-apply command'
);

select throws_ok(
  $$ select public.request_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 2 limit 1),
    (select ends_at from patient_direct_slots offset 2 limit 1),
    (select timezone from patient_direct_slots offset 2 limit 1),
    null,
    'patient-proposal-forbidden-0001',
    172800,
    (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
  ) $$,
  '42501',
  'BOOKING_PROPOSAL_REQUIRES_THERAPIST',
  'a patient cannot create a pending proposal through the legacy command'
);

select is(
  (
    public.request_booking_reschedule_v1(
      'f2000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      (select starts_at from patient_direct_slots offset 2 limit 1),
      (select ends_at from patient_direct_slots offset 2 limit 1),
      (select timezone from patient_direct_slots offset 2 limit 1),
      null,
      'therapist-proposal-after-direct-0001',
      172800,
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    )
  ).status,
  'pending',
  'therapist-initiated rescheduling still creates a proposal'
);

select throws_ok(
  $$ select public.apply_patient_booking_reschedule_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select starts_at from patient_direct_slots offset 3 limit 1),
    (select ends_at from patient_direct_slots offset 3 limit 1),
    (select timezone from patient_direct_slots offset 3 limit 1),
    null,
    'patient-direct-while-proposal-pending',
    (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
  ) $$,
  'P0001',
  'BOOKING_RESCHEDULE_ALREADY_PENDING',
  'a pending therapist proposal must be resolved before another direct change'
);

select * from finish();
rollback;
