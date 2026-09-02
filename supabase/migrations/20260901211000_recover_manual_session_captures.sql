-- Recovery inventory for manual captures whose webhook delivery or Stripe API
-- response was transiently interrupted. The maintenance Function reconciles
-- provider state; this RPC never captures or confirms money by itself.

create or replace function public.list_recoverable_session_captures_v1(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns table (
  session_payment_id uuid,
  stripe_payment_intent_id text,
  slot_claimed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    attempt.session_payment_id,
    attempt.stripe_payment_intent_id,
    attempt.slot_claimed_at
  from public.session_payment_attempts as attempt
  join public.session_payments as payment
    on payment.id = attempt.session_payment_id
   and payment.stripe_checkout_session_id = attempt.stripe_checkout_session_id
  where attempt.status = 'capture_pending'
    and attempt.slot_claimed_at is not null
    and attempt.slot_claimed_at <= p_now - interval '30 seconds'
    and attempt.stripe_payment_intent_id is not null
    and payment.financial_status = 'processing'
  order by attempt.slot_claimed_at
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.list_recoverable_session_captures_v1(
  timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.list_recoverable_session_captures_v1(
  timestamptz, integer
) to service_role;

comment on function public.list_recoverable_session_captures_v1(
  timestamptz, integer
) is 'Returns bounded current capture_pending attempts for Stripe reconciliation; service_role only.';
