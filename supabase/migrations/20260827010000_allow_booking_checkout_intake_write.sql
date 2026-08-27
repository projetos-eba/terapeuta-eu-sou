-- The checkout Edge Function writes the private intake after consuming the
-- booking hold. RLS is bypassed by service_role, but PostgREST still requires
-- explicit table privileges before it can perform the idempotent upsert.
grant insert, update on table public.booking_intake_responses to service_role;

revoke insert, update on table public.booking_intake_responses
from anon, authenticated;

comment on table public.booking_intake_responses is
  'Private booking intake. Readable by authorized participants and writable only by trusted checkout operations.';
