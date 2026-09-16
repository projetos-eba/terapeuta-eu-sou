-- V10 support decisions are full-session refunds only. Provider-originated
-- partial refunds remain observable, but cannot be initiated by TES.
create table public.session_refund_decisions_v10 (
  id uuid primary key default gen_random_uuid(),
  session_payment_id uuid not null unique references public.session_payments(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  request_id text not null unique,
  reason text not null,
  amount_cents integer not null check (amount_cents > 0),
  therapist_exposure_cents integer not null check (therapist_exposure_cents >= 0),
  stripe_charge_id text not null,
  stripe_transfer_id text,
  reversal_state text not null default 'not_attempted'
    check (reversal_state in ('not_needed','not_attempted','attempting','complete','unavailable','unknown')),
  refund_state text not null default 'not_attempted'
    check (refund_state in ('not_attempted','attempting','pending','complete','failed','unknown')),
  reversal_attempted_at timestamptz,
  refund_attempted_at timestamptz,
  recovery_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_refund_decisions_v10_reason_length check (length(btrim(reason)) between 20 and 1000),
  constraint session_refund_decisions_v10_request_length check (length(btrim(request_id)) between 8 and 128)
);

create table public.session_refund_incidents_v10 (
  id uuid primary key default gen_random_uuid(),
  session_refund_decision_id uuid not null references public.session_refund_decisions_v10(id) on delete restrict,
  code text not null,
  expected_amount_cents integer not null default 0,
  observed_amount_cents integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (session_refund_decision_id, code)
);

revoke all on public.session_refund_decisions_v10, public.session_refund_incidents_v10
  from public, anon, authenticated;
grant select, insert, update on public.session_refund_decisions_v10 to service_role;
grant select, insert, update on public.session_refund_incidents_v10 to service_role;

create or replace function public.claim_full_session_refund_v10(
  p_actor_user_id uuid,
  p_session_payment_id uuid,
  p_request_id text,
  p_reason text
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
    or not exists (select 1 from public.profiles where id = p_actor_user_id and role = 'admin') then
    raise exception 'FULL_REFUND_REQUEST_INVALID' using errcode = '22023';
  end if;

  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  if not found or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'paid'
    or v_payment.stripe_charge_id is null
    or v_payment.disputed_at is not null
    or v_payment.currency <> 'BRL' then
    raise exception 'FULL_REFUND_PAYMENT_NOT_READY' using errcode = '23514';
  end if;

  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = v_payment.id for update;
  if found then
    if v_decision.actor_user_id <> p_actor_user_id
      or v_decision.request_id <> p_request_id
      or v_decision.reason <> btrim(p_reason) then
      raise exception 'FULL_REFUND_DECISION_ALREADY_EXISTS' using errcode = '23505';
    end if;
    return jsonb_build_object('decisionId', v_decision.id,
      'amountCents', v_decision.amount_cents, 'chargeId', v_decision.stripe_charge_id,
      'transferId', v_decision.stripe_transfer_id, 'reversalState', v_decision.reversal_state,
      'refundState', v_decision.refund_state, 'existing', true);
  end if;

  if v_payment.refund_pending or v_payment.admin_blocked_at is not null
    or exists (select 1 from public.session_refunds where session_payment_id = v_payment.id) then
    raise exception 'FULL_REFUND_REQUIRES_REVIEW' using errcode = '23514';
  end if;

  select * into v_job from public.session_transfer_jobs
  where session_payment_id = v_payment.id;
  if found and (v_job.status in ('creating','pending_source','reconciliation_required','failed')
    or (v_job.prepared_at is not null and v_job.status not in
      ('transferred','offset_only','reversed','partially_reversed'))
    or v_job.status = 'partially_reversed') then
    raise exception 'FULL_REFUND_TRANSFER_REQUIRES_REVIEW' using errcode = '23514';
  end if;
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
    'transferId', v_decision.stripe_transfer_id, 'reversalState', v_decision.reversal_state,
    'refundState', v_decision.refund_state, 'existing', false);
end;
$$;

create or replace function public.transition_full_session_refund_step_v10(
  p_decision_id uuid, p_step text, p_state text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_decision public.session_refund_decisions_v10%rowtype;
begin
  select * into v_decision from public.session_refund_decisions_v10
  where id = p_decision_id for update;
  if not found then raise exception 'FULL_REFUND_DECISION_NOT_FOUND' using errcode = '23514'; end if;
  if p_step = 'reversal' then
    if p_state = 'attempting' and v_decision.reversal_state = 'not_attempted' then
      update public.session_refund_decisions_v10 set reversal_state = 'attempting',
        reversal_attempted_at = now(), updated_at = now() where id = p_decision_id;
    elsif p_state in ('complete','unavailable','unknown')
      and v_decision.reversal_state in ('attempting','unknown') then
      update public.session_refund_decisions_v10 set reversal_state = p_state,
        updated_at = now() where id = p_decision_id;
    else raise exception 'FULL_REFUND_STEP_TRANSITION_INVALID' using errcode = '23514'; end if;
  elsif p_step = 'refund' then
    if p_state = 'attempting' and v_decision.refund_state = 'not_attempted' then
      update public.session_refund_decisions_v10 set refund_state = 'attempting',
        refund_attempted_at = now(), updated_at = now() where id = p_decision_id;
    elsif p_state in ('pending','complete','failed','unknown')
      and v_decision.refund_state in ('attempting','pending','unknown') then
      update public.session_refund_decisions_v10 set refund_state = p_state,
        updated_at = now() where id = p_decision_id;
    else raise exception 'FULL_REFUND_STEP_TRANSITION_INVALID' using errcode = '23514'; end if;
  else raise exception 'FULL_REFUND_STEP_INVALID' using errcode = '22023'; end if;
  return jsonb_build_object('decisionId', p_decision_id, 'state', p_state);
end;
$$;

-- Called after signed provider reconciliation, including later webhooks.
-- A late recovery reduces only the unpaid part of the debt. Any excess is
-- quarantined for manual correction rather than silently recovered twice.
create or replace function public.reconcile_full_session_refund_debt_v10(
  p_session_payment_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_decision public.session_refund_decisions_v10%rowtype;
  v_debt public.therapist_financial_debts%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_refunded integer;
  v_reversed integer := 0;
  v_initial_reversed integer;
  v_prior_recovery integer;
  v_due integer;
  v_delta integer;
  v_reduce integer;
  v_ledger_id uuid;
begin
  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id for update;
  if not found then return jsonb_build_object('status', 'no_decision'); end if;
  select coalesce(sum(amount_cents), 0) into v_refunded
  from public.session_refunds
  where session_payment_id = p_session_payment_id and status = 'succeeded';
  if v_refunded <> v_decision.amount_cents then
    return jsonb_build_object('status', 'awaiting_full_refund');
  end if;

  if v_decision.stripe_transfer_id is not null then
    select * into v_transfer from public.stripe_transfers
    where stripe_transfer_id = v_decision.stripe_transfer_id;
    if not found or v_transfer.session_payment_id <> p_session_payment_id then
      raise exception 'FULL_REFUND_TRANSFER_MISMATCH' using errcode = '23514';
    end if;
    select coalesce(sum(amount_cents), 0) into v_reversed
    from public.stripe_transfer_reversals
    where stripe_transfer_id = v_transfer.id and status = 'succeeded';
    if v_reversed < v_transfer.amount_cents
      and v_decision.reversal_state not in ('unavailable','complete') then
      return jsonb_build_object('status', 'recovery_requires_review');
    end if;
  end if;

  v_due := greatest(0, v_decision.therapist_exposure_cents - v_reversed);
  select * into v_debt from public.therapist_financial_debts
  where session_payment_id = p_session_payment_id and origin = 'refund' for update;
  if v_debt.id is null and v_due > 0 then
    insert into public.therapist_financial_debts (
      therapist_profile_id, session_payment_id, stripe_transfer_id,
      origin, reason_code, principal_amount_cents, open_amount_cents,
      metadata
    ) values (
      v_payment.therapist_profile_id, p_session_payment_id, v_transfer.id,
      'refund', 'full_session_refund', v_due, v_due,
      jsonb_build_object('decisionId', v_decision.id, 'initialReversedCents', v_reversed)
    ) returning * into v_debt;
    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents, therapist_profile_id,
      booking_id, session_payment_id, financial_policy_version_id,
      therapist_financial_debt_id, source_table, source_id, occurred_at
    ) values (
      'therapist_debt', 'debit', 'BRL', v_due, v_payment.therapist_profile_id,
      v_payment.booking_id, p_session_payment_id, v_payment.policy_version_id,
      v_debt.id, 'therapist_financial_debts', v_debt.id, now()
    ) returning id into v_ledger_id;
    insert into public.therapist_financial_debt_events (
      therapist_financial_debt_id, event_type, direction, amount_cents,
      idempotency_key, financial_ledger_entry_id
    ) values (v_debt.id, 'created', 'increase', v_due,
      'tes:v10:refund-debt:' || v_debt.id::text, v_ledger_id);
  elsif v_debt.id is not null then
    v_initial_reversed := coalesce((v_debt.metadata->>'initialReversedCents')::integer, 0);
    select coalesce(sum(amount_cents), 0) into v_prior_recovery
    from public.therapist_financial_debt_events
    where therapist_financial_debt_id = v_debt.id and event_type = 'reversal_recovered';
    v_delta := greatest(0, v_reversed - v_initial_reversed - v_prior_recovery);
    v_reduce := least(v_delta, v_debt.open_amount_cents);
    if v_reduce > 0 then
      update public.therapist_financial_debts
      set open_amount_cents = open_amount_cents - v_reduce,
        recovered_amount_cents = recovered_amount_cents + v_reduce,
        status = case when open_amount_cents = v_reduce then 'settled' else 'open' end,
        closed_at = case when open_amount_cents = v_reduce then now() else null end,
        updated_at = now() where id = v_debt.id;
      insert into public.therapist_financial_debt_events (
        therapist_financial_debt_id, event_type, direction, amount_cents, idempotency_key
      ) values (v_debt.id, 'reversal_recovered', 'decrease', v_reduce,
        'tes:v10:refund-recovery:' || v_debt.id::text || ':' || v_reversed::text);
    end if;
    if v_delta > v_reduce then
      insert into public.session_refund_incidents_v10 (
        session_refund_decision_id, code, expected_amount_cents, observed_amount_cents
      ) values (v_decision.id, 'recovery_exceeds_open_debt', v_debt.open_amount_cents, v_delta)
      on conflict (session_refund_decision_id, code) do update
      set observed_amount_cents = excluded.observed_amount_cents;
    end if;
  end if;
  update public.session_refund_decisions_v10
  set refund_state = 'complete', recovery_reconciled_at = now(), updated_at = now()
  where id = v_decision.id and refund_state <> 'complete';
  return jsonb_build_object('status', 'reconciled', 'debtCents', v_due,
    'reversedCents', v_reversed);
end;
$$;

create unique index therapist_financial_debts_v10_refund_uidx
  on public.therapist_financial_debts (session_payment_id)
  where origin = 'refund' and session_payment_id is not null;

revoke all on function public.claim_full_session_refund_v10(uuid,uuid,text,text),
  public.transition_full_session_refund_step_v10(uuid,text,text),
  public.reconcile_full_session_refund_debt_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_full_session_refund_v10(uuid,uuid,text,text),
  public.transition_full_session_refund_step_v10(uuid,text,text),
  public.reconcile_full_session_refund_debt_v10(uuid) to service_role;
