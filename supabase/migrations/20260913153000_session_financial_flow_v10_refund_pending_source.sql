-- A created, source-bound Transfer can still be waiting for availability.
-- The job is pending_source, but its provider Transfer already exists and can
-- be reversed. Only an in-flight or ambiguous creation must stop the refund.
create or replace function public.claim_full_session_refund_v10_v2(
  p_actor_user_id uuid, p_session_payment_id uuid,
  p_request_id text, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_job public.session_transfer_jobs%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_decision public.session_refund_decisions_v10%rowtype;
begin
  if p_actor_user_id is null or p_session_payment_id is null
    or length(btrim(coalesce(p_request_id, ''))) not between 8 and 128
    or length(btrim(coalesce(p_reason, ''))) not between 20 and 1000
    or not exists (select 1 from public.profiles where id = p_actor_user_id
      and role = 'admin' and auth_deleted_at is null and anonymized_at is null) then
    raise exception 'FULL_REFUND_REQUEST_INVALID' using errcode = '22023';
  end if;
  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  if not found or v_payment.payment_flow_version <> 'v10' then
    raise exception 'FULL_REFUND_PAYMENT_NOT_READY' using errcode = '23514';
  end if;
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id for update;
  if found then
    if v_decision.request_id <> btrim(p_request_id)
      or v_decision.reason <> btrim(p_reason) then
      raise exception 'FULL_REFUND_DECISION_ALREADY_EXISTS' using errcode = '23505';
    end if;
    return jsonb_build_object('decisionId', v_decision.id,
      'amountCents', v_decision.amount_cents, 'chargeId', v_decision.stripe_charge_id,
      'transferId', v_decision.stripe_transfer_id,
      'reversalState', v_decision.reversal_state,
      'refundState', v_decision.refund_state, 'existing', true);
  end if;
  if v_payment.financial_status <> 'paid' or v_payment.stripe_charge_id is null
    or v_payment.disputed_at is not null or v_payment.currency <> 'BRL'
    or v_payment.refund_pending or v_payment.admin_blocked_at is not null
    or exists (select 1 from public.session_refunds
      where session_payment_id = p_session_payment_id) then
    raise exception 'FULL_REFUND_REQUIRES_REVIEW' using errcode = '23514';
  end if;
  select * into v_job from public.session_transfer_jobs
  where session_payment_id = p_session_payment_id;
  if v_job.id is not null and (
    v_job.status in ('creating','reconciliation_required','failed','partially_reversed')
    or v_job.lease_owner is not null
    or (v_job.prepared_at is not null and v_job.status not in
      ('pending_source','transferred','offset_only','reversed'))
    or (v_job.status = 'pending_source' and v_job.stripe_transfer_id is null)
  ) then raise exception 'FULL_REFUND_TRANSFER_REQUIRES_REVIEW' using errcode = '23514'; end if;
  if v_job.stripe_transfer_id is not null then
    select * into v_transfer from public.stripe_transfers
    where id = v_job.stripe_transfer_id;
    if not found or v_transfer.stripe_transfer_id is null
      or v_transfer.transfer_origin <> 'session_direct'
      or v_transfer.session_payment_id <> v_payment.id
      or v_transfer.stripe_source_charge_id <> v_payment.stripe_charge_id
      or v_transfer.status not in ('transferred','reversed') then
      raise exception 'FULL_REFUND_TRANSFER_REQUIRES_REVIEW' using errcode = '23514';
    end if;
  end if;
  insert into public.session_refund_decisions_v10 (
    session_payment_id, actor_user_id, request_id, reason, amount_cents,
    therapist_exposure_cents, stripe_charge_id, stripe_transfer_id, reversal_state
  ) values (
    v_payment.id, p_actor_user_id, btrim(p_request_id), btrim(p_reason),
    v_payment.gross_amount_cents,
    case when v_job.prepared_at is not null then v_job.therapist_gross_amount_cents else 0 end,
    v_payment.stripe_charge_id, v_transfer.stripe_transfer_id,
    case when v_transfer.stripe_transfer_id is null or v_transfer.status = 'reversed'
      then 'not_needed' else 'not_attempted' end
  ) returning * into v_decision;
  update public.session_payments set refund_pending = true,
    admin_blocked_at = coalesce(admin_blocked_at, now()), updated_at = now()
  where id = v_payment.id;
  insert into public.admin_audit_events (
    actor_user_id, actor_role, permission, action, entity_type, entity_id,
    previous_state, next_state, reason, request_id, source
  ) values (
    p_actor_user_id, 'admin', 'admin.payments.refund', 'payment.full_refund_requested',
    'session_payment', v_payment.id::text,
    jsonb_build_object('financialStatus', v_payment.financial_status),
    jsonb_build_object('decisionId', v_decision.id, 'amountCents', v_decision.amount_cents),
    btrim(p_reason), btrim(p_request_id), 'admin'
  );
  return jsonb_build_object('decisionId', v_decision.id,
    'amountCents', v_decision.amount_cents, 'chargeId', v_decision.stripe_charge_id,
    'transferId', v_decision.stripe_transfer_id,
    'reversalState', v_decision.reversal_state,
    'refundState', v_decision.refund_state, 'existing', false);
end;
$$;
revoke all on function public.claim_full_session_refund_v10_v2(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_full_session_refund_v10_v2(uuid,uuid,text,text)
  to service_role;

create or replace function public.admin_get_full_session_refund_status_v11(
  p_session_payment_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_decision public.session_refund_decisions_v10%rowtype;
  v_job public.session_transfer_jobs%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
      and auth_deleted_at is null and anonymized_at is null
  ) then raise exception 'ADMIN_REFUND_FORBIDDEN' using errcode = '42501'; end if;
  select * into v_payment from public.session_payments where id = p_session_payment_id;
  if not found then return jsonb_build_object('available', false, 'state', 'not_found'); end if;
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if found then return jsonb_build_object('available', false, 'state',
    case when v_payment.financial_status = 'refunded' then 'refunded' else 'in_review' end); end if;
  select * into v_job from public.session_transfer_jobs
  where session_payment_id = p_session_payment_id;
  return jsonb_build_object('available',
    v_payment.payment_flow_version = 'v10' and v_payment.financial_status = 'paid'
    and v_payment.stripe_charge_id is not null and v_payment.disputed_at is null
    and v_payment.admin_blocked_at is null and not v_payment.refund_pending
    and not exists (select 1 from public.session_refunds
      where session_payment_id = p_session_payment_id)
    and (v_job.id is null or (v_job.status in
      ('queued','pending_source','transferred','offset_only','reversed')
      and v_job.lease_owner is null
      and (v_job.prepared_at is null or v_job.status <> 'queued')
      and (v_job.status <> 'pending_source' or v_job.stripe_transfer_id is not null))),
    'state', case when v_payment.financial_status = 'refunded' then 'refunded'
      when v_payment.payment_flow_version <> 'v10' then 'other_flow'
      else 'unavailable' end);
end;
$$;
revoke all on function public.admin_get_full_session_refund_status_v11(uuid)
  from public, anon;
grant execute on function public.admin_get_full_session_refund_status_v11(uuid)
  to authenticated;
