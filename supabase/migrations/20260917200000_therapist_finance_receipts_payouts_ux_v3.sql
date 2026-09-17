begin;

-- Additive, read-only product projections for the therapist financial UX.
-- V2 remains unchanged for compatibility and for operational consumers.

create or replace function public.private_therapist_charge_status_v3(
  p_session_payment_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when payment.financial_status = 'disputed'
      or payment.disputed_at is not null then 'under_review'
    when public.private_therapist_finance_refunded_cents_v1(payment.id) > 0
      or payment.financial_status = 'refunded' then 'refunded'
    when payment.financial_status = 'canceled' then 'canceled'
    when payment.financial_status = 'failed' then 'failed'
    when payment.financial_status in ('paid', 'partially_refunded') then 'approved'
    when payment.financial_status = 'processing' then 'processing'
    when schedule.status in ('scheduled', 'retry_scheduled') then 'scheduled'
    when schedule.status in ('claimed', 'processing') then 'processing'
    when schedule.status in ('requires_customer_action', 'failed') then 'failed'
    when schedule.status in ('canceled', 'superseded') then 'canceled'
    else 'processing'
  end
  from public.session_payments payment
  left join lateral (
    select payment_schedule.status
    from public.session_payment_schedules payment_schedule
    where payment_schedule.session_payment_id = payment.id
    order by payment_schedule.created_at desc, payment_schedule.id desc
    limit 1
  ) schedule on true
  where payment.id = p_session_payment_id;
$$;

revoke all on function public.private_therapist_charge_status_v3(uuid)
from public, anon, authenticated;

create or replace function public.get_private_therapist_receipts_v3(
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_therapy_options jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if p_status is not null and p_status not in (
    'scheduled', 'processing', 'approved', 'failed', 'refunded',
    'under_review', 'canceled'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  with scoped as (
    select
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      therapy.id as therapy_id,
      booking.starts_at as session_date,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents as tes_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id)
        as refunded_amount_cents,
      greatest(0, payment.therapist_amount_cents)::integer
        as therapist_net_amount_cents,
      payment.financial_status::text as financial_status,
      public.private_therapist_charge_status_v3(payment.id) as charge_status,
      case
        when public.private_therapist_charge_status_v3(payment.id) = 'scheduled'
          then coalesce(schedule.due_at, payment.payment_due_at)
        else null
      end as scheduled_charge_at,
      receipt.receipt_url,
      payment.created_at
    from public.session_payments payment
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    left join public.booking_payment_receipts receipt
      on receipt.booking_id = payment.booking_id
    left join lateral (
      select payment_schedule.due_at
      from public.session_payment_schedules payment_schedule
      where payment_schedule.session_payment_id = payment.id
      order by payment_schedule.created_at desc, payment_schedule.id desc
      limit 1
    ) schedule on true
    where payment.therapist_profile_id = v_therapist.id
      and booking.starts_at >= v_period.starts_at
      and booking.starts_at < v_period.ends_at
      and (p_therapy_id is null or therapy.id = p_therapy_id)
      and (
        v_search is null
        or patient.display_name ilike '%' || v_search || '%'
        or therapy.name ilike '%' || v_search || '%'
        or booking.service_title_snapshot ilike '%' || v_search || '%'
      )
  ), filtered as (
    select * from scoped
    where p_status is null or charge_status = p_status
  ), counted as (
    select count(*)::integer as count from filtered
  ), paged as (
    select * from filtered
    order by session_date desc, created_at desc, session_payment_id desc
    limit v_page_size offset v_offset
  )
  select
    counted.count,
    coalesce(jsonb_agg(jsonb_build_object(
      'sessionPaymentId', paged.session_payment_id,
      'bookingId', paged.booking_id,
      'patientDisplayName', paged.patient_display_name,
      'therapyNameSnapshot', paged.therapy_name_snapshot,
      'sessionDate', paged.session_date,
      'grossAmountCents', paged.gross_amount_cents,
      'tesCommissionCents', paged.tes_commission_cents,
      'therapistNetAmountCents', paged.therapist_net_amount_cents,
      'refundedAmountCents', paged.refunded_amount_cents,
      'financialStatus', paged.financial_status,
      'chargeStatus', paged.charge_status,
      'scheduledChargeAt', paged.scheduled_charge_at,
      'receiptUrl', paged.receipt_url,
      'createdAt', paged.created_at
    ) order by paged.session_date desc, paged.created_at desc, paged.session_payment_id desc)
      filter (where paged.session_payment_id is not null), '[]'::jsonb)
  into v_total_count, v_items
  from counted
  left join paged on true
  group by counted.count;

  with scoped as (
    select
      payment.id,
      therapy.id as therapy_id,
      therapy.name as therapy_name,
      patient.display_name as patient_name,
      booking.service_title_snapshot,
      public.private_therapist_charge_status_v3(payment.id) as charge_status,
      public.private_therapist_finance_refunded_cents_v1(payment.id)
        as refunded_amount_cents,
      greatest(0, payment.therapist_amount_cents)::integer as net_cents
    from public.session_payments payment
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
      and booking.starts_at >= v_period.starts_at
      and booking.starts_at < v_period.ends_at
      and (p_therapy_id is null or therapy.id = p_therapy_id)
      and (
        v_search is null
        or patient.display_name ilike '%' || v_search || '%'
        or therapy.name ilike '%' || v_search || '%'
        or booking.service_title_snapshot ilike '%' || v_search || '%'
      )
  )
  select jsonb_build_object(
    'approvedCents', coalesce(sum(net_cents) filter (
      where charge_status = 'approved'
    ), 0)::integer,
    'processingCents', coalesce(sum(net_cents) filter (
      where charge_status = 'processing'
    ), 0)::integer,
    'scheduledCents', coalesce(sum(net_cents) filter (
      where charge_status = 'scheduled'
    ), 0)::integer,
    'refundedCents', coalesce(sum(refunded_amount_cents) filter (
      where charge_status = 'refunded'
    ), 0)::integer
  ) into v_summary
  from scoped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'therapyId', option.id,
    'name', option.name
  ) order by option.name), '[]'::jsonb)
  into v_therapy_options
  from (
    select distinct therapy.id, therapy.name
    from public.session_payments payment
    join public.therapist_services service on service.id = payment.service_id
    join public.therapies therapy on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
  ) option;

  return jsonb_build_object(
    'contractVersion', 3,
    'therapistProfileId', v_therapist.id,
    'items', v_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    'filters', jsonb_build_object(
      'status', p_status,
      'therapyId', p_therapy_id,
      'search', v_search,
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone
    ),
    'summary', v_summary,
    'therapyOptions', v_therapy_options,
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_private_therapist_receipts_v3(
  date, date, text, uuid, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_receipts_v3(
  date, date, text, uuid, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_receipts_v3(
  date, date, text, uuid, text, integer, integer, text
) is 'Read-only therapist charge projection. Separates scheduled, processing, approved, failed, refunded and review states without changing the canonical payment lifecycle.';

create or replace function public.get_private_therapist_payouts_v3(
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_today date;
  v_agenda_end date;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_summary jsonb := '{}'::jsonb;
  v_agenda_in_transit jsonb := '[]'::jsonb;
  v_agenda_predicted jsonb := '[]'::jsonb;
  v_history_items jsonb := '[]'::jsonb;
begin
  if p_agenda_days not in (7, 15, 30) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;

  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  v_today := (now() at time zone v_period.timezone)::date;
  v_agenda_end := v_today + (p_agenda_days - 1);

  with future_arrivals as (
    select
      case
        when payout.status in ('pending', 'in_transit') then 'in_transit'
        else 'predicted'
      end as stage,
      allocation.amount_cents
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_transfers transfer on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where transfer.therapist_profile_id = v_therapist.id
      and transfer.status = 'transferred'
      and payout.status in ('pending_balance', 'creating', 'pending', 'in_transit')
      and payout.arrival_at is not null
      and allocation.amount_cents = transfer.amount_cents
      and (payout.arrival_at at time zone v_period.timezone)::date
        between v_today and v_agenda_end
  ), received as (
    select coalesce(sum(allocation.amount_cents), 0)::integer as amount_cents
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_transfers transfer on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where transfer.therapist_profile_id = v_therapist.id
      and transfer.status = 'transferred'
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
      and allocation.amount_cents = transfer.amount_cents
      and coalesce(payout.paid_at, payout.updated_at) >= v_period.starts_at
      and coalesce(payout.paid_at, payout.updated_at) < v_period.ends_at
  )
  select jsonb_build_object(
    'expectedCents', coalesce(sum(amount_cents) filter (
      where stage = 'predicted'
    ), 0)::integer,
    'inTransitCents', coalesce(sum(amount_cents) filter (
      where stage = 'in_transit'
    ), 0)::integer,
    'receivedCents', (select amount_cents from received)
  ) into v_summary
  from future_arrivals;

  with agenda_rows as (
    select
      case
        when payout.status in ('pending', 'in_transit') then 'in_transit'
        else 'predicted'
      end as stage,
      (payout.arrival_at at time zone v_period.timezone)::date as arrival_date,
      allocation.amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_transfers transfer on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    left join public.payout_batch_items batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    where transfer.therapist_profile_id = v_therapist.id
      and transfer.status = 'transferred'
      and payout.status in ('pending_balance', 'creating', 'pending', 'in_transit')
      and payout.arrival_at is not null
      and allocation.amount_cents = transfer.amount_cents
      and (payout.arrival_at at time zone v_period.timezone)::date
        between v_today and v_agenda_end
  ), agenda_groups as (
    select
      stage,
      arrival_date,
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
    from agenda_rows
    group by stage, arrival_date
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'in-transit:' || arrival_date::text,
      'date', arrival_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', 'in_transit',
      'composition', composition
    ) order by arrival_date) filter (where stage = 'in_transit'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'predicted:' || arrival_date::text,
      'date', arrival_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', 'predicted',
      'composition', composition
    ) order by arrival_date) filter (where stage = 'predicted'), '[]'::jsonb)
  into v_agenda_in_transit, v_agenda_predicted
  from agenda_groups;

  with received_rows as (
    select
      (coalesce(payout.paid_at, payout.updated_at) at time zone v_period.timezone)::date
        as event_date,
      'received'::text as status,
      allocation.amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_transfers transfer on transfer.id = allocation.stripe_transfer_id
    join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    left join public.payout_batch_items batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments payment
      on payment.id = coalesce(
        transfer.session_payment_id,
        batch_item.session_payment_id
      )
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    where transfer.therapist_profile_id = v_therapist.id
      and transfer.status = 'transferred'
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
      and allocation.amount_cents = transfer.amount_cents
      and coalesce(payout.paid_at, payout.updated_at) >= v_period.starts_at
      and coalesce(payout.paid_at, payout.updated_at) < v_period.ends_at
  ), review_rows as (
    select distinct on (payment.id)
      (coalesce(payout.failed_at, transfer.updated_at, payment.updated_at)
        at time zone v_period.timezone)::date as event_date,
      'under_review'::text as status,
      greatest(
        0,
        coalesce(transfer.amount_cents, transfer_job.transfer_amount_cents,
          payment.therapist_amount_cents)
      )::integer as amount_cents,
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      booking.starts_at as session_date
    from public.session_payments payment
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    left join public.session_transfer_jobs transfer_job
      on transfer_job.session_payment_id = payment.id
    left join public.payout_batch_items batch_item
      on batch_item.session_payment_id = payment.id
      and batch_item.status <> 'removed'
    left join public.stripe_transfers transfer
      on transfer.session_payment_id = payment.id
      or transfer.payout_batch_item_id = batch_item.id
    left join public.stripe_payout_transfer_allocations allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    where payment.therapist_profile_id = v_therapist.id
      and (
        public.private_therapist_receipt_status_v2(payment.id) in (
          'blocked', 'failed', 'reversed', 'disputed'
        )
        or transfer.status in ('failed', 'reversed', 'reconciliation_required')
        or payout.status in ('failed', 'canceled', 'reconciliation_required')
      )
      and coalesce(payout.failed_at, transfer.updated_at, payment.updated_at)
        >= v_period.starts_at
      and coalesce(payout.failed_at, transfer.updated_at, payment.updated_at)
        < v_period.ends_at
    order by payment.id,
      coalesce(payout.failed_at, transfer.updated_at, payment.updated_at) desc
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
    select * from grouped
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

  return jsonb_build_object(
    'contractVersion', 3,
    'therapistProfileId', v_therapist.id,
    'summary', v_summary,
    'agenda', jsonb_build_object(
      'days', p_agenda_days,
      'periodStart', v_today,
      'periodEnd', v_agenda_end,
      'inTransit', v_agenda_in_transit,
      'predicted', v_agenda_predicted
    ),
    'historyItems', v_history_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    'filters', jsonb_build_object(
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone,
      'agendaDays', p_agenda_days
    ),
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_private_therapist_payouts_v3(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v3(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v3(
  date, date, integer, integer, text, integer
) is 'Read-only therapist cash-arrival projection. Uses provider arrival dates only when a transfer is fully allocated, keeps received authority bank-paid and hides V9/V10 orchestration details.';

commit;
