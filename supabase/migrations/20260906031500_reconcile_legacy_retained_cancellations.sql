-- Repair only the legacy projection produced when a fully retained,
-- no-review cancellation was incorrectly routed through manual refund review.

create or replace function public.reconcile_legacy_retained_cancellations_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_reconciled integer := 0;
begin
  for v_payment_id in
    select payment.id
    from public.session_payments payment
    join public.session_cancellation_decisions decision
      on decision.session_payment_id = payment.id
     and decision.booking_id = payment.booking_id
    where payment.financial_status = 'paid'
      and payment.refund_pending = true
      and payment.service_status = 'scheduled'
      and payment.transfer_status = 'blocked'
      and payment.transfer_blocked_reason = 'manual_refund_review'
      and payment.admin_blocked_at is null
      and payment.internal_contested_at is null
      and payment.disputed_at is null
      and decision.processed_at is not null
      and decision.requires_manual_review = false
      and decision.refund_amount_cents = 0
      and decision.retained_amount_cents = payment.gross_amount_cents
      and decision.therapist_retained_cents = payment.therapist_amount_cents
      and decision.platform_retained_cents = payment.platform_gross_commission_cents
    for update of payment
  loop
    update public.session_payments payment
    set canceled_at = coalesce(
          payment.canceled_at,
          (
            select coalesce(decision.processed_at, decision.created_at, p_now)
            from public.session_cancellation_decisions decision
            where decision.session_payment_id = payment.id
              and decision.processed_at is not null
              and decision.requires_manual_review = false
              and decision.refund_amount_cents = 0
            order by decision.created_at desc
            limit 1
          )
        ),
        eligible_at = null,
        refund_pending = false,
        service_confirmation_source = null,
        service_confirmed_at = coalesce(
          payment.service_confirmed_at,
          (
            select coalesce(decision.processed_at, decision.created_at, p_now)
            from public.session_cancellation_decisions decision
            where decision.session_payment_id = payment.id
              and decision.processed_at is not null
              and decision.requires_manual_review = false
              and decision.refund_amount_cents = 0
            order by decision.created_at desc
            limit 1
          )
        ),
        service_status = 'canceled',
        transfer_blocked_reason = 'retained_cancellation_pending_eligibility',
        updated_at = p_now
    where payment.id = v_payment_id;

    perform public.refresh_session_transfer_eligibility(v_payment_id, p_now);
    v_reconciled := v_reconciled + 1;
  end loop;

  return v_reconciled;
end;
$$;

revoke all on function public.reconcile_legacy_retained_cancellations_v1(timestamptz)
from public, anon, authenticated;
grant execute on function public.reconcile_legacy_retained_cancellations_v1(timestamptz)
to service_role;

select public.reconcile_legacy_retained_cancellations_v1(now());
