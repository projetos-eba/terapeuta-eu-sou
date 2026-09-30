begin;

select plan(10);

select is(
  has_function_privilege(
    'authenticated',
    'public.private_therapist_future_agenda_summary_v2(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the complete-day agenda helper directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.private_therapist_future_agenda_summary_v2(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'service role can invoke the complete-day agenda helper'
);

select ok(
  pg_catalog.to_regprocedure(
    'public.private_therapist_future_agenda_summary_v1(uuid,text)'
  ) is not null,
  'v1 remains available for legacy internal consumers'
);

create temporary table complete_day_window
on commit drop
as
select
  local_today,
  local_today + 1 as local_tomorrow,
  ((local_today + time '12:00') at time zone 'America/Sao_Paulo') as as_of
from (
  select (now() at time zone 'America/Sao_Paulo')::date + 2 as local_today
) as dates;

update public.therapist_profiles
set status = 'approved', is_public = true, is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set status = 'active',
    is_bookable = true,
    duration_minutes = 30,
    delivery_format = 'online',
    online_only = true
where id = 'd1000000-0000-4000-8000-000000000001';

update public.therapies
set status = 'published', is_available_for_services = true
where id = (
  select therapy_id
  from public.therapist_services
  where id = 'd1000000-0000-4000-8000-000000000001'
);

insert into public.therapist_service_booking_settings (
  service_id,
  buffer_before_minutes,
  buffer_after_minutes,
  min_notice_minutes,
  max_days_ahead,
  interval_minutes
)
values (
  'd1000000-0000-4000-8000-000000000001', 0, 0, 0, 90, 15
)
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
    ((select local_today from complete_day_window)::timestamp at time zone 'America/Sao_Paulo'),
    ((select local_tomorrow + 1 from complete_day_window)::timestamp at time zone 'America/Sao_Paulo'),
    '[)'
  );

delete from public.availability_rules
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

delete from public.availability_exceptions
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

-- These date-specific available exceptions avoid recurrence, so this fixture
-- isolates the boundary precisely. The two-hour period later on the as-of
-- date must not be included. The only offered interval in the V2 window is
-- tomorrow from midnight to 01:00.
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
select
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  (local_today + time '13:00') at time zone 'America/Sao_Paulo',
  (local_today + time '15:00') at time zone 'America/Sao_Paulo',
  true,
  'America/Sao_Paulo',
  'other',
  'active'
from complete_day_window
union all
select
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  (local_tomorrow + time '00:00') at time zone 'America/Sao_Paulo',
  (local_tomorrow + time '01:00') at time zone 'America/Sao_Paulo',
  true,
  'America/Sao_Paulo',
  'other',
  'active'
from complete_day_window;

-- This confirmed booking crosses the local midnight. Only its 15-minute
-- portion inside tomorrow's window remains a protected reservation.
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
  'a1590000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select local_today from complete_day_window) + time '23:45') at time zone 'America/Sao_Paulo',
  ((select local_tomorrow from complete_day_window) + time '00:15') at time zone 'America/Sao_Paulo',
  'America/Sao_Paulo',
  'confirmed',
  'pending'
);

select is(
  (
    public.private_therapist_future_agenda_summary_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      (select as_of from complete_day_window)
    ) ->> 'windowStart'
  )::date,
  (select local_tomorrow from complete_day_window),
  'the complete-day window starts at the next local date'
);

select is(
  (
    public.private_therapist_future_agenda_summary_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      (select as_of from complete_day_window)
    ) ->> 'windowEnd'
  )::date,
  (select local_tomorrow + 29 from complete_day_window),
  'the complete-day window exposes 30 inclusive local dates'
);

select is(
  (
    public.private_therapist_future_agenda_summary_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      (select as_of from complete_day_window)
    ) ->> 'capacityMinutes'
  )::integer,
  60,
  'availability from the as-of date is excluded from capacity'
);

select is(
  (
    public.private_therapist_future_agenda_summary_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      (select as_of from complete_day_window)
    ) ->> 'reservedMinutes'
  )::integer,
  15,
  'only the portion of a booking after the next local midnight remains reserved'
);

select is(
  (
    public.private_therapist_future_agenda_summary_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      (select as_of from complete_day_window)
    ) ->> 'availableMinutes'
  )::integer,
  45,
  'complete-day availability excludes the current date and protected reservation'
);

select is(
  position(
    'private_therapist_future_agenda_summary_v2' in pg_get_functiondef(
      'public.get_private_therapist_advanced_financial_dashboard_v3(date,date,text)'::regprocedure
    )
  ) > 0,
  true,
  'finance v3 delegates its agenda potential to the complete-day helper'
);

select is(
  position(
    'private_therapist_future_agenda_summary_v2' in pg_get_functiondef(
      'public.get_therapist_metrics_dashboard_v4(integer)'::regprocedure
    )
  ) > 0,
  true,
  'metrics v4 delegates its future agenda to the complete-day helper'
);

select * from finish();

rollback;
