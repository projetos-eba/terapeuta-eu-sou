-- V10 direct Transfers are deliberately separate from the V9 weekly batch.
-- This migration is additive: it does not activate V10 or schedule a worker.

alter table public.session_transfer_jobs
  add column if not exists prepared_at timestamptz;

alter table public.therapist_financial_debt_allocations
  alter column stripe_transfer_id drop not null,
  add column if not exists session_transfer_job_id uuid
    references public.session_transfer_jobs(id) on delete restrict;

alter table public.therapist_financial_debt_allocations
  add constraint therapist_debt_allocation_v10_target_check
  check (stripe_transfer_id is not null or session_transfer_job_id is not null);

create unique index if not exists therapist_debt_allocation_v10_job_uidx
  on public.therapist_financial_debt_allocations
  (session_transfer_job_id, therapist_financial_debt_id)
  where session_transfer_job_id is not null;

create or replace function public.derive_payout_allocation_origin_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text;
begin
  select transfer_origin into v_origin from public.stripe_transfers
  where id = new.stripe_transfer_id;
  if v_origin is null then
    raise exception 'PAYOUT_ALLOCATION_TRANSFER_NOT_FOUND' using errcode = '23514';
  end if;
  new.allocation_origin := v_origin;
  if v_origin = 'session_direct' then
    new.payout_batch_id := null;
    new.payout_batch_therapist_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists derive_payout_allocation_origin on public.stripe_payout_transfer_allocations;
create trigger derive_payout_allocation_origin
before insert or update of stripe_transfer_id
on public.stripe_payout_transfer_allocations
for each row execute function public.derive_payout_allocation_origin_v10();

create or replace function public.complete_direct_transfer_from_paid_payout_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid'
    and new.provider_reconciliation_status = 'completed'
    and new.allocation_status = 'completed' then
    update public.session_transfer_jobs job
    set status = 'transferred', updated_at = now()
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_transfers transfer on transfer.id = allocation.stripe_transfer_id
    where allocation.stripe_payout_id = new.id
      and allocation.allocation_origin = 'session_direct'
      and transfer.transfer_origin = 'session_direct'
      and job.stripe_transfer_id = transfer.id
      and job.status = 'pending_source';
  end if;
  return new;
end;
$$;

drop trigger if exists complete_direct_transfer_from_paid_payout on public.stripe_payouts;
create trigger complete_direct_transfer_from_paid_payout
after insert or update of status, provider_reconciliation_status, allocation_status
on public.stripe_payouts
for each row execute function public.complete_direct_transfer_from_paid_payout_v10();

revoke all on function public.derive_payout_allocation_origin_v10()
  from public, anon, authenticated;
revoke all on function public.complete_direct_transfer_from_paid_payout_v10()
  from public, anon, authenticated;

create or replace function public.begin_session_payment_retry_v10(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preflight jsonb;
  v_payment public.session_payments%rowtype;
begin
  v_preflight := public.preflight_session_payment_retry_v1(p_booking_id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;
  select * into v_payment from public.session_payments
  where booking_id = p_booking_id for update;
  if not found or v_payment.payment_flow_version <> 'v10' then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;
  update public.bookings
  set status = 'pending_payment', payment_status = 'pending', updated_at = now()
  where id = p_booking_id and status = 'cancelled_by_payment';
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;
  update public.session_payments
  set financial_status = 'pending', failed_at = null, canceled_at = null,
      transfer_blocked_reason = null, updated_at = now()
  where id = v_payment.id;
  return jsonb_build_object('allowed', true, 'reason', 'retry_started');
end;
$$;

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
declare
  v_claims jsonb;
begin
  if p_now is null or p_worker_id is null
    or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30 then
    raise exception 'SESSION_TRANSFER_JOB_CLAIM_V10_INVALID' using errcode = '22023';
  end if;

  with candidates as (
    select job.id
    from public.session_transfer_jobs job
    join public.session_payments payment on payment.id = job.session_payment_id
    where payment.payment_flow_version = 'v10'
      and payment.financial_status = 'paid'
      and not payment.refund_pending
      and job.status in ('queued', 'creating', 'reconciliation_required')
      and job.attempt_count < 8
      and coalesce(job.next_retry_at, job.created_at) <= p_now
      and (job.lease_expires_at is null or job.lease_expires_at <= p_now)
    order by coalesce(job.next_retry_at, job.created_at), job.id
    limit p_limit
    for update of job skip locked
  ), claimed as (
    update public.session_transfer_jobs job
    set status = 'creating', attempt_count = job.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        updated_at = p_now
    from candidates where candidates.id = job.id
    returning job.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', claimed.id,
    'sessionPaymentId', claimed.session_payment_id,
    'stripeEnvironment', claimed.stripe_environment,
    'attemptCount', claimed.attempt_count,
    'bookingId', claimed.booking_id,
    'therapistProfileId', payment.therapist_profile_id,
    'paymentIntentId', payment.stripe_payment_intent_id,
    'grossAmountCents', payment.gross_amount_cents,
    'stripeAccountId', account.stripe_account_id,
    'sourceChargeId', claimed.stripe_source_charge_id
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_claims
  from claimed
  join public.session_payments payment on payment.id = claimed.session_payment_id
  join public.therapist_connect_accounts account on account.id = claimed.connect_account_id;
  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

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
    or v_payment.admin_blocked_at is not null
    or v_payment.stripe_charge_id is distinct from v_job.stripe_source_charge_id
    or v_payment.connect_account_id_snapshot is distinct from v_job.connect_account_id
    or v_account.id is null
    or v_account.therapist_profile_id <> v_payment.therapist_profile_id
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or v_account.closed_at is not null then
    raise exception 'SESSION_TRANSFER_JOB_BINDING_NOT_READY' using errcode = '23514';
  end if;

  -- A prepared job owns its debt allocations permanently. Reclaims only
  -- reuse that frozen net amount and the same Stripe idempotency key.
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

  -- One therapist's debt offset decisions must be serialized across jobs.
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

create or replace function public.complete_session_transfer_job_v10(
  p_job_id uuid,
  p_worker_id uuid,
  p_stripe_transfer_id text,
  p_destination_payment_id text default null,
  p_connected_balance_transaction_id text default null,
  p_connected_balance_available_on timestamptz default null,
  p_transferred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.session_transfer_jobs%rowtype;
  v_transfer public.stripe_transfers%rowtype;
begin
  if nullif(trim(p_stripe_transfer_id), '') is null or p_transferred_at is null then
    raise exception 'SESSION_TRANSFER_PROVIDER_ID_INVALID' using errcode = '22023';
  end if;
  select * into v_job from public.session_transfer_jobs where id = p_job_id for update;
  if not found or v_job.stripe_transfer_id is null or v_job.prepared_at is null then
    raise exception 'SESSION_TRANSFER_JOB_NOT_PREPARED' using errcode = '23514';
  end if;
  select * into v_transfer from public.stripe_transfers
  where id = v_job.stripe_transfer_id for update;
  if v_transfer.stripe_transfer_id = p_stripe_transfer_id
    and v_transfer.status = 'transferred' then
    return jsonb_build_object('completed', true, 'duplicate', true);
  end if;
  if v_job.status <> 'creating'
    or v_job.lease_owner is distinct from p_worker_id
    or v_job.lease_expires_at <= now()
    or (v_transfer.stripe_transfer_id is not null
      and v_transfer.stripe_transfer_id <> p_stripe_transfer_id) then
    raise exception 'SESSION_TRANSFER_JOB_LEASE_OR_PROVIDER_MISMATCH'
      using errcode = '23514';
  end if;

  update public.stripe_transfers
  set stripe_transfer_id = p_stripe_transfer_id,
      stripe_destination_payment_id = nullif(trim(p_destination_payment_id), ''),
      stripe_connected_balance_transaction_id = nullif(trim(p_connected_balance_transaction_id), ''),
      connected_balance_available_on = p_connected_balance_available_on,
      transferred_at = p_transferred_at, status = 'transferred',
      failure_code = null, failure_message = null,
      updated_at = now()
  where id = v_transfer.id;

  update public.session_transfer_jobs
  set status = case when p_connected_balance_available_on is null
                      or p_connected_balance_available_on > now()
                    then 'pending_source' else 'transferred' end,
      succeeded_at = p_transferred_at, lease_owner = null,
      lease_expires_at = null, next_retry_at = null,
      last_error_code = null, updated_at = now()
  where id = v_job.id;

  update public.session_payments
  set transfer_status = 'transferred', transfer_blocked_reason = null,
      updated_at = now() where id = v_job.session_payment_id;

  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents, therapist_profile_id,
    booking_id, session_payment_id, stripe_transfer_id,
    financial_policy_version_id, transfer_origin,
    source_table, source_id, occurred_at
  ) select
    'transfer', 'debit', 'BRL', v_transfer.amount_cents,
    v_transfer.therapist_profile_id, v_job.booking_id,
    v_job.session_payment_id, v_transfer.id,
    v_job.policy_version_id, 'session_direct',
    'stripe_transfers', v_transfer.id, p_transferred_at
  on conflict do nothing;
  return jsonb_build_object('completed', true, 'duplicate', false);
end;
$$;

create or replace function public.fail_session_transfer_job_v10(
  p_job_id uuid,
  p_worker_id uuid,
  p_error_code text,
  p_ambiguous boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.session_transfer_jobs%rowtype;
  v_terminal boolean;
  v_payment public.session_payments%rowtype;
begin
  select * into v_job from public.session_transfer_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'creating'
    or v_job.lease_owner is distinct from p_worker_id then
    raise exception 'SESSION_TRANSFER_JOB_LEASE_LOST' using errcode = '23514';
  end if;
  -- An unknown provider outcome is never converted into a definitive failure.
  -- After eight claims it remains visible for manual reconciliation, but is
  -- no longer automatically retried by the claim RPC.
  v_terminal := not coalesce(p_ambiguous, true);
  update public.session_transfer_jobs
  set status = case when v_terminal then 'failed' else 'reconciliation_required' end,
      last_error_code = left(coalesce(nullif(trim(p_error_code), ''), 'provider_unknown'), 80),
      last_failed_at = now(),
      next_retry_at = case when v_terminal or v_job.attempt_count >= 8 then null
        else now() + make_interval(mins => least(60, 5 * power(2, least(v_job.attempt_count - 1, 4))::integer)) end,
      lease_owner = null, lease_expires_at = null, updated_at = now()
  where id = v_job.id;
  if v_job.stripe_transfer_id is not null then
    update public.stripe_transfers
    set status = case when v_terminal then 'failed' else 'reconciliation_required' end,
        failure_code = left(coalesce(nullif(trim(p_error_code), ''), 'provider_unknown'), 80),
        updated_at = now()
    where id = v_job.stripe_transfer_id;
  end if;
  if v_terminal then
    update public.session_payments set transfer_status = 'failed',
      updated_at = now() where id = v_job.session_payment_id;
  end if;
  if v_terminal or v_job.attempt_count >= 8 then
    select * into v_payment from public.session_payments
    where id = v_job.session_payment_id;
    perform public.record_payout_operational_incident_v1(
      'session-transfer-v10:' || v_job.id::text,
      'session_direct_transfer_attention', 'critical',
      left(coalesce(nullif(trim(p_error_code), ''), 'provider_unknown'), 80),
      'O Transfer da sessao requer verificacao operacional.',
      null, null, null, v_job.stripe_transfer_id, null,
      v_payment.therapist_profile_id,
      jsonb_build_object('sessionPaymentId', v_job.session_payment_id)
    );
  end if;
  return jsonb_build_object('status', case when v_terminal then 'failed' else 'reconciliation_required' end);
end;
$$;

revoke all on function public.claim_session_transfer_jobs_v10(timestamptz,uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function public.claim_session_transfer_jobs_v10(timestamptz,uuid,integer,integer)
  to service_role;
revoke all on function public.begin_session_payment_retry_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_session_payment_retry_v10(uuid)
  to service_role;
revoke all on function public.prepare_session_transfer_job_v10(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_session_transfer_job_v10(uuid,uuid)
  to service_role;
revoke all on function public.complete_session_transfer_job_v10(uuid,uuid,text,text,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_session_transfer_job_v10(uuid,uuid,text,text,text,timestamptz,timestamptz)
  to service_role;
revoke all on function public.fail_session_transfer_job_v10(uuid,uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.fail_session_transfer_job_v10(uuid,uuid,text,boolean)
  to service_role;
