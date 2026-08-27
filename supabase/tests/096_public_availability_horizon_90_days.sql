begin;

select plan(8);

insert into public.profiles (id, role, display_name)
values ('f9600000-0000-4000-8000-000000000001', 'therapist', 'Agenda 90 dias')
on conflict (id) do update set role = excluded.role;

insert into public.therapist_profiles (
  id,
  user_id,
  slug,
  public_name,
  free_public_slug,
  status,
  public_status,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions
)
values (
  'f9600000-0000-4000-8000-000000000002',
  'f9600000-0000-4000-8000-000000000001',
  'agenda-90-dias',
  'Agenda 90 dias',
  '9999999',
  'approved',
  'published',
  true,
  true,
  true
)
on conflict (id) do update
set status = excluded.status,
    public_status = excluded.public_status,
    is_public = excluded.is_public,
    is_accepting_bookings = excluded.is_accepting_bookings,
    accepts_online_sessions = excluded.accepts_online_sessions;

insert into public.therapist_schedule_settings (therapist_profile_id, timezone)
values ('f9600000-0000-4000-8000-000000000002', 'America/Sao_Paulo')
on conflict (therapist_profile_id) do update set timezone = excluded.timezone;

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  duration_minutes,
  price_cents,
  status,
  online_only,
  delivery_format,
  is_bookable
)
select
  'f9600000-0000-4000-8000-000000000003',
  'f9600000-0000-4000-8000-000000000002',
  therapy.id,
  'Disponibilidade 90 dias',
  20,
  12000,
  'active',
  true,
  'online',
  true
from public.therapies as therapy
join public.therapy_categories as category on category.id = therapy.category_id
where therapy.status = 'published'
  and therapy.is_public_visible
  and category.is_active
order by therapy.slug
limit 1
on conflict (id) do update
set status = excluded.status,
    online_only = excluded.online_only,
    delivery_format = excluded.delivery_format,
    is_bookable = excluded.is_bookable;

insert into public.therapist_service_booking_settings (
  service_id,
  min_notice_minutes
)
values ('f9600000-0000-4000-8000-000000000003', 0)
on conflict (service_id) do update
set min_notice_minutes = excluded.min_notice_minutes,
    max_days_ahead = 90;

insert into public.availability_rules (
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
select
  'f9600000-0000-4000-8000-000000000002',
  'f9600000-0000-4000-8000-000000000003',
  day_of_week,
  '08:00'::time,
  '20:00'::time,
  'America/Sao_Paulo',
  true
from generate_series(0, 6) as day_of_week;

select is(
  (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'therapist_service_booking_settings'
      and column_name = 'max_days_ahead'
  ),
  '90',
  'new service booking settings default to a 90-day horizon'
);

select is(
  (select count(*)::integer from public.therapist_service_booking_settings where max_days_ahead <> 90),
  0,
  'all existing service booking settings are normalized to 90 days'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_service_available_days_v1(uuid,date)',
    'EXECUTE'
  ),
  'anonymous visitors can read the safe month availability endpoint'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_service_available_day_slots_v1(uuid,date)',
    'EXECUTE'
  ),
  'anonymous visitors can read the safe day availability endpoint'
);

select is(
  (
    public.get_service_available_days_v1(
      'f9600000-0000-4000-8000-000000000003',
      date_trunc('month', now() + interval '2 months')::date
    ) ? 'slots'
  ),
  false,
  'month availability never leaks detailed slot payloads'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_service_available_days_v1(
        'f9600000-0000-4000-8000-000000000003',
        date_trunc('month', now() + interval '2 months')::date
      ) -> 'days'
    ) as available_day(value)
    where (available_day.value ->> 'date')::date > (now() at time zone 'America/Sao_Paulo')::date + 30
  ),
  'a later month remains discoverable after the old 30-day window'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_service_available_day_slots_v1(
        'f9600000-0000-4000-8000-000000000003',
        ((now() at time zone 'America/Sao_Paulo')::date + 89)
      ) -> 'slots'
    ) as slot(value)
    where (slot.value ->> 'startsAt')::timestamptz >= now() + interval '90 days'
  ),
  0,
  'day detail never returns a slot at or beyond the 90-day horizon'
);

select ok(
  (public.get_service_available_days_v1(
    'f9600000-0000-4000-8000-000000000003',
    date_trunc('month', now())::date
  ) ?& array['days', 'horizonEndsAt', 'timezone']),
  'month availability publishes only calendar navigation metadata'
);

select * from finish();

rollback;
