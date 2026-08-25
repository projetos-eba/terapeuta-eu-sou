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
  if p_limit < 1 or p_limit > 100 then raise exception 'VALIDATION_ERROR' using errcode = '22023'; end if;
  v_therapist := public.get_private_therapist_financial_actor_v1();

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'payoutBatchId', therapist_group.payout_batch_id,
        'payoutBatchTherapistId', therapist_group.id,
        'amountCents', therapist_group.total_amount_cents,
        'currency', coalesce(payout.currency, 'BRL'),
        'transferStage', case
          when exists (
            select 1 from public.payout_batch_items item
            left join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
            where item.payout_batch_therapist_id = therapist_group.id
              and (item.status in ('failed', 'blocked') or transfer.status in ('failed', 'reconciliation_required', 'reversed'))
          ) then 'attention'
          when not exists (
            select 1 from public.payout_batch_items item
            where item.payout_batch_therapist_id = therapist_group.id and item.status <> 'transferred'
          ) then 'transferred'
          else 'processing'
        end,
        'bankPayoutStatus', coalesce(payout.status::text, 'not_created'),
        'payoutCreatedAt', payout.created_at,
        'expectedArrivalAt', payout.arrival_at,
        'paidAt', payout.paid_at,
        'failedAt', payout.failed_at,
        'requiresReconciliation', payout.status = 'reconciliation_required'
          or exists (
            select 1 from public.payout_batch_items item
            join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
            where item.payout_batch_therapist_id = therapist_group.id
              and transfer.status = 'reconciliation_required'
          )
      ) order by therapist_group.created_at desc)
      from (
        select * from public.payout_batch_therapists group_row
        where group_row.therapist_profile_id = v_therapist.id
        order by group_row.created_at desc
        limit p_limit
      ) therapist_group
      left join public.stripe_payouts payout
        on payout.payout_batch_therapist_id = therapist_group.id
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
  ) then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_limit < 1 or p_limit > 200 then raise exception 'VALIDATION_ERROR' using errcode = '22023'; end if;

  return jsonb_build_object(
    'contractVersion', 1,
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

revoke all on function public.get_private_therapist_bank_payouts_v1(integer) from public, anon;
grant execute on function public.get_private_therapist_bank_payouts_v1(integer) to authenticated, service_role;
revoke all on function public.get_admin_payout_operations_v1(integer) from public, anon;
grant execute on function public.get_admin_payout_operations_v1(integer) to authenticated, service_role;

comment on function public.get_private_therapist_bank_payouts_v1(integer) is
  'Separates the Connect Transfer stage from the bank Payout stage without exposing provider identifiers.';
comment on function public.get_admin_payout_operations_v1(integer) is
  'Sanitized admin-only weekly payout runs and operational incidents.';

commit;
