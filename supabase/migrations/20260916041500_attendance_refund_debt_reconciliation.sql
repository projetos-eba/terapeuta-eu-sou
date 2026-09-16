-- Preserve late Reversal reconciliation when a full refund originates from an
-- attendance incident. The debt nature is chosen once and remains stable.

create or replace function public.reconcile_full_session_refund_debt_v10(
  p_session_payment_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_decision public.session_refund_decisions_v10%rowtype;
  v_debt public.therapist_financial_debts%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_incident_id uuid;
  v_origin text := 'refund';
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

  select incident.id into v_incident_id
  from public.session_confirmation_incidents as incident
  where incident.session_payment_id = p_session_payment_id
    and incident.operational_resolution = 'refund'
  order by incident.resolved_at desc nulls last
  limit 1;
  if v_incident_id is not null then
    v_origin := 'attendance_transfer_recovery';
  end if;

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
  where session_payment_id = p_session_payment_id and origin = v_origin
  for update;

  if v_debt.id is null and v_due > 0 then
    insert into public.therapist_financial_debts (
      therapist_profile_id, session_payment_id, stripe_transfer_id,
      session_confirmation_incident_id, origin, reason_code,
      principal_amount_cents, open_amount_cents, metadata
    ) values (
      v_payment.therapist_profile_id, p_session_payment_id, v_transfer.id,
      v_incident_id, v_origin,
      case when v_incident_id is null
        then 'full_session_refund'
        else 'attendance_transfer_not_recovered'
      end,
      v_due, v_due,
      jsonb_build_object(
        'decisionId', v_decision.id,
        'initialReversedCents', v_reversed,
        'attendanceIncidentId', v_incident_id
      )
    ) returning * into v_debt;

    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents, therapist_profile_id,
      booking_id, session_payment_id, financial_policy_version_id,
      therapist_financial_debt_id, source_table, source_id, occurred_at
    ) values (
      'therapist_debt', 'debit', 'BRL', v_due,
      v_payment.therapist_profile_id, v_payment.booking_id,
      p_session_payment_id, v_payment.policy_version_id, v_debt.id,
      'therapist_financial_debts', v_debt.id, now()
    ) returning id into v_ledger_id;

    insert into public.therapist_financial_debt_events (
      therapist_financial_debt_id, event_type, direction, amount_cents,
      idempotency_key, financial_ledger_entry_id
    ) values (
      v_debt.id, 'created', 'increase', v_due,
      'tes:v10:refund-debt:' || v_debt.id::text, v_ledger_id
    );
  elsif v_debt.id is not null then
    v_initial_reversed := coalesce(
      (v_debt.metadata ->> 'initialReversedCents')::integer,
      0
    );
    select coalesce(sum(amount_cents), 0) into v_prior_recovery
    from public.therapist_financial_debt_events
    where therapist_financial_debt_id = v_debt.id
      and event_type = 'reversal_recovered';
    v_delta := greatest(0, v_reversed - v_initial_reversed - v_prior_recovery);
    v_reduce := least(v_delta, v_debt.open_amount_cents);

    if v_reduce > 0 then
      update public.therapist_financial_debts
      set open_amount_cents = open_amount_cents - v_reduce,
          recovered_amount_cents = recovered_amount_cents + v_reduce,
          status = case when open_amount_cents = v_reduce then 'settled' else 'open' end,
          closed_at = case when open_amount_cents = v_reduce then now() else null end,
          updated_at = now()
      where id = v_debt.id;
      insert into public.therapist_financial_debt_events (
        therapist_financial_debt_id, event_type, direction, amount_cents,
        idempotency_key
      ) values (
        v_debt.id, 'reversal_recovered', 'decrease', v_reduce,
        'tes:v10:refund-recovery:' || v_debt.id::text || ':' || v_reversed::text
      );
    end if;

    if v_delta > v_reduce then
      insert into public.session_refund_incidents_v10 (
        session_refund_decision_id, code, expected_amount_cents,
        observed_amount_cents
      ) values (
        v_decision.id, 'recovery_exceeds_open_debt',
        v_debt.open_amount_cents, v_delta
      )
      on conflict (session_refund_decision_id, code) do update
      set observed_amount_cents = excluded.observed_amount_cents;
    end if;
  end if;

  update public.session_refund_decisions_v10
  set refund_state = 'complete', recovery_reconciled_at = now(), updated_at = now()
  where id = v_decision.id and refund_state <> 'complete';

  return jsonb_build_object(
    'status', 'reconciled',
    'debtCents', v_due,
    'debtOrigin', v_origin,
    'reversedCents', v_reversed
  );
end;
$$;

revoke all on function public.reconcile_full_session_refund_debt_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_full_session_refund_debt_v10(uuid)
  to service_role;
