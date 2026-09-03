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
    when payment.transfer_status = 'waiting_settlement' then 'waiting_settlement'
    when payment.transfer_status = 'waiting_safety_period' then 'waiting_safety_period'
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

create or replace function public.record_session_payment_stripe_reconciliation_v2(
  p_session_payment_id uuid,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_charge_id text default null,
  p_stripe_balance_transaction_id text default null,
  p_stripe_fee_amount_cents integer default null,
  p_stripe_net_amount_cents integer default null,
  p_payment_method_type text default null,
  p_payment_origin text default 'stripe_checkout',
  p_receipt_url text default null,
  p_balance_status text default null,
  p_balance_available_on timestamptz default null,
  p_balance_currency text default null,
  p_balance_amount_cents integer default null,
  p_balance_source_charge_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_base jsonb;
  v_settlement_applied boolean := false;
begin
  select * into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  end if;

  if p_balance_status is not null then
    if p_balance_status not in ('pending', 'available')
      or nullif(trim(p_stripe_charge_id), '') is null
      or nullif(trim(p_stripe_balance_transaction_id), '') is null
      or p_balance_available_on is null
      or lower(coalesce(p_balance_currency, '')) <> lower(v_payment.currency)
      or p_balance_amount_cents <> v_payment.gross_amount_cents
      or p_balance_source_charge_id <> p_stripe_charge_id
      or (v_payment.stripe_charge_id is not null and v_payment.stripe_charge_id <> p_stripe_charge_id)
      or (v_payment.stripe_balance_transaction_id is not null
        and v_payment.stripe_balance_transaction_id <> p_stripe_balance_transaction_id)
    then
      raise exception 'STRIPE_BALANCE_TRANSACTION_MISMATCH' using errcode = '22023';
    end if;
  end if;

  v_base := public.record_session_payment_stripe_reconciliation_v1(
    p_session_payment_id,
    p_stripe_event_id,
    p_stripe_event_created_at,
    p_stripe_charge_id,
    p_stripe_balance_transaction_id,
    p_stripe_fee_amount_cents,
    p_stripe_net_amount_cents,
    p_payment_method_type,
    p_payment_origin,
    p_receipt_url
  );

  if p_balance_status is not null
    and (v_payment.stripe_balance_checked_at is null
      or p_stripe_event_created_at >= v_payment.stripe_balance_checked_at)
    and not (
      v_payment.stripe_balance_status = 'available'
      and p_balance_status = 'pending'
    ) then
    update public.session_payments
    set stripe_balance_status = p_balance_status,
        stripe_balance_available_on = p_balance_available_on,
        stripe_balance_checked_at = p_stripe_event_created_at,
        updated_at = now()
    where id = p_session_payment_id;
    v_settlement_applied := true;
    perform public.refresh_session_transfer_eligibility(
      p_session_payment_id,
      p_stripe_event_created_at
    );
  end if;

  return v_base || jsonb_build_object(
    'settlementRecorded', v_settlement_applied,
    'settlementStatus', p_balance_status
  );
end;
$$;

revoke all on function public.record_session_payment_stripe_reconciliation_v2(
  uuid, text, timestamptz, text, text, integer, integer, text, text, text,
  text, timestamptz, text, integer, text
) from public, anon, authenticated;
grant execute on function public.record_session_payment_stripe_reconciliation_v2(
  uuid, text, timestamptz, text, text, integer, integer, text, text, text,
  text, timestamptz, text, integer, text
) to service_role;

create or replace function public.refresh_session_transfer_eligibility(
  p_session_payment_id uuid, p_now timestamptz default now()
)
returns public.session_transfer_status
language plpgsql security definer set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_connect_ready boolean;
  v_has_active_batch boolean;
  v_safety_days integer;
  v_eligible_at timestamptz;
  v_status public.session_transfer_status;
  v_reason text;
begin
  select * into v_payment from public.session_payments where id = p_session_payment_id for update;
  if not found then raise exception 'session_payment_not_found'; end if;
  select coalesce(transfer_safety_period_days, 1) into v_safety_days
  from public.financial_policy_versions where id = v_payment.policy_version_id;
  select exists (
    select 1 from public.therapist_connect_accounts account
    where account.therapist_profile_id = v_payment.therapist_profile_id
      and account.is_current = true and account.stripe_transfers_status = 'active'
      and account.payouts_enabled = true and account.payout_status = 'enabled'
      and account.payout_schedule_interval = 'daily' and account.operational_status = 'ready'
  ) into v_connect_ready;
  select exists (
    select 1 from public.payout_batch_items
    where session_payment_id = p_session_payment_id
      and status in ('reserved', 'transfer_pending', 'transferred')
  ) into v_has_active_batch;

  if v_payment.transfer_status = 'transferred' then v_status := 'transferred'; v_reason := 'already_transferred';
  elsif v_has_active_batch then v_status := 'batched'; v_reason := 'already_batched';
  elsif v_payment.financial_status = 'disputed' or v_payment.disputed_at is not null then v_status := 'blocked'; v_reason := 'disputed';
  elsif v_payment.admin_blocked_at is not null or v_payment.internal_contested_at is not null then v_status := 'blocked'; v_reason := coalesce(v_payment.transfer_blocked_reason, 'blocked_or_contested');
  elsif v_payment.refund_pending or v_payment.financial_status = 'refunded' then v_status := 'blocked'; v_reason := 'refund';
  elsif v_payment.financial_status not in ('paid', 'partially_refunded') then v_status := 'not_eligible'; v_reason := 'payment_not_confirmed';
  elsif v_payment.service_status not in ('confirmed_bilateral', 'confirmed_by_patient_review', 'confirmed_by_therapist', 'auto_confirmed') or v_payment.service_confirmed_at is null then v_status := 'waiting_confirmation'; v_reason := 'service_not_confirmed';
  elsif not v_connect_ready then v_status := 'blocked'; v_reason := 'connect_not_ready';
  elsif v_payment.therapist_amount_cents <= 0 then v_status := 'not_eligible'; v_reason := 'non_positive_transfer_amount';
  else
    v_eligible_at := v_payment.service_confirmed_at + make_interval(days => v_safety_days);
    if p_now < v_eligible_at then
      v_status := 'waiting_safety_period'; v_reason := 'waiting_safety_period';
    elsif v_payment.stripe_charge_id is null
      or v_payment.stripe_balance_transaction_id is null
      or v_payment.stripe_balance_status is distinct from 'available'
      or v_payment.stripe_balance_available_on is null
      or v_payment.stripe_balance_available_on > p_now
      or v_payment.stripe_balance_checked_at is null
      or v_payment.stripe_balance_checked_at < p_now - interval '2 hours' then
      v_status := 'waiting_settlement'; v_reason := 'stripe_settlement_pending';
    else
      v_status := 'eligible'; v_reason := 'eligible';
    end if;
  end if;
  update public.session_payments set transfer_status = v_status,
    eligible_at = case when v_status in ('waiting_safety_period', 'waiting_settlement', 'eligible') then v_eligible_at when v_status in ('batched', 'transfer_pending', 'transferred') then eligible_at else null end,
    transfer_blocked_reason = v_reason, updated_at = now() where id = p_session_payment_id;
  return v_status;
end;
$$;

create or replace function public.get_private_therapist_financial_overview_v2(
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
  v_base jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_received integer := 0;
  v_processing integer := 0;
  v_waiting_settlement integer := 0;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );
  v_base := public.get_private_therapist_financial_overview_v1(
    p_period_start, p_period_end, p_timezone
  );

  select coalesce(sum(transfer.amount_cents), 0)::integer into v_received
  from public.stripe_transfers transfer
  join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id = transfer.id
  join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
  where transfer.therapist_profile_id = v_therapist.id
    and transfer.status = 'transferred'
    and payout.status = 'paid'
    and payout.provider_reconciliation_status = 'completed'
    and payout.allocation_status = 'completed'
    and allocation.amount_cents = transfer.amount_cents
    and coalesce(payout.paid_at, payout.updated_at) >= v_period.starts_at
    and coalesce(payout.paid_at, payout.updated_at) < v_period.ends_at;

  select
    coalesce(sum(payment.therapist_amount_cents) filter (
      where public.private_therapist_receipt_status_v2(payment.id) in (
        'receivable', 'waiting_confirmation', 'waiting_safety_period',
        'waiting_settlement', 'eligible', 'payout_processing', 'bank_pending'
      )
    ), 0)::integer,
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_settlement'
    ), 0)::integer
  into v_processing, v_waiting_settlement
  from public.session_payments payment
  join public.bookings booking on booking.id = payment.booking_id
  where payment.therapist_profile_id = v_therapist.id
    and booking.starts_at >= v_period.starts_at
    and booking.starts_at < v_period.ends_at;

  return v_base || jsonb_build_object(
    'contractVersion', 2,
    'receivedCents', v_received,
    'processingCents', v_processing,
    'waitingSettlementCents', v_waiting_settlement
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_overview_v2(date,date,text)
from public, anon;
grant execute on function public.get_private_therapist_financial_overview_v2(date,date,text)
to authenticated;

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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_therapy_options jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_trend jsonb := '[]'::jsonb;
  v_distribution jsonb := '[]'::jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if p_status is not null and p_status not in (
    'receivable', 'waiting_confirmation', 'waiting_safety_period', 'waiting_settlement',
    'eligible', 'payout_processing', 'bank_pending', 'paid', 'blocked', 'failed',
    'reversed', 'refunded', 'canceled', 'disputed'
  ) then raise exception 'VALIDATION_ERROR' using errcode = '22023'; end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;
  select * into v_period from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  with raw as (
    select payment.id session_payment_id, payment.booking_id,
      coalesce(patient.display_name, 'Paciente') patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title) therapy_name_snapshot,
      therapy.id therapy_id, booking.starts_at session_date,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents tes_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id) refunded_amount_cents,
      payment.financial_status::text financial_status,
      public.private_therapist_receipt_status_v2(payment.id) receipt_status,
      coalesce(nullif(payment.metadata ->> 'paymentMethodType',''), nullif(payment.metadata ->> 'payment_method_type',''), nullif(payment.metadata #>> '{payment_method,type}','')) payment_method_type,
      coalesce(nullif(payment.metadata ->> 'paymentOrigin',''), nullif(payment.metadata ->> 'payment_origin',''), case when payment.stripe_checkout_session_id is not null then 'stripe_checkout' else 'unknown' end) payment_origin,
      receipt.receipt_url,
      (select dispute.status from public.session_disputes dispute where dispute.session_payment_id=payment.id order by dispute.opened_at desc limit 1) dispute_status,
      bank.received_at,
      bank.received_amount_cents,
      payment.created_at
    from public.session_payments payment
    join public.bookings booking on booking.id=payment.booking_id
    left join public.patient_profiles patient on patient.id=payment.patient_profile_id
    left join public.therapist_services service on service.id=payment.service_id
    left join public.therapies therapy on therapy.id=service.therapy_id
    left join public.booking_payment_receipts receipt on receipt.booking_id=payment.booking_id
    left join lateral (
      select max(coalesce(payout.paid_at,payout.updated_at)) received_at,
        sum(transfer.amount_cents)::integer received_amount_cents
      from public.stripe_transfers transfer
      join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id=transfer.id
      join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id
      where transfer.session_payment_id=payment.id and transfer.status='transferred'
        and payout.status='paid' and payout.provider_reconciliation_status='completed'
        and payout.allocation_status='completed'
        and allocation.amount_cents=transfer.amount_cents
    ) bank on true
    where payment.therapist_profile_id=v_therapist.id
      and (p_therapy_id is null or therapy.id=p_therapy_id)
      and (v_search is null or patient.display_name ilike '%'||v_search||'%' or therapy.name ilike '%'||v_search||'%' or booking.service_title_snapshot ilike '%'||v_search||'%')
  ), base as (
    select * from raw
    where (receipt_status='paid' and received_at>=v_period.starts_at and received_at<v_period.ends_at)
       or (receipt_status<>'paid' and session_date>=v_period.starts_at and session_date<v_period.ends_at)
  ), filtered as (select * from base where p_status is null or receipt_status=p_status),
  counted as (select count(*)::integer count from filtered),
  paged as (select * from filtered order by coalesce(received_at,session_date,created_at) desc,session_payment_id desc limit v_page_size offset v_offset)
  select counted.count, coalesce(jsonb_agg(jsonb_build_object(
    'sessionPaymentId',paged.session_payment_id,'bookingId',paged.booking_id,
    'patientDisplayName',paged.patient_display_name,'therapyNameSnapshot',paged.therapy_name_snapshot,
    'sessionDate',paged.session_date,'grossAmountCents',paged.gross_amount_cents,
    'tesCommissionCents',paged.tes_commission_cents,'refundedAmountCents',paged.refunded_amount_cents,
    'therapistNetAmountCents',case when paged.receipt_status='paid' then coalesce(paged.received_amount_cents,0) else greatest(0,paged.gross_amount_cents-paged.tes_commission_cents-paged.refunded_amount_cents) end,
    'financialStatus',paged.financial_status,'receiptStatus',paged.receipt_status,
    'paymentMethodType',paged.payment_method_type,'paymentOrigin',paged.payment_origin,
    'receiptUrl',paged.receipt_url,'disputeStatus',paged.dispute_status,
    'receivedAt',paged.received_at,'createdAt',paged.created_at
  ) order by coalesce(paged.received_at,paged.session_date,paged.created_at) desc,paged.session_payment_id desc) filter(where paged.session_payment_id is not null),'[]'::jsonb)
  into v_total_count,v_items from counted left join paged on true group by counted.count;

  select coalesce(jsonb_agg(jsonb_build_object('therapyId',x.id,'name',x.name) order by x.name),'[]'::jsonb)
  into v_therapy_options from (
    select distinct therapy.id,therapy.name from public.session_payments payment
    join public.therapist_services service on service.id=payment.service_id
    join public.therapies therapy on therapy.id=service.therapy_id
    where payment.therapist_profile_id=v_therapist.id
  ) x;

  with scoped as (
    select payment.*,booking.starts_at session_date,therapy.id therapy_id,therapy.name therapy_name,
      patient.display_name patient_name,booking.service_title_snapshot,
      public.private_therapist_receipt_status_v2(payment.id) receipt_status,
      bank.received_at,
      case when public.private_therapist_receipt_status_v2(payment.id)='paid'
        then coalesce(bank.received_amount_cents,0)
        else greatest(0,payment.gross_amount_cents-payment.platform_gross_commission_cents-public.private_therapist_finance_refunded_cents_v1(payment.id)) end net_cents
    from public.session_payments payment join public.bookings booking on booking.id=payment.booking_id
    left join public.patient_profiles patient on patient.id=payment.patient_profile_id
    left join public.therapist_services service on service.id=payment.service_id
    left join public.therapies therapy on therapy.id=service.therapy_id
    left join lateral (
      select max(coalesce(payout.paid_at,payout.updated_at)) received_at,
        sum(transfer.amount_cents)::integer received_amount_cents
      from public.stripe_transfers transfer
      join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id=transfer.id
      join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id
      where transfer.session_payment_id=payment.id and transfer.status='transferred'
        and payout.status='paid' and payout.provider_reconciliation_status='completed'
        and payout.allocation_status='completed'
        and allocation.amount_cents=transfer.amount_cents
    ) bank on true
    where payment.therapist_profile_id=v_therapist.id
      and (p_therapy_id is null or therapy.id=p_therapy_id)
      and (v_search is null or patient.display_name ilike '%'||v_search||'%' or therapy.name ilike '%'||v_search||'%' or booking.service_title_snapshot ilike '%'||v_search||'%')
  ), period_scoped as (
    select * from scoped where (
      (receipt_status='paid' and received_at>=v_period.starts_at and received_at<v_period.ends_at)
      or (receipt_status<>'paid' and session_date>=v_period.starts_at and session_date<v_period.ends_at)
    )
      and (p_status is null or receipt_status=p_status)
  ), paid_scoped as (
    select distinct transfer.session_payment_id,transfer.amount_cents,payout.paid_at
    from public.stripe_transfers transfer
    join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id=transfer.id
    join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id
    join scoped on scoped.id=transfer.session_payment_id
    where payout.status='paid' and payout.provider_reconciliation_status='completed'
      and payout.allocation_status='completed'
      and allocation.amount_cents=transfer.amount_cents
      and coalesce(payout.paid_at,payout.updated_at)>=v_period.starts_at
      and coalesce(payout.paid_at,payout.updated_at)<v_period.ends_at
      and (p_status is null or p_status='paid')
  )
  select jsonb_build_object(
    'receivedCents',(select coalesce(sum(amount_cents),0)::integer from paid_scoped),
    'processingCents',(select coalesce(sum(net_cents),0)::integer from period_scoped where receipt_status in ('receivable','waiting_confirmation','waiting_safety_period','waiting_settlement','eligible','payout_processing','bank_pending')),
    'refundedCents',(select coalesce(sum(public.private_therapist_finance_refunded_cents_v1(id)),0)::integer from period_scoped),
    'disputedCents',(select coalesce(sum(gross_amount_cents),0)::integer from period_scoped where receipt_status='disputed')
  ) into v_summary;

  with months as (
    select month_start,month_start+interval '1 month' month_end
    from generate_series(date_trunc('month',v_period.starts_at),date_trunc('month',v_period.ends_at-interval '1 second'),interval '1 month') month_start
  ), scoped as (
    select payment.id,booking.starts_at session_date,therapy.id therapy_id,therapy.name therapy_name,patient.display_name patient_name,booking.service_title_snapshot,
      public.private_therapist_receipt_status_v2(payment.id) receipt_status,
      greatest(0,payment.gross_amount_cents-payment.platform_gross_commission_cents-public.private_therapist_finance_refunded_cents_v1(payment.id)) net_cents
    from public.session_payments payment join public.bookings booking on booking.id=payment.booking_id
    left join public.patient_profiles patient on patient.id=payment.patient_profile_id left join public.therapist_services service on service.id=payment.service_id left join public.therapies therapy on therapy.id=service.therapy_id
    where payment.therapist_profile_id=v_therapist.id and (p_therapy_id is null or therapy.id=p_therapy_id)
      and (v_search is null or patient.display_name ilike '%'||v_search||'%' or therapy.name ilike '%'||v_search||'%' or booking.service_title_snapshot ilike '%'||v_search||'%')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month',to_char(months.month_start at time zone v_period.timezone,'YYYY-MM'),
    'processingCents',(select coalesce(sum(s.net_cents),0)::integer from scoped s where s.session_date>=months.month_start and s.session_date<months.month_end and s.receipt_status in ('receivable','waiting_confirmation','waiting_safety_period','waiting_settlement','eligible','payout_processing','bank_pending') and (p_status is null or s.receipt_status=p_status)),
    'receivedCents',(select coalesce(sum(transfer.amount_cents),0)::integer from public.stripe_transfers transfer join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id=transfer.id join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id join scoped s on s.id=transfer.session_payment_id where payout.status='paid' and payout.provider_reconciliation_status='completed' and payout.allocation_status='completed' and allocation.amount_cents=transfer.amount_cents and coalesce(payout.paid_at,payout.updated_at)>=months.month_start and coalesce(payout.paid_at,payout.updated_at)<months.month_end and (p_status is null or p_status='paid'))
  ) order by months.month_start),'[]'::jsonb) into v_trend from months;

  with distribution_rows as (
    select public.private_therapist_receipt_status_v2(payment.id) status,
      booking.starts_at session_date,
      bank.received_at,
      case when public.private_therapist_receipt_status_v2(payment.id)='paid'
        then coalesce(bank.received_amount_cents,0)
        else greatest(0,payment.gross_amount_cents-payment.platform_gross_commission_cents-public.private_therapist_finance_refunded_cents_v1(payment.id)) end net_cents
    from public.session_payments payment join public.bookings booking on booking.id=payment.booking_id
    left join public.patient_profiles patient on patient.id=payment.patient_profile_id left join public.therapist_services service on service.id=payment.service_id left join public.therapies therapy on therapy.id=service.therapy_id
    left join lateral (
      select max(coalesce(payout.paid_at,payout.updated_at)) received_at,
        sum(transfer.amount_cents)::integer received_amount_cents
      from public.stripe_transfers transfer
      join public.stripe_payout_transfer_allocations allocation on allocation.stripe_transfer_id=transfer.id
      join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id
      where transfer.session_payment_id=payment.id and transfer.status='transferred'
        and payout.status='paid' and payout.provider_reconciliation_status='completed'
        and payout.allocation_status='completed'
        and allocation.amount_cents=transfer.amount_cents
    ) bank on true
    where payment.therapist_profile_id=v_therapist.id
      and (p_therapy_id is null or therapy.id=p_therapy_id) and (v_search is null or patient.display_name ilike '%'||v_search||'%' or therapy.name ilike '%'||v_search||'%' or booking.service_title_snapshot ilike '%'||v_search||'%')
      and (p_status is null or public.private_therapist_receipt_status_v2(payment.id)=p_status)
  ), distribution as (
    select status,sum(net_cents)::integer amount_cents,count(*)::integer item_count
    from distribution_rows
    where (status='paid' and received_at>=v_period.starts_at and received_at<v_period.ends_at)
       or (status<>'paid' and session_date>=v_period.starts_at and session_date<v_period.ends_at)
    group by 1
  ) select coalesce(jsonb_agg(jsonb_build_object('status',status,'amountCents',amount_cents,'itemCount',item_count) order by status),'[]'::jsonb) into v_distribution from distribution;

  return jsonb_build_object('contractVersion',2,'therapistProfileId',v_therapist.id,
    'items',v_items,'pagination',jsonb_build_object('page',v_page,'pageSize',v_page_size,'totalCount',v_total_count,'totalPages',case when v_total_count=0 then 0 else ceil(v_total_count::numeric/v_page_size)::integer end,'hasNextPage',v_offset+v_page_size<v_total_count),
    'filters',jsonb_build_object('status',p_status,'therapyId',p_therapy_id,'search',v_search,'periodStart',v_period.period_start,'periodEnd',v_period.period_end,'timezone',v_period.timezone),
    'therapyOptions',v_therapy_options,'summary',v_summary,'monthlyTrend',v_trend,'statusDistribution',v_distribution,'generatedAt',now());
end;
$$;

revoke all on function public.get_private_therapist_receipts_v2(date,date,text,uuid,text,integer,integer,text) from public, anon;
grant execute on function public.get_private_therapist_receipts_v2(date,date,text,uuid,text,integer,integer,text) to authenticated;

create or replace function public.get_private_therapist_payouts_v2(
  p_period_start date default null,p_period_end date default null,p_status text default null,
  p_page integer default 1,p_page_size integer default 20,p_timezone text default null
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_therapist public.therapist_profiles%rowtype; v_period record;
  v_page integer:=greatest(coalesce(p_page,1),1); v_page_size integer:=least(greatest(coalesce(p_page_size,20),1),500); v_offset integer;
  v_total_count integer:=0; v_items jsonb:='[]'::jsonb; v_summary jsonb:='{}'::jsonb;
begin
  if p_status is not null and p_status not in ('waiting_confirmation','waiting_safety_period','waiting_settlement','eligible','batched','transfer_pending','bank_pending','paid','blocked','failed','reversed') then raise exception 'VALIDATION_ERROR' using errcode='22023'; end if;
  v_therapist:=public.get_private_therapist_financial_actor_v1(); v_offset:=(v_page-1)*v_page_size;
  select * into v_period from public.normalize_private_therapist_finance_period_v1(p_period_start,p_period_end,p_timezone);
  with batch_rows as (
    select batch.id payout_batch_id,batch.reference_period_start period_start,batch.reference_period_end period_end,batch.cutoff_at expected_transfer_at,max(transfer.transferred_at) transferred_at,max(transfer.updated_at) reconciliation_updated_at,max(transfer.stripe_transfer_id) stripe_transfer_id,max(transfer.stripe_source_charge_id) stripe_source_charge_id,
      coalesce(sum(payment.gross_amount_cents),0)::integer gross_amount_cents,coalesce(sum(payment.platform_gross_commission_cents),0)::integer tes_commission_cents,coalesce(sum(public.private_therapist_finance_refunded_cents_v1(payment.id)),0)::integer refunded_amount_cents,coalesce(sum(item.amount_cents),0)::integer therapist_net_amount_cents,count(distinct item.session_payment_id)::integer session_count,
      case when bool_or(transfer.status='reversed' or payment.transfer_status='reversed') then 'reversed' when bool_or(transfer.status='failed' or item.status='failed' or payment.transfer_status='failed') then 'failed' when bool_or(item.status='blocked' or payment.transfer_status='blocked') then 'blocked'
        when bool_and(item.status='transferred' and transfer.status='transferred' and exists(select 1 from public.stripe_payout_transfer_allocations allocation join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id where allocation.stripe_transfer_id=transfer.id and payout.status='paid' and payout.provider_reconciliation_status='completed' and payout.allocation_status='completed' and allocation.amount_cents=transfer.amount_cents)) then 'paid'
        when bool_and(item.status='transferred' and transfer.status='transferred') then 'bank_pending'
        when bool_or(item.status='transfer_pending' or transfer.status='pending') or batch.status='processing' then 'transfer_pending' else 'batched' end transfer_status,
      case when bool_or(transfer.status='failed' or item.status='failed') then 'failed' when bool_or(transfer.status='reversed') then 'reversed'
        when bool_and(exists(select 1 from public.stripe_payout_transfer_allocations allocation join public.stripe_payouts payout on payout.id=allocation.stripe_payout_id where allocation.stripe_transfer_id=transfer.id and payout.status='paid' and payout.provider_reconciliation_status='completed' and payout.allocation_status='completed' and allocation.amount_cents=transfer.amount_cents)) then 'paid'
        when bool_and(transfer.stripe_transfer_id is not null and transfer.stripe_source_charge_id is not null and item.status='transferred') then 'matched' when bool_or(item.status in ('reserved','transfer_pending')) then 'pending' else 'needs_reconciliation' end reconciliation_status,
      max(item.failure_code) filter(where item.status='blocked') blocked_reason,max(item.failure_code) filter(where item.status='failed' or transfer.status='failed') failed_reason
    from public.payout_batch_items item join public.payout_batches batch on batch.id=item.payout_batch_id join public.session_payments payment on payment.id=item.session_payment_id left join public.stripe_transfers transfer on transfer.payout_batch_item_id=item.id
    where item.therapist_profile_id=v_therapist.id and batch.reference_period_start>=v_period.period_start and batch.reference_period_start<=v_period.period_end and item.status<>'removed'
    group by batch.id,batch.reference_period_start,batch.reference_period_end,batch.cutoff_at,batch.status
  ),filtered as(select * from batch_rows where p_status is null or transfer_status=p_status),counted as(select count(*)::integer count from filtered),paged as(select * from filtered order by period_start desc,payout_batch_id desc limit v_page_size offset v_offset)
  select counted.count,coalesce(jsonb_agg(jsonb_build_object('payoutBatchId',paged.payout_batch_id,'periodStart',paged.period_start,'periodEnd',paged.period_end,'grossAmountCents',paged.gross_amount_cents,'tesCommissionCents',paged.tes_commission_cents,'refundedAmountCents',paged.refunded_amount_cents,'therapistNetAmountCents',paged.therapist_net_amount_cents,'transferStatus',paged.transfer_status,'expectedTransferAt',paged.expected_transfer_at,'transferredAt',paged.transferred_at,'blockedReason',paged.blocked_reason,'failedReason',paged.failed_reason,'sessionCount',paged.session_count,'stripeTransferId',paged.stripe_transfer_id,'stripeSourceChargeId',paged.stripe_source_charge_id,'reconciliationStatus',paged.reconciliation_status,'reconciliationUpdatedAt',paged.reconciliation_updated_at) order by paged.period_start desc,paged.payout_batch_id desc) filter(where paged.payout_batch_id is not null),'[]'::jsonb)
  into v_total_count,v_items from counted left join paged on true group by counted.count;
  select jsonb_build_object(
    'eligibleForPayoutCents',coalesce(sum(payment.therapist_amount_cents) filter(where payment.transfer_status='eligible' and payment.stripe_balance_status='available' and payment.stripe_balance_available_on<=now()),0)::integer,
    'waitingConfirmationCents',coalesce(sum(payment.therapist_amount_cents) filter(where payment.transfer_status='waiting_confirmation'),0)::integer,
    'waitingSafetyPeriodCents',coalesce(sum(payment.therapist_amount_cents) filter(where payment.transfer_status='waiting_safety_period'),0)::integer,
    'waitingSettlementCents',coalesce(sum(payment.therapist_amount_cents) filter(where payment.transfer_status='waiting_settlement'),0)::integer,
    'payoutProcessingCents',coalesce(sum(payment.therapist_amount_cents) filter(where public.private_therapist_receipt_status_v2(payment.id) in ('receivable','waiting_confirmation','waiting_safety_period','waiting_settlement','eligible','payout_processing','bank_pending')),0)::integer,
    'blockedCents',coalesce(sum(payment.therapist_amount_cents) filter(where payment.transfer_status='blocked'),0)::integer,
    'blockedReasonCodes',coalesce((select jsonb_agg(distinct case when blocked.transfer_blocked_reason='connect_not_ready' then 'account' when blocked.transfer_blocked_reason in ('refund','manual_refund_review') then 'refund' when blocked.transfer_blocked_reason in ('disputed','blocked_or_contested','participant_reported_not_performed') then 'review' else 'other' end) from public.session_payments blocked where blocked.therapist_profile_id=v_therapist.id and blocked.transfer_status='blocked'),'[]'::jsonb),
    'nextBatchAt',case when exists(select 1 from public.session_payments eligible join public.therapist_connect_accounts account on account.therapist_profile_id=eligible.therapist_profile_id and account.is_current=true and account.stripe_transfers_status='active' and account.payouts_enabled=true and account.payout_status='enabled' and account.payout_schedule_interval='daily' and account.operational_status='ready' where eligible.therapist_profile_id=v_therapist.id and eligible.transfer_status='eligible' and eligible.stripe_balance_status='available' and eligible.stripe_balance_available_on<=now() and eligible.therapist_amount_cents>0) then public.next_weekly_payout_cutoff_v1(now(),now()) else null end
  ) into v_summary from public.session_payments payment where payment.therapist_profile_id=v_therapist.id;
  return jsonb_build_object('contractVersion',2,'therapistProfileId',v_therapist.id,'items',v_items,'pagination',jsonb_build_object('page',v_page,'pageSize',v_page_size,'totalCount',v_total_count,'totalPages',case when v_total_count=0 then 0 else ceil(v_total_count::numeric/v_page_size)::integer end,'hasNextPage',v_offset+v_page_size<v_total_count),'filters',jsonb_build_object('status',p_status,'periodStart',v_period.period_start,'periodEnd',v_period.period_end,'timezone',v_period.timezone),'summary',v_summary,'generatedAt',now());
end; $$;

revoke all on function public.get_private_therapist_payouts_v2(date,date,text,integer,integer,text) from public,anon;
grant execute on function public.get_private_therapist_payouts_v2(date,date,text,integer,integer,text) to authenticated;

comment on function public.get_private_therapist_receipts_v2(date,date,text,uuid,text,integer,integer,text) is
  'Therapist receipt lifecycle with full-filter summaries, monthly trend and bank-paid authority independent from pagination.';
comment on function public.get_private_therapist_payouts_v2(date,date,text,integer,integer,text) is
  'Therapist payout history and current position. Paid requires a fully reconciled automatic Payout allocation.';

create or replace function public.create_weekly_payout_batch_v2(
  p_reference_period_start date,
  p_reference_period_end date,
  p_cutoff_at timestamptz default now(),
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  if p_reference_period_start is null or p_reference_period_end is null
    or p_reference_period_start > p_reference_period_end or p_cutoff_at is null
  then raise exception 'PAYOUT_BATCH_PERIOD_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'tes-payout-batch:' || p_reference_period_start::text || ':' || p_reference_period_end::text, 0
  ));

  for v_payment_id in
    select payment.id
    from public.session_payments payment
    where payment.financial_status in ('paid','partially_refunded')
      and payment.transfer_status in ('waiting_confirmation','waiting_safety_period','waiting_settlement','eligible')
      and not exists (
        select 1 from public.payout_batch_items item
        where item.session_payment_id=payment.id
          and item.status in ('reserved','transfer_pending','transferred')
      )
    order by payment.id
    for update
  loop
    perform public.refresh_session_transfer_eligibility(v_payment_id,p_cutoff_at);
  end loop;

  if not exists (
    select 1
    from public.session_payments payment
    join public.therapist_connect_accounts account
      on account.therapist_profile_id=payment.therapist_profile_id
      and account.is_current and account.operational_status='ready'
      and account.stripe_transfers_status='active' and account.payouts_enabled
      and account.payout_status='enabled' and account.payout_schedule_interval='daily'
    where payment.transfer_status='eligible' and payment.eligible_at<=p_cutoff_at
      and payment.stripe_balance_status='available'
      and payment.stripe_balance_available_on<=p_cutoff_at
      and payment.stripe_balance_checked_at>=p_cutoff_at-interval '2 hours'
      and payment.therapist_amount_cents>0
      and payment.stripe_charge_id is not null
      and payment.stripe_balance_transaction_id is not null
      and not exists (
        select 1 from public.payout_batch_items item
        where item.session_payment_id=payment.id
          and item.status in ('reserved','transfer_pending','transferred')
      )
  ) then return null; end if;

  return public.create_weekly_payout_batch(
    p_reference_period_start,p_reference_period_end,p_cutoff_at,p_created_by
  );
end;
$$;

revoke all on function public.create_weekly_payout_batch_v2(date,date,timestamptz,uuid)
from public,anon,authenticated;
grant execute on function public.create_weekly_payout_batch_v2(date,date,timestamptz,uuid)
to service_role;

create or replace function public.claim_weekly_payout_scheduler_run_v1(
  p_now timestamptz,p_worker_id uuid,p_lease_minutes integer default 5
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_local timestamp; v_business_date date; v_cutoff_at timestamptz;
  v_window_open boolean; v_run public.payout_scheduler_runs%rowtype; v_batch_id uuid;
begin
  if p_now is null or p_worker_id is null or p_lease_minutes<1 or p_lease_minutes>30 then raise exception 'PAYOUT_SCHEDULER_CLAIM_INVALID'; end if;
  v_local:=p_now at time zone 'America/Sao_Paulo'; v_business_date:=v_local::date;
  v_window_open:=extract(dow from v_local)::integer=2 and v_local::time>=time '02:00' and v_local::time<time '04:00';
  select * into v_run from public.payout_scheduler_runs
  where status='running' and (lease_expires_at is null or lease_expires_at<=p_now or worker_id=p_worker_id)
  order by business_date asc limit 1 for update skip locked;
  if v_run.id is null and not v_window_open then return jsonb_build_object('acquired',false,'reason','outside_start_window'); end if;
  if v_run.id is null then
    v_cutoff_at:=make_timestamptz(extract(year from v_business_date)::integer,extract(month from v_business_date)::integer,extract(day from v_business_date)::integer,2,0,0,'America/Sao_Paulo');
    perform pg_advisory_xact_lock(hashtextextended('tes-weekly-payout:'||v_business_date::text,0));
    insert into public.payout_scheduler_runs(business_date,reference_period_start,reference_period_end,cutoff_at,status,worker_id,lease_expires_at,attempts)
    values(v_business_date,v_business_date-7,v_business_date-1,v_cutoff_at,'running',p_worker_id,p_now+make_interval(mins=>p_lease_minutes),1)
    on conflict(business_date) do update set worker_id=excluded.worker_id,lease_expires_at=excluded.lease_expires_at,attempts=public.payout_scheduler_runs.attempts+1,updated_at=now()
    where public.payout_scheduler_runs.status='running' and (public.payout_scheduler_runs.lease_expires_at is null or public.payout_scheduler_runs.lease_expires_at<=p_now or public.payout_scheduler_runs.worker_id=p_worker_id)
    returning * into v_run;
    if v_run.id is null then return jsonb_build_object('acquired',false,'reason','already_claimed'); end if;
  else
    update public.payout_scheduler_runs set worker_id=p_worker_id,lease_expires_at=p_now+make_interval(mins=>p_lease_minutes),attempts=attempts+1,updated_at=now() where id=v_run.id returning * into v_run;
  end if;
  if v_run.payout_batch_id is null then
    v_batch_id:=public.create_weekly_payout_batch_v2(v_run.reference_period_start,v_run.reference_period_end,v_run.cutoff_at,null);
    if v_batch_id is not null then
      update public.payout_scheduler_runs set payout_batch_id=v_batch_id,updated_at=now() where id=v_run.id returning * into v_run;
    end if;
  end if;
  return jsonb_build_object('acquired',true,'runId',v_run.id,'batchId',v_run.payout_batch_id,'businessDate',v_run.business_date,'cutoffAt',v_run.cutoff_at,'windowOpen',v_window_open,'reason',case when v_run.payout_batch_id is null then 'no_eligible_payments' else null end);
end; $$;

update public.session_payments
set transfer_status='waiting_settlement',
    transfer_blocked_reason='stripe_settlement_pending',
    updated_at=now()
where transfer_status='eligible'
  and (
    stripe_balance_status is distinct from 'available'
    or stripe_balance_available_on is null
    or stripe_balance_checked_at is null
    or stripe_balance_checked_at < now()-interval '2 hours'
  );
