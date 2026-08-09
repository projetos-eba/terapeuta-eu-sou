-- H1 hardening: internal financial/session/job RPCs must not be callable via
-- Data API by anon/authenticated clients. Edge Functions and scheduled jobs use
-- service_role; trigger helpers do not need external EXECUTE grants.

revoke execute on function public.auto_confirm_sessions(timestamptz)
from public, anon, authenticated;
grant execute on function public.auto_confirm_sessions(timestamptz)
to service_role;

revoke execute on function public.calculate_session_cancellation_policy(uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.calculate_session_cancellation_policy(uuid, text, timestamptz)
to service_role;

revoke execute on function public.confirm_session_service(uuid, public.session_confirmation_source, uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.confirm_session_service(uuid, public.session_confirmation_source, uuid, uuid, jsonb)
to service_role;

revoke execute on function public.create_weekly_payout_batch(date, date, timestamptz, uuid)
from public, anon, authenticated;
grant execute on function public.create_weekly_payout_batch(date, date, timestamptz, uuid)
to service_role;

revoke execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
to service_role;

revoke execute on function public.confirm_session_from_review()
from public, anon, authenticated, service_role;

revoke execute on function public.import_legacy_payment_projection()
from public, anon, authenticated, service_role;

revoke execute on function public.sync_session_payment_projections()
from public, anon, authenticated, service_role;

revoke execute on function public.enforce_therapist_profile_online_only_v1()
from public, anon, authenticated, service_role;

revoke execute on function public.enforce_therapist_service_online_only_v1()
from public, anon, authenticated, service_role;

revoke execute on function public.validate_availability_exception_series_v1()
from public, anon, authenticated, service_role;

revoke execute on function public.validate_service_matching_write_v1()
from public, anon, authenticated, service_role;

revoke execute on function public.ensure_therapy_matching_theme_limit_v1()
from public, anon, authenticated, service_role;

revoke execute on function public.ensure_therapy_has_matching_theme_for_publish_v1(uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.ensure_service_matching_rules_v1(uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.prepare_profile_for_auth_user_delete_v1()
from public, anon, authenticated;
grant execute on function public.prepare_profile_for_auth_user_delete_v1()
to service_role;
