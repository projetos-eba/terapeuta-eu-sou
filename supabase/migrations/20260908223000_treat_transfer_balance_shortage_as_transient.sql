begin;

create or replace function public.fail_payout_transfer_v1(
  p_transfer_id uuid,
  p_worker_id uuid,
  p_disposition text,
  p_error_code text,
  p_error_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.stripe_transfers%rowtype;
  v_item public.payout_batch_items%rowtype;
  v_next_retry timestamptz;
  v_terminal boolean;
  v_status text;
  v_disposition text;
begin
  if p_disposition not in ('transient', 'blocked', 'reconciliation_required') then
    raise exception 'PAYOUT_TRANSFER_DISPOSITION_INVALID';
  end if;

  v_disposition := case
    when p_disposition = 'blocked'
      and p_error_code in ('balance_insufficient', 'insufficient_funds')
      then 'transient'
    else p_disposition
  end;

  select * into v_transfer
  from public.stripe_transfers
  where id = p_transfer_id
  for update;
  if not found then raise exception 'PAYOUT_TRANSFER_NOT_FOUND'; end if;
  if v_transfer.status = 'transferred' then return 'transferred'; end if;
  if v_transfer.lease_owner <> p_worker_id then raise exception 'PAYOUT_TRANSFER_CLAIM_LOST'; end if;

  select * into v_item
  from public.payout_batch_items
  where id = v_transfer.payout_batch_item_id
  for update;

  v_terminal := v_disposition = 'blocked' or v_transfer.attempt_count >= 4;
  v_next_retry := case v_transfer.attempt_count
    when 1 then now() + interval '15 minutes'
    when 2 then now() + interval '1 hour'
    when 3 then now() + interval '4 hours'
    else null
  end;
  v_status := case
    when v_disposition = 'reconciliation_required' then 'reconciliation_required'
    else 'failed'
  end;

  update public.stripe_transfers
  set status = v_status,
      failure_code = left(coalesce(p_error_code, 'provider_error'), 120),
      failure_message = left(regexp_replace(coalesce(p_error_message, 'Falha no repasse.'), '[\r\n]+', ' ', 'g'), 500),
      next_retry_at = case when v_terminal then null else v_next_retry end,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_transfer.id;

  update public.payout_batch_items
  set status = case when v_disposition = 'blocked'
        then 'blocked'::public.payout_batch_item_status
        else 'failed'::public.payout_batch_item_status end,
      failure_code = left(coalesce(p_error_code, 'provider_error'), 120),
      failure_message = left(regexp_replace(coalesce(p_error_message, 'Falha no repasse.'), '[\r\n]+', ' ', 'g'), 500),
      updated_at = now()
  where id = v_item.id;

  update public.session_payments
  set transfer_status = case
        when v_disposition = 'blocked' then 'blocked'::public.session_transfer_status
        when v_terminal then 'failed'::public.session_transfer_status
        else 'transfer_pending'::public.session_transfer_status
      end,
      transfer_blocked_reason = left(coalesce(p_error_code, 'provider_error'), 120),
      updated_at = now()
  where id = v_transfer.session_payment_id;

  if v_terminal or v_disposition = 'reconciliation_required' then
    perform public.record_payout_operational_incident_v1(
      'transfer:' || v_transfer.id::text || ':' || v_status,
      case when v_disposition = 'blocked' then 'transfer_blocked'
        when v_disposition = 'reconciliation_required' then 'transfer_reconciliation_required'
        else 'transfer_failed' end,
      case when v_terminal then 'critical' else 'warning' end,
      p_error_code, p_error_message, null, v_item.payout_batch_id,
      v_item.id, v_transfer.id, null, v_transfer.therapist_profile_id
    );
  end if;

  return case when v_terminal then 'terminal' else v_status end;
end;
$$;

-- Repair only false-terminal shortages that have no provider Transfer and no
-- ledger debit. The same local intention, fingerprint and idempotency key are
-- retained for a later retry.
with recoverable as (
  select transfer.id as transfer_id,
         transfer.payout_batch_item_id,
         transfer.session_payment_id
  from public.stripe_transfers transfer
  join public.payout_batch_items item
    on item.id = transfer.payout_batch_item_id
  join public.session_payments payment
    on payment.id = transfer.session_payment_id
  where transfer.status = 'failed'
    and transfer.failure_code in ('balance_insufficient', 'insufficient_funds')
    and transfer.stripe_transfer_id is null
    and item.status = 'blocked'
    and payment.transfer_status = 'blocked'
    and not exists (
      select 1
      from public.financial_ledger_entries ledger
      where ledger.stripe_transfer_id = transfer.id
        and ledger.entry_type = 'transfer'
    )
), repaired_transfers as (
  update public.stripe_transfers transfer
  set next_retry_at = now() + interval '15 minutes',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  from recoverable
  where transfer.id = recoverable.transfer_id
  returning transfer.id
), repaired_items as (
  update public.payout_batch_items item
  set status = 'failed', updated_at = now()
  from recoverable
  where item.id = recoverable.payout_batch_item_id
  returning item.id
)
update public.session_payments payment
set transfer_status = 'transfer_pending', updated_at = now()
from recoverable
where payment.id = recoverable.session_payment_id;

update public.payout_operational_incidents incident
set status = 'resolved',
    resolved_at = coalesce(resolved_at, now()),
    updated_at = now()
where incident.status = 'open'
  and incident.incident_type = 'transfer_blocked'
  and incident.error_code in ('balance_insufficient', 'insufficient_funds')
  and exists (
    select 1
    from public.stripe_transfers transfer
    where transfer.id = incident.stripe_transfer_id
      and transfer.stripe_transfer_id is null
      and transfer.next_retry_at is not null
  );

revoke all on function public.fail_payout_transfer_v1(uuid, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.fail_payout_transfer_v1(uuid, uuid, text, text, text)
to service_role;

commit;
