begin;

-- An incident can predate preparation of the Stripe Transfer. The incident
-- key and recorded session payment still bind it to the exact successful job;
-- a non-null binding to another Transfer must never be auto-resolved.
create or replace function public.resolve_successful_session_direct_transfer_attention_v10(
  p_session_payment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved integer;
begin
  update public.payout_operational_incidents as incident
  set status = 'resolved',
      resolved_at = coalesce(incident.resolved_at, now()),
      metadata = incident.metadata || jsonb_build_object(
        'resolution', 'confirmed_source_bound_transfer'
      ),
      updated_at = now()
  from public.session_transfer_jobs as job
  join public.stripe_transfers as transfer
    on transfer.id = job.stripe_transfer_id
  join public.session_payments as payment
    on payment.id = job.session_payment_id
  where payment.id = p_session_payment_id
    and payment.payment_flow_version = 'v10'
    and payment.financial_status = 'paid'
    and payment.transfer_status = 'transferred'
    and job.status in ('pending_source', 'transferred')
    and job.succeeded_at is not null
    and job.transfer_amount_cents > 0
    and transfer.transfer_origin = 'session_direct'
    and transfer.status = 'transferred'
    and transfer.stripe_transfer_id is not null
    and transfer.transferred_at is not null
    and transfer.session_payment_id = payment.id
    and transfer.connect_account_id = job.connect_account_id
    and transfer.stripe_source_charge_id = job.stripe_source_charge_id
    and transfer.amount_cents = job.transfer_amount_cents
    and incident.incident_key = 'session-transfer-v10:' || job.id::text
    and incident.incident_type = 'session_direct_transfer_attention'
    and (
      incident.stripe_transfer_id = transfer.id
      or (
        incident.stripe_transfer_id is null
        and incident.metadata ->> 'sessionPaymentId' = payment.id::text
      )
    )
    and incident.status = 'open';
  get diagnostics v_resolved = row_count;
  return v_resolved;
end;
$$;

select public.resolve_successful_session_direct_transfer_attention_v10(payment.id)
from public.session_payments as payment
where payment.payment_flow_version = 'v10'
  and payment.financial_status = 'paid'
  and payment.transfer_status = 'transferred'
  and exists (
    select 1 from public.session_transfer_jobs as job
    join public.payout_operational_incidents as incident
      on incident.incident_key = 'session-transfer-v10:' || job.id::text
    where job.session_payment_id = payment.id
      and incident.incident_type = 'session_direct_transfer_attention'
      and incident.status = 'open'
  );

commit;
