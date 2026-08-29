-- Cleanup for local-patient-schedule-hotfix-fixture.sql.

delete from public.bookings
where id = 'a1030000-0000-4000-8000-000000000201';

delete from public.availability_rules
where id in (
  'a1030000-0000-4000-8000-000000000203',
  'a1030000-0000-4000-8000-000000000204'
);

delete from public.therapist_service_booking_settings
where id = 'a1030000-0000-4000-8000-000000000202';
