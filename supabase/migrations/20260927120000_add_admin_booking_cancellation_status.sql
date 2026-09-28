-- Administrative pre-charge cancellation is a terminal booking state. It is
-- deliberately distinct from participant cancellations for auditability.
alter type public.booking_status add value if not exists 'cancelled_by_admin';
