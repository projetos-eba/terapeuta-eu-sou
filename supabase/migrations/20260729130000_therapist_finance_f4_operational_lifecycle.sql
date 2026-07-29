create or replace function public.record_session_payment_stripe_reconciliation_v1(
  p_session_payment_id uuid,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_charge_id text default null,
  p_stripe_balance_transaction_id text default null,
  p_stripe_fee_amount_cents integer default null,
  p_stripe_net_amount_cents integer default null,
  p_payment_method_type text default null,
  p_payment_origin text default 'stripe_checkout',
  p_receipt_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  select *
    into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  end if;

  if v_payment.stripe_event_created_at is not null
    and p_stripe_event_created_at < v_payment.stripe_event_created_at then
    return jsonb_build_object('applied', false, 'reason', 'stale_event');
  end if;

  update public.session_payments
  set stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
      stripe_balance_transaction_id = coalesce(
        p_stripe_balance_transaction_id,
        stripe_balance_transaction_id
      ),
      stripe_fee_amount_cents = coalesce(
        p_stripe_fee_amount_cents,
        stripe_fee_amount_cents
      ),
      stripe_net_amount_cents = coalesce(
        p_stripe_net_amount_cents,
        stripe_net_amount_cents
      ),
      metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
        'paymentMethodType', p_payment_method_type,
        'paymentOrigin', p_payment_origin,
        'receiptUrlAvailable', p_receipt_url is not null
      )),
      updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  if p_receipt_url is not null
    or v_payment.financial_status in (
      'paid',
      'partially_refunded',
      'refunded',
      'disputed'
    ) then
    insert into public.booking_payment_receipts (
      booking_id,
      amount_cents,
      currency,
      provider,
      receipt_url,
      paid_at
    ) values (
      v_payment.booking_id,
      v_payment.gross_amount_cents,
      v_payment.currency,
      'stripe',
      p_receipt_url,
      v_payment.paid_at
    )
    on conflict (booking_id) do update
    set amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        provider = excluded.provider,
        receipt_url = coalesce(excluded.receipt_url, public.booking_payment_receipts.receipt_url),
        paid_at = coalesce(excluded.paid_at, public.booking_payment_receipts.paid_at),
        updated_at = now();
  end if;

  if p_stripe_balance_transaction_id is not null
    and p_stripe_fee_amount_cents is not null
    and p_stripe_fee_amount_cents > 0 then
    insert into public.financial_ledger_entries (
      entry_type,
      direction,
      amount_cents,
      patient_profile_id,
      therapist_profile_id,
      booking_id,
      session_payment_id,
      stripe_event_id,
      source_table,
      source_external_id,
      occurred_at
    ) values (
      'stripe_fee',
      'debit',
      p_stripe_fee_amount_cents,
      v_payment.patient_profile_id,
      v_payment.therapist_profile_id,
      v_payment.booking_id,
      v_payment.id,
      p_stripe_event_id,
      'stripe_balance_transactions',
      p_stripe_balance_transaction_id,
      p_stripe_event_created_at
    )
    on conflict (entry_type, source_table, source_external_id, direction)
    do nothing;
  end if;

  return jsonb_build_object(
    'applied', true,
    'sessionPaymentId', v_payment.id,
    'receiptRecorded', p_receipt_url is not null
  );
end;
$$;

revoke all on function public.record_session_payment_stripe_reconciliation_v1(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_session_payment_stripe_reconciliation_v1(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text
) to service_role;

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
    'waiting_confirmation',
    'waiting_safety_period',
    'eligible',
    'batched',
    'transfer_pending',
    'transferred',
    'blocked',
    'failed',
    'reversed'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;

  select *
    into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
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
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer
        as tes_commission_cents,
      coalesce(sum(public.private_therapist_finance_refunded_cents_v1(payment.id)), 0)::integer
        as refunded_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_net_amount_cents,
      count(distinct item.session_payment_id)::integer as session_count,
      case
        when bool_or(transfer.status = 'reversed'
          or payment.transfer_status = 'reversed') then 'reversed'
        when bool_or(transfer.status = 'failed'
          or item.status = 'failed'
          or payment.transfer_status = 'failed') then 'failed'
        when bool_or(item.status = 'blocked'
          or payment.transfer_status = 'blocked') then 'blocked'
        when bool_and(item.status = 'transferred')
          or batch.status = 'completed' then 'transferred'
        when bool_or(item.status = 'transfer_pending'
          or transfer.status = 'pending')
          or batch.status = 'processing' then 'transfer_pending'
        else 'batched'
      end as transfer_status,
      case
        when bool_or(transfer.status = 'failed'
          or item.status = 'failed'
          or payment.transfer_status = 'failed') then 'failed'
        when bool_or(transfer.status = 'reversed'
          or payment.transfer_status = 'reversed') then 'reversed'
        when bool_and(transfer.stripe_transfer_id is not null
          and transfer.stripe_source_charge_id is not null
          and item.status = 'transferred') then 'matched'
        when bool_or(item.status in ('reserved', 'transfer_pending')
          or payment.transfer_status in ('batched', 'transfer_pending')) then 'pending'
        else 'needs_reconciliation'
      end as reconciliation_status,
      max(item.failure_code) filter (
        where item.status = 'blocked' or payment.transfer_status = 'blocked'
      ) as blocked_reason,
      max(item.failure_code) filter (
        where item.status = 'failed'
          or transfer.status = 'failed'
          or payment.transfer_status = 'failed'
      ) as failed_reason
    from public.payout_batch_items as item
    join public.payout_batches as batch
      on batch.id = item.payout_batch_id
    join public.session_payments as payment
      on payment.id = item.session_payment_id
    left join public.stripe_transfers as transfer
      on transfer.payout_batch_item_id = item.id
    where item.therapist_profile_id = v_therapist.id
      and batch.reference_period_start >= v_period.period_start
      and batch.reference_period_start <= v_period.period_end
      and item.status <> 'removed'
    group by batch.id, batch.reference_period_start, batch.reference_period_end,
      batch.cutoff_at, batch.status
  ),
  filtered as (
    select *
    from batch_rows
    where p_status is null or transfer_status = p_status
  ),
  counted as (
    select count(*)::integer as count from filtered
  ),
  paged as (
    select *
    from filtered
    order by period_start desc, payout_batch_id desc
    limit v_page_size
    offset v_offset
  )
  select
    counted.count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'payoutBatchId', paged.payout_batch_id,
          'periodStart', paged.period_start,
          'periodEnd', paged.period_end,
          'grossAmountCents', paged.gross_amount_cents,
          'tesCommissionCents', paged.tes_commission_cents,
          'refundedAmountCents', paged.refunded_amount_cents,
          'therapistNetAmountCents', paged.therapist_net_amount_cents,
          'transferStatus', paged.transfer_status,
          'expectedTransferAt', paged.expected_transfer_at,
          'transferredAt', paged.transferred_at,
          'blockedReason', paged.blocked_reason,
          'failedReason', paged.failed_reason,
          'sessionCount', paged.session_count,
          'stripeTransferId', paged.stripe_transfer_id,
          'stripeSourceChargeId', paged.stripe_source_charge_id,
          'reconciliationStatus', paged.reconciliation_status,
          'reconciliationUpdatedAt', paged.reconciliation_updated_at
        )
        order by paged.period_start desc, paged.payout_batch_id desc
      ) filter (where paged.payout_batch_id is not null),
      '[]'::jsonb
    )
    into v_total_count, v_items
  from counted
  left join paged on true
  group by counted.count;

  select jsonb_build_object(
    'eligibleForPayoutCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'eligible'
    ), 0)::integer,
    'waitingConfirmationCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_confirmation'
    ), 0)::integer,
    'waitingSafetyPeriodCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_safety_period'
    ), 0)::integer,
    'payoutProcessingCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status in ('batched', 'transfer_pending')
    ), 0)::integer,
    'blockedCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'blocked'
    ), 0)::integer,
    'nextBatchAt', (
      select min(batch.cutoff_at)
      from public.payout_batches as batch
      where batch.status in ('open', 'processing')
        and batch.cutoff_at >= now()
    )
  )
    into v_summary
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      >= v_period.starts_at
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      < v_period.ends_at;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'items', v_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case
        when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer
      end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    'filters', jsonb_build_object(
      'status', p_status,
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone
    ),
    'summary', v_summary,
    'generatedAt', now()
  );
end;
$$;

comment on function public.record_session_payment_stripe_reconciliation_v1(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text
) is
  'Registra comprovante e conciliacao de Charge/Balance Transaction para pagamento de sessao confirmado exclusivamente por webhook Stripe.';

comment on function public.get_private_therapist_payouts_v1(
  date,
  date,
  text,
  integer,
  integer,
  text
) is
  'Read model privado de repasses do terapeuta, incluindo status de conciliacao de transferencias Connect.';
