-- A V10 payment fully consumed by a therapist debt offset has no bank Transfer.
-- Keep the historical payment transfer marker for compatibility, but project an
-- explicit receipt state so it cannot be mistaken for money on its way to bank.
create or replace function public.private_therapist_receipt_status_v2(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when payment.financial_status = 'disputed' or payment.disputed_at is not null then 'disputed'
    when payment.financial_status = 'refunded' then 'refunded'
    when payment.financial_status = 'canceled' then 'canceled'
    when payment.financial_status = 'failed' then 'failed'
    when payment.transfer_status = 'reversed' then 'reversed'
    when payment.transfer_status = 'failed' then 'failed'
    when payment.transfer_status = 'blocked' then 'blocked'
    when exists (
      select 1
      from public.session_transfer_jobs job
      where job.session_payment_id = payment.id
        and job.status = 'offset_only'
        and job.transfer_amount_cents = 0
        and job.debt_offset_amount_cents = job.therapist_gross_amount_cents
        and job.succeeded_at is not null
    ) then 'compensated'
    when exists (
      select 1
      from public.stripe_transfers transfer
      join public.stripe_payout_transfer_allocations allocation
        on allocation.stripe_transfer_id = transfer.id
      join public.stripe_payouts payout
        on payout.id = allocation.stripe_payout_id
      where transfer.session_payment_id = payment.id
        and transfer.status = 'transferred'
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
        and allocation.amount_cents = transfer.amount_cents
    ) then 'paid'
    when payment.transfer_status = 'transferred' then 'bank_pending'
    when payment.transfer_status in ('batched', 'transfer_pending') then 'payout_processing'
    when payment.transfer_status = 'eligible' then 'eligible'
    when payment.transfer_status in ('waiting_settlement', 'waiting_safety_period') then 'waiting_settlement'
    when payment.financial_status in ('paid', 'partially_refunded')
      and booking.starts_at > p_now then 'receivable'
    when payment.transfer_status = 'waiting_confirmation' then 'waiting_confirmation'
    when payment.financial_status in ('paid', 'partially_refunded') then 'waiting_confirmation'
    else 'receivable'
  end
  from public.session_payments payment
  join public.bookings booking on booking.id = payment.booking_id
  where payment.id = p_session_payment_id;
$$;

revoke all on function public.private_therapist_receipt_status_v2(uuid, timestamptz)
from public, anon, authenticated;

-- The legacy read model already excludes unknown statuses from processing and
-- monthly totals. Normalize the visible item amount and remove the zero-value
-- compensated status from the distribution chart.
create or replace function public.get_private_therapist_receipts_v2(
  p_period_start date default null,
  p_period_end date default null,
  p_status text default null,
  p_therapy_id uuid default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_items jsonb;
  v_distribution jsonb;
begin
  v_payload := public.private_therapist_receipts_v2_legacy_timezone(
    p_period_start, p_period_end, p_status, p_therapy_id, p_search,
    p_page, p_page_size, p_timezone
  );

  select coalesce(
    jsonb_agg(
      case
        when item ->> 'receiptStatus' = 'compensated'
          then jsonb_set(item, '{therapistNetAmountCents}', '0'::jsonb, true)
        else item
      end order by ordinal
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb))
    with ordinality as rows(item, ordinal);

  select coalesce(jsonb_agg(item order by ordinal), '[]'::jsonb)
  into v_distribution
  from jsonb_array_elements(
    coalesce(v_payload -> 'statusDistribution', '[]'::jsonb)
  ) with ordinality as rows(item, ordinal)
  where item ->> 'status' <> 'compensated'
    and coalesce((item ->> 'amountCents')::integer, 0) > 0;

  v_payload := jsonb_set(v_payload, '{items}', v_items, true);
  v_payload := jsonb_set(v_payload, '{statusDistribution}', v_distribution, true);

  return jsonb_set(
    v_payload,
    '{monthlyTrend}',
    public.private_therapist_receipts_monthly_trend_v2(
      p_period_start, p_period_end, p_status, p_therapy_id, p_search, p_timezone
    ),
    true
  );
end;
$$;

revoke all on function public.get_private_therapist_receipts_v2(
  date, date, text, uuid, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_receipts_v2(
  date, date, text, uuid, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_receipts_v2(
  date, date, text, uuid, text, integer, integer, text
) is 'Recebimentos v2 com compensacoes integrais sem deposito bancario e totais independentes da paginacao.';
