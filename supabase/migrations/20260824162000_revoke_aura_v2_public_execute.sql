-- CREATE FUNCTION grants EXECUTE to PUBLIC unless it is explicitly revoked.
-- Keep the Aura v2 boundary authenticated-only.

revoke all on function public.get_therapist_aura_signals_v2(integer)
from public;
revoke all on function public.dismiss_therapist_aura_signal_v2(
  text,
  timestamptz,
  timestamptz,
  uuid
)
from public;

grant execute on function public.get_therapist_aura_signals_v2(integer)
to authenticated;
grant execute on function public.dismiss_therapist_aura_signal_v2(
  text,
  timestamptz,
  timestamptz,
  uuid
)
to authenticated;
