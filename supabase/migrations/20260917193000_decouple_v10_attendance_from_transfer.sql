begin;

-- V10 creates the therapist Transfer as soon as the Charge is confirmed.
-- Attendance reports remain operational evidence and may not pause money.
create or replace function public.preserve_v10_immediate_transfer_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_flow_version = 'v10'
    and new.financial_status = 'paid'
    and not new.refund_pending
    and new.disputed_at is null then
    new.admin_blocked_at := null;
    new.internal_contested_at := null;

    if new.transfer_blocked_reason in (
      'session_not_performed_reported',
      'participant_reported_not_performed',
      'not_performed_confirmed_by_admin'
    ) then
      new.transfer_blocked_reason := old.transfer_blocked_reason;
      if new.transfer_status = 'blocked' then
        new.transfer_status := old.transfer_status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_v10_immediate_transfer_v1
  on public.session_payments;
create trigger preserve_v10_immediate_transfer_v1
before insert or update on public.session_payments
for each row execute function public.preserve_v10_immediate_transfer_v1();

revoke all on function public.preserve_v10_immediate_transfer_v1() from public;

-- Repair only operational holds that have no refund or provider dispute.
update public.session_payments as payment
set admin_blocked_at = null,
    internal_contested_at = null,
    transfer_blocked_reason = null,
    transfer_status = case
      when payment.transfer_status = 'blocked' and job.status = 'failed'
        then 'failed'::public.session_transfer_status
      else payment.transfer_status
    end,
    updated_at = now()
from public.session_transfer_jobs as job
where job.session_payment_id = payment.id
  and payment.payment_flow_version = 'v10'
  and payment.financial_status = 'paid'
  and not payment.refund_pending
  and payment.disputed_at is null
  and payment.transfer_blocked_reason in (
    'session_not_performed_reported',
    'participant_reported_not_performed',
    'not_performed_confirmed_by_admin'
  )
  and not exists (
    select 1 from public.session_refunds as refund
    where refund.session_payment_id = payment.id
  )
  and not exists (
    select 1 from public.session_refund_decisions_v10 as decision
    where decision.session_payment_id = payment.id
  );

create or replace function public.claim_session_transfer_jobs_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_claims jsonb;
begin
  if p_now is null or p_worker_id is null or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30 then
    raise exception 'SESSION_TRANSFER_JOB_CLAIM_V10_INVALID' using errcode = '22023';
  end if;

  with candidates as (
    select job.id
    from public.session_transfer_jobs as job
    join public.session_payments as payment on payment.id = job.session_payment_id
    where payment.payment_flow_version = 'v10'
      and payment.financial_status = 'paid'
      and not payment.refund_pending
      and payment.disputed_at is null
      and job.status in ('queued', 'creating', 'reconciliation_required')
      and job.attempt_count < 8
      and coalesce(job.next_retry_at, job.created_at) <= p_now
      and (job.lease_expires_at is null or job.lease_expires_at <= p_now)
    order by coalesce(job.next_retry_at, job.created_at), job.id
    limit p_limit for update of job skip locked
  ), claimed as (
    update public.session_transfer_jobs as job
    set status = 'creating', attempt_count = job.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        updated_at = p_now
    from candidates where candidates.id = job.id returning job.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', claimed.id,
    'sessionPaymentId', claimed.session_payment_id,
    'connectAccountId', claimed.connect_account_id,
    'stripeEnvironment', claimed.stripe_environment,
    'sourceChargeId', claimed.stripe_source_charge_id,
    'transferAmountCents', claimed.transfer_amount_cents,
    'idempotencyKey', claimed.idempotency_key,
    'requestFingerprint', claimed.request_fingerprint,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at,
    'bookingId', claimed.booking_id,
    'therapistProfileId', payment.therapist_profile_id,
    'paymentIntentId', payment.stripe_payment_intent_id,
    'grossAmountCents', payment.gross_amount_cents,
    'stripeAccountId', account.stripe_account_id
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_claims
  from claimed
  join public.session_payments as payment on payment.id = claimed.session_payment_id
  join public.therapist_connect_accounts as account on account.id = claimed.connect_account_id;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

revoke all on function public.claim_session_transfer_jobs_v10(
  timestamptz, uuid, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_session_transfer_jobs_v10(
  timestamptz, uuid, integer, integer
) to service_role;

create or replace function public.resume_session_transfer_job_v10(
  p_job_id uuid,
  p_expected_attempt_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.session_transfer_jobs%rowtype;
  v_payment public.session_payments%rowtype;
begin
  if p_job_id is null or p_expected_attempt_count is null
    or p_expected_attempt_count < 1 then
    raise exception 'SESSION_TRANSFER_RESUME_V10_INVALID' using errcode = '22023';
  end if;

  select * into v_job from public.session_transfer_jobs
  where id = p_job_id for update;
  if not found or v_job.status <> 'failed'
    or v_job.attempt_count <> p_expected_attempt_count
    or v_job.prepared_at is not null
    or v_job.stripe_transfer_id is not null
    or v_job.lease_owner is not null
    or exists (select 1 from public.stripe_transfers
      where session_payment_id = v_job.session_payment_id
        and transfer_origin = 'session_direct') then
    return jsonb_build_object('resumed', false, 'reason', 'manual_reconciliation_required');
  end if;

  select * into v_payment from public.session_payments
  where id = v_job.session_payment_id for update;
  if not found or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'paid'
    or v_payment.transfer_status <> 'failed'
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.stripe_charge_id is distinct from v_job.stripe_source_charge_id
    or v_payment.connect_account_id_snapshot is distinct from v_job.connect_account_id
    or exists (select 1 from public.session_refunds
      where session_payment_id = v_payment.id)
    or exists (select 1 from public.session_refund_decisions_v10
      where session_payment_id = v_payment.id) then
    return jsonb_build_object('resumed', false, 'reason', 'payment_not_eligible');
  end if;

  update public.session_transfer_jobs
  set status = 'creating',
      attempt_count = case when v_job.last_error_code = 'session_transfer_claim_validation_failed'
        then 0 else v_job.attempt_count end,
      last_error_code = null,
      next_retry_at = now(),
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_job.id;

  update public.session_payments
  set transfer_status = 'transfer_pending', updated_at = now()
  where id = v_payment.id;

  return jsonb_build_object('resumed', true, 'reason', 'operator_resumed');
end;
$$;

revoke all on function public.resume_session_transfer_job_v10(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.resume_session_transfer_job_v10(uuid, integer)
  to service_role;

create or replace function public.prepare_session_transfer_job_v10(
  p_job_id uuid,
  p_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.session_transfer_jobs%rowtype;
  v_payment public.session_payments%rowtype;
  v_account public.therapist_connect_accounts%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_debt public.therapist_financial_debts%rowtype;
  v_remaining integer;
  v_amount integer;
  v_offset integer := 0;
  v_net integer;
  v_ledger_id uuid;
  v_allocation_id uuid;
begin
  if p_job_id is null or p_worker_id is null then
    raise exception 'SESSION_TRANSFER_JOB_PREPARE_V10_INVALID' using errcode = '22023';
  end if;

  select * into v_job from public.session_transfer_jobs
  where id = p_job_id for update;
  if not found or v_job.status <> 'creating'
    or v_job.lease_owner is distinct from p_worker_id
    or v_job.lease_expires_at <= now() then
    raise exception 'SESSION_TRANSFER_JOB_LEASE_LOST' using errcode = '23514';
  end if;

  select * into v_payment from public.session_payments
  where id = v_job.session_payment_id for update;
  select * into v_account from public.therapist_connect_accounts
  where id = v_job.connect_account_id for update;
  if v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'paid'
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.stripe_charge_id is distinct from v_job.stripe_source_charge_id
    or v_payment.connect_account_id_snapshot is distinct from v_job.connect_account_id
    or v_account.id is null
    or v_account.therapist_profile_id <> v_payment.therapist_profile_id
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or v_account.closed_at is not null then
    raise exception 'SESSION_TRANSFER_JOB_BINDING_NOT_READY' using errcode = '23514';
  end if;

  if v_job.prepared_at is not null then
    if v_job.stripe_transfer_id is not null then
      select * into v_transfer from public.stripe_transfers
      where id = v_job.stripe_transfer_id for update;
    end if;
    return jsonb_build_object(
      'jobId', v_job.id, 'transferId', v_job.stripe_transfer_id,
      'bookingId', v_job.booking_id,
      'sessionPaymentId', v_job.session_payment_id,
      'therapistProfileId', v_payment.therapist_profile_id,
      'paymentIntentId', v_payment.stripe_payment_intent_id,
      'grossAmountCents', v_payment.gross_amount_cents,
      'stripeAccountId', v_account.stripe_account_id,
      'sourceChargeId', v_job.stripe_source_charge_id,
      'amountCents', v_job.transfer_amount_cents,
      'debtOffsetCents', v_job.debt_offset_amount_cents,
      'idempotencyKey', v_job.idempotency_key,
      'stripeTransferId', v_transfer.stripe_transfer_id
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_payment.therapist_profile_id::text, 91410)
  );
  v_remaining := v_job.therapist_gross_amount_cents;
  for v_debt in
    select * from public.therapist_financial_debts
    where therapist_profile_id = v_payment.therapist_profile_id
      and status = 'open' and open_amount_cents > 0
    order by opened_at, id for update
  loop
    exit when v_remaining = 0;
    v_amount := least(v_remaining, v_debt.open_amount_cents);
    v_allocation_id := gen_random_uuid();
    update public.therapist_financial_debts
    set open_amount_cents = open_amount_cents - v_amount,
        recovered_amount_cents = recovered_amount_cents + v_amount,
        status = case when open_amount_cents = v_amount then 'settled' else 'open' end,
        closed_at = case when open_amount_cents = v_amount then now() else null end,
        updated_at = now()
    where id = v_debt.id;

    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents,
      therapist_profile_id, booking_id, session_payment_id,
      financial_policy_version_id, transfer_origin,
      therapist_financial_debt_id, source_table, source_id, occurred_at
    ) values (
      'therapist_debt_offset', 'debit', 'BRL', v_amount,
      v_payment.therapist_profile_id, v_job.booking_id, v_job.session_payment_id,
      v_job.policy_version_id, 'session_direct',
      v_debt.id, 'therapist_financial_debt_allocations', v_allocation_id, now()
    ) returning id into v_ledger_id;

    insert into public.therapist_financial_debt_allocations (
      id, therapist_financial_debt_id, session_transfer_job_id,
      financial_ledger_entry_id, amount_cents, idempotency_key
    ) values (
      v_allocation_id, v_debt.id, v_job.id, v_ledger_id, v_amount,
      'tes:v10:debt-offset:' || v_job.id::text || ':' || v_debt.id::text
    );
    insert into public.therapist_financial_debt_events (
      therapist_financial_debt_id, event_type, direction, amount_cents,
      idempotency_key, financial_ledger_entry_id
    ) values (
      v_debt.id, 'transfer_offset', 'decrease', v_amount,
      'tes:v10:debt-event:' || v_job.id::text || ':' || v_debt.id::text,
      v_ledger_id
    );
    v_remaining := v_remaining - v_amount;
    v_offset := v_offset + v_amount;
  end loop;

  v_net := v_job.therapist_gross_amount_cents - v_offset;
  if v_net > 0 then
    insert into public.stripe_transfers (
      session_payment_id, therapist_profile_id, connect_account_id,
      idempotency_key, request_fingerprint, amount_cents, currency,
      status, stripe_source_charge_id, transfer_origin,
      therapist_gross_amount_cents, debt_offset_amount_cents
    ) values (
      v_job.session_payment_id, v_payment.therapist_profile_id,
      v_job.connect_account_id, v_job.idempotency_key,
      v_job.request_fingerprint, v_net, 'BRL', 'pending',
      v_job.stripe_source_charge_id, 'session_direct',
      v_job.therapist_gross_amount_cents, v_offset
    ) returning * into v_transfer;
  end if;

  update public.session_transfer_jobs
  set debt_offset_amount_cents = v_offset,
      transfer_amount_cents = v_net,
      stripe_transfer_id = v_transfer.id,
      prepared_at = now(),
      status = case when v_net = 0 then 'offset_only' else 'creating' end,
      succeeded_at = case when v_net = 0 then now() else null end,
      lease_owner = case when v_net = 0 then null else lease_owner end,
      lease_expires_at = case when v_net = 0 then null else lease_expires_at end,
      updated_at = now()
  where id = v_job.id;

  if v_net = 0 then
    update public.session_payments set transfer_status = 'transferred',
      updated_at = now() where id = v_job.session_payment_id;
  end if;

  return jsonb_build_object(
    'jobId', v_job.id, 'transferId', v_transfer.id,
    'bookingId', v_job.booking_id,
    'sessionPaymentId', v_job.session_payment_id,
    'therapistProfileId', v_payment.therapist_profile_id,
    'paymentIntentId', v_payment.stripe_payment_intent_id,
    'grossAmountCents', v_payment.gross_amount_cents,
    'stripeAccountId', v_account.stripe_account_id,
    'sourceChargeId', v_job.stripe_source_charge_id,
    'amountCents', v_net, 'debtOffsetCents', v_offset,
    'idempotencyKey', v_job.idempotency_key,
    'stripeTransferId', null
  );
end;
$$;

revoke all on function public.prepare_session_transfer_job_v10(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_session_transfer_job_v10(uuid, uuid)
  to service_role;

commit;
