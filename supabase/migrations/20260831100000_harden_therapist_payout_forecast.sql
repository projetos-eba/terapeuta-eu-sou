-- Finance hardening: forecasts are therapist-scoped and Connect recovery is idempotent.

create or replace function public.get_private_therapist_payouts_v1(
  p_period_start date default null,
  p_period_end date default null,
  p_status text default null,
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
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  if p_status is not null and p_status not in (
    'waiting_confirmation', 'waiting_safety_period', 'eligible', 'batched',
    'transfer_pending', 'transferred', 'blocked', 'failed', 'reversed'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  with batch_rows as (
    select
      batch.id as payout_batch_id,
      batch.reference_period_start as period_start,
      batch.reference_period_end as period_end,
      batch.cutoff_at as expected_transfer_at,
      max(transfer.transferred_at) as transferred_at,
      max(transfer.updated_at) as reconciliation_updated_at,
      max(transfer.stripe_transfer_id) as stripe_transfer_id,
      max(transfer.stripe_source_charge_id) as stripe_source_charge_id,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer as tes_commission_cents,
      coalesce(sum(public.private_therapist_finance_refunded_cents_v1(payment.id)), 0)::integer as refunded_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_net_amount_cents,
      count(distinct item.session_payment_id)::integer as session_count,
      case
        when bool_or(transfer.status = 'reversed' or payment.transfer_status = 'reversed') then 'reversed'
        when bool_or(transfer.status = 'failed' or item.status = 'failed' or payment.transfer_status = 'failed') then 'failed'
        when bool_or(item.status = 'blocked' or payment.transfer_status = 'blocked') then 'blocked'
        when bool_and(item.status = 'transferred') or batch.status = 'completed' then 'transferred'
        when bool_or(item.status = 'transfer_pending' or transfer.status = 'pending') or batch.status = 'processing' then 'transfer_pending'
        else 'batched'
      end as transfer_status,
      case
        when bool_or(transfer.status = 'failed' or item.status = 'failed' or payment.transfer_status = 'failed') then 'failed'
        when bool_or(transfer.status = 'reversed' or payment.transfer_status = 'reversed') then 'reversed'
        when bool_and(transfer.stripe_transfer_id is not null and transfer.stripe_source_charge_id is not null and item.status = 'transferred') then 'matched'
        when bool_or(item.status in ('reserved', 'transfer_pending') or payment.transfer_status in ('batched', 'transfer_pending')) then 'pending'
        else 'needs_reconciliation'
      end as reconciliation_status,
      max(item.failure_code) filter (where item.status = 'blocked' or payment.transfer_status = 'blocked') as blocked_reason,
      max(item.failure_code) filter (where item.status = 'failed' or transfer.status = 'failed' or payment.transfer_status = 'failed') as failed_reason
    from public.payout_batch_items item
    join public.payout_batches batch on batch.id = item.payout_batch_id
    join public.session_payments payment on payment.id = item.session_payment_id
    left join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
    where item.therapist_profile_id = v_therapist.id
      and batch.reference_period_start >= v_period.period_start
      and batch.reference_period_start <= v_period.period_end
      and item.status <> 'removed'
    group by batch.id, batch.reference_period_start, batch.reference_period_end, batch.cutoff_at, batch.status
  ), filtered as (
    select * from batch_rows where p_status is null or transfer_status = p_status
  ), counted as (
    select count(*)::integer as count from filtered
  ), paged as (
    select * from filtered order by period_start desc, payout_batch_id desc limit v_page_size offset v_offset
  )
  select counted.count, coalesce(jsonb_agg(jsonb_build_object(
    'payoutBatchId', paged.payout_batch_id, 'periodStart', paged.period_start,
    'periodEnd', paged.period_end, 'grossAmountCents', paged.gross_amount_cents,
    'tesCommissionCents', paged.tes_commission_cents, 'refundedAmountCents', paged.refunded_amount_cents,
    'therapistNetAmountCents', paged.therapist_net_amount_cents, 'transferStatus', paged.transfer_status,
    'expectedTransferAt', paged.expected_transfer_at, 'transferredAt', paged.transferred_at,
    'blockedReason', paged.blocked_reason, 'failedReason', paged.failed_reason,
    'sessionCount', paged.session_count, 'stripeTransferId', paged.stripe_transfer_id,
    'stripeSourceChargeId', paged.stripe_source_charge_id, 'reconciliationStatus', paged.reconciliation_status,
    'reconciliationUpdatedAt', paged.reconciliation_updated_at
  ) order by paged.period_start desc, paged.payout_batch_id desc) filter (where paged.payout_batch_id is not null), '[]'::jsonb)
  into v_total_count, v_items
  from counted left join paged on true group by counted.count;

  select jsonb_build_object(
    'eligibleForPayoutCents', coalesce(sum(payment.therapist_amount_cents) filter (where payment.transfer_status = 'eligible'), 0)::integer,
    'waitingConfirmationCents', coalesce(sum(payment.therapist_amount_cents) filter (where payment.transfer_status = 'waiting_confirmation'), 0)::integer,
    'waitingSafetyPeriodCents', coalesce(sum(payment.therapist_amount_cents) filter (where payment.transfer_status = 'waiting_safety_period'), 0)::integer,
    'payoutProcessingCents', coalesce(sum(payment.therapist_amount_cents) filter (where payment.transfer_status in ('batched', 'transfer_pending')), 0)::integer,
    'blockedCents', coalesce(sum(payment.therapist_amount_cents) filter (where payment.transfer_status = 'blocked'), 0)::integer,
    'blockedReasonCodes', coalesce((select jsonb_agg(distinct case
      when blocked.transfer_blocked_reason = 'connect_not_ready' then 'account'
      when blocked.transfer_blocked_reason in ('refund', 'manual_refund_review') then 'refund'
      when blocked.transfer_blocked_reason in ('disputed', 'blocked_or_contested', 'participant_reported_not_performed') then 'review'
      else 'other' end)
      from public.session_payments blocked
      where blocked.therapist_profile_id = v_therapist.id
        and blocked.transfer_status = 'blocked'
        and coalesce(blocked.eligible_at, blocked.paid_at, blocked.created_at) >= v_period.starts_at
        and coalesce(blocked.eligible_at, blocked.paid_at, blocked.created_at) < v_period.ends_at), '[]'::jsonb),
    'nextBatchAt', case when exists (
      select 1 from public.session_payments eligible
      join public.therapist_connect_accounts account
        on account.therapist_profile_id = eligible.therapist_profile_id
       and account.is_current = true
       and account.stripe_transfers_status = 'active'
       and account.payouts_enabled = true
       and account.payout_status = 'enabled'
       and account.payout_schedule_interval = 'daily'
       and account.operational_status = 'ready'
      where eligible.therapist_profile_id = v_therapist.id
        and eligible.transfer_status = 'eligible'
        and eligible.therapist_amount_cents > 0
    ) then public.next_weekly_payout_cutoff_v1(now(), now()) else null end
  ) into v_summary
  from public.session_payments payment
  where payment.therapist_profile_id = v_therapist.id
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at) >= v_period.starts_at
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at) < v_period.ends_at;

  return jsonb_build_object(
    'contractVersion', 1, 'therapistProfileId', v_therapist.id, 'items', v_items,
    'pagination', jsonb_build_object('page', v_page, 'pageSize', v_page_size, 'totalCount', v_total_count,
      'totalPages', case when v_total_count = 0 then 0 else ceil(v_total_count::numeric / v_page_size)::integer end,
      'hasNextPage', v_offset + v_page_size < v_total_count),
    'filters', jsonb_build_object('status', p_status, 'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end, 'timezone', v_period.timezone),
    'summary', v_summary, 'generatedAt', now()
  );
end;
$$;

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
  select exists (select 1 from public.payout_batch_items where session_payment_id = p_session_payment_id and status in ('reserved', 'transfer_pending', 'transferred')) into v_has_active_batch;

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
    if p_now < v_eligible_at then v_status := 'waiting_safety_period'; v_reason := 'waiting_safety_period';
    else v_status := 'eligible'; v_reason := 'eligible'; end if;
  end if;
  update public.session_payments set transfer_status = v_status,
    eligible_at = case when v_status in ('waiting_safety_period', 'eligible') then v_eligible_at when v_status in ('batched', 'transfer_pending', 'transferred') then eligible_at else null end,
    transfer_blocked_reason = v_reason, updated_at = now() where id = p_session_payment_id;
  return v_status;
end;
$$;

create or replace function public.recheck_connect_blocked_payments_v1(
  p_therapist_profile_id uuid, p_now timestamptz default now()
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer := 0; v_payment_id uuid;
begin
  if p_therapist_profile_id is null then raise exception 'THERAPIST_REQUIRED' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.therapist_connect_accounts account
    where account.therapist_profile_id = p_therapist_profile_id and account.is_current = true
      and account.stripe_transfers_status = 'active' and account.payouts_enabled = true
      and account.payout_status = 'enabled' and account.payout_schedule_interval = 'daily'
      and account.operational_status = 'ready'
  ) then return 0; end if;
  for v_payment_id in
    select id from public.session_payments
    where therapist_profile_id = p_therapist_profile_id and transfer_status = 'blocked'
      and transfer_blocked_reason = 'connect_not_ready'
    order by id
    for update
  loop
    perform public.refresh_session_transfer_eligibility(v_payment_id, p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.recheck_connect_blocked_payments_v1(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.recheck_connect_blocked_payments_v1(uuid, timestamptz) to service_role;
