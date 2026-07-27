begin;

select plan(43);

create temporary table a2_available_slots (
  service_id uuid primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null
) on commit drop;

insert into a2_available_slots (service_id, starts_at, ends_at)
select
  service.id,
  slot.starts_at,
  slot.ends_at
from (
  values
    ('d1000000-0000-4000-8000-000000000001'::uuid),
    ('d1000000-0000-4000-8000-000000000002'::uuid),
    ('d1000000-0000-4000-8000-000000000006'::uuid)
) as service(id)
join public.therapist_services as therapist_service
  on therapist_service.id = service.id
cross join lateral (
  select candidate.starts_at, candidate.ends_at
  from public.list_service_schedule_candidates_v1(
    service.id,
    now(),
    now() + interval '30 days',
    now(),
    100
  ) as candidate
  where not exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id =
      therapist_service.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && candidate.occupied_during
  )
  order by candidate.starts_at
  limit 1
) as slot;

select is(
  (
    select count(*)::integer
    from public.bookings
    where service_title_snapshot is null
      or service_duration_minutes_snapshot is null
      or service_price_cents_snapshot is null
      or currency_snapshot is null
      or occupied_during is null
  ),
  0,
  'all seeded bookings have complete A2 snapshots'
);

select is(
  (
    select count(*)::integer
    from public.bookings as left_booking
    join public.bookings as right_booking
      on right_booking.therapist_profile_id = left_booking.therapist_profile_id
      and right_booking.id > left_booking.id
      and right_booking.status in ('draft', 'pending_payment', 'confirmed')
      and right_booking.occupied_during && left_booking.occupied_during
    where left_booking.status in ('draft', 'pending_payment', 'confirmed')
  ),
  0,
  'the seed contains no active therapist booking conflicts'
);

select ok(
  public.is_booking_status_transition_allowed_v1(
    'confirmed',
    'completed'
  ),
  'the database accepts a canonical booking transition'
);

select ok(
  not public.is_booking_status_transition_allowed_v1(
    'completed',
    'confirmed'
  ),
  'the database rejects a backward booking transition'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.reserve_booking_hold_v1(uuid,uuid,timestamptz,timestamptz,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the hold command directly'
);

select is(
  has_table_privilege('authenticated', 'public.booking_holds', 'INSERT'),
  false,
  'authenticated clients cannot insert holds directly'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      (select ends_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      'America/Sao_Paulo',
      'a2-hold-idempotency-0001',
      600
    )
  ).status::text,
  'active',
  'a valid slot receives an active hold'
);

select is(
  (
    select service_price_cents_snapshot
    from public.booking_holds
    where idempotency_key = 'a2-hold-idempotency-0001'
  ),
  17000,
  'the hold captures the current service price'
);

select is(
  (
    select extract(
      epoch from (
        upper(occupied_during) - lower(occupied_during)
      )
    )::integer / 60
    from public.booking_holds
    where idempotency_key = 'a2-hold-idempotency-0001'
  ),
  70,
  'the occupied interval includes both booking buffers'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      (select ends_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      'America/Sao_Paulo',
      'a2-hold-idempotency-0001',
      600
    )
  ).id,
  (
    select id
    from public.booking_holds
    where idempotency_key = 'a2-hold-idempotency-0001'
  ),
  'repeating a hold request returns the original hold'
);

select is(
  (
    select count(*)::integer
    from public.booking_holds
    where idempotency_key = 'a2-hold-idempotency-0001'
  ),
  1,
  'hold idempotency creates exactly one row'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at + interval '20 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      (select ends_at + interval '20 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      'America/Sao_Paulo',
      'a2-hold-conflict-same-service',
      600
    )
  $$,
  'P0001',
  'SLOT_HELD_BY_ANOTHER_USER',
  'an overlapping hold for the same service is rejected'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000006',
      (select starts_at + interval '20 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      (select starts_at + interval '80 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      'America/Sao_Paulo',
      'a2-hold-conflict-other-service',
      600
    )
  $$,
  'P0001',
  'SLOT_HELD_BY_ANOTHER_USER',
  'a therapist conflict is rejected across different services'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000002',
      (select starts_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000002'),
      (select ends_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000002'),
      'America/Sao_Paulo',
      'a2-hold-other-therapist-0001',
      600
    )
  ).status::text,
  'active',
  'different therapists can hold independently valid intervals'
);

select is(
  public.expire_booking_holds_v1(
    now() + interval '20 minutes',
    'c1000000-0000-4000-8000-000000000002'
  ),
  1,
  'expired holds are reclaimed in one command'
);

select is(
  (
    select status::text
    from public.booking_holds
    where idempotency_key = 'a2-hold-other-therapist-0001'
  ),
  'expired',
  'the reclaimed hold has the expired terminal status'
);

select is(
  (
    public.cancel_booking_hold_v1(
      (
        select id
        from public.booking_holds
        where idempotency_key = 'a2-hold-idempotency-0001'
      ),
      'a2-hold-cancel-request-0001'
    )
  ).status::text,
  'cancelled',
  'an active hold can be cancelled'
);

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000006',
      (select starts_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000006'),
      (select ends_at from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000006'),
      'America/Sao_Paulo',
      'a2-hold-consume-0001',
      600
    )
  ).status::text,
  'active',
  'a cancelled hold releases the therapist interval'
);

update public.therapist_services
set title = 'Aromaterapia atualizada',
    price_cents = 19900
where id = 'd1000000-0000-4000-8000-000000000006';

select is(
  (
    public.consume_booking_hold_v1(
      (
        select id
        from public.booking_holds
        where idempotency_key = 'a2-hold-consume-0001'
      ),
      'a2-hold-consume-request-0001'
    )
  ).status::text,
  'draft',
  'consuming a hold creates one draft booking'
);

select is(
  (
    select status::text
    from public.booking_holds
    where idempotency_key = 'a2-hold-consume-0001'
  ),
  'consumed',
  'the source hold becomes consumed'
);

select is(
  (
    select booking.service_title_snapshot
    from public.booking_holds as hold
    join public.bookings as booking
      on booking.id = hold.consumed_booking_id
    where hold.idempotency_key = 'a2-hold-consume-0001'
  ),
  (
    select service_title_snapshot
    from public.booking_holds
    where idempotency_key = 'a2-hold-consume-0001'
  ),
  'hold conversion preserves the service snapshot'
);

select is(
  (
    select booking.service_price_cents_snapshot
    from public.booking_holds as hold
    join public.bookings as booking
      on booking.id = hold.consumed_booking_id
    where hold.idempotency_key = 'a2-hold-consume-0001'
  ),
  24000,
  'service price changes after the hold do not alter the booking snapshot'
);

select throws_ok(
  $$
    update public.bookings
    set service_price_cents_snapshot = 1
    where id = (
      select consumed_booking_id
      from public.booking_holds
      where idempotency_key = 'a2-hold-consume-0001'
    )
  $$,
  '23514',
  'BOOKING_SNAPSHOT_IMMUTABLE',
  'booking snapshots cannot be rewritten after creation'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000001',
      (select starts_at + interval '20 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      (select ends_at + interval '20 minutes' from a2_available_slots where service_id = 'd1000000-0000-4000-8000-000000000001'),
      'America/Sao_Paulo',
      'a2-booking-conflict-other-service',
      600
    )
  $$,
  'P0001',
  'BOOKING_CONFLICT',
  'an active booking blocks every service of the therapist'
);

select is(
  (
    public.transition_booking_status_v1(
      (
        select consumed_booking_id
        from public.booking_holds
        where idempotency_key = 'a2-hold-consume-0001'
      ),
      'cancelled_by_patient',
      'bbbbbbbb-0000-4000-8000-000000000005',
      'Mudanca de disponibilidade.',
      'a2-booking-transition-0001',
      1,
      'agenda_a2'
    )
  ).status::text,
  'cancelled_by_patient',
  'the patient can apply the allowed cancellation transition'
);

select is(
  (
    select version
    from public.bookings
    where id = (
      select consumed_booking_id
      from public.booking_holds
      where idempotency_key = 'a2-hold-consume-0001'
    )
  ),
  2,
  'an operational transition increments the booking version'
);

select is(
  (
    select count(*)::integer
    from public.booking_events
    where request_id = 'a2-booking-transition-0001'
      and event_type = 'booking_status_changed'
  ),
  1,
  'the booking transition writes one audit event'
);

select is(
  (
    public.transition_booking_status_v1(
      (
        select consumed_booking_id
        from public.booking_holds
        where idempotency_key = 'a2-hold-consume-0001'
      ),
      'cancelled_by_patient',
      'bbbbbbbb-0000-4000-8000-000000000005',
      'Mudanca de disponibilidade.',
      'a2-booking-transition-0001',
      1,
      'agenda_a2'
    )
  ).status::text,
  'cancelled_by_patient',
  'repeating a transition request returns its applied state'
);

select is(
  (
    select count(*)::integer
    from public.booking_events
    where request_id = 'a2-booking-transition-0001'
      and event_type = 'booking_status_changed'
  ),
  1,
  'transition idempotency does not duplicate audit events'
);

select throws_ok(
  $$
    select public.transition_booking_status_v1(
      (
        select consumed_booking_id
        from public.booking_holds
        where idempotency_key = 'a2-hold-consume-0001'
      ),
      'confirmed',
      'bbbbbbbb-0000-4000-8000-000000000005',
      null,
      'a2-payment-owned-transition',
      null,
      'agenda_a2'
    )
  $$,
  'P0001',
  'PAYMENT_WORKFLOW_REQUIRED',
  'payment-owned booking states cannot be applied by Agenda RPCs'
);

select isnt(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000001',
    'development',
    'a2-video-session-before-reschedule'
  ),
  null,
  'the paid booking receives a local Video SDK session for the test'
);

select is(
  (
    public.request_booking_reschedule_v1(
      'f2000000-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000001',
      date_trunc('day', now()) + interval '25 days 18 hours',
      date_trunc('day', now()) + interval '25 days 18 hours 50 minutes',
      'America/Sao_Paulo',
      'Ajuste de agenda.',
      'a2-reschedule-request-0001',
      172800,
      1
    )
  ).status,
  'pending',
  'a booking participant can create a pending reschedule request'
);

select is(
  (
    public.request_booking_reschedule_v1(
      'f2000000-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000001',
      date_trunc('day', now()) + interval '25 days 18 hours',
      date_trunc('day', now()) + interval '25 days 18 hours 50 minutes',
      'America/Sao_Paulo',
      'Ajuste de agenda.',
      'a2-reschedule-request-0001',
      172800,
      1
    )
  ).id,
  (
    select id
    from public.booking_reschedule_requests
    where request_id = 'a2-reschedule-request-0001'
  ),
  'the reschedule request is idempotent'
);

select is(
  (
    public.resolve_booking_reschedule_v1(
      (
        select id
        from public.booking_reschedule_requests
        where request_id = 'a2-reschedule-request-0001'
      ),
      'aaaaaaaa-0000-4000-8000-000000000001',
      'accepted',
      'a2-reschedule-resolution-0001',
      1
    )->>'applied'
  )::boolean,
  true,
  'the counterparty can atomically apply the reschedule'
);

select is(
  (
    select version
    from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000001'
  ),
  2,
  'rescheduling increments the booking version'
);

select is(
  (
    select status
    from public.booking_reschedule_requests
    where request_id = 'a2-reschedule-request-0001'
  ),
  'applied',
  'the accepted request reaches the applied terminal state'
);

select is(
  (
    select count(*)::integer
    from public.video_sessions
    join public.bookings
      on bookings.id = video_sessions.booking_id
    where video_sessions.booking_id = 'f2000000-0000-4000-8000-000000000001'
      and video_sessions.status in ('ready', 'active')
      and scheduled_starts_at = bookings.starts_at
      and scheduled_ends_at = bookings.ends_at
  ),
  1,
  'an applied reschedule updates the local video session'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  (
    select count(*) > 0
    from public.booking_holds
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'Ana can read holds for her own schedule'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.booking_holds
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  0,
  'Rafael cannot read holds from Ana schedule'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);

select ok(
  (
    select count(*) > 0
    from public.booking_holds
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000005'
  ),
  'a patient can read their own holds'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.booking_holds
    where patient_profile_id = 'b1000000-0000-4000-8000-000000000005'
  ),
  0,
  'a patient cannot read another patient holds'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.booking_reschedule_requests
    where request_id = 'a2-reschedule-request-0001'
  ),
  0,
  'Rafael cannot read Ana reschedule requests'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.booking_reschedule_requests
    where request_id = 'a2-reschedule-request-0001'
  ),
  1,
  'the booking patient can read their reschedule request'
);

select * from finish();

rollback;
