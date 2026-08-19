-- Recreating a PostgreSQL function grants EXECUTE to PUBLIC unless the
-- privilege boundary is restored explicitly. The publication lifecycle
-- migration replaced the slot and hold entrypoints, so re-apply the intended
-- grants after that replacement.

revoke all on function public.get_service_available_slots_v1_internal(
  uuid,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.get_service_available_slots_v1_internal(
  uuid,
  timestamptz,
  timestamptz,
  integer
) to service_role;

revoke all on function public.get_service_available_slots_v1(
  uuid,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.get_service_available_slots_v1(
  uuid,
  timestamptz,
  timestamptz,
  integer
) to anon, authenticated, service_role;

revoke all on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) to service_role;

comment on function public.reserve_booking_hold_v1(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  integer
) is 'Transactional booking hold command. Edge Functions using service_role only; browser clients must use session-booking-checkout.';
