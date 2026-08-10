-- Security Advisor / authorization surface hardening.
-- Local-first migration: keeps public catalog RPCs intentionally callable and
-- public therapist DTO views as constrained SECURITY DEFINER projections.
-- Switching those public views to security_invoker would require granting anon
-- access to base tables that also carry metadata, booking and payment columns.

alter view public.public_home_therapists
  reset (security_invoker);

alter view public.public_therapist_profile_reviews_v
  reset (security_invoker);

alter view public.public_therapist_profile_services_v
  reset (security_invoker);

alter view public.public_therapist_profiles_v
  reset (security_invoker);

alter view public.public_therapist_search
  reset (security_invoker);

alter view public.therapist_private_services_v1
  set (security_invoker = true);

alter view public.therapist_service_allowed_catalog_v1
  set (security_invoker = true);

alter view public.therapist_service_metrics_v1
  set (security_invoker = true);

revoke all on function public.admin_get_dashboard_v1()
  from public, anon, authenticated;
grant execute on function public.admin_get_dashboard_v1()
  to authenticated, service_role;

revoke all on function public.admin_get_integration_health_v1()
  from public, anon, authenticated;
grant execute on function public.admin_get_integration_health_v1()
  to authenticated, service_role;

revoke all on function public.admin_get_operation_module_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_module_v1(text, integer, integer)
  to authenticated, service_role;

revoke all on function public.admin_get_operation_module_v2(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_module_v2(text, jsonb)
  to authenticated, service_role;

revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

revoke all on function public.admin_get_finance_module_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_module_v1(text, integer, integer)
  to authenticated, service_role;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
  to authenticated, service_role;

revoke all on function public.admin_get_finance_detail_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_detail_v1(text, uuid)
  to authenticated, service_role;

revoke all on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
grant execute on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

revoke all on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
grant execute on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

revoke all on function public.get_public_therapy_therapists_v1(
  text,
  uuid[],
  uuid[],
  integer
) from public, anon, authenticated;
grant execute on function public.get_public_therapy_therapists_v1(
  text,
  uuid[],
  uuid[],
  integer
) to anon, authenticated, service_role;

revoke all on function public.get_service_available_slots_v1(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer
) from public, anon, authenticated;
grant execute on function public.get_service_available_slots_v1(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer
) to anon, authenticated, service_role;

revoke all on function public.record_public_therapist_metric_events_v1(
  uuid,
  jsonb
) from public, anon, authenticated;
grant execute on function public.record_public_therapist_metric_events_v1(
  uuid,
  jsonb
) to anon, authenticated, service_role;

comment on view public.public_home_therapists is
  'Public homepage therapist DTO. SECURITY DEFINER is intentional to avoid granting anon direct access to profile/service/payment base tables; private therapist documents and administrative fields are excluded by projection and regression tests.';

comment on view public.public_therapist_profiles_v is
  'Public therapist profile DTO. SECURITY DEFINER is intentional to avoid granting anon direct access to profile metadata/payment base tables; legal/private document fields are excluded by projection and regression tests.';

comment on view public.public_therapist_search is
  'Public therapist search DTO. SECURITY DEFINER is intentional to avoid granting anon direct access to profile/service/payment base tables; no private document, Stripe or administrative identifiers are exposed.';
