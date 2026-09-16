-- A later V10 administrative-review migration unintentionally narrowed this
-- read model to V10 jobs only. Restore the historical V9 batch projection and
-- retain the V10 review state in one fail-closed, sanitized projection.

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
      when coalesce(open_debt.open_amount_cents, 0) > 0
        then 'compensation_pending'
      when job.status = 'reversed' or transfer.status = 'reversed'
        then 'reversed'
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
        then 'needs_review'
      when paid_payout.id is not null
        then 'paid'
      when job.status in ('pending_source', 'transferred')
        or transfer.status = 'transferred'
        then 'bank_pending'
      when job.status in ('queued', 'creating')
        or transfer.status in ('pending', 'creating')
        then 'processing'
      else 'processing'
    end,
    'financial_review_status', case when exists (
      select 1
      from public.booking_reschedule_requests request
      where request.booking_id = payment.booking_id
        and request.status = 'pending_admin_review'
        and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
    ) then 'therapist_change_refund_review' else null end,
    'debt_offset_amount_cents', coalesce(
      nullif(job.debt_offset_amount_cents, 0),
      nullif(transfer.debt_offset_amount_cents, 0)
    ),
    'transfer_effective_amount_cents', coalesce(
      job.transfer_amount_cents,
      transfer.amount_cents
    ),
    'bank_paid_at', paid_payout.paid_at
  ))
  from public.session_payments payment
  left join public.session_transfer_jobs job
    on job.session_payment_id = payment.id
  left join lateral (
    select candidate.*
    from public.stripe_transfers candidate
    where candidate.session_payment_id = payment.id
    order by
      (candidate.id = job.stripe_transfer_id) desc,
      coalesce(candidate.transferred_at, candidate.created_at) desc,
      candidate.id desc
    limit 1
  ) transfer on true
  left join lateral (
    select coalesce(sum(debt.open_amount_cents), 0)::integer
      as open_amount_cents
    from public.therapist_financial_debts debt
    where debt.session_payment_id = payment.id
      and debt.status = 'open'
      and debt.open_amount_cents > 0
  ) open_debt on true
  left join lateral (
    select payout.id, payout.paid_at
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
      and allocation.amount_cents = transfer.amount_cents
      and allocation.allocation_origin = case
        when payment.payment_flow_version = 'v10' then 'session_direct'
        else 'weekly_batch'
      end
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
    order by payout.paid_at desc nulls last, payout.id desc
    limit 1
  ) paid_payout on true
  where payment.id = p_session_payment_id
    and (job.id is not null or transfer.id is not null);
$$;

revoke all on function public.private_admin_session_payout_projection_v10(uuid)
  from public, anon, authenticated;

comment on function public.private_admin_session_payout_projection_v10(uuid) is
  'Private fail-closed V9/V10 payout projection with sanitized therapist-change review state.';
