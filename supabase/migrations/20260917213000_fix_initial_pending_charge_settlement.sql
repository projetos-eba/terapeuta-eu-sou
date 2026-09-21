-- A first pending observation must be recorded when the previous status is NULL.
-- This only repairs provider-state persistence; V10 Transfers remain immediate.
create or replace function public.record_session_payment_stripe_reconciliation_v2(
  p_session_payment_id uuid,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_charge_id text default null,
  p_stripe_balance_transaction_id text default null,
  p_stripe_fee_amount_cents integer default null,
  p_stripe_net_amount_cents integer default null,
  p_payment_method_type text default null,
  p_payment_origin text default 'stripe_checkout',
  p_receipt_url text default null,
  p_balance_status text default null,
  p_balance_available_on timestamptz default null,
  p_balance_currency text default null,
  p_balance_amount_cents integer default null,
  p_balance_source_charge_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_base jsonb;
  v_settlement_applied boolean := false;
begin
  select * into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  end if;

  if p_balance_status is not null then
    if p_balance_status not in ('pending', 'available')
      or nullif(trim(p_stripe_charge_id), '') is null
      or nullif(trim(p_stripe_balance_transaction_id), '') is null
      or p_balance_available_on is null
      or lower(coalesce(p_balance_currency, '')) <> lower(v_payment.currency)
      or p_balance_amount_cents <> v_payment.gross_amount_cents
      or p_balance_source_charge_id <> p_stripe_charge_id
      or (v_payment.stripe_charge_id is not null and v_payment.stripe_charge_id <> p_stripe_charge_id)
      or (v_payment.stripe_balance_transaction_id is not null
        and v_payment.stripe_balance_transaction_id <> p_stripe_balance_transaction_id)
    then
      raise exception 'STRIPE_BALANCE_TRANSACTION_MISMATCH' using errcode = '22023';
    end if;
  end if;

  v_base := public.record_session_payment_stripe_reconciliation_v1(
    p_session_payment_id, p_stripe_event_id, p_stripe_event_created_at,
    p_stripe_charge_id, p_stripe_balance_transaction_id,
    p_stripe_fee_amount_cents, p_stripe_net_amount_cents,
    p_payment_method_type, p_payment_origin, p_receipt_url
  );

  if p_balance_status is not null
    and (v_payment.stripe_balance_checked_at is null
      or p_stripe_event_created_at >= v_payment.stripe_balance_checked_at)
    and not (
      v_payment.stripe_balance_status is not distinct from 'available'
      and p_balance_status = 'pending'
    ) then
    update public.session_payments
    set stripe_balance_status = p_balance_status,
        stripe_balance_available_on = p_balance_available_on,
        stripe_balance_checked_at = p_stripe_event_created_at,
        updated_at = now()
    where id = p_session_payment_id;
    v_settlement_applied := true;
    perform public.refresh_session_transfer_eligibility(
      p_session_payment_id, p_stripe_event_created_at
    );
  end if;

  return v_base || jsonb_build_object(
    'settlementRecorded', v_settlement_applied,
    'settlementStatus', p_balance_status
  );
end;
$$;

revoke all on function public.record_session_payment_stripe_reconciliation_v2(
  uuid, text, timestamptz, text, text, integer, integer, text, text, text,
  text, timestamptz, text, integer, text
) from public, anon, authenticated;
grant execute on function public.record_session_payment_stripe_reconciliation_v2(
  uuid, text, timestamptz, text, text, integer, integer, text, text, text,
  text, timestamptz, text, integer, text
) to service_role;
