begin;

select plan(14);

select has_function(
  'public',
  'release_booking_after_full_refund_v1',
  array[]::text[],
  'full refunds have a dedicated booking reconciliation trigger'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.release_booking_after_full_refund_v1()',
    'EXECUTE'
  ),
  false,
  'browser roles cannot invoke the refund reconciliation trigger'
);

create temporary table refund_available_slots on commit drop as
select
  (slot.value ->> 'startsAt')::timestamptz as starts_at,
  (slot.value ->> 'endsAt')::timestamptz as ends_at
from jsonb_array_elements(
  public.get_service_available_slots_v1(
    'd1000000-0000-4000-8000-000000000001',
    now() + interval '1 day',
    now() + interval '30 days',
    500
  ) -> 'slots'
) as slot(value)
order by (slot.value ->> 'startsAt')::timestamptz;

create temporary table refund_test_windows on commit drop as
with full_refund as (
  select starts_at, ends_at
  from refund_available_slots
  order by starts_at
  limit 1
), partial_refund as (
  select slot.starts_at, slot.ends_at
  from refund_available_slots as slot
  cross join full_refund
  where slot.starts_at >= full_refund.ends_at + interval '20 minutes'
  order by slot.starts_at
  limit 1
)
select 'full'::text as kind, starts_at, ends_at from full_refund
union all
select 'partial'::text as kind, starts_at, ends_at from partial_refund;

select is(
  (select count(*)::integer from refund_test_windows),
  2,
  'the seeded schedule provides two non-overlapping refund test slots'
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
)
select
  case kind
    when 'full' then 'a8700000-0000-4000-8000-000000000001'::uuid
    else 'a8700000-0000-4000-8000-000000000002'::uuid
  end,
  case kind
    when 'full' then 'b1000000-0000-4000-8000-000000000005'::uuid
    else 'b1000000-0000-4000-8000-000000000006'::uuid
  end,
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  starts_at,
  ends_at,
  'America/Sao_Paulo',
  'confirmed',
  'paid'
from refund_test_windows;

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  financial_status,
  paid_at
)
select
  case test_window.kind
    when 'full' then 'a8700000-0000-4000-8000-000000000011'::uuid
    else 'a8700000-0000-4000-8000-000000000012'::uuid
  end,
  case test_window.kind
    when 'full' then 'a8700000-0000-4000-8000-000000000001'::uuid
    else 'a8700000-0000-4000-8000-000000000002'::uuid
  end,
  case test_window.kind
    when 'full' then 'b1000000-0000-4000-8000-000000000005'::uuid
    else 'b1000000-0000-4000-8000-000000000006'::uuid
  end,
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  12000,
  2000,
  2400,
  9600,
  'paid',
  now()
from refund_test_windows as test_window
cross join lateral (
  select id
  from public.financial_policy_versions
  where is_active
  limit 1
) as policy;

update public.session_payments
set financial_status = 'refunded',
    stripe_event_id = 'evt_full_refund_releases_slot',
    stripe_event_created_at = now()
where id = 'a8700000-0000-4000-8000-000000000011';

select is(
  (
    select status::text
    from public.bookings
    where id = 'a8700000-0000-4000-8000-000000000001'
  ),
  'refunded',
  'a full refund closes the booking'
);

select is(
  (
    select payment_status::text
    from public.bookings
    where id = 'a8700000-0000-4000-8000-000000000001'
  ),
  'refunded',
  'the legacy payment projection remains synchronized'
);

select is(
  (
    select count(*)::integer
    from public.booking_events
    where booking_id = 'a8700000-0000-4000-8000-000000000001'
      and event_type = 'booking_status_changed'
      and next_status = 'refunded'
      and source = 'payment_state'
  ),
  1,
  'the booking transition is recorded once in the audit history'
);

select is(
  (
    (
      public.reserve_booking_hold_v1(
        'b1000000-0000-4000-8000-000000000006',
        'd1000000-0000-4000-8000-000000000001',
        (select starts_at from refund_test_windows where kind = 'full'),
        (select ends_at from refund_test_windows where kind = 'full'),
        'America/Sao_Paulo',
        'full-refund-slot-available',
        600
      )
    ).status
  )::text,
  'active',
  'the fully refunded booking releases its slot for a new hold'
);

update public.booking_holds
set status = 'cancelled'
where idempotency_key = 'full-refund-slot-available';

update public.session_payments
set financial_status = financial_status
where id = 'a8700000-0000-4000-8000-000000000011';

select is(
  (
    select count(*)::integer
    from public.booking_events
    where booking_id = 'a8700000-0000-4000-8000-000000000001'
      and event_type = 'booking_status_changed'
      and next_status = 'refunded'
  ),
  1,
  'replaying the same full refund is idempotent'
);

update public.session_payments
set financial_status = 'partially_refunded',
    stripe_event_id = 'evt_partial_refund_keeps_slot',
    stripe_event_created_at = now()
where id = 'a8700000-0000-4000-8000-000000000012';

select is(
  (
    select status::text
    from public.bookings
    where id = 'a8700000-0000-4000-8000-000000000002'
  ),
  'confirmed',
  'a partial refund does not close a session that may still happen'
);

select is(
  (
    select payment_status::text
    from public.bookings
    where id = 'a8700000-0000-4000-8000-000000000002'
  ),
  'partially_refunded',
  'the partial refund is still projected for operational display'
);

select throws_ok(
  format(
    $sql$
      select public.reserve_booking_hold_v1(
        'b1000000-0000-4000-8000-000000000005',
        'd1000000-0000-4000-8000-000000000001',
        %L::timestamptz,
        %L::timestamptz,
        'America/Sao_Paulo',
        'partial-refund-slot-still-occupied',
        600
      )
    $sql$,
    (select starts_at from refund_test_windows where kind = 'partial'),
    (select ends_at from refund_test_windows where kind = 'partial')
  ),
  'BOOKING_CONFLICT',
  'a partially refunded booking continues protecting its slot'
);

select throws_ok(
  $$
    update public.bookings
    set status = 'refunded'
    where id = 'a8700000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'PAYMENT_WORKFLOW_REQUIRED',
  'browser-style direct writes cannot forge the payment-owned booking state'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000001',
        now() + interval '1 day',
        now() + interval '30 days',
        500
      ) -> 'slots'
    ) as slot(value)
    where (slot.value ->> 'startsAt')::timestamptz =
      (select starts_at from refund_test_windows where kind = 'full')
  ),
  'the public slot endpoint exposes the released time again'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000001',
        now() + interval '1 day',
        now() + interval '30 days',
        500
      ) -> 'slots'
    ) as slot(value)
    where (slot.value ->> 'startsAt')::timestamptz =
      (select starts_at from refund_test_windows where kind = 'partial')
  ),
  'the public slot endpoint keeps a partially refunded session occupied'
);

select * from finish();

rollback;
