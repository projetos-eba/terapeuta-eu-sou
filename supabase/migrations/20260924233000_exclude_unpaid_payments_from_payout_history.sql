begin;

-- V7 preserves the V6 agenda, bank-arrival and received totals. It rebuilds
-- only payout history so an unpaid charge failure cannot be presented as a
-- payout incident. Real transfer/job/Payout incidents remain visible even if
-- their payment projection is inconsistent, which keeps the read model
-- fail-closed for financial reconciliation.
create or replace function public.get_private_therapist_payouts_v7(
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
  v_period_start_date date;
  v_period_end_date date;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_history_items jsonb := '[]'::jsonb;
begin
  v_base := public.get_private_therapist_payouts_v6(
    p_period_start,
    p_period_end,
    p_page,
    p_page_size,
    p_timezone,
    p_agenda_days
  );
  v_therapist_id := (v_base ->> 'therapistProfileId')::uuid;
  v_offset := (v_page - 1) * v_page_size;

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_period_start_date :=
    (v_period.starts_at at time zone v_period.timezone)::date;
  v_period_end_date :=
    (v_period.ends_at at time zone v_period.timezone)::date;

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

  v_base := jsonb_set(v_base, '{contractVersion}', '7'::jsonb, true);
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

revoke all on function public.get_private_therapist_payouts_v7(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v7(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v7(
  date, date, integer, integer, text, integer
) is 'Repasses V7: preserva agenda e chegada bancaria V6, exclui cobrancas nao pagas sem artefato de repasse do historico em analise.';

commit;
