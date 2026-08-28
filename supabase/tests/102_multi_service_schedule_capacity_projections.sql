begin;

select plan(18);

select is(
  has_function_privilege(
    'authenticated',
    'public.private_therapist_agenda_capacity_v1(uuid,date,date,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the internal agenda capacity helper'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.private_therapist_agenda_capacity_v1(uuid,date,date,text)',
    'EXECUTE'
  ),
  'service role can invoke the internal agenda capacity helper'
);

select throws_ok(
  $$
    select *
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      date '2026-09-02',
      date '2026-09-01',
      'America/Sao_Paulo'
    )
  $$,
  '22023',
  'invalid_agenda_capacity_range',
  'agenda capacity rejects an inverted range'
);

create temporary table capacity_test_days
on commit drop
as
select (
  current_date
  + ((1 - extract(dow from current_date)::integer + 7) % 7)
  + 14
)::date as monday;

update public.therapist_profiles
set status = 'approved',
    is_public = true,
    is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set status = 'active',
    is_bookable = true,
    delivery_format = 'online',
    online_only = true
where id in (
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000006',
  'd1000000-0000-4000-8000-000000000021'
);

update public.therapies
set status = 'published',
    is_public_visible = true,
    is_available_for_services = true
where id in (
  select service.therapy_id
  from public.therapist_services as service
  where service.id in (
    'd1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    'd1000000-0000-4000-8000-000000000021'
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
  ('d1000000-0000-4000-8000-000000000001', 10, 10, 0, 90, 30),
  ('d1000000-0000-4000-8000-000000000006', 10, 10, 0, 90, 30),
  ('d1000000-0000-4000-8000-000000000021', 10, 10, 0, 90, 30)
on conflict (service_id) do update
set buffer_before_minutes = excluded.buffer_before_minutes,
    buffer_after_minutes = excluded.buffer_after_minutes,
    min_notice_minutes = excluded.min_notice_minutes,
    max_days_ahead = excluded.max_days_ahead,
    interval_minutes = excluded.interval_minutes;

update public.booking_holds
set status = 'expired',
    expires_at = now() - interval '1 minute'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and occupied_during && tstzrange(
    ((select monday from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    ((select monday + 3 from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.bookings
set status = 'cancelled_by_therapist'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status in ('draft', 'pending_payment', 'confirmed')
  and occupied_during && tstzrange(
    ((select monday from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    ((select monday + 3 from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.availability_exceptions
set status = 'cancelled'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status = 'active'
  and tstzrange(starts_at, ends_at, '[)') && tstzrange(
    ((select monday from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    ((select monday + 3 from capacity_test_days) + time '00:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

delete from public.availability_rules
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

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
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 1, time '09:00', time '17:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 1, time '09:00', time '17:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000021', 1, time '09:00', time '17:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 2, time '09:00', time '12:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 2, time '11:00', time '14:00', 'America/Sao_Paulo', true),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000021', 2, time '13:00', time '15:00', 'America/Sao_Paulo', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table capacity_schedule_payload
on commit drop
as
select public.get_therapist_schedule_v1() as payload;

select is(
  (select (payload #>> '{summary,configuredDays}')::integer from capacity_schedule_payload),
  2,
  'general schedule summary counts configured weekdays across services once'
);

select is(
  (select (payload #>> '{summary,weeklyAvailableMinutes}')::integer from capacity_schedule_payload),
  840,
  'general schedule summary merges equal and partially overlapping service windows'
);

select is(
  (
    select (service.value ->> 'weeklyAvailableMinutes')::integer
    from capacity_schedule_payload
    cross join lateral jsonb_array_elements(payload -> 'services') as service(value)
    where service.value ->> 'id' = 'd1000000-0000-4000-8000-000000000001'
  ),
  660,
  'first service keeps its own weekly minutes'
);

select is(
  (
    select (service.value ->> 'weeklyAvailableMinutes')::integer
    from capacity_schedule_payload
    cross join lateral jsonb_array_elements(payload -> 'services') as service(value)
    where service.value ->> 'id' = 'd1000000-0000-4000-8000-000000000006'
  ),
  660,
  'second service keeps its own weekly minutes'
);

select is(
  (
    select (service.value ->> 'weeklyAvailableMinutes')::integer
    from capacity_schedule_payload
    cross join lateral jsonb_array_elements(payload -> 'services') as service(value)
    where service.value ->> 'id' = 'd1000000-0000-4000-8000-000000000021'
  ),
  600,
  'third service keeps its own weekly minutes'
);

select is(
  (
    select count(*)
    from capacity_schedule_payload
    cross join lateral jsonb_array_elements(payload -> 'rules') as rule(value)
    where rule.value -> 'serviceId' = 'null'::jsonb
  ),
  0::bigint,
  'agenda read model never emits a general weekly rule'
);

reset role;

select is(
  (
    select scheduled_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 1 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  840,
  'capacity helper merges service windows before projecting potential'
);

select is(
  (
    select available_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 1 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  840,
  'fully open merged windows remain fully available'
);

insert into public.availability_exceptions (
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  is_available,
  timezone,
  reason_code,
  status
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    ((select monday + 1 from capacity_test_days) + time '11:00') at time zone 'America/Sao_Paulo',
    ((select monday + 1 from capacity_test_days) + time '12:00') at time zone 'America/Sao_Paulo',
    false,
    'America/Sao_Paulo',
    'other',
    'active'
  );

select is(
  (
    select exception_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 1 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  0,
  'a service-scoped block does not remove capacity covered by another service'
);

insert into public.availability_exceptions (
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  is_available,
  timezone,
  reason_code,
  status
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    null,
    ((select monday + 1 from capacity_test_days) + time '12:00') at time zone 'America/Sao_Paulo',
    ((select monday + 1 from capacity_test_days) + time '13:00') at time zone 'America/Sao_Paulo',
    false,
    'America/Sao_Paulo',
    'other',
    'active'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000021',
    ((select monday + 2 from capacity_test_days) + time '10:00') at time zone 'America/Sao_Paulo',
    ((select monday + 2 from capacity_test_days) + time '11:00') at time zone 'America/Sao_Paulo',
    true,
    'America/Sao_Paulo',
    'other',
    'active'
  );

select is(
  (
    select exception_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 2 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  60,
  'a therapist-global block removes capacity once across every service'
);

select is(
  (
    select scheduled_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 2 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  900,
  'a service-scoped positive exception adds one real availability window'
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
values (
  'a5200000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select monday from capacity_test_days) + time '10:00') at time zone 'America/Sao_Paulo',
  ((select monday from capacity_test_days) + time '10:30') at time zone 'America/Sao_Paulo',
  'America/Sao_Paulo',
  'confirmed',
  'paid'
);

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
  'a5300000-0000-4000-8000-000000000001',
  'a5200000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  12000,
  1500,
  1800,
  10200,
  'paid',
  now()
from public.financial_policy_versions as policy
where policy.is_active
limit 1;

select is(
  (
    select committed_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 2 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  50,
  'paid booking occupancy includes immutable before and after buffer snapshots'
);

select is(
  (
    select available_minutes
    from public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (select monday from capacity_test_days),
      (select monday + 2 from capacity_test_days),
      'America/Sao_Paulo'
    )
  ),
  790,
  'available capacity subtracts global blocks and paid booking buffers once'
);

select ok(
  pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  ) like '%private_therapist_agenda_capacity_v1%',
  'F3 advanced finance payload delegates agenda capacity to the deduplicated helper'
);

create temporary table capacity_f3_payload
on commit drop
as
select public.private_therapist_finance_advanced_dashboard_payload_v1(
  'c1000000-0000-4000-8000-000000000001',
  'premium_plus',
  (select monday from capacity_test_days),
  (select monday + 2 from capacity_test_days),
  'America/Sao_Paulo'
) as payload;

select is(
  (
    select (payload #>> '{agendaPotential,capacityMinutes}')::integer
    from capacity_f3_payload
  ),
  (
    select capacity.scheduled_minutes
    from capacity_f3_payload as f3
    cross join lateral public.private_therapist_agenda_capacity_v1(
      'c1000000-0000-4000-8000-000000000001',
      (f3.payload #>> '{agendaPotential,windowStart}')::date,
      (f3.payload #>> '{agendaPotential,windowEnd}')::date,
      'America/Sao_Paulo'
    ) as capacity
  ),
  'F3 capacityMinutes matches the canonical deduplicated capacity projection'
);

select * from finish();

rollback;
