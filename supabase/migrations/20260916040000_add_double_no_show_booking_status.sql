-- The booking status is extended in its own migration because PostgreSQL
-- requires a newly-added enum value to be committed before later functions
-- can reference it.
alter type public.booking_status add value if not exists 'no_show_both';

alter type public.session_confirmation_source
  add value if not exists 'attendance_evidence';
