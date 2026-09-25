begin;

-- Financial dashboards describe realized therapist revenue. A fully refunded
-- payment contributes zero, while partial refunds can never make the session
-- contribution negative. This helper changes no ledger, debt, Transfer or
-- Payout state; it is only used by private read models.
create or replace function public.private_therapist_finance_realized_net_cents_v2(
  p_payment public.session_payments
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_payment.financial_status = 'refunded' then 0
    else greatest(
      coalesce(
        p_payment.therapist_amount_cents,
        p_payment.gross_amount_cents - p_payment.platform_gross_commission_cents
      ) - public.private_therapist_finance_refunded_cents_v1(p_payment.id),
      0
    )::integer
  end;
$$;

revoke all on function public.private_therapist_finance_realized_net_cents_v2(
  public.session_payments
) from public, anon, authenticated;

-- Keep the existing advanced-dashboard contract coherent for any server-side
-- consumer that still calls V1. The signature and permissions remain intact.
create or replace function public.private_therapist_finance_net_cents_v1(
  p_payment public.session_payments
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.private_therapist_finance_realized_net_cents_v2(p_payment);
$$;

revoke all on function public.private_therapist_finance_net_cents_v1(
  public.session_payments
) from public, anon, authenticated;

-- Receipts V5 keeps the charge lifecycle from V4 and adds the immutable V10
-- split prepared by the Transfer worker. Null means the payment has no V10 job
-- (for example, a historical V9 payment); zero remains a meaningful amount.
create or replace function public.get_private_therapist_receipts_v5(
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
begin
  v_payload := public.get_private_therapist_receipts_v4(
    p_period_start,
    p_period_end,
    p_status,
    p_therapy_id,
    p_search,
    p_page,
    p_page_size,
    p_timezone
  );

  select coalesce(
    jsonb_agg(
      rows.item || jsonb_build_object(
        'debtOffsetAmountCents', job.debt_offset_amount_cents,
        'bankTransferAmountCents', job.transfer_amount_cents
      ) order by rows.ordinal
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb))
    with ordinality as rows(item, ordinal)
  left join lateral (
    select
      transfer_job.debt_offset_amount_cents,
      transfer_job.transfer_amount_cents
    from public.session_transfer_jobs as transfer_job
    where transfer_job.session_payment_id = (rows.item ->> 'sessionPaymentId')::uuid
    order by transfer_job.created_at desc, transfer_job.id desc
    limit 1
  ) as job on true;

  v_payload := jsonb_set(v_payload, '{items}', v_items, true);
  return jsonb_set(v_payload, '{contractVersion}', '5'::jsonb, true);
end;
$$;

revoke all on function public.get_private_therapist_receipts_v5(
  date, date, text, uuid, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_receipts_v5(
  date, date, text, uuid, text, integer, integer, text
) to authenticated;

-- Overview V3 preserves the operational positions from V2, while the revenue
-- block uses the payment cohort and excludes fully refunded sessions. Refunds
-- processed in the selected period remain visible in their dedicated card.
create or replace function public.get_private_therapist_financial_overview_v3(
  p_period_start date default null,
  p_period_end date default null,
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_gross_paid_cents integer := 0;
  v_tes_commission_cents integer := 0;
  v_therapist_net_cents integer := 0;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  v_payload := public.get_private_therapist_financial_overview_v2(
    p_period_start, p_period_end, p_timezone
  );

  select
    coalesce(sum(payment.gross_amount_cents), 0)::integer,
    coalesce(sum(payment.platform_gross_commission_cents), 0)::integer,
    coalesce(sum(
      public.private_therapist_finance_realized_net_cents_v2(payment)
    ), 0)::integer
  into
    v_gross_paid_cents,
    v_tes_commission_cents,
    v_therapist_net_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
    and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

  return v_payload || jsonb_build_object(
    'contractVersion', 3,
    'grossPaidCents', v_gross_paid_cents,
    'tesCommissionCents', v_tes_commission_cents,
    'therapistNetCents', v_therapist_net_cents
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_overview_v3(
  date, date, text
) from public, anon;
grant execute on function public.get_private_therapist_financial_overview_v3(
  date, date, text
) to authenticated;

-- F2 metrics V2 retains attendance, cancellation, rescheduling and retention
-- from V1. Only the realized-revenue cohort is corrected: fully refunded
-- sessions are absent from "Sessões pagas" and all monetary contributions are
-- bounded at zero.
create or replace function public.get_private_therapist_financial_metrics_v2(
  p_period_start date default null,
  p_period_end date default null,
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_period_days integer;
  v_previous_period_start date;
  v_previous_period_end date;
  v_previous_starts_at timestamptz;
  v_gross_paid_cents integer := 0;
  v_previous_gross_paid_cents integer := 0;
  v_therapist_net_cents integer := 0;
  v_previous_therapist_net_cents integer := 0;
  v_paid_session_count integer := 0;
  v_previous_paid_session_count integer := 0;
  v_gross_average_ticket_cents integer;
  v_net_average_ticket_cents integer;
  v_previous_net_average_ticket_cents integer;
  v_revenue_by_therapy jsonb := '[]'::jsonb;
  v_financial_evolution jsonb := '[]'::jsonb;
begin
  v_payload := public.get_private_therapist_financial_metrics_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  v_period_days := (v_period.period_end - v_period.period_start) + 1;
  v_previous_period_end := v_period.period_start - 1;
  v_previous_period_start := v_previous_period_end - (v_period_days - 1);
  v_previous_starts_at :=
    v_previous_period_start::timestamp at time zone v_period.timezone;

  with realized_rows as (
    select
      case
        when coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
          then 'current'
        else 'previous'
      end as period_key,
      payment.gross_amount_cents,
      public.private_therapist_finance_realized_net_cents_v2(payment) as net_cents
    from public.session_payments as payment
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
      and coalesce(payment.paid_at, payment.created_at) >= v_previous_starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  )
  select
    coalesce(sum(gross_amount_cents) filter (where period_key = 'current'), 0)::integer,
    coalesce(sum(gross_amount_cents) filter (where period_key = 'previous'), 0)::integer,
    coalesce(sum(net_cents) filter (where period_key = 'current'), 0)::integer,
    coalesce(sum(net_cents) filter (where period_key = 'previous'), 0)::integer,
    count(*) filter (where period_key = 'current')::integer,
    count(*) filter (where period_key = 'previous')::integer
  into
    v_gross_paid_cents,
    v_previous_gross_paid_cents,
    v_therapist_net_cents,
    v_previous_therapist_net_cents,
    v_paid_session_count,
    v_previous_paid_session_count
  from realized_rows;

  v_gross_average_ticket_cents := case
    when v_paid_session_count = 0 then null
    else round(v_gross_paid_cents::numeric / v_paid_session_count)::integer
  end;
  v_net_average_ticket_cents := case
    when v_paid_session_count = 0 then null
    else round(v_therapist_net_cents::numeric / v_paid_session_count)::integer
  end;
  v_previous_net_average_ticket_cents := case
    when v_previous_paid_session_count = 0 then null
    else round(
      v_previous_therapist_net_cents::numeric / v_previous_paid_session_count
    )::integer
  end;

  with realized_rows as (
    select
      service.therapy_id,
      coalesce(therapy.name, booking.service_title_snapshot) as therapy_name_snapshot,
      payment.gross_amount_cents,
      public.private_therapist_finance_realized_net_cents_v2(payment) as net_cents
    from public.session_payments as payment
    join public.bookings as booking on booking.id = payment.booking_id
    join public.therapist_services as service on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  ), grouped as (
    select
      therapy_id,
      max(therapy_name_snapshot) as therapy_name_snapshot,
      count(*)::integer as paid_session_count,
      sum(gross_amount_cents)::integer as gross_amount_cents,
      sum(net_cents)::integer as therapist_net_amount_cents
    from realized_rows
    group by therapy_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'therapyId', grouped.therapy_id,
      'therapyNameSnapshot', grouped.therapy_name_snapshot,
      'paidSessionCount', grouped.paid_session_count,
      'grossAmountCents', grouped.gross_amount_cents,
      'therapistNetAmountCents', grouped.therapist_net_amount_cents,
      'averageTicketCents', case
        when grouped.paid_session_count = 0 then null
        else round(
          grouped.gross_amount_cents::numeric / grouped.paid_session_count
        )::integer
      end
    ) order by grouped.therapist_net_amount_cents desc, grouped.therapy_name_snapshot
  ), '[]'::jsonb)
  into v_revenue_by_therapy
  from (
    select * from grouped
    order by therapist_net_amount_cents desc, therapy_name_snapshot
    limit 6
  ) as grouped;

  with buckets as (
    select
      bucket_start::date as period_start,
      least(bucket_start::date + 6, v_period.period_end)::date as period_end
    from generate_series(
      v_period.period_start, v_period.period_end, interval '7 days'
    ) as bucket(bucket_start)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'periodStart', bucket.period_start,
      'periodEnd', bucket.period_end,
      'grossAmountCents', coalesce((
        select sum(payment.gross_amount_cents)::integer
        from public.session_payments as payment
        where payment.therapist_profile_id = v_therapist.id
          and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
          and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
            between bucket.period_start and bucket.period_end
      ), 0),
      'therapistNetAmountCents', coalesce((
        select sum(
          public.private_therapist_finance_realized_net_cents_v2(payment)
        )::integer
        from public.session_payments as payment
        where payment.therapist_profile_id = v_therapist.id
          and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
          and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
            between bucket.period_start and bucket.period_end
      ), 0),
      'previousPeriodNetAmountCents', (
        select coalesce(sum(
          public.private_therapist_finance_realized_net_cents_v2(payment)
        ), 0)::integer
        from public.session_payments as payment
        where payment.therapist_profile_id = v_therapist.id
          and payment.financial_status in ('paid', 'partially_refunded', 'disputed')
          and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
            between (
              v_previous_period_start + (bucket.period_start - v_period.period_start)
            ) and least(
              v_previous_period_start + (bucket.period_end - v_period.period_start),
              v_previous_period_end
            )
      )
    ) order by bucket.period_start
  ), '[]'::jsonb)
  into v_financial_evolution
  from buckets as bucket;

  return v_payload || jsonb_build_object(
    'contractVersion', 2,
    'metricDefinitionVersion', 2,
    'revenue', jsonb_build_object(
      'grossPaidCents', v_gross_paid_cents,
      'therapistNetCents', v_therapist_net_cents,
      'paidSessionCount', v_paid_session_count,
      'grossAverageTicketCents', v_gross_average_ticket_cents,
      'netAverageTicketCents', v_net_average_ticket_cents,
      'comparison', jsonb_build_object(
        'grossPaid', public.private_therapist_finance_metric_comparison_v1(
          v_gross_paid_cents, v_previous_gross_paid_cents,
          v_paid_session_count > 0, v_previous_paid_session_count > 0
        ),
        'therapistNet', public.private_therapist_finance_metric_comparison_v1(
          v_therapist_net_cents, v_previous_therapist_net_cents,
          v_paid_session_count > 0, v_previous_paid_session_count > 0
        ),
        'paidSessions', public.private_therapist_finance_metric_comparison_v1(
          v_paid_session_count, v_previous_paid_session_count,
          v_paid_session_count > 0, v_previous_paid_session_count > 0
        ),
        'averageTicket', public.private_therapist_finance_metric_comparison_v1(
          coalesce(v_net_average_ticket_cents, 0),
          v_previous_net_average_ticket_cents,
          v_paid_session_count > 0, v_previous_paid_session_count > 0
        )
      )
    ),
    'revenueByTherapy', v_revenue_by_therapy,
    'financialEvolution', v_financial_evolution
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_metrics_v2(
  date, date, text
) from public, anon;
grant execute on function public.get_private_therapist_financial_metrics_v2(
  date, date, text
) to authenticated;

-- Premium Plus V2 inherits all capacity, retention and forecast rules from V1.
-- The corrected net helper above fixes realized values; this wrapper rebuilds
-- the only collection that also exposes a paid-session count.
create or replace function public.get_private_therapist_advanced_financial_dashboard_v2(
  p_period_start date default null,
  p_period_end date default null,
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_period_days integer;
  v_previous_period_start date;
  v_previous_period_end date;
  v_revenue_by_therapy jsonb := '[]'::jsonb;
begin
  v_payload := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_period_days := (v_period.period_end - v_period.period_start) + 1;
  v_previous_period_end := v_period.period_start - 1;
  v_previous_period_start := v_previous_period_end - (v_period_days - 1);

  with current_paid as (
    select
      service.therapy_id,
      coalesce(therapy.name, booking.service_title_snapshot) as therapy_name_snapshot,
      payment.gross_amount_cents,
      public.private_therapist_finance_realized_net_cents_v2(payment) as net_cents
    from public.session_payments as payment
    join public.bookings as booking on booking.id = payment.booking_id
    join public.therapist_services as service on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in ('paid', 'partially_refunded')
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  ), previous_paid as (
    select
      service.therapy_id,
      public.private_therapist_finance_realized_net_cents_v2(payment) as net_cents
    from public.session_payments as payment
    join public.therapist_services as service on service.id = payment.service_id
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in ('paid', 'partially_refunded')
      and coalesce(payment.paid_at, payment.created_at) >=
        (v_previous_period_start::timestamp at time zone v_period.timezone)
      and coalesce(payment.paid_at, payment.created_at) <
        ((v_previous_period_end + 1)::timestamp at time zone v_period.timezone)
  ), current_grouped as (
    select
      therapy_id,
      max(therapy_name_snapshot) as therapy_name_snapshot,
      count(*)::integer as paid_session_count,
      sum(gross_amount_cents)::integer as gross_amount_cents,
      sum(net_cents)::integer as therapist_net_amount_cents
    from current_paid
    group by therapy_id
  ), previous_grouped as (
    select therapy_id, sum(net_cents)::integer as previous_net_cents
    from previous_paid
    group by therapy_id
  ), total_current as (
    select greatest(coalesce(sum(therapist_net_amount_cents), 0), 0)::numeric as total_net
    from current_grouped
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'therapyId', current_grouped.therapy_id,
      'therapyNameSnapshot', current_grouped.therapy_name_snapshot,
      'paidSessionCount', current_grouped.paid_session_count,
      'grossAmountCents', current_grouped.gross_amount_cents,
      'therapistNetAmountCents', current_grouped.therapist_net_amount_cents,
      'averageTicketCents', case
        when current_grouped.paid_session_count = 0 then null
        else round(
          current_grouped.gross_amount_cents::numeric / current_grouped.paid_session_count
        )::integer
      end,
      'revenueSharePercent', case
        when total_current.total_net <= 0 then null
        else round(
          current_grouped.therapist_net_amount_cents::numeric * 100
          / total_current.total_net,
          1
        )
      end,
      'trend', public.private_therapist_finance_advanced_comparison_v1(
        current_grouped.therapist_net_amount_cents,
        coalesce(previous_grouped.previous_net_cents, 0)
      )
    ) order by current_grouped.therapist_net_amount_cents desc,
      current_grouped.therapy_name_snapshot
  ), '[]'::jsonb)
  into v_revenue_by_therapy
  from current_grouped
  cross join total_current
  left join previous_grouped
    on previous_grouped.therapy_id is not distinct from current_grouped.therapy_id;

  return jsonb_set(
    v_payload || jsonb_build_object('contractVersion', 2),
    '{revenueByTherapy}',
    v_revenue_by_therapy,
    true
  );
end;
$$;

revoke all on function public.get_private_therapist_advanced_financial_dashboard_v2(
  date, date, text
) from public, anon;
grant execute on function public.get_private_therapist_advanced_financial_dashboard_v2(
  date, date, text
) to authenticated;

-- The reconciliation worker uses this private queue for both settlement and
-- receipt repair. Missing receipts are selected only for a terminal successful
-- charge with an immutable local Charge id. The worker retrieves that same
-- Charge from Stripe before it can fill the URL.
create or replace function public.get_session_payment_charge_reconciliation_candidates_v1(
  p_limit integer default 500
)
returns table (
  id uuid,
  stripe_charge_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select payment.id, payment.stripe_charge_id
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

revoke all on function public.get_session_payment_charge_reconciliation_candidates_v1(
  integer
) from public, anon, authenticated;
grant execute on function public.get_session_payment_charge_reconciliation_candidates_v1(
  integer
) to service_role;

comment on function public.get_private_therapist_receipts_v5(
  date, date, text, uuid, text, integer, integer, text
) is 'Recebimentos V5: preserva cobrança e expõe separadamente compensação V10 e valor efetivamente encaminhado.';

comment on function public.get_private_therapist_financial_overview_v3(
  date, date, text
) is 'Resumo financeiro V3: exclui reembolsos integrais da receita realizada e preserva reembolsos do período em indicador próprio.';

comment on function public.get_private_therapist_financial_metrics_v2(
  date, date, text
) is 'Métricas F2 V2: exclui sessões integralmente reembolsadas da contagem paga e impede receita líquida negativa por sessão.';

comment on function public.get_private_therapist_advanced_financial_dashboard_v2(
  date, date, text
) is 'Dashboard F3 V2: preserva projeções e corrige receita realizada e contagem paga após reembolso integral.';

comment on function public.get_session_payment_charge_reconciliation_candidates_v1(
  integer
) is 'Fila service-role para conciliar saldo Stripe e enriquecer apenas comprovantes ausentes usando a Charge já vinculada.';

commit;
