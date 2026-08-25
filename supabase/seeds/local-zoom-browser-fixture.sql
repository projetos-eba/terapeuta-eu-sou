-- Local-only setup for tests/e2e/zoom.spec.ts.
--
-- This fixture intentionally stays out of [db.seed].sql_paths: pgTAP owns the
-- lifecycle of the same booking and needs to begin without a video session.
-- Run this file immediately before the local browser Zoom test. It uses the
-- canonical paid-booking RPC instead of inserting a video session directly.
select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001'::uuid,
  'development',
  'local-e2e-zoom-browser-fixture'
);
