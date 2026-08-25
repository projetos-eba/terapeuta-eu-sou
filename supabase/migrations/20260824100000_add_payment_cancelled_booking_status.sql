-- A failed or expired Stripe payment needs an auditable terminal booking
-- state that is distinct from a participant-initiated cancellation.
alter type public.booking_status
  add value if not exists 'cancelled_by_payment';
