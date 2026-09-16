-- V10 provider events are projected atomically. This does not authorize a
-- refund or reversal, enable V10, or schedule any financial worker.

create or replace function public.reconcile_session_refund_event_v10(
  p_session_payment_id uuid,
  p_stripe_refund_id text,
  p_amount_cents integer,
  p_currency text,
  p_status text,
  p_reason text,
  p_stripe_event_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_refund public.session_refunds%rowtype;
  v_succeeded integer;
  v_pending boolean;
  v_status text;
begin
  if p_session_payment_id is null
    or nullif(trim(p_stripe_refund_id), '') is null
    or p_amount_cents is null or p_amount_cents <= 0
    or upper(coalesce(p_currency, '')) <> 'BRL'
    or p_status not in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
    or nullif(trim(p_stripe_event_id), '') is null
    or p_occurred_at is null then
    raise exception 'V10_REFUND_EVENT_INVALID' using errcode = '22023';
  end if;

  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  if not found or v_payment.payment_flow_version <> 'v10'
    or v_payment.currency <> 'BRL'
    or v_payment.gross_amount_cents < p_amount_cents
    or v_payment.stripe_charge_id is null then
    raise exception 'V10_REFUND_PAYMENT_MISMATCH' using errcode = '23514';
  end if;

  select * into v_refund from public.session_refunds
  where stripe_refund_id = p_stripe_refund_id for update;
  if found and (v_refund.session_payment_id <> v_payment.id
    or v_refund.amount_cents <> p_amount_cents
    or v_refund.currency <> 'BRL') then
    raise exception 'V10_REFUND_ID_REUSED' using errcode = '23505';
  end if;

  -- A delayed older event cannot undo a provider-confirmed refund.
  v_status := case when v_refund.status = 'succeeded' then 'succeeded'
                   else p_status end;
  if v_refund.id is null then
    insert into public.session_refunds (
      session_payment_id, stripe_refund_id, amount_cents, currency,
      status, reason, processed_at, metadata
    ) values (
      v_payment.id, p_stripe_refund_id, p_amount_cents, 'BRL',
      v_status, p_reason,
      case when v_status = 'succeeded' then p_occurred_at else null end,
      jsonb_build_object('paymentFlowVersion', 'v10')
    ) returning * into v_refund;
  elsif v_refund.status is distinct from v_status then
    update public.session_refunds
    set status = v_status,
        processed_at = case when v_status = 'succeeded' then p_occurred_at
                            else processed_at end,
        updated_at = now()
    where id = v_refund.id returning * into v_refund;
  end if;

  select coalesce(sum(amount_cents) filter (where status = 'succeeded'), 0),
         coalesce(bool_or(status in ('pending', 'requires_action')), false)
  into v_succeeded, v_pending
  from public.session_refunds where session_payment_id = v_payment.id;
  if v_succeeded > v_payment.gross_amount_cents then
    raise exception 'V10_REFUND_EXCEEDS_PAYMENT' using errcode = '23514';
  end if;

  if v_status = 'succeeded' then
    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents,
      patient_profile_id, therapist_profile_id, booking_id,
      session_payment_id, financial_policy_version_id,
      source_table, source_external_id, stripe_event_id, occurred_at
    ) values (
      'refund', 'debit', 'BRL', p_amount_cents,
      v_payment.patient_profile_id, v_payment.therapist_profile_id,
      v_payment.booking_id, v_payment.id,
      v_payment.policy_version_id, 'stripe_refunds', p_stripe_refund_id,
      p_stripe_event_id, p_occurred_at
    ) on conflict (entry_type, source_table, source_external_id, direction)
      do nothing;
  end if;

  update public.session_payments
  set financial_status = case
        when v_succeeded = gross_amount_cents then 'refunded'::public.session_financial_status
        when v_succeeded > 0 then 'partially_refunded'::public.session_financial_status
        else financial_status end,
      refund_pending = v_pending,
      updated_at = now()
  where id = v_payment.id;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id, 'refundId', v_refund.id,
    'successfulAmountCents', v_succeeded, 'refundPending', v_pending
  );
end;
$$;

create or replace function public.reconcile_session_transfer_reversal_v10(
  p_stripe_transfer_id text,
  p_stripe_reversal_id text,
  p_amount_cents integer,
  p_currency text,
  p_stripe_event_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.stripe_transfers%rowtype;
  v_payment public.session_payments%rowtype;
  v_reversal public.stripe_transfer_reversals%rowtype;
  v_reversed integer;
begin
  if nullif(trim(p_stripe_transfer_id), '') is null
    or nullif(trim(p_stripe_reversal_id), '') is null
    or p_amount_cents is null or p_amount_cents <= 0
    or upper(coalesce(p_currency, '')) <> 'BRL'
    or nullif(trim(p_stripe_event_id), '') is null
    or p_occurred_at is null then
    raise exception 'V10_REVERSAL_EVENT_INVALID' using errcode = '22023';
  end if;

  select * into v_transfer from public.stripe_transfers
  where stripe_transfer_id = p_stripe_transfer_id for update;
  if not found or v_transfer.transfer_origin <> 'session_direct'
    or v_transfer.amount_cents < p_amount_cents then
    raise exception 'V10_REVERSAL_TRANSFER_MISMATCH' using errcode = '23514';
  end if;
  select * into v_payment from public.session_payments
  where id = v_transfer.session_payment_id for update;
  if not found or v_payment.payment_flow_version <> 'v10'
    or v_payment.stripe_charge_id is distinct from v_transfer.stripe_source_charge_id then
    raise exception 'V10_REVERSAL_PAYMENT_MISMATCH' using errcode = '23514';
  end if;

  select * into v_reversal from public.stripe_transfer_reversals
  where stripe_transfer_reversal_id = p_stripe_reversal_id for update;
  if found and (v_reversal.stripe_transfer_id <> v_transfer.id
    or v_reversal.amount_cents <> p_amount_cents
    or v_reversal.currency <> 'BRL') then
    raise exception 'V10_REVERSAL_ID_REUSED' using errcode = '23505';
  end if;
  if v_reversal.id is null then
    insert into public.stripe_transfer_reversals (
      stripe_transfer_id, stripe_transfer_reversal_id, amount_cents,
      currency, reason, status, metadata
    ) values (
      v_transfer.id, p_stripe_reversal_id, p_amount_cents,
      'BRL', 'refund', 'succeeded',
      jsonb_build_object('paymentFlowVersion', 'v10')
    ) returning * into v_reversal;
  end if;

  select coalesce(sum(amount_cents), 0) into v_reversed
  from public.stripe_transfer_reversals
  where stripe_transfer_id = v_transfer.id and status = 'succeeded';
  if v_reversed > v_transfer.amount_cents then
    raise exception 'V10_REVERSAL_EXCEEDS_TRANSFER' using errcode = '23514';
  end if;

  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents,
    patient_profile_id, therapist_profile_id, booking_id,
    session_payment_id, stripe_transfer_id, financial_policy_version_id,
    transfer_origin, source_table, source_external_id,
    stripe_event_id, occurred_at
  ) values (
    'transfer_reversal', 'credit', 'BRL', p_amount_cents,
    v_payment.patient_profile_id, v_payment.therapist_profile_id,
    v_payment.booking_id, v_payment.id, v_transfer.id,
    v_payment.policy_version_id, 'session_direct',
    'stripe_transfer_reversals', p_stripe_reversal_id,
    p_stripe_event_id, p_occurred_at
  ) on conflict (entry_type, source_table, source_external_id, direction)
    do nothing;

  update public.stripe_transfers
  set status = case when v_reversed = amount_cents then 'reversed'
                    else 'partially_reversed' end,
      updated_at = now()
  where id = v_transfer.id;
  update public.session_transfer_jobs
  set status = case when v_reversed = v_transfer.amount_cents then 'reversed'
                    else 'partially_reversed' end,
      updated_at = now()
  where stripe_transfer_id = v_transfer.id;
  if v_reversed = v_transfer.amount_cents then
    update public.session_payments
    set transfer_status = 'reversed',
        transfer_blocked_reason = 'transfer_reversed', updated_at = now()
    where id = v_payment.id;
  end if;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id, 'transferId', v_transfer.id,
    'reversedAmountCents', v_reversed,
    'fullyReversed', v_reversed = v_transfer.amount_cents
  );
end;
$$;

revoke all on function public.reconcile_session_refund_event_v10(
  uuid, text, integer, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_session_refund_event_v10(
  uuid, text, integer, text, text, text, text, timestamptz
) to service_role;
revoke all on function public.reconcile_session_transfer_reversal_v10(
  text, text, integer, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.reconcile_session_transfer_reversal_v10(
  text, text, integer, text, text, timestamptz
) to service_role;
