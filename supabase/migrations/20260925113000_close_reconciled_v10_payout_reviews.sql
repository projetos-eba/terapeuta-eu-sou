begin;

-- V8 keeps the V7 bank-arrival and unpaid-payment safeguards. It corrects two
-- presentation edges without changing money movement: a V10 payment whose customer
-- refund and direct Transfer reversal are both uniquely and fully reconciled
-- is financially closed and must not remain under review; an already allocated
-- Payout remains in transit/received when refund recovery became therapist
-- debt. Any partial, ambiguous or unresolved case remains fail-closed.
create or replace function public.get_private_therapist_payouts_v8(
  p_period_start date default null,
  p_period_end date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null,
  p_agenda_days integer default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_therapist_id uuid;
  v_period record;
  v_timezone text;
  v_today date;
  v_agenda_end date;
  v_period_start_date date;
  v_period_end_date date;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_history_items jsonb := '[]'::jsonb;
  v_predicted jsonb := '[]'::jsonb;
  v_in_transit jsonb := '[]'::jsonb;
  v_available jsonb := '[]'::jsonb;
  v_without_bank_date jsonb := '[]'::jsonb;
  v_expected_cents integer := 0;
  v_in_transit_cents integer := 0;
begin
  v_base := public.get_private_therapist_payouts_v7(
    p_period_start,
    p_period_end,
    p_page,
    p_page_size,
    p_timezone,
    p_agenda_days
  );
  v_therapist_id := (v_base ->> 'therapistProfileId')::uuid;
  v_timezone := v_base -> 'filters' ->> 'timezone';
  v_today := (v_base -> 'agenda' ->> 'periodStart')::date;
  v_agenda_end := (v_base -> 'agenda' ->> 'periodEnd')::date;
  v_offset := (v_page - 1) * v_page_size;

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_period_start_date :=
    (v_period.starts_at at time zone v_period.timezone)::date;
  v_period_end_date :=
    (v_period.ends_at at time zone v_period.timezone)::date;

  -- Preserve the bank lifecycle after a refund only when the provider money
  -- was already bound to a full Payout allocation and recovery is represented
  -- by an open therapist debt. Unallocated/refundable value keeps the prior
  -- fail-closed behavior and never becomes a bank promise.
  with remaining as (
    select
      transfer.id,
      payment.id as session_payment_id,
      payment.booking_id,
      booking.starts_at as session_date,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      greatest(
        0,
        transfer.amount_cents - coalesce(reversed.amount_cents, 0)
      )::integer as amount_cents,
      case
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        when allocation.id is null
          and transfer.connected_balance_available_on is not null
          then (
            transfer.connected_balance_available_on at time zone v_timezone
          )::date
        else null::date
      end as forecast_date,
      case
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          and (
            payout.status in ('pending', 'in_transit')
            or (
              payout.status = 'paid'
              and payout.provider_reconciliation_status = 'completed'
              and payout.allocation_status = 'completed'
              and allocation.amount_cents = transfer.amount_cents
              and (payout.arrival_at at time zone 'UTC')::date > v_today
            )
          )
          then 'in_transit'
        when allocation.id is not null
          and reversed.amount_cents = 0
          and payout.arrival_at is not null
          then 'predicted'
        when allocation.id is null
          and transfer.connected_balance_available_on is not null
          then 'balance_schedule'
        else 'awaiting_bank_date'
      end as stage
    from public.stripe_transfers as transfer
    left join public.payout_batch_items as batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments as payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    left join public.stripe_payout_transfer_allocations as allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    left join lateral (
      select coalesce(sum(reversal.amount_cents), 0)::integer as amount_cents
      from public.stripe_transfer_reversals as reversal
      where reversal.stripe_transfer_id = transfer.id
        and reversal.status = 'succeeded'
    ) as reversed on true
    where transfer.therapist_profile_id = v_therapist_id
      and transfer.status = 'transferred'
      and (
        (
          payment.financial_status = 'paid'
          and not exists (
            select 1
            from public.session_refunds as refund
            where refund.session_payment_id = payment.id
              and refund.status <> 'failed'
          )
        )
        or (
          payment.financial_status = 'refunded'
          and allocation.id is not null
          and allocation.amount_cents = transfer.amount_cents
          and reversed.amount_cents = 0
          and exists (
            select 1
            from public.therapist_financial_debts as debt
            where debt.session_payment_id = payment.id
              and debt.status = 'open'
              and debt.open_amount_cents > 0
          )
        )
      )
      and (
        allocation.id is null
        or payout.status in (
          'pending_balance', 'creating', 'pending', 'in_transit'
        )
        or (
          payout.status = 'paid'
          and payout.provider_reconciliation_status = 'completed'
          and payout.allocation_status = 'completed'
          and allocation.amount_cents = transfer.amount_cents
          and payout.arrival_at is not null
          and (payout.arrival_at at time zone 'UTC')::date > v_today
        )
      )
      and not exists (
        select 1
        from public.session_disputes as dispute
        where dispute.session_payment_id = payment.id
      )
      and not exists (
        select 1
        from public.stripe_transfer_reversals as reversal
        where reversal.stripe_transfer_id = transfer.id
          and reversal.status not in ('succeeded', 'failed')
      )
  ), scoped as (
    select *
    from remaining
    where amount_cents > 0
      and (forecast_date is null or forecast_date <= v_agenda_end)
  ), grouped as (
    select
      case
        when forecast_date < v_today then null::date
        else forecast_date
      end as forecast_date,
      case
        when forecast_date < v_today then 'awaiting_bank_date'
        else stage
      end as stage,
      sum(amount_cents)::integer as amount_cents,
      count(distinct session_payment_id)::integer as session_count,
      jsonb_agg(jsonb_build_object(
        'sessionPaymentId', session_payment_id,
        'bookingId', booking_id,
        'patientDisplayName', patient_display_name,
        'therapyNameSnapshot', therapy_name_snapshot,
        'sessionDate', session_date,
        'amountCents', amount_cents
      ) order by session_date, session_payment_id) as composition
    from scoped
    group by
      case when forecast_date < v_today then null::date else forecast_date end,
      case
        when forecast_date < v_today then 'awaiting_bank_date'
        else stage
      end
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'predicted:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'predicted'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'in-transit:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'in_transit'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'balance:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (
      where stage = 'balance_schedule'
    ), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'bank-date-pending',
      'date', null,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    )) filter (
      where stage = 'awaiting_bank_date'
    ), '[]'::jsonb),
    coalesce(sum(amount_cents) filter (
      where stage <> 'in_transit'
    ), 0)::integer,
    coalesce(sum(amount_cents) filter (
      where stage = 'in_transit'
    ), 0)::integer
  into
    v_predicted,
    v_in_transit,
    v_available,
    v_without_bank_date,
    v_expected_cents,
    v_in_transit_cents
  from grouped;

  with received_rows as (
    select
      case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end as event_date,
      'received'::text as status,
      allocation.amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.stripe_payout_transfer_allocations as allocation
    join public.stripe_transfers as transfer
      on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    left join public.payout_batch_items as batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments as payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    where transfer.therapist_profile_id = v_therapist_id
      and transfer.status = 'transferred'
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
      and allocation.amount_cents = transfer.amount_cents
      and (
        (
          payout.arrival_at is not null
          and (payout.arrival_at at time zone 'UTC')::date
            <= (now() at time zone v_period.timezone)::date
        )
        or (
          payout.arrival_at is null
          and coalesce(payout.paid_at, payout.updated_at) <= now()
        )
      )
      and case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end >= v_period_start_date
      and case
        when payout.arrival_at is not null
          then (payout.arrival_at at time zone 'UTC')::date
        else (
          coalesce(payout.paid_at, payout.updated_at)
          at time zone v_period.timezone
        )::date
      end < v_period_end_date
  ), review_rows as (
    select distinct on (payment.id)
      (
        coalesce(payout.failed_at, transfer.updated_at,
          transfer_job.updated_at, payment.updated_at)
        at time zone v_period.timezone
      )::date as event_date,
      'under_review'::text as status,
      greatest(
        0,
        coalesce(
          transfer.amount_cents,
          transfer_job.transfer_amount_cents,
          payment.therapist_amount_cents
        )
      )::integer as amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.session_payments as payment
    join public.bookings as booking on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy on therapy.id = service.therapy_id
    left join public.session_transfer_jobs as transfer_job
      on transfer_job.session_payment_id = payment.id
    left join public.payout_batch_items as batch_item
      on batch_item.session_payment_id = payment.id
      and batch_item.status <> 'removed'
    left join public.stripe_transfers as transfer
      on transfer.session_payment_id = payment.id
      or transfer.payout_batch_item_id = batch_item.id
    left join public.stripe_payout_transfer_allocations as allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    where payment.therapist_profile_id = v_therapist_id
      and (
        (
          payment.financial_status in (
            'paid', 'partially_refunded', 'refunded', 'disputed'
          )
          and public.private_therapist_receipt_status_v2(payment.id) in (
            'blocked', 'failed', 'reversed', 'disputed'
          )
        )
        or transfer_job.status in (
          'failed', 'partially_reversed', 'reversed',
          'reconciliation_required'
        )
        or transfer.status in (
          'failed', 'reversed', 'reconciliation_required'
        )
        or payout.status in (
          'failed', 'canceled', 'reconciliation_required'
        )
      )
      and not (
        payment.payment_flow_version = 'v10'
        and payment.financial_status = 'refunded'
        and payment.transfer_status = 'reversed'
        and not payment.refund_pending
        and transfer.id is not null
        and transfer.transfer_origin = 'session_direct'
        and transfer.status = 'reversed'
        and transfer.session_payment_id = payment.id
        and transfer.connect_account_id
          is not distinct from payment.connect_account_id_snapshot
        and transfer.stripe_source_charge_id
          is not distinct from payment.stripe_charge_id
        and nullif(trim(transfer.stripe_destination_payment_id), '')
          is not null
        and nullif(
          trim(transfer.stripe_connected_balance_transaction_id), ''
        ) is not null
        and transfer_job.id is not null
        and transfer_job.status = 'reversed'
        and transfer_job.stripe_transfer_id
          is not distinct from transfer.id
        and not exists (
          select 1
          from public.stripe_payout_transfer_allocations as closed_allocation
          where closed_allocation.stripe_transfer_id = transfer.id
        )
        and not exists (
          select 1
          from public.therapist_financial_debts as debt
          where debt.session_payment_id = payment.id
            and debt.status = 'open'
            and debt.open_amount_cents > 0
        )
        and not exists (
          select 1
          from public.session_refund_decisions_v10 as decision
          join public.session_refund_incidents_v10 as incident
            on incident.session_refund_decision_id = decision.id
          where decision.session_payment_id = payment.id
            and incident.resolved_at is null
        )
        and (
          select count(*) = 1
            and coalesce(sum(refund.amount_cents), 0)
              = payment.gross_amount_cents
          from public.session_refunds as refund
          where refund.session_payment_id = payment.id
            and refund.status = 'succeeded'
            and refund.currency = 'BRL'
            and nullif(trim(refund.stripe_refund_id), '') is not null
        )
        and (
          select count(*) = 1
            and coalesce(sum(reversal.amount_cents), 0)
              = transfer.amount_cents
          from public.stripe_transfer_reversals as reversal
          where reversal.stripe_transfer_id = transfer.id
            and reversal.status = 'succeeded'
            and reversal.currency = 'BRL'
            and nullif(trim(reversal.stripe_transfer_reversal_id), '')
              is not null
        )
      )
      and coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) >= v_period.starts_at
      and coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) < v_period.ends_at
    order by payment.id,
      coalesce(
        payout.failed_at,
        transfer.updated_at,
        transfer_job.updated_at,
        payment.updated_at
      ) desc
  ), all_rows as (
    select * from received_rows
    union all
    select * from review_rows
  ), grouped as (
    select
      event_date,
      status,
      sum(amount_cents)::integer as amount_cents,
      count(distinct session_payment_id)::integer as session_count,
      jsonb_agg(jsonb_build_object(
        'sessionPaymentId', session_payment_id,
        'bookingId', booking_id,
        'patientDisplayName', patient_display_name,
        'therapyNameSnapshot', therapy_name_snapshot,
        'sessionDate', session_date,
        'amountCents', amount_cents
      ) order by session_date desc, session_payment_id) as composition
    from all_rows
    group by event_date, status
  ), counted as (
    select count(*)::integer as count from grouped
  ), paged as (
    select *
    from grouped
    order by event_date desc,
      case when status = 'received' then 0 else 1 end
    limit v_page_size offset v_offset
  )
  select
    counted.count,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', paged.status || ':' || paged.event_date::text,
      'date', paged.event_date,
      'amountCents', paged.amount_cents,
      'sessionCount', paged.session_count,
      'status', paged.status,
      'composition', paged.composition
    ) order by paged.event_date desc,
      case when paged.status = 'received' then 0 else 1 end)
      filter (where paged.event_date is not null), '[]'::jsonb)
  into v_total_count, v_history_items
  from counted
  left join paged on true
  group by counted.count;

  v_base := jsonb_set(v_base, '{contractVersion}', '8'::jsonb, true);
  v_base := jsonb_set(
    v_base, '{summary,expectedCents}', to_jsonb(v_expected_cents), true
  );
  v_base := jsonb_set(
    v_base, '{summary,inTransitCents}', to_jsonb(v_in_transit_cents), true
  );
  v_base := jsonb_set(v_base, '{agenda,predicted}', v_predicted, true);
  v_base := jsonb_set(v_base, '{agenda,inTransit}', v_in_transit, true);
  v_base := jsonb_set(
    v_base, '{agenda,balanceAvailable}', v_available, true
  );
  v_base := jsonb_set(
    v_base, '{agenda,awaitingBankDate}', v_without_bank_date, true
  );
  v_base := jsonb_set(v_base, '{historyItems}', v_history_items, true);
  v_base := jsonb_set(
    v_base,
    '{pagination}',
    jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case
        when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer
      end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    true
  );

  return v_base;
end;
$$;

revoke all on function public.get_private_therapist_payouts_v8(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v8(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v8(
  date, date, integer, integer, text, integer
) is 'Repasses V8: preserva V7, mantem payout alocado com divida em transito ou recebido e encerra somente reversoes V10 integralmente reconciliadas.';

commit;
