begin;

-- Receipt enrichment is presentation-only. Keep it separate from settlement
-- reconciliation so repairing a missing Stripe receipt can never refresh
-- eligibility, create ledger entries or mutate refund/Transfer/Payout state.
create or replace function public.record_session_payment_receipt_url_v1(
  p_session_payment_id uuid,
  p_stripe_charge_id text,
  p_receipt_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_recorded boolean := false;
begin
  select *
  into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    raise exception 'SESSION_PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_payment.financial_status not in (
    'paid', 'partially_refunded', 'refunded', 'disputed'
  )
    or v_payment.stripe_charge_id is null
    or v_payment.stripe_charge_id <> nullif(btrim(p_stripe_charge_id), '')
  then
    raise exception 'STRIPE_CHARGE_MISMATCH' using errcode = '22023';
  end if;

  if p_receipt_url is null
    or p_receipt_url !~ '^https://pay[.]stripe[.]com/'
  then
    raise exception 'STRIPE_RECEIPT_URL_INVALID' using errcode = '22023';
  end if;

  insert into public.booking_payment_receipts (
    booking_id,
    amount_cents,
    currency,
    provider,
    receipt_url,
    paid_at
  ) values (
    v_payment.booking_id,
    v_payment.gross_amount_cents,
    v_payment.currency,
    'stripe',
    p_receipt_url,
    v_payment.paid_at
  )
  on conflict (booking_id) do update
  set receipt_url = excluded.receipt_url,
      updated_at = now()
  where public.booking_payment_receipts.receipt_url is null;

  get diagnostics v_recorded = row_count;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id,
    'receiptRecorded', v_recorded
  );
end;
$$;

revoke all on function public.record_session_payment_receipt_url_v1(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.record_session_payment_receipt_url_v1(
  uuid, text, text
) to service_role;

create or replace function public.get_session_payment_charge_reconciliation_candidates_v2(
  p_limit integer default 500
)
returns table (
  id uuid,
  stripe_charge_id text,
  needs_settlement boolean,
  needs_receipt boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    payment.id,
    payment.stripe_charge_id,
    (
      payment.financial_status in ('paid', 'partially_refunded')
      and (
        payment.stripe_balance_transaction_id is null
        or payment.stripe_balance_status is null
        or payment.stripe_balance_status = 'pending'
      )
    ) as needs_settlement,
    (
      payment.financial_status in (
        'paid', 'partially_refunded', 'refunded', 'disputed'
      )
      and (receipt.booking_id is null or receipt.receipt_url is null)
    ) as needs_receipt
  from public.session_payments as payment
  left join public.booking_payment_receipts as receipt
    on receipt.booking_id = payment.booking_id
  where payment.stripe_charge_id is not null
    and (
      (
        payment.financial_status in ('paid', 'partially_refunded')
        and (
          payment.stripe_balance_transaction_id is null
          or payment.stripe_balance_status is null
          or payment.stripe_balance_status = 'pending'
        )
      )
      or (
        payment.financial_status in (
          'paid', 'partially_refunded', 'refunded', 'disputed'
        )
        and (receipt.booking_id is null or receipt.receipt_url is null)
      )
    )
  order by payment.stripe_balance_checked_at asc nulls first,
    payment.updated_at asc,
    payment.id asc
  limit least(greatest(coalesce(p_limit, 500), 1), 500);
$$;

revoke all on function public.get_session_payment_charge_reconciliation_candidates_v2(
  integer
) from public, anon, authenticated;
grant execute on function public.get_session_payment_charge_reconciliation_candidates_v2(
  integer
) to service_role;

comment on function public.record_session_payment_receipt_url_v1(
  uuid, text, text
) is 'Preenche somente comprovante Stripe ausente após validar a Charge imutável; não altera estado financeiro, ledger, reembolso, Transfer ou Payout.';

comment on function public.get_session_payment_charge_reconciliation_candidates_v2(
  integer
) is 'Fila service-role que separa conciliação financeira de enriquecimento estritamente visual do comprovante.';

commit;
