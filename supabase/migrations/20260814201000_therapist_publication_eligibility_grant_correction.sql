-- Correct execution/grant boundaries for the public eligibility wrappers.
revoke all on function public.is_public_service_booking_eligible_v1(uuid) from public;
grant execute on function public.is_therapist_publication_eligible_v1(uuid), public.is_public_service_booking_eligible_v1(uuid)
  to anon, authenticated, service_role;

alter view public.public_therapist_profile_content_v reset (security_invoker);
alter view public.public_therapist_slug_redirects_v reset (security_invoker);
