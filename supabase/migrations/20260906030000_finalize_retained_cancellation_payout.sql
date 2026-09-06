-- A cancellation with zero refund and no manual review is a finalized retained
-- settlement, not a pending refund. Keep the service visibly canceled while
-- allowing only a fully reconciled, processed decision into payout eligibility.

create or replace function public.is_fully_retained_cancellation_payment_v1(
  p_session_payment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_payments payment
    join public.session_cancellation_decisions decision
      on decision.session_payment_id = payment.id
     and decision.booking_id = payment.booking_id
    where payment.id = p_session_payment_id
      and payment.financial_status = 'paid'
      and payment.refund_pending = false
      and payment.service_status = 'canceled'
      and decision.processed_at is not null
      and decision.requires_manual_review = false
      and decision.refund_amount_cents = 0
      and decision.retained_amount_cents = payment.gross_amount_cents
      and decision.therapist_retained_cents = payment.therapist_amount_cents
      and decision.platform_retained_cents = payment.platform_gross_commission_cents
  );
$$;

revoke all on function public.is_fully_retained_cancellation_payment_v1(uuid)
from public, anon, authenticated;
grant execute on function public.is_fully_retained_cancellation_payment_v1(uuid)
to service_role;

create or replace function public.refresh_session_transfer_eligibility(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns public.session_transfer_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_connect_ready boolean;
  v_has_active_batch boolean;
  v_eligible_at timestamptz;
  v_status public.session_transfer_status;
  v_reason text;
begin
  select * into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    raise exception 'session_payment_not_found';
  end if;

  select exists (
    select 1
    from public.therapist_connect_accounts account
    where account.therapist_profile_id = v_payment.therapist_profile_id
      and account.is_current = true
      and account.stripe_transfers_status = 'active'
      and account.payouts_enabled = true
      and account.payout_status = 'enabled'
      and account.payout_schedule_interval = 'daily'
      and account.operational_status = 'ready'
  ) into v_connect_ready;

  select exists (
    select 1
    from public.payout_batch_items
    where session_payment_id = p_session_payment_id
      and status in ('reserved', 'transfer_pending', 'transferred')
  ) into v_has_active_batch;

  if v_payment.transfer_status = 'transferred' then
    v_status := 'transferred';
    v_reason := 'already_transferred';
  elsif v_has_active_batch then
    v_status := 'batched';
    v_reason := 'already_batched';
  elsif v_payment.financial_status = 'disputed' or v_payment.disputed_at is not null then
    v_status := 'blocked';
    v_reason := 'disputed';
  elsif v_payment.admin_blocked_at is not null or v_payment.internal_contested_at is not null then
    v_status := 'blocked';
    v_reason := coalesce(v_payment.transfer_blocked_reason, 'blocked_or_contested');
  elsif v_payment.refund_pending or v_payment.financial_status = 'refunded' then
    v_status := 'blocked';
    v_reason := 'refund';
  elsif v_payment.financial_status not in ('paid', 'partially_refunded') then
    v_status := 'not_eligible';
    v_reason := 'payment_not_confirmed';
  elsif (
      v_payment.service_status not in (
        'confirmed_bilateral',
        'confirmed_by_patient_review',
        'confirmed_by_therapist',
        'auto_confirmed'
      )
      and not (
        v_payment.service_status = 'canceled'
        and public.is_fully_retained_cancellation_payment_v1(v_payment.id)
      )
    ) or v_payment.service_confirmed_at is null
      or v_payment.service_confirmed_at > p_now then
    v_status := 'waiting_confirmation';
    v_reason := 'service_not_confirmed';
  elsif not v_connect_ready then
    v_status := 'blocked';
    v_reason := 'connect_not_ready';
  elsif v_payment.therapist_amount_cents <= 0 then
    v_status := 'not_eligible';
    v_reason := 'non_positive_transfer_amount';
  else
    v_eligible_at := v_payment.service_confirmed_at;
    if v_payment.stripe_charge_id is null
      or v_payment.stripe_balance_transaction_id is null
      or v_payment.stripe_balance_status is distinct from 'available'
      or v_payment.stripe_balance_available_on is null
      or v_payment.stripe_balance_available_on > p_now
      or v_payment.stripe_balance_checked_at is null
      or v_payment.stripe_balance_checked_at < p_now - interval '2 hours' then
      v_status := 'waiting_settlement';
      v_reason := 'stripe_settlement_pending';
    else
      v_status := 'eligible';
      v_reason := 'eligible';
    end if;
  end if;

  update public.session_payments
  set transfer_status = v_status,
      eligible_at = case
        when v_status in ('waiting_settlement', 'eligible') then v_eligible_at
        when v_status in ('batched', 'transfer_pending', 'transferred') then eligible_at
        else null
      end,
      transfer_blocked_reason = v_reason,
      updated_at = now()
  where id = p_session_payment_id;

  return v_status;
end;
$$;

revoke all on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
to service_role;
