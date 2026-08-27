-- Local-only, idempotent fixture for visual validation of the public 90-day
-- calendar. It does not represent production or HML data.

insert into public.profiles (id, role, display_name)
values ('f9700000-0000-4000-8000-000000000001', 'therapist', 'Agenda Local')
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
  'f9700000-0000-4000-8000-000000000002',
  'f9700000-0000-4000-8000-000000000001',
  'agenda-90-dias-local',
  'Agenda Local',
  '9999998',
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
values ('f9700000-0000-4000-8000-000000000002', 'America/Sao_Paulo')
on conflict (therapist_profile_id) do update set timezone = excluded.timezone;

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  status,
  online_only,
  delivery_format,
  is_bookable
)
select
  'f9700000-0000-4000-8000-000000000003',
  'f9700000-0000-4000-8000-000000000002',
  therapy.id,
  'Agenda local de 90 dias',
  'Fixture local para validar a navegação da agenda pública.',
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
values ('f9700000-0000-4000-8000-000000000003', 0)
on conflict (service_id) do update
set min_notice_minutes = excluded.min_notice_minutes,
    max_days_ahead = 90;

insert into public.availability_rules (
  therapist_profile_id,
  service_id,
  days.day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
select
  'f9700000-0000-4000-8000-000000000002',
  'f9700000-0000-4000-8000-000000000003',
  day_of_week,
  '08:00'::time,
  '20:00'::time,
  'America/Sao_Paulo',
  true
from generate_series(0, 6) as days(day_of_week)
where not exists (
  select 1
  from public.availability_rules as rule
  where rule.therapist_profile_id = 'f9700000-0000-4000-8000-000000000002'
    and rule.service_id = 'f9700000-0000-4000-8000-000000000003'
    and rule.day_of_week = days.day_of_week
);
