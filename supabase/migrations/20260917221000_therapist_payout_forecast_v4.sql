-- V4 adds source-backed availability without presenting it as a bank arrival.
-- V3 stays available for already-deployed consumers during the PR rollout.
begin;

create or replace function public.get_private_therapist_payouts_v4(
  p_period_start date default null,
  p_period_end date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null,
  p_agenda_days integer default 15
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_base jsonb;
  v_therapist_id uuid;
  v_timezone text;
  v_today date;
  v_agenda_end date;
  v_predicted jsonb := '[]'::jsonb;
  v_in_transit jsonb := '[]'::jsonb;
  v_available jsonb := '[]'::jsonb;
  v_without_bank_date jsonb := '[]'::jsonb;
  v_expected_cents integer := 0;
  v_in_transit_cents integer := 0;
begin
  v_base := public.get_private_therapist_payouts_v3(
    p_period_start, p_period_end, p_page, p_page_size, p_timezone, p_agenda_days
  );
  v_therapist_id := (v_base->>'therapistProfileId')::uuid;
  v_timezone := v_base->'filters'->>'timezone';
  v_today := (v_base->'agenda'->>'periodStart')::date;
  v_agenda_end := (v_base->'agenda'->>'periodEnd')::date;

  -- Rebuild the forward-looking rows rather than adding to V3: an allocated
  -- transfer can subsequently be refunded or reversed while its old payout
  -- allocation remains. V3 history continues to describe actual bank receipts.
  with remaining as (
    select transfer.id, payment.id as session_payment_id, payment.booking_id,
      booking.starts_at as session_date,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      greatest(0, transfer.amount_cents - coalesce(reversed.amount_cents, 0))::integer
        as amount_cents,
      case
        when allocation.id is not null and reversed.amount_cents = 0
          and payout.arrival_at is not null
          then (payout.arrival_at at time zone v_timezone)::date
        when allocation.id is null and transfer.connected_balance_available_on is not null
          then (transfer.connected_balance_available_on at time zone v_timezone)::date
        else null::date
      end as forecast_date,
      case
        when allocation.id is not null and reversed.amount_cents = 0
          and payout.arrival_at is not null and payout.status in ('pending', 'in_transit')
          then 'in_transit'
        when allocation.id is not null and reversed.amount_cents = 0
          and payout.arrival_at is not null then 'predicted'
        when allocation.id is null and transfer.connected_balance_available_on is not null
          then 'balance_schedule'
        else 'awaiting_bank_date'
      end as stage
    from public.stripe_transfers transfer
    left join public.payout_batch_items batch_item
      on batch_item.id = transfer.payout_batch_item_id
    join public.session_payments payment on payment.id = coalesce(
      transfer.session_payment_id, batch_item.session_payment_id
    )
    join public.bookings booking on booking.id = payment.booking_id
    left join public.patient_profiles patient on patient.id = payment.patient_profile_id
    left join public.therapist_services service on service.id = payment.service_id
    left join public.therapies therapy on therapy.id = service.therapy_id
    left join public.stripe_payout_transfer_allocations allocation
      on allocation.stripe_transfer_id = transfer.id
    left join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
    left join lateral (
      select coalesce(sum(reversal.amount_cents), 0)::integer as amount_cents
      from public.stripe_transfer_reversals reversal
      where reversal.stripe_transfer_id = transfer.id and reversal.status = 'succeeded'
    ) reversed on true
    where transfer.therapist_profile_id = v_therapist_id
      and transfer.status = 'transferred'
      and payment.financial_status = 'paid'
      and (allocation.id is null or
        payout.status in ('pending_balance', 'creating', 'pending', 'in_transit'))
      and not exists (
        select 1 from public.session_refunds refund
        where refund.session_payment_id = payment.id and refund.status <> 'failed'
      )
      and not exists (
        select 1 from public.session_disputes dispute
        where dispute.session_payment_id = payment.id
      )
      and not exists (
        select 1 from public.stripe_transfer_reversals reversal
        where reversal.stripe_transfer_id = transfer.id
          and reversal.status not in ('succeeded', 'failed')
      )
  ), scoped as (
    select * from remaining
    where amount_cents > 0
      and (forecast_date is null or forecast_date <= v_agenda_end)
  ), grouped as (
    select case when forecast_date < v_today then null::date
        else forecast_date end as forecast_date,
      case when forecast_date < v_today then 'awaiting_bank_date'
        else stage end as stage,
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
    group by case when forecast_date < v_today then null::date
      else forecast_date end,
      case when forecast_date < v_today then 'awaiting_bank_date'
        else stage end
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'predicted:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (where stage = 'predicted'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'in-transit:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (where stage = 'in_transit'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'balance:' || forecast_date::text,
      'date', forecast_date,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    ) order by forecast_date) filter (where stage = 'balance_schedule'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', 'bank-date-pending',
      'date', null,
      'amountCents', amount_cents,
      'sessionCount', session_count,
      'status', stage,
      'composition', composition
    )) filter (where stage = 'awaiting_bank_date'), '[]'::jsonb),
    coalesce(sum(amount_cents) filter (where stage <> 'in_transit'), 0)::integer,
    coalesce(sum(amount_cents) filter (where stage = 'in_transit'), 0)::integer
  into v_predicted, v_in_transit, v_available, v_without_bank_date,
    v_expected_cents, v_in_transit_cents
  from grouped;

  v_base := jsonb_set(v_base, '{contractVersion}', '4'::jsonb);
  v_base := jsonb_set(v_base, '{summary,expectedCents}',
    to_jsonb(v_expected_cents));
  v_base := jsonb_set(v_base, '{summary,inTransitCents}',
    to_jsonb(v_in_transit_cents));
  v_base := jsonb_set(v_base, '{agenda,predicted}', v_predicted);
  v_base := jsonb_set(v_base, '{agenda,inTransit}', v_in_transit);
  v_base := jsonb_set(v_base, '{agenda,balanceAvailable}', v_available);
  v_base := jsonb_set(v_base, '{agenda,awaitingBankDate}', v_without_bank_date);
  return v_base;
end;
$$;

revoke all on function public.get_private_therapist_payouts_v4(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v4(
  date, date, integer, integer, text, integer
) to authenticated;

commit;
