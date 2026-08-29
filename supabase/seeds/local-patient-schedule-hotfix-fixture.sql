-- Local-only, idempotent fixture for the patient schedule hotfix browser QA.
-- It is intentionally outside config.toml and must never be applied remotely.

delete from public.bookings
where id = 'a1030000-0000-4000-8000-000000000201';

insert into public.therapist_service_booking_settings (
  id, service_id, buffer_before_minutes, buffer_after_minutes,
  min_notice_minutes, max_days_ahead, interval_minutes
) values (
  'a1030000-0000-4000-8000-000000000202',
  'd1000000-0000-4000-8000-000000000002',
  10, 10, 0, 90, 10
)
on conflict (service_id) do update
set
  buffer_before_minutes = excluded.buffer_before_minutes,
  buffer_after_minutes = excluded.buffer_after_minutes,
  min_notice_minutes = excluded.min_notice_minutes,
  max_days_ahead = excluded.max_days_ahead,
  interval_minutes = excluded.interval_minutes,
  updated_at = now();

insert into public.availability_rules (
  id, therapist_profile_id, service_id, day_of_week, start_time, end_time,
  timezone, is_active
) values (
  'a1030000-0000-4000-8000-000000000203',
  'c1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000002',
  2, '18:00', '21:00', 'America/Sao_Paulo', true
)
on conflict (id) do update
set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.availability_rules (
  id, therapist_profile_id, service_id, day_of_week, start_time, end_time,
  timezone, is_active
) values (
  'a1030000-0000-4000-8000-000000000204',
  'c1000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000003',
  2, '18:00', '21:00', 'America/Sao_Paulo', true
)
on conflict (id) do update
set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  is_active = excluded.is_active,
  updated_at = now();

with fixture_window as (
  select
    (
      date_trunc('day', now() at time zone 'America/Sao_Paulo')
      + case
          when extract(dow from now() at time zone 'America/Sao_Paulo')::integer = 2
            then interval '7 days'
          else ((9 - extract(dow from now() at time zone 'America/Sao_Paulo')::integer) % 7) * interval '1 day'
        end
      + time '18:30'
    ) at time zone 'America/Sao_Paulo' as starts_at
)
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
)
select
  'a1030000-0000-4000-8000-000000000201',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000003',
  starts_at,
  starts_at + interval '60 minutes',
  'America/Sao_Paulo',
  'confirmed',
  'paid'
from fixture_window;

-- Browser account: paciente.ana@example.test / local fixture password.
-- Expected on Rafael's service: overlapping slots are hidden; 19:30 remains.
