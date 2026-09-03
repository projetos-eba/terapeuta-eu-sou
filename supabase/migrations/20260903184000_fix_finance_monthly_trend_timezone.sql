alter function public.get_private_therapist_receipts_v2(
  date, date, text, uuid, text, integer, integer, text
) rename to private_therapist_receipts_v2_legacy_timezone;

revoke all on function public.private_therapist_receipts_v2_legacy_timezone(
  date, date, text, uuid, text, integer, integer, text
) from public, anon, authenticated;

create or replace function public.private_therapist_receipts_monthly_trend_v2(
  p_period_start date,
  p_period_end date,
  p_status text,
  p_therapy_id uuid,
  p_search text,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_trend jsonb := '[]'::jsonb;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  with months as (
    select
      local_month at time zone v_period.timezone as month_start,
      (local_month + interval '1 month') at time zone v_period.timezone as month_end,
      to_char(local_month, 'YYYY-MM') as month_key
    from generate_series(
      date_trunc('month', v_period.period_start::timestamp),
      date_trunc('month', v_period.period_end::timestamp),
      interval '1 month'
    ) as local_month
  ), scoped as (
    select
      payment.id,
      booking.starts_at as session_date,
      public.private_therapist_receipt_status_v2(payment.id) as receipt_status,
      greatest(
        0,
        payment.gross_amount_cents
          - payment.platform_gross_commission_cents
          - public.private_therapist_finance_refunded_cents_v1(payment.id)
      ) as net_cents
    from public.session_payments payment
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
      and (p_therapy_id is null or therapy.id = p_therapy_id)
      and (
        v_search is null
        or patient.display_name ilike '%' || v_search || '%'
        or therapy.name ilike '%' || v_search || '%'
        or booking.service_title_snapshot ilike '%' || v_search || '%'
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', months.month_key,
        'processingCents', (
          select coalesce(sum(item.net_cents), 0)::integer
          from scoped item
          where item.session_date >= months.month_start
            and item.session_date < months.month_end
            and item.receipt_status in (
              'receivable', 'waiting_confirmation', 'waiting_safety_period',
              'waiting_settlement', 'eligible', 'payout_processing', 'bank_pending'
            )
            and (p_status is null or item.receipt_status = p_status)
        ),
        'receivedCents', (
          select coalesce(sum(transfer.amount_cents), 0)::integer
          from public.stripe_transfers transfer
          join public.stripe_payout_transfer_allocations allocation
            on allocation.stripe_transfer_id = transfer.id
          join public.stripe_payouts payout
            on payout.id = allocation.stripe_payout_id
          join scoped item on item.id = transfer.session_payment_id
          where payout.status = 'paid'
            and payout.provider_reconciliation_status = 'completed'
            and payout.allocation_status = 'completed'
            and allocation.amount_cents = transfer.amount_cents
            and coalesce(payout.paid_at, payout.updated_at) >= months.month_start
            and coalesce(payout.paid_at, payout.updated_at) < months.month_end
            and (p_status is null or p_status = 'paid')
        )
      ) order by months.month_start
    ),
    '[]'::jsonb
  ) into v_trend
  from months;

  return v_trend;
end;
$$;

revoke all on function public.private_therapist_receipts_monthly_trend_v2(
  date, date, text, uuid, text, text
) from public, anon, authenticated;

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
begin
  v_payload := public.private_therapist_receipts_v2_legacy_timezone(
    p_period_start, p_period_end, p_status, p_therapy_id, p_search,
    p_page, p_page_size, p_timezone
  );

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
) is 'Recebimentos v2 com buckets mensais delimitados no fuso solicitado e totais independentes da paginacao.';
