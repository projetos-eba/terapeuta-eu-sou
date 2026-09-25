begin;

-- Payouts V5 keeps every forward-looking rule from V4 and corrects only the
-- completed-bank date. Once Stripe confirms a paid Payout, arrival_at is the
-- customer-facing bank date; paid_at remains the fallback when Stripe does not
-- provide arrival evidence. No Transfer, allocation, ledger or Payout row is
-- mutated by this read model.
create or replace function public.get_private_therapist_payouts_v5(
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
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_history_items jsonb := '[]'::jsonb;
  v_received_cents integer := 0;
begin
  v_base := public.get_private_therapist_payouts_v4(
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

  with received_rows as (
    select
      (
        coalesce(payout.arrival_at, payout.paid_at, payout.updated_at)
        at time zone v_period.timezone
      )::date as event_date,
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
      and coalesce(payout.arrival_at, payout.paid_at, payout.updated_at)
        >= v_period.starts_at
      and coalesce(payout.arrival_at, payout.paid_at, payout.updated_at)
        < v_period.ends_at
  ), review_rows as (
    select distinct on (payment.id)
      (
        coalesce(payout.failed_at, transfer.updated_at, payment.updated_at)
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

  select coalesce(sum(allocation.amount_cents), 0)::integer
  into v_received_cents
  from public.stripe_payout_transfer_allocations as allocation
  join public.stripe_transfers as transfer
    on transfer.id = allocation.stripe_transfer_id
  join public.stripe_payouts as payout
    on payout.id = allocation.stripe_payout_id
  where transfer.therapist_profile_id = v_therapist_id
    and transfer.status = 'transferred'
    and payout.status = 'paid'
    and payout.provider_reconciliation_status = 'completed'
    and payout.allocation_status = 'completed'
    and allocation.amount_cents = transfer.amount_cents
    and coalesce(payout.arrival_at, payout.paid_at, payout.updated_at)
      >= v_period.starts_at
    and coalesce(payout.arrival_at, payout.paid_at, payout.updated_at)
      < v_period.ends_at;

  v_base := jsonb_set(v_base, '{contractVersion}', '5'::jsonb, true);
  v_base := jsonb_set(
    v_base, '{summary,receivedCents}', to_jsonb(v_received_cents), true
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

revoke all on function public.get_private_therapist_payouts_v5(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v5(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v5(
  date, date, integer, integer, text, integer
) is 'Repasses V5: preserva a projecao V4 e usa arrival_at como data bancaria de recebimento, com paid_at apenas como fallback.';

-- Administrative presentation must distinguish an unresolved recovery debt
-- from a debt that was fully settled by later V10 offsets. The offset evidence
-- comes from the immutable debt events, not from a UI inference. Bank dates use
-- the same arrival-first rule as the therapist projection.
create or replace function public.private_admin_session_payout_projection_v10(
  p_session_payment_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'payout_display_status', case
      when coalesce(debt_state.open_amount_cents, 0) > 0
        then 'compensation_pending'
      when job.status = 'reversed' or transfer.status = 'reversed'
        then 'reversed'
      when payment.financial_status = 'refunded'
        and transfer.status = 'transferred'
        and coalesce(debt_state.fully_compensated, false)
        then 'compensated'
      when payment.financial_status = 'refunded'
        and transfer.status = 'transferred'
        then 'needs_review'
      when payment.financial_status = 'refunded'
        then 'refunded'
      when job.status = 'offset_only'
        then 'compensated'
      when job.status in ('partially_reversed', 'failed')
        or transfer.status = 'failed'
        then 'failed'
      when job.status = 'reconciliation_required'
        or transfer.status = 'reconciliation_required'
        or bank_payout.status = 'reconciliation_required'
        then 'needs_review'
      when bank_payout.status in ('failed', 'canceled')
        then 'failed'
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        then 'paid'
      when bank_payout.status = 'paid'
        or (
          bank_payout.id is not null
          and bank_payout.allocated_amount_cents <> transfer.amount_cents
        )
        then 'needs_review'
      when bank_payout.status in ('pending', 'in_transit')
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        then 'bank_pending'
      when job.status in ('queued', 'creating', 'pending_source', 'transferred')
        or transfer.status in ('pending', 'creating', 'transferred')
        or bank_payout.status in ('pending_balance', 'creating')
        then 'processing'
      else 'processing'
    end,
    'financial_review_status', case
      when exists (
        select 1
        from public.session_confirmation_incidents as incident
        where incident.session_payment_id = payment.id
          and incident.status = 'open'
          and incident.classification in (
            'no_show_therapist', 'no_show_both', 'requires_review'
          )
      ) then 'attendance_review'
      when exists (
        select 1
        from public.booking_reschedule_requests as request
        where request.booking_id = payment.booking_id
          and request.status = 'pending_admin_review'
          and request.change_kind in (
            'therapist_reschedule', 'therapist_cancellation'
          )
      ) then 'therapist_change_refund_review'
      else null
    end,
    'debt_offset_amount_cents', coalesce(
      nullif(job.debt_offset_amount_cents, 0),
      nullif(transfer.debt_offset_amount_cents, 0)
    ),
    'transfer_effective_amount_cents', coalesce(
      job.transfer_amount_cents,
      transfer.amount_cents
    ),
    'bank_paid_at', case
      when bank_payout.status = 'paid'
        and bank_payout.provider_reconciliation_status = 'completed'
        and bank_payout.allocation_status = 'completed'
        and bank_payout.allocated_amount_cents = transfer.amount_cents
        then coalesce(bank_payout.arrival_at, bank_payout.paid_at)
      else null
    end
  ))
  from public.session_payments as payment
  left join public.session_transfer_jobs as job
    on job.session_payment_id = payment.id
  left join lateral (
    select candidate.*
    from public.stripe_transfers as candidate
    where candidate.session_payment_id = payment.id
    order by
      (candidate.id = job.stripe_transfer_id) desc,
      coalesce(candidate.transferred_at, candidate.created_at) desc,
      candidate.id desc
    limit 1
  ) as transfer on true
  left join lateral (
    select
      coalesce(sum(debt.open_amount_cents) filter (
        where debt.status = 'open' and debt.open_amount_cents > 0
      ), 0)::integer as open_amount_cents,
      coalesce(bool_or(
        debt.status = 'settled'
        and coalesce(offsets.amount_cents, 0) = debt.principal_amount_cents
      ), false) as fully_compensated
    from public.therapist_financial_debts as debt
    left join lateral (
      select coalesce(sum(event.amount_cents), 0)::integer as amount_cents
      from public.therapist_financial_debt_events as event
      where event.therapist_financial_debt_id = debt.id
        and event.event_type = 'transfer_offset'
        and event.direction = 'decrease'
    ) as offsets on true
    where debt.session_payment_id = payment.id
  ) as debt_state on true
  left join lateral (
    select
      payout.id,
      payout.status,
      payout.provider_reconciliation_status,
      payout.allocation_status,
      payout.arrival_at,
      payout.paid_at,
      allocation.amount_cents as allocated_amount_cents
    from public.stripe_payout_transfer_allocations as allocation
    join public.stripe_payouts as payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
    order by payout.created_at desc, payout.id desc
    limit 1
  ) as bank_payout on true
  where payment.id = p_session_payment_id
    and (job.id is not null or transfer.id is not null);
$$;

revoke all on function public.private_admin_session_payout_projection_v10(uuid)
  from public, anon, authenticated;

comment on function public.private_admin_session_payout_projection_v10(uuid) is
  'Private V9/V10 admin projection with durable debt-offset resolution and arrival-backed bank dates.';

commit;
