-- The standalone benchmark RPC is legacy. The therapist finance UI no longer
-- exposes benchmarking, and the active Premium Plus finance surface consumes
-- the consolidated advanced dashboard contract instead. Keep this wrapper out
-- of the authenticated Data API surface so SECURITY DEFINER benchmark logic is
-- not callable as an independent endpoint.
revoke execute on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) from public;
revoke execute on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) from anon;
revoke execute on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) from authenticated;
revoke execute on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) from service_role;

comment on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) is
  'LEGACY_UNUSED standalone benchmark wrapper. Direct Data API execution is revoked; do not re-enable without a new product/privacy decision.';
