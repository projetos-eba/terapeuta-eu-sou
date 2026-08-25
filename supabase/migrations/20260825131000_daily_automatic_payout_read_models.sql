begin;

create or replace function public.get_private_therapist_bank_payouts_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;
  v_therapist := public.get_private_therapist_financial_actor_v1();

  return jsonb_build_object(
    'contractVersion', 2,
    'therapistProfileId', v_therapist.id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'payoutBatchId', therapist_group.payout_batch_id,
        'payoutBatchTherapistId', therapist_group.id,
        'amountCents', therapist_group.total_amount_cents,
        'currency', 'BRL',
        'transferStage', case
          when stats.transfer_attention_count > 0 then 'attention'
          when stats.transfer_pending_count = 0 then 'transferred'
          else 'processing'
        end,
        'bankPayoutStatus', case
          when stats.payout_attention_count > 0 then 'attention'
          when stats.transfer_count > 0
            and stats.paid_transfer_count = stats.transfer_count then 'paid'
          when stats.paid_transfer_count > 0 then 'partially_paid'
          when stats.transfer_pending_count = 0 then 'awaiting_automatic_payout'
          else 'not_available'
        end,
        'payoutCount', stats.payout_count,
        'payoutCreatedAt', stats.payout_created_at,
        'expectedArrivalAt', stats.expected_arrival_at,
        'paidAt', stats.paid_at,
        'failedAt', stats.failed_at,
        'requiresReconciliation', stats.transfer_attention_count > 0
          or stats.payout_attention_count > 0
      ) order by therapist_group.created_at desc)
      from (
        select * from public.payout_batch_therapists group_row
        where group_row.therapist_profile_id = v_therapist.id
        order by group_row.created_at desc
        limit p_limit
      ) therapist_group
      cross join lateral (
        select
          count(distinct transfer.id)::integer as transfer_count,
          count(distinct transfer.id) filter (
            where item.status <> 'transferred'
              or transfer.status is null
              or transfer.status <> 'transferred'
          )::integer as transfer_pending_count,
          count(distinct transfer.id) filter (
            where item.status in ('failed', 'blocked')
              or transfer.status in ('failed', 'reconciliation_required', 'reversed')
          )::integer as transfer_attention_count,
          count(distinct transfer.id) filter (
            where payout.status = 'paid'
              and payout.provider_reconciliation_status = 'completed'
              and payout.allocation_status = 'completed'
          )::integer as paid_transfer_count,
          count(distinct payout.id)::integer as payout_count,
          count(distinct payout.id) filter (
            where payout.status in ('failed', 'canceled', 'reconciliation_required')
              or payout.allocation_status = 'partial'
          )::integer as payout_attention_count,
          min(payout.created_at) as payout_created_at,
          max(payout.arrival_at) as expected_arrival_at,
          max(payout.paid_at) as paid_at,
          max(payout.failed_at) as failed_at
        from public.payout_batch_items item
        left join public.stripe_transfers transfer
          on transfer.payout_batch_item_id = item.id
        left join public.stripe_payout_transfer_allocations allocation
          on allocation.stripe_transfer_id = transfer.id
        left join public.stripe_payouts payout
          on payout.id = allocation.stripe_payout_id
        where item.payout_batch_therapist_id = therapist_group.id
          and item.status <> 'removed'
      ) stats
    ), '[]'::jsonb),
    'generatedAt', now()
  );
end;
$$;

create or replace function public.get_admin_payout_operations_v1(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'admin'
      and profile.auth_deleted_at is null and profile.anonymized_at is null
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', run.id,
        'businessDate', run.business_date,
        'cutoffAt', run.cutoff_at,
        'status', run.status,
        'attempts', run.attempts,
        'startedAt', run.started_at,
        'completedAt', run.completed_at,
        'windowAlertedAt', run.window_alerted_at
      ) order by run.business_date desc)
      from (select * from public.payout_scheduler_runs order by business_date desc limit p_limit) run
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', payout.id,
        'therapistProfileId', payout.therapist_profile_id,
        'amountCents', payout.amount_cents,
        'currency', payout.currency,
        'automatic', payout.automatic,
        'status', payout.status,
        'providerReconciliationStatus', payout.provider_reconciliation_status,
        'allocationStatus', payout.allocation_status,
        'unmatchedTransactionCount', payout.unmatched_transaction_count,
        'arrivalAt', payout.arrival_at,
        'paidAt', payout.paid_at,
        'failedAt', payout.failed_at,
        'createdAt', payout.created_at
      ) order by payout.created_at desc)
      from (select * from public.stripe_payouts order by created_at desc limit p_limit) payout
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', incident.id,
        'type', incident.incident_type,
        'severity', incident.severity,
        'status', incident.status,
        'errorCode', incident.error_code,
        'occurrenceCount', incident.occurrence_count,
        'firstOccurredAt', incident.first_occurred_at,
        'lastOccurredAt', incident.last_occurred_at,
        'therapistProfileId', incident.therapist_profile_id
      ) order by incident.last_occurred_at desc)
      from (select * from public.payout_operational_incidents order by last_occurred_at desc limit p_limit) incident
    ), '[]'::jsonb),
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_private_therapist_bank_payouts_v1(integer)
  from public, anon;
grant execute on function public.get_private_therapist_bank_payouts_v1(integer)
  to authenticated, service_role;
revoke all on function public.get_admin_payout_operations_v1(integer)
  from public, anon;
grant execute on function public.get_admin_payout_operations_v1(integer)
  to authenticated, service_role;

comment on function public.get_private_therapist_bank_payouts_v1(integer) is
  'Contract v2: weekly Transfer progress and many-to-many automatic bank Payout coverage without provider identifiers.';
comment on function public.get_admin_payout_operations_v1(integer) is
  'Contract v2: sanitized weekly runs, automatic Payout reconciliation and incidents.';

commit;
