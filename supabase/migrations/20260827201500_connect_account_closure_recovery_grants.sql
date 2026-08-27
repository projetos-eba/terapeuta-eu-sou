begin;

grant execute on function public.retire_therapist_connect_account_v1(
  text,
  text,
  timestamptz,
  timestamptz
) to service_role;

comment on function public.retire_therapist_connect_account_v1(text, text, timestamptz, timestamptz) is
  'Internal, idempotent closure transition. Service role only; requeues only payout items with no Transfer record and preserves all historical Transfers and Payouts.';

commit;
