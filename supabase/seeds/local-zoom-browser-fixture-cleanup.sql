-- Reverts only the local browser Zoom fixture prepared by
-- local-zoom-browser-fixture.sql. It is safe to run repeatedly and restores
-- the base local-test-data booking so pgTAP owns the lifecycle from version 1.
with deleted_fixture as (
  delete from public.video_sessions
  where booking_id = 'f2000000-0000-4000-8000-000000000001'::uuid
    and metadata ->> 'source' = 'local-e2e-zoom-browser-fixture'
  returning booking_id
)
update public.bookings as booking
set
  meeting_provider = 'zoom',
  meeting_url = 'https://example.test/meeting/ana-today-1',
  updated_at = now()
where booking.id = 'f2000000-0000-4000-8000-000000000001'::uuid
  and exists (select 1 from deleted_fixture);
