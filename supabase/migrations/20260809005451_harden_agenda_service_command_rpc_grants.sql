-- Reassert SERVICE_ROLE_ONLY grants for Agenda and therapist service command
-- RPCs that must not be callable directly through the Data API by browser
-- roles. This is intentionally additive/idempotent to close HML drift without
-- changing the underlying business logic.

revoke execute on function public.validate_booking_against_active_holds_v1()
from public;
revoke execute on function public.validate_booking_against_active_holds_v1()
from anon, authenticated, service_role;

revoke execute on function public.validate_hold_against_active_bookings_v1()
from public;
revoke execute on function public.validate_hold_against_active_bookings_v1()
from anon, authenticated, service_role;

revoke execute on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) from public;
revoke execute on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) from anon, authenticated;
grant execute on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) to service_role;

revoke execute on function public.list_private_therapist_services_v1(uuid)
from public;
revoke execute on function public.list_private_therapist_services_v1(uuid)
from anon, authenticated;
grant execute on function public.list_private_therapist_services_v1(uuid)
to service_role;

revoke execute on function public.create_therapist_service_v1(uuid, uuid, jsonb)
from public;
revoke execute on function public.create_therapist_service_v1(uuid, uuid, jsonb)
from anon, authenticated;
grant execute on function public.create_therapist_service_v1(uuid, uuid, jsonb)
to service_role;

revoke execute on function public.update_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) from public;
revoke execute on function public.update_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) from anon, authenticated;
grant execute on function public.update_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) to service_role;

revoke execute on function public.transition_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) from public;
revoke execute on function public.transition_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) from anon, authenticated;
grant execute on function public.transition_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) to service_role;

revoke execute on function public.reorder_therapist_services_v1(
  uuid,
  uuid,
  uuid[]
) from public;
revoke execute on function public.reorder_therapist_services_v1(
  uuid,
  uuid,
  uuid[]
) from anon, authenticated;
grant execute on function public.reorder_therapist_services_v1(
  uuid,
  uuid,
  uuid[]
) to service_role;

revoke execute on function public.replace_therapist_service_matching_v1(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid
) from public;
revoke execute on function public.replace_therapist_service_matching_v1(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid
) from anon, authenticated;
grant execute on function public.replace_therapist_service_matching_v1(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid
) to service_role;

revoke execute on function public.create_therapist_service_with_matching_v1(
  uuid,
  uuid,
  jsonb
) from public;
revoke execute on function public.create_therapist_service_with_matching_v1(
  uuid,
  uuid,
  jsonb
) from anon, authenticated;
grant execute on function public.create_therapist_service_with_matching_v1(
  uuid,
  uuid,
  jsonb
) to service_role;

revoke execute on function public.update_therapist_service_with_matching_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) from public;
revoke execute on function public.update_therapist_service_with_matching_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) from anon, authenticated;
grant execute on function public.update_therapist_service_with_matching_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) to service_role;

comment on function public.validate_booking_against_active_holds_v1() is
  'Trigger helper only. No direct Data API execution; it enforces booking/hold overlap inside trusted table mutations.';

comment on function public.validate_hold_against_active_bookings_v1() is
  'Trigger helper only. No direct Data API execution; it enforces hold/booking overlap inside trusted table mutations.';

comment on function public.transition_booking_status_v1(
  uuid,
  public.booking_status,
  uuid,
  text,
  text,
  integer,
  text
) is
  'SERVICE_ROLE_ONLY Agenda transition. Browser roles must use authenticated command boundaries with actor derived from JWT.';

comment on function public.transition_therapist_service_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) is
  'SERVICE_ROLE_ONLY therapist service transition. Actor id is supplied by therapist-services-command after JWT validation.';

comment on function public.update_therapist_service_with_matching_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  jsonb
) is
  'SERVICE_ROLE_ONLY therapist service update with Match metadata. Browser clients must not call this RPC directly.';
