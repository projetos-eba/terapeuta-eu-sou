-- Keep Connect Transfer and bank Payout as separate administrative states.
-- A Transfer only moves funds to the connected Stripe balance. It is not
-- evidence that Stripe created a deposit to the therapist's bank account.

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
        then bank_payout.paid_at
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
    select coalesce(sum(debt.open_amount_cents), 0)::integer
      as open_amount_cents
    from public.therapist_financial_debts as debt
    where debt.session_payment_id = payment.id
      and debt.status = 'open'
      and debt.open_amount_cents > 0
  ) as open_debt on true
  left join lateral (
    select
      payout.id,
      payout.status,
      payout.provider_reconciliation_status,
      payout.allocation_status,
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
  'Private V9/V10 admin projection that separates connected-balance Transfers from fully allocated bank Payout states.';
