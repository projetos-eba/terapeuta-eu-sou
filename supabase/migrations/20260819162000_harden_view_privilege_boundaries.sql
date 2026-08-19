-- Views are read models. PostgreSQL default privileges in this local Supabase
-- project grant DML/DDL privileges to API roles when a view is recreated, so
-- restore an explicit read-only matrix and make future relations fail closed.

revoke all on
  public.public_home_testimonials,
  public.public_home_therapies,
  public.public_home_therapists,
  public.public_matching_config,
  public.public_matching_therapies_v,
  public.public_matching_therapist_counts,
  public.public_matching_therapy_themes_v,
  public.public_therapies_v,
  public.public_therapist_profile_content_v,
  public.public_therapist_profile_reviews_v,
  public.public_therapist_profile_services_v,
  public.public_therapist_profiles_v,
  public.public_therapist_search,
  public.public_therapist_slug_redirects_v,
  public.public_therapy_details_v,
  public.public_therapy_slug_redirects_v
from public, anon, authenticated, service_role;

grant select on
  public.public_home_testimonials,
  public.public_home_therapies,
  public.public_home_therapists,
  public.public_matching_config,
  public.public_matching_therapies_v,
  public.public_matching_therapist_counts,
  public.public_matching_therapy_themes_v,
  public.public_therapies_v,
  public.public_therapist_profile_content_v,
  public.public_therapist_profile_reviews_v,
  public.public_therapist_profile_services_v,
  public.public_therapist_profiles_v,
  public.public_therapist_search,
  public.public_therapist_slug_redirects_v,
  public.public_therapy_details_v,
  public.public_therapy_slug_redirects_v
to anon, authenticated, service_role;

revoke all on
  public.patient_video_session_summary_v,
  public.therapist_session_read_model_v1,
  public.therapist_video_session_summary_v
from public, anon, authenticated, service_role;

grant select on
  public.patient_video_session_summary_v,
  public.therapist_session_read_model_v1,
  public.therapist_video_session_summary_v
to authenticated;

revoke all on
  public.therapist_private_services_v1,
  public.therapist_service_allowed_catalog_v1,
  public.therapist_service_metrics_v1
from public, anon, authenticated, service_role;

grant select on
  public.therapist_private_services_v1,
  public.therapist_service_allowed_catalog_v1,
  public.therapist_service_metrics_v1
to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
