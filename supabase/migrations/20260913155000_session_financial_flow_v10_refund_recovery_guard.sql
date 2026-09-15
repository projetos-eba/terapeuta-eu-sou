-- Keep the actor bound to the original support decision on every retry.
create function public.claim_full_session_refund_v10_v3(
  p_actor_user_id uuid, p_session_payment_id uuid,
  p_request_id text, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  perform 1 from public.session_payments
  where id = p_session_payment_id for update;
  select actor_user_id into v_actor
  from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if v_actor is not null and v_actor <> p_actor_user_id then
    raise exception 'FULL_REFUND_DECISION_ALREADY_EXISTS' using errcode = '23505';
  end if;
  return public.claim_full_session_refund_v10_v2(
    p_actor_user_id, p_session_payment_id, p_request_id, p_reason);
end;
$$;
revoke all on function public.claim_full_session_refund_v10_v3(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_full_session_refund_v10_v3(uuid,uuid,text,text)
  to service_role;

-- The earlier decision/status surfaces were never shipped. Remove them so
-- callers cannot accidentally use the obsolete pending-source rule.
drop function public.claim_full_session_refund_v10(uuid,uuid,text,text);
drop function public.admin_get_full_session_refund_status_v10(uuid);

-- The underlying ledger reconciliation remains idempotent; this readout
-- refuses to report success while a double-recovery incident is open.
create function public.reconcile_full_session_refund_debt_v10_v2(
  p_session_payment_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_decision public.session_refund_decisions_v10%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_reversed integer;
begin
  v_result := public.reconcile_full_session_refund_debt_v10(p_session_payment_id);
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id for update;
  if not found then return v_result; end if;
  if exists (select 1 from public.session_refund_incidents_v10
    where session_refund_decision_id = v_decision.id and resolved_at is null) then
    return jsonb_set(v_result, '{status}', '"recovery_requires_review"'::jsonb);
  end if;
  if v_decision.stripe_transfer_id is not null then
    select * into v_transfer from public.stripe_transfers
    where stripe_transfer_id = v_decision.stripe_transfer_id;
    if found then
      select coalesce(sum(amount_cents), 0) into v_reversed
      from public.stripe_transfer_reversals
      where stripe_transfer_id = v_transfer.id and status = 'succeeded';
      if v_reversed = v_transfer.amount_cents
        and v_decision.reversal_state = 'unavailable' then
        update public.session_refund_decisions_v10
        set reversal_state = 'complete', updated_at = now()
        where id = v_decision.id;
      end if;
    end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.reconcile_full_session_refund_debt_v10_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_full_session_refund_debt_v10_v2(uuid)
  to service_role;
