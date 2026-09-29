begin;

select plan(15);

select is(
  has_function_privilege(
    'authenticated',
    'public.private_therapist_agenda_capacity_v2(uuid,timestamptz,timestamptz,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke future agenda capacity directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.private_therapist_agenda_capacity_v2(uuid,timestamptz,timestamptz,text)',
    'EXECUTE'
  ),
  'service role can invoke the internal future agenda capacity helper'
);

select throws_ok(
  $$
    select *
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      timestamptz '2026-10-02 12:00:00+00',
      timestamptz '2026-10-01 12:00:00+00',
      'America/Sao_Paulo'
    )
  $$,
  '22023',
  'invalid_future_agenda_capacity_range',
  'future agenda capacity rejects an inverted window'
);

create temporary table future_agenda_test_days
on commit drop
as
select (
  current_date
  + ((1 - extract(dow from current_date)::integer + 7) % 7)
  + 14
)::date as monday;

update public.therapist_profiles
set status = 'approved', is_public = true, is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set status = 'active',
    is_bookable = true,
    delivery_format = 'online',
    online_only = true
where id in (
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000006'
);

update public.therapies
set status = 'published', is_available_for_services = true
where id in (
  select therapy_id
  from public.therapist_services
  where id in (
    'd1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006'
  )
);

insert into public.therapist_service_booking_settings (
  service_id,
  buffer_before_minutes,
  buffer_after_minutes,
  min_notice_minutes,
  max_days_ahead,
  interval_minutes
)
values
  ('d1000000-0000-4000-8000-000000000001', 5, 10, 0, 90, 30),
  ('d1000000-0000-4000-8000-000000000006', 5, 10, 0, 90, 30)
on conflict (service_id) do update
set buffer_before_minutes = excluded.buffer_before_minutes,
    buffer_after_minutes = excluded.buffer_after_minutes,
    min_notice_minutes = excluded.min_notice_minutes,
    max_days_ahead = excluded.max_days_ahead,
    interval_minutes = excluded.interval_minutes;

update public.bookings
set status = 'cancelled_by_therapist'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status in ('draft', 'pending_payment', 'confirmed')
  and occupied_during && tstzrange(
    ((select monday from future_agenda_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    ((select monday + 1 from future_agenda_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.availability_exceptions
set status = 'cancelled'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and coalesce(status, 'active') = 'active'
  and starts_at < ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo')
  and ends_at > ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo');

delete from public.availability_rules
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

-- 09h–16h plus 15h–18h is nine unique hours, not ten.
insert into public.availability_rules (
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
values
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 1, time '09:00', time '16:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 1, time '15:00', time '18:00', 'America/Sao_Paulo', true);

select is(
  (
    select offered_minutes
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  540,
  'overlapping service schedules are merged into nine unique hours'
);

insert into public.availability_exceptions (
  therapist_profile_id, service_id, starts_at, ends_at, is_available,
  timezone, reason_code, status
)
values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select monday from future_agenda_test_days) + time '15:30') at time zone 'America/Sao_Paulo',
  ((select monday from future_agenda_test_days) + time '16:00') at time zone 'America/Sao_Paulo',
  false, 'America/Sao_Paulo', 'other', 'active'
);

select is(
  (
    select offered_minutes
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  540,
  'a service-scoped exception keeps capacity covered by another therapy'
);

insert into public.availability_exceptions (
  therapist_profile_id, service_id, starts_at, ends_at, is_available,
  timezone, reason_code, status
)
values (
  'c1000000-0000-4000-8000-000000000001',
  null,
  ((select monday from future_agenda_test_days) + time '12:00') at time zone 'America/Sao_Paulo',
  ((select monday from future_agenda_test_days) + time '13:00') at time zone 'America/Sao_Paulo',
  false, 'America/Sao_Paulo', 'other', 'active'
);

select is(
  (
    select offered_minutes
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  480,
  'a therapist-global exception removes its hour only once'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
)
values
  ('a5600000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', ((select monday from future_agenda_test_days) + time '09:00') at time zone 'America/Sao_Paulo', ((select monday from future_agenda_test_days) + time '09:30') at time zone 'America/Sao_Paulo', 'America/Sao_Paulo', 'pending_payment', 'pending'),
  ('a5600000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', ((select monday from future_agenda_test_days) + time '10:00') at time zone 'America/Sao_Paulo', ((select monday from future_agenda_test_days) + time '10:30') at time zone 'America/Sao_Paulo', 'America/Sao_Paulo', 'confirmed', 'pending'),
  ('a5600000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', ((select monday from future_agenda_test_days) + time '11:00') at time zone 'America/Sao_Paulo', ((select monday from future_agenda_test_days) + time '11:30') at time zone 'America/Sao_Paulo', 'America/Sao_Paulo', 'completed', 'paid');

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status
)
select
  'a5700000-0000-4000-8000-000000000001',
  'a5600000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 12000, 1500, 1800, 10200, 'processing'
from public.financial_policy_versions as policy
where policy.is_active
limit 1;

select is(
  (
    select reserved_session_count
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  3,
  'pending, processing and paid session states all remain protected reservations'
);

select is(
  (
    select reserved_minutes
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  135,
  'reserved minutes preserve the five-minute pre-buffer and ten-minute post-buffer snapshots'
);

update public.bookings
set status = 'cancelled_by_therapist'
where id = 'a5600000-0000-4000-8000-000000000001';

select is(
  (
    select reserved_session_count
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  2,
  'a terminal cancellation no longer occupies the future agenda'
);

delete from public.availability_rules
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select capacity_minutes >= reserved_minutes and available_minutes = 0
    from public.private_therapist_agenda_capacity_v2(
      'c1000000-0000-4000-8000-000000000001',
      ((select monday from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      ((select monday + 1 from future_agenda_test_days)::timestamp at time zone 'America/Sao_Paulo'),
      'America/Sao_Paulo'
    )
  ),
  true,
  'removing later availability never hides a protected booking or exceeds 100 percent occupancy'
);

select ok(
  to_regprocedure('public.get_private_therapist_advanced_financial_dashboard_v3(date,date,text)') is not null,
  'finance v3 contract is available without replacing v2'
);

select ok(
  to_regprocedure('public.get_therapist_metrics_dashboard_v4(integer)') is not null,
  'metrics v4 contract is available without replacing prior dashboards'
);

select is(
  position(
    '30, 60, 90' in pg_get_functiondef(
      'public.get_therapist_occupancy_metrics_v2(uuid,text,integer)'::regprocedure
    )
  ) > 0,
  true,
  'historical occupancy retains 90-day compatibility and accepts the 60-day dashboard period'
);

select is(
  position(
    '30, 60, 90' in pg_get_functiondef(
      'public.get_therapist_metrics_dashboard_v2(integer)'::regprocedure
    )
  ) > 0,
  true,
  'the v2 dashboard chain also accepts the 60-day route without losing 90-day compatibility'
);

select is(
  (
    select
      (payload ->> 'windowEnd')::date - (payload ->> 'windowStart')::date
    from (
      select public.private_therapist_future_agenda_summary_v1(
        'c1000000-0000-4000-8000-000000000001',
        'America/Sao_Paulo'
      ) as payload
    ) as summary
  ),
  29,
  'the future summary spans exactly 30 inclusive local calendar days'
);

select * from finish();

rollback;
