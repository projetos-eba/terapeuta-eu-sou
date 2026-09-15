begin;

-- Preserve the V9 projection as a private compatibility implementation. The
-- public reader below paginates V9 weekly batches and V10 direct transfers in
-- one deterministic history without changing either financial lifecycle.
alter function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) rename to private_therapist_payouts_v2_v9_history_legacy;

revoke all on function public.private_therapist_payouts_v2_v9_history_legacy(
  date, date, text, integer, integer, text
) from public, anon, authenticated;

create function public.get_private_therapist_payouts_v2(
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
  v_legacy jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 500);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  -- The legacy reader performs the canonical actor authorization and provides
  -- the current-position summary shared by both payment versions.
  v_legacy := public.private_therapist_payouts_v2_v9_history_legacy(
    p_period_start, p_period_end, p_status, 1, 1, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  with v9_batch_rows as (
    select
      batch.id as payout_item_id,
      batch.id as payout_batch_id,
      'weekly_batch'::text as source_kind,
      batch.reference_period_start as period_start,
      batch.reference_period_end as period_end,
      batch.cutoff_at as expected_transfer_at,
      max(transfer.transferred_at) as transferred_at,
      max(transfer.updated_at) as reconciliation_updated_at,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer
        as tes_commission_cents,
      coalesce(sum(public.private_therapist_finance_refunded_cents_v1(payment.id)), 0)::integer
        as refunded_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_net_amount_cents,
      0::integer as debt_offset_amount_cents,
      count(distinct item.session_payment_id)::integer as session_count,
      case
        when bool_or(transfer.status = 'reversed' or payment.transfer_status = 'reversed')
          then 'reversed'
        when bool_or(
          transfer.status = 'failed'
          or item.status = 'failed'
          or payment.transfer_status = 'failed'
        ) then 'failed'
        when bool_or(item.status = 'blocked' or payment.transfer_status = 'blocked')
          then 'blocked'
        when bool_and(
          item.status = 'transferred'
          and transfer.status = 'transferred'
          and exists (
            select 1
            from public.stripe_payout_transfer_allocations allocation
            join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
            where allocation.stripe_transfer_id = transfer.id
              and payout.status = 'paid'
              and payout.provider_reconciliation_status = 'completed'
              and payout.allocation_status = 'completed'
              and allocation.amount_cents = transfer.amount_cents
          )
        ) then 'paid'
        when bool_and(item.status = 'transferred' and transfer.status = 'transferred')
          then 'bank_pending'
        when bool_or(item.status = 'transfer_pending' or transfer.status = 'pending')
          or batch.status = 'processing'
          then 'transfer_pending'
        else 'batched'
      end as transfer_status,
      case
        when bool_or(transfer.status = 'failed' or item.status = 'failed') then 'failed'
        when bool_or(transfer.status = 'reversed') then 'reversed'
        when bool_and(exists (
          select 1
          from public.stripe_payout_transfer_allocations allocation
          join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
          where allocation.stripe_transfer_id = transfer.id
            and payout.status = 'paid'
            and payout.provider_reconciliation_status = 'completed'
            and payout.allocation_status = 'completed'
            and allocation.amount_cents = transfer.amount_cents
        )) then 'paid'
        when bool_and(
          transfer.stripe_transfer_id is not null
          and transfer.stripe_source_charge_id is not null
          and item.status = 'transferred'
        ) then 'matched'
        when bool_or(item.status in ('reserved', 'transfer_pending')) then 'pending'
        else 'needs_reconciliation'
      end as reconciliation_status,
      case when bool_or(item.status = 'blocked')
        then 'Repasse em análise.' else null end as blocked_reason,
      case when bool_or(item.status = 'failed' or transfer.status = 'failed')
        then 'Não foi possível concluir. Nossa equipe foi avisada.' else null end
        as failed_reason
    from public.payout_batch_items item
    join public.payout_batches batch on batch.id = item.payout_batch_id
    join public.session_payments payment on payment.id = item.session_payment_id
    left join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
    where item.therapist_profile_id = v_therapist.id
      and batch.reference_period_start >= v_period.period_start
      and batch.reference_period_start <= v_period.period_end
      and item.status <> 'removed'
    group by
      batch.id, batch.reference_period_start, batch.reference_period_end,
      batch.cutoff_at, batch.status
  ), v10_direct_rows as (
    select
      job.id as payout_item_id,
      null::uuid as payout_batch_id,
      'session_direct'::text as source_kind,
      (booking.starts_at at time zone v_period.timezone)::date as period_start,
      (booking.starts_at at time zone v_period.timezone)::date as period_end,
      coalesce(payment.paid_at, job.created_at) as expected_transfer_at,
      case when paid_payout.id is not null then paid_payout.paid_at else null end
        as transferred_at,
      greatest(job.updated_at, transfer.updated_at, paid_payout.updated_at)
        as reconciliation_updated_at,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents as tes_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id)::integer
        as refunded_amount_cents,
      job.transfer_amount_cents as therapist_net_amount_cents,
      job.debt_offset_amount_cents,
      1::integer as session_count,
      case
        when job.status = 'reversed' or transfer.status = 'reversed' then 'reversed'
        when job.status in ('partially_reversed', 'failed', 'reconciliation_required')
          or transfer.status in ('failed', 'reconciliation_required') then 'failed'
        when paid_payout.id is not null then 'paid'
        when transfer.status = 'transferred'
          or job.status in ('pending_source', 'transferred') then 'bank_pending'
        else 'transfer_pending'
      end as transfer_status,
      case
        when job.status = 'reversed' or transfer.status = 'reversed' then 'reversed'
        when job.status in ('partially_reversed', 'failed') or transfer.status = 'failed'
          then 'failed'
        when job.status = 'reconciliation_required'
          or transfer.status = 'reconciliation_required' then 'needs_reconciliation'
        when paid_payout.id is not null then 'paid'
        when transfer.status = 'transferred' and transfer.stripe_transfer_id is not null
          then 'matched'
        else 'pending'
      end as reconciliation_status,
      null::text as blocked_reason,
      case
        when job.status = 'partially_reversed'
          then 'Este repasse precisa de análise da nossa equipe.'
        when job.status in ('failed', 'reconciliation_required')
          or transfer.status in ('failed', 'reconciliation_required')
          then 'Não foi possível concluir. Nossa equipe foi avisada.'
        else null
      end as failed_reason
    from public.session_transfer_jobs job
    join public.session_payments payment on payment.id = job.session_payment_id
    join public.bookings booking on booking.id = job.booking_id
    left join public.stripe_transfers transfer on transfer.id = job.stripe_transfer_id
    left join lateral (
      select payout.id, payout.paid_at, payout.updated_at
      from public.stripe_payout_transfer_allocations allocation
      join public.stripe_payouts payout on payout.id = allocation.stripe_payout_id
      where allocation.stripe_transfer_id = transfer.id
        and allocation.allocation_origin = 'session_direct'
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
        and allocation.amount_cents = transfer.amount_cents
      order by payout.paid_at desc nulls last, payout.id desc
      limit 1
    ) paid_payout on true
    where payment.therapist_profile_id = v_therapist.id
      and payment.payment_flow_version = 'v10'
      and job.status <> 'offset_only'
      and (booking.starts_at at time zone v_period.timezone)::date
        between v_period.period_start and v_period.period_end
  ), all_rows as (
    select * from v9_batch_rows
    union all
    select * from v10_direct_rows
  ), filtered as (
    select * from all_rows
    where p_status is null or transfer_status = p_status
  ), counted as (
    select count(*)::integer as count from filtered
  ), paged as (
    select * from filtered
    order by period_start desc, payout_item_id desc
    limit v_page_size offset v_offset
  )
  select
    counted.count,
    coalesce(jsonb_agg(jsonb_build_object(
      'payoutItemId', paged.payout_item_id,
      'payoutBatchId', paged.payout_batch_id,
      'sourceKind', paged.source_kind,
      'periodStart', paged.period_start,
      'periodEnd', paged.period_end,
      'grossAmountCents', paged.gross_amount_cents,
      'tesCommissionCents', paged.tes_commission_cents,
      'refundedAmountCents', paged.refunded_amount_cents,
      'therapistNetAmountCents', paged.therapist_net_amount_cents,
      'debtOffsetAmountCents', paged.debt_offset_amount_cents,
      'transferStatus', paged.transfer_status,
      'expectedTransferAt', paged.expected_transfer_at,
      'transferredAt', paged.transferred_at,
      'blockedReason', paged.blocked_reason,
      'failedReason', paged.failed_reason,
      'sessionCount', paged.session_count,
      'stripeTransferId', null,
      'stripeSourceChargeId', null,
      'reconciliationStatus', paged.reconciliation_status,
      'reconciliationUpdatedAt', paged.reconciliation_updated_at
    ) order by paged.period_start desc, paged.payout_item_id desc)
      filter (where paged.payout_item_id is not null), '[]'::jsonb)
  into v_total_count, v_items
  from counted
  left join paged on true
  group by counted.count;

  return jsonb_build_object(
    'contractVersion', 2,
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
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone
    ),
    'summary', v_legacy -> 'summary',
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) is 'Therapist payout history unifies V9 weekly batches and V10 direct transfers without duplicate rows. Provider identifiers remain private; paid requires a fully reconciled automatic payout allocation.';

commit;
