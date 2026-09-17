-- Restore the complete service-role claim contract required by the V10
-- Transfer worker. Keep the attendance/refund fences introduced later.
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
      and payment.admin_blocked_at is null
      and payment.internal_contested_at is null
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

revoke all on function public.claim_session_transfer_jobs_v10(timestamptz, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_session_transfer_jobs_v10(timestamptz, uuid, integer, integer)
  to service_role;

-- A claim-validation failure happened before any Stripe call or debt
-- preparation. An explicit operator resume may safely restore first-attempt
-- semantics, but only while the payment is still eligible and unrefunded.
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
    or v_payment.admin_blocked_at is not null
    or v_payment.internal_contested_at is not null
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
