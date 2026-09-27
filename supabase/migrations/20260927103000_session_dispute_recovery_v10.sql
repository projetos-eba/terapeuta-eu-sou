-- Complete the V10 dispute lifecycle without changing the historical payout.
-- Open disputes only block new financial effects. Recovery starts exclusively
-- after Stripe closes the dispute as lost.

alter table public.session_disputes
  add column if not exists previous_financial_status public.session_financial_status,
  add column if not exists provider_event_created_at timestamptz,
  add column if not exists provider_event_id text,
  add column if not exists stripe_transfer_id uuid references public.stripe_transfers(id) on delete restrict,
  add column if not exists recovery_state text not null default 'not_needed',
  add column if not exists recovery_amount_cents integer not null default 0,
  add column if not exists provider_reversal_amount_cents integer not null default 0,
  add column if not exists recovered_amount_cents integer not null default 0,
  add column if not exists stripe_transfer_reversal_id text;

update public.session_disputes
set provider_event_created_at = coalesce(provider_event_created_at, closed_at, opened_at)
where provider_event_created_at is null;

alter table public.session_disputes
  alter column provider_event_created_at set not null;

alter table public.session_disputes
  drop constraint if exists session_disputes_recovery_state_check;
alter table public.session_disputes
  add constraint session_disputes_recovery_state_check check (
    recovery_state in (
      'not_needed', 'pending_resolution', 'not_attempted', 'attempting',
      'complete', 'unknown', 'requires_review'
    )
  );

alter table public.session_disputes
  drop constraint if exists session_disputes_recovery_amounts_check;
alter table public.session_disputes
  add constraint session_disputes_recovery_amounts_check check (
    recovery_amount_cents >= 0
    and provider_reversal_amount_cents >= 0
    and provider_reversal_amount_cents <= recovery_amount_cents
    and recovered_amount_cents >= 0
    and recovered_amount_cents <= provider_reversal_amount_cents
  );

alter table public.therapist_financial_debts
  add column if not exists session_dispute_id uuid
    references public.session_disputes(id) on delete restrict;

create unique index if not exists therapist_financial_debts_dispute_uidx
  on public.therapist_financial_debts (session_dispute_id)
  where origin = 'dispute' and session_dispute_id is not null;

-- A provider reversal is reconciled after the payment has already entered the
-- disputed state. Preserve every immutable job binding while allowing only
-- that existing job to reflect the now-reversed Transfer.
create or replace function public.validate_session_transfer_job_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  select * into v_payment
  from public.session_payments
  where id = new.session_payment_id;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or (
      v_payment.financial_status not in ('paid', 'partially_refunded')
      and not (
        tg_op = 'UPDATE'
        and v_payment.financial_status in ('refunded', 'disputed')
        and old.id = new.id
      )
    )
    or v_payment.booking_id <> new.booking_id
    or v_payment.policy_version_id <> new.policy_version_id
    or v_payment.connect_account_id_snapshot <> new.connect_account_id
    or v_payment.stripe_charge_id <> new.stripe_source_charge_id
    or v_payment.therapist_amount_cents <> new.therapist_gross_amount_cents
  then
    raise exception 'SESSION_TRANSFER_JOB_V10_PAYMENT_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_session_transfer_job_v10()
  from public, anon, authenticated;

create or replace function public.reconcile_session_dispute_event_v10(
  p_stripe_dispute_id text,
  p_stripe_charge_id text,
  p_amount_cents integer,
  p_currency text,
  p_status text,
  p_event_type text,
  p_event_id text,
  p_event_created_at timestamptz,
  p_evidence_due_by timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_dispute public.session_disputes%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_job public.session_transfer_jobs%rowtype;
  v_refunded integer := 0;
  v_existing_reversed integer := 0;
  v_is_closed boolean;
  v_recovery_amount integer := 0;
  v_provider_reversal_amount integer := 0;
  v_recovery_state text := 'not_needed';
  v_restored_status public.session_financial_status;
  v_stripe_environment text;
begin
  if nullif(btrim(p_stripe_dispute_id), '') is null
    or nullif(btrim(p_stripe_charge_id), '') is null
    or p_amount_cents is null or p_amount_cents <= 0
    or upper(coalesce(p_currency, '')) <> 'BRL'
    or nullif(btrim(p_status), '') is null
    or p_event_type not in (
      'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'
    )
    or nullif(btrim(p_event_id), '') is null
    or p_event_created_at is null then
    raise exception 'SESSION_DISPUTE_EVENT_INVALID' using errcode = '22023';
  end if;

  select * into v_payment
  from public.session_payments
  where stripe_charge_id = p_stripe_charge_id
  for update;

  if not found
    or p_amount_cents > v_payment.gross_amount_cents
    or v_payment.currency <> 'BRL' then
    raise exception 'SESSION_DISPUTE_PAYMENT_MISMATCH' using errcode = '23514';
  end if;

  select coalesce(
    (select job.stripe_environment
     from public.session_transfer_jobs as job
     where job.session_payment_id = v_payment.id),
    (select setup.stripe_environment
     from public.session_payment_setups as setup
     where setup.session_payment_id = v_payment.id
     order by setup.created_at desc
     limit 1)
  ) into v_stripe_environment;

  select * into v_dispute
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id
  for update;

  if found and (
    v_dispute.session_payment_id <> v_payment.id
    or v_dispute.stripe_charge_id is distinct from p_stripe_charge_id
    or v_dispute.amount_cents <> p_amount_cents
    or v_dispute.currency <> 'BRL'
  ) then
    raise exception 'SESSION_DISPUTE_BINDING_MISMATCH' using errcode = '23514';
  end if;

  v_is_closed := p_event_type = 'charge.dispute.closed';

  if found and p_event_created_at < v_dispute.provider_event_created_at then
    return jsonb_build_object(
      'applied', false,
      'sessionPaymentId', v_payment.id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'stripeDisputeId', v_dispute.stripe_dispute_id,
      'stripeChargeId', v_payment.stripe_charge_id,
      'recoveryState', v_dispute.recovery_state,
      'recoveryAmountCents', v_dispute.recovery_amount_cents,
      'providerReversalAmountCents', v_dispute.provider_reversal_amount_cents,
      'stripeTransferId', null,
      'stripeAccountId', v_payment.stripe_connect_account_id_snapshot,
      'stripeEnvironment', v_stripe_environment,
      'therapistProfileId', v_payment.therapist_profile_id
    );
  end if;

  if found and v_dispute.closed_at is not null and not v_is_closed then
    return jsonb_build_object(
      'applied', false,
      'sessionPaymentId', v_payment.id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'stripeDisputeId', v_dispute.stripe_dispute_id,
      'stripeChargeId', v_payment.stripe_charge_id,
      'recoveryState', v_dispute.recovery_state,
      'recoveryAmountCents', v_dispute.recovery_amount_cents,
      'providerReversalAmountCents', v_dispute.provider_reversal_amount_cents,
      'stripeTransferId', null,
      'stripeAccountId', v_payment.stripe_connect_account_id_snapshot,
      'stripeEnvironment', v_stripe_environment,
      'therapistProfileId', v_payment.therapist_profile_id
    );
  end if;

  if found and v_dispute.closed_at is not null and v_is_closed
    and v_dispute.status = btrim(p_status) then
    return jsonb_build_object(
      'applied', false,
      'sessionPaymentId', v_payment.id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'stripeDisputeId', v_dispute.stripe_dispute_id,
      'disputeStatus', v_dispute.status,
      'stripeChargeId', v_payment.stripe_charge_id,
      'recoveryState', v_dispute.recovery_state,
      'recoveryAmountCents', v_dispute.recovery_amount_cents,
      'providerReversalAmountCents', v_dispute.provider_reversal_amount_cents,
      'stripeTransferId', null,
      'stripeAccountId', v_payment.stripe_connect_account_id_snapshot,
      'stripeEnvironment', v_stripe_environment,
      'therapistProfileId', v_payment.therapist_profile_id
    );
  end if;

  if found and v_dispute.closed_at is not null and v_is_closed
    and v_dispute.status <> btrim(p_status) then
    update public.session_disputes
    set recovery_state = 'requires_review',
        provider_event_created_at = greatest(
          provider_event_created_at, p_event_created_at
        ),
        provider_event_id = btrim(p_event_id),
        metadata = metadata || jsonb_build_object(
          'terminalStatusConflict', btrim(p_status),
          'lastEventType', p_event_type
        ),
        updated_at = now()
    where id = v_dispute.id
    returning * into v_dispute;

    return jsonb_build_object(
      'applied', true,
      'sessionPaymentId', v_payment.id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'stripeDisputeId', v_dispute.stripe_dispute_id,
      'disputeStatus', v_dispute.status,
      'stripeChargeId', v_payment.stripe_charge_id,
      'recoveryState', v_dispute.recovery_state,
      'recoveryAmountCents', v_dispute.recovery_amount_cents,
      'providerReversalAmountCents', v_dispute.provider_reversal_amount_cents,
      'stripeTransferId', null,
      'stripeAccountId', v_payment.stripe_connect_account_id_snapshot,
      'stripeEnvironment', v_stripe_environment,
      'therapistProfileId', v_payment.therapist_profile_id
    );
  end if;

  if v_dispute.id is null then
    insert into public.session_disputes (
      session_payment_id, stripe_dispute_id, stripe_charge_id,
      amount_cents, currency, status, evidence_due_by, opened_at,
      closed_at, previous_financial_status, provider_event_created_at,
      provider_event_id, metadata
    ) values (
      v_payment.id, btrim(p_stripe_dispute_id), btrim(p_stripe_charge_id),
      p_amount_cents, 'BRL', btrim(p_status), p_evidence_due_by,
      p_event_created_at, case when v_is_closed then p_event_created_at else null end,
      v_payment.financial_status, p_event_created_at, btrim(p_event_id),
      jsonb_build_object('lastEventType', p_event_type)
    ) returning * into v_dispute;
  else
    update public.session_disputes
    set status = btrim(p_status),
        evidence_due_by = p_evidence_due_by,
        closed_at = case when v_is_closed then p_event_created_at else closed_at end,
        provider_event_created_at = p_event_created_at,
        provider_event_id = btrim(p_event_id),
        metadata = metadata || jsonb_build_object('lastEventType', p_event_type),
        updated_at = now()
    where id = v_dispute.id
    returning * into v_dispute;
  end if;

  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents,
    patient_profile_id, therapist_profile_id, booking_id,
    session_payment_id, financial_policy_version_id,
    source_table, source_external_id, stripe_event_id, occurred_at
  ) values (
    'dispute', 'debit', 'BRL', p_amount_cents,
    v_payment.patient_profile_id, v_payment.therapist_profile_id,
    v_payment.booking_id, v_payment.id, v_payment.policy_version_id,
    'stripe_disputes', p_stripe_dispute_id, p_event_id, p_event_created_at
  ) on conflict (entry_type, source_table, source_external_id, direction)
    do nothing;

  if v_is_closed and p_status = 'won' then
    select coalesce(sum(amount_cents), 0) into v_refunded
    from public.session_refunds
    where session_payment_id = v_payment.id and status = 'succeeded';

    v_restored_status := case
      when v_refunded >= v_payment.gross_amount_cents then 'refunded'::public.session_financial_status
      when v_refunded > 0 then 'partially_refunded'::public.session_financial_status
      else 'paid'::public.session_financial_status
    end;

    update public.session_disputes
    set recovery_state = 'not_needed', recovery_amount_cents = 0,
        provider_reversal_amount_cents = 0, recovered_amount_cents = 0,
        stripe_transfer_id = null, stripe_transfer_reversal_id = null,
        updated_at = now()
    where id = v_dispute.id
    returning * into v_dispute;

    update public.session_payments
    set disputed_at = null,
        financial_status = v_restored_status,
        transfer_blocked_reason = case
          when transfer_blocked_reason = 'disputed' then null
          else transfer_blocked_reason
        end,
        updated_at = now()
    where id = v_payment.id;

    perform public.refresh_session_transfer_eligibility(v_payment.id, now());

    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents,
      patient_profile_id, therapist_profile_id, booking_id,
      session_payment_id, financial_policy_version_id,
      source_table, source_external_id, stripe_event_id, occurred_at
    ) values (
      'recovery', 'credit', 'BRL', p_amount_cents,
      v_payment.patient_profile_id, v_payment.therapist_profile_id,
      v_payment.booking_id, v_payment.id, v_payment.policy_version_id,
      'stripe_disputes', p_stripe_dispute_id, p_event_id, p_event_created_at
    ) on conflict (entry_type, source_table, source_external_id, direction)
      do nothing;

  elsif v_is_closed and p_status = 'lost' then
    select * into v_job
    from public.session_transfer_jobs
    where session_payment_id = v_payment.id;

    if found and v_job.prepared_at is not null then
      v_recovery_amount := least(
        v_job.therapist_gross_amount_cents,
        floor(
          v_job.therapist_gross_amount_cents::numeric
          * p_amount_cents::numeric
          / v_payment.gross_amount_cents::numeric
        )::integer
      );

      if v_job.stripe_transfer_id is not null then
        select * into v_transfer
        from public.stripe_transfers
        where id = v_job.stripe_transfer_id;
      end if;

      v_provider_reversal_amount := least(
        coalesce(v_transfer.amount_cents, 0),
        floor(
          v_job.transfer_amount_cents::numeric
          * p_amount_cents::numeric
          / v_payment.gross_amount_cents::numeric
        )::integer
      );

      if v_transfer.id is not null then
        select coalesce(sum(amount_cents), 0) into v_existing_reversed
        from public.stripe_transfer_reversals
        where stripe_transfer_id = v_transfer.id and status = 'succeeded';
      end if;

      v_recovery_state := case
        when v_recovery_amount = 0 then 'not_needed'
        when v_job.transfer_amount_cents > 0 and v_transfer.id is null
          then 'requires_review'
        when v_provider_reversal_amount = 0 then 'not_attempted'
        when v_existing_reversed > 0 then 'requires_review'
        when v_transfer.status = 'transferred' then 'not_attempted'
        else 'requires_review'
      end;
    end if;

    update public.session_disputes
    set stripe_transfer_id = v_transfer.id,
        recovery_state = v_recovery_state,
        recovery_amount_cents = v_recovery_amount,
        provider_reversal_amount_cents = v_provider_reversal_amount,
        recovered_amount_cents = 0,
        updated_at = now()
    where id = v_dispute.id
    returning * into v_dispute;

    update public.session_payments
    set disputed_at = coalesce(disputed_at, p_event_created_at),
        financial_status = 'disputed',
        transfer_status = case
          when transfer_status in ('transferred', 'reversed') then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'disputed',
        updated_at = now()
    where id = v_payment.id;
  else
    update public.session_disputes
    set recovery_state = case
          when recovery_state in ('complete', 'unknown', 'requires_review')
            then recovery_state
          else 'pending_resolution'
        end,
        updated_at = now()
    where id = v_dispute.id
    returning * into v_dispute;

    update public.session_payments
    set disputed_at = coalesce(disputed_at, p_event_created_at),
        financial_status = 'disputed',
        transfer_status = case
          when transfer_status in ('transferred', 'reversed') then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'disputed',
        updated_at = now()
    where id = v_payment.id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'sessionPaymentId', v_payment.id,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'stripeDisputeId', v_dispute.stripe_dispute_id,
    'disputeStatus', v_dispute.status,
    'stripeChargeId', v_payment.stripe_charge_id,
    'recoveryState', v_dispute.recovery_state,
    'recoveryAmountCents', v_dispute.recovery_amount_cents,
    'providerReversalAmountCents', v_dispute.provider_reversal_amount_cents,
    'stripeTransferId', v_transfer.stripe_transfer_id,
    'stripeAccountId', v_payment.stripe_connect_account_id_snapshot,
    'stripeEnvironment', coalesce(v_job.stripe_environment, v_stripe_environment),
    'therapistProfileId', v_payment.therapist_profile_id
  );
end;
$$;

create or replace function public.claim_session_dispute_recovery_v10(
  p_stripe_dispute_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.session_disputes%rowtype;
begin
  select * into v_dispute
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id
  for update;

  if not found or v_dispute.status <> 'lost' or v_dispute.closed_at is null then
    raise exception 'SESSION_DISPUTE_RECOVERY_NOT_READY' using errcode = '23514';
  end if;

  if v_dispute.recovery_state = 'attempting' then
    return false;
  end if;
  if v_dispute.recovery_state <> 'not_attempted' then
    raise exception 'SESSION_DISPUTE_RECOVERY_STATE_INVALID' using errcode = '23514';
  end if;

  update public.session_disputes
  set recovery_state = 'attempting', updated_at = now()
  where id = v_dispute.id;
  return true;
end;
$$;

create or replace function public.mark_session_dispute_recovery_review_v10(
  p_stripe_dispute_id text,
  p_state text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state not in ('unknown', 'requires_review') then
    raise exception 'SESSION_DISPUTE_REVIEW_STATE_INVALID' using errcode = '22023';
  end if;

  update public.session_disputes
  set recovery_state = p_state, updated_at = now()
  where stripe_dispute_id = p_stripe_dispute_id
    and status = 'lost'
    and recovery_state in ('not_attempted', 'attempting', 'unknown', 'requires_review');

  if not found then
    raise exception 'SESSION_DISPUTE_RECOVERY_NOT_READY' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.reconcile_session_dispute_transfer_reversal_v10(
  p_stripe_dispute_id text,
  p_stripe_transfer_id text,
  p_stripe_reversal_id text,
  p_amount_cents integer,
  p_currency text,
  p_stripe_event_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.session_disputes%rowtype;
  v_transfer public.stripe_transfers%rowtype;
  v_payment public.session_payments%rowtype;
  v_reversal public.stripe_transfer_reversals%rowtype;
  v_dispute_payment_id uuid;
  v_dispute_transfer_id uuid;
  v_total_reversed integer;
begin
  if nullif(btrim(p_stripe_dispute_id), '') is null
    or nullif(btrim(p_stripe_transfer_id), '') is null
    or nullif(btrim(p_stripe_reversal_id), '') is null
    or p_amount_cents is null or p_amount_cents <= 0
    or upper(coalesce(p_currency, '')) <> 'BRL'
    or nullif(btrim(p_stripe_event_id), '') is null
    or p_occurred_at is null then
    raise exception 'SESSION_DISPUTE_REVERSAL_INVALID' using errcode = '22023';
  end if;

  select session_payment_id, stripe_transfer_id
    into v_dispute_payment_id, v_dispute_transfer_id
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id;

  if not found or v_dispute_transfer_id is null then
    raise exception 'SESSION_DISPUTE_REVERSAL_NOT_EXPECTED' using errcode = '23514';
  end if;

  select * into v_transfer
  from public.stripe_transfers
  where id = v_dispute_transfer_id
    and stripe_transfer_id = p_stripe_transfer_id
  for update;

  if not found or v_transfer.session_payment_id <> v_dispute_payment_id
    or v_transfer.transfer_origin <> 'session_direct'
    or v_transfer.amount_cents < p_amount_cents then
    raise exception 'SESSION_DISPUTE_TRANSFER_MISMATCH' using errcode = '23514';
  end if;

  select * into v_payment
  from public.session_payments
  where id = v_dispute_payment_id
  for update;

  select * into v_dispute
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id
  for update;

  if not found or v_dispute.session_payment_id <> v_payment.id
    or v_dispute.stripe_transfer_id <> v_transfer.id
    or v_dispute.status <> 'lost'
    or v_dispute.provider_reversal_amount_cents <> p_amount_cents
    or v_dispute.recovery_state not in ('attempting', 'unknown') then
    raise exception 'SESSION_DISPUTE_REVERSAL_NOT_EXPECTED' using errcode = '23514';
  end if;

  select * into v_reversal
  from public.stripe_transfer_reversals
  where stripe_transfer_reversal_id = p_stripe_reversal_id
  for update;

  if found and (
    v_reversal.stripe_transfer_id <> v_transfer.id
    or v_reversal.amount_cents <> p_amount_cents
    or v_reversal.currency <> 'BRL'
  ) then
    raise exception 'SESSION_DISPUTE_REVERSAL_ID_REUSED' using errcode = '23505';
  end if;

  if v_reversal.id is null then
    insert into public.stripe_transfer_reversals (
      stripe_transfer_id, stripe_transfer_reversal_id, amount_cents,
      currency, reason, status, metadata
    ) values (
      v_transfer.id, p_stripe_reversal_id, p_amount_cents,
      'BRL', 'dispute', 'succeeded',
      jsonb_build_object(
        'paymentFlowVersion', 'v10',
        'stripeDisputeId', p_stripe_dispute_id
      )
    ) returning * into v_reversal;
  end if;

  select coalesce(sum(amount_cents), 0) into v_total_reversed
  from public.stripe_transfer_reversals
  where stripe_transfer_id = v_transfer.id and status = 'succeeded';

  if v_total_reversed > v_transfer.amount_cents then
    raise exception 'SESSION_DISPUTE_REVERSAL_EXCEEDS_TRANSFER' using errcode = '23514';
  end if;

  insert into public.financial_ledger_entries (
    entry_type, direction, currency, amount_cents,
    patient_profile_id, therapist_profile_id, booking_id,
    session_payment_id, stripe_transfer_id, financial_policy_version_id,
    transfer_origin, source_table, source_external_id,
    stripe_event_id, occurred_at
  ) values (
    'transfer_reversal', 'credit', 'BRL', p_amount_cents,
    v_payment.patient_profile_id, v_payment.therapist_profile_id,
    v_payment.booking_id, v_payment.id, v_transfer.id,
    v_payment.policy_version_id, 'session_direct',
    'stripe_transfer_reversals', p_stripe_reversal_id,
    p_stripe_event_id, p_occurred_at
  ) on conflict (entry_type, source_table, source_external_id, direction)
    do nothing;

  update public.stripe_transfers
  set status = case
        when v_total_reversed = amount_cents then 'reversed'
        else 'partially_reversed'
      end,
      updated_at = now()
  where id = v_transfer.id;

  update public.session_transfer_jobs
  set status = case
        when v_total_reversed = v_transfer.amount_cents then 'reversed'
        else 'partially_reversed'
      end,
      updated_at = now()
  where stripe_transfer_id = v_transfer.id;

  update public.session_disputes
  set recovered_amount_cents = p_amount_cents,
      stripe_transfer_reversal_id = p_stripe_reversal_id,
      updated_at = now()
  where id = v_dispute.id;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id,
    'recoveredAmountCents', p_amount_cents,
    'fullyReversedTransfer', v_total_reversed = v_transfer.amount_cents
  );
end;
$$;

create or replace function public.complete_session_dispute_recovery_v10(
  p_stripe_dispute_id text,
  p_definitive_provider_shortfall boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.session_disputes%rowtype;
  v_payment public.session_payments%rowtype;
  v_debt public.therapist_financial_debts%rowtype;
  v_session_payment_id uuid;
  v_due integer;
  v_ledger_id uuid;
begin
  select session_payment_id into v_session_payment_id
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id;

  if not found then
    raise exception 'SESSION_DISPUTE_RECOVERY_NOT_READY' using errcode = '23514';
  end if;

  select * into v_payment
  from public.session_payments
  where id = v_session_payment_id
  for update;

  select * into v_dispute
  from public.session_disputes
  where stripe_dispute_id = p_stripe_dispute_id
  for update;

  if not found or v_dispute.status <> 'lost' or v_dispute.closed_at is null
    or v_dispute.session_payment_id <> v_payment.id
    or v_dispute.recovery_state not in ('not_attempted', 'attempting') then
    raise exception 'SESSION_DISPUTE_RECOVERY_NOT_READY' using errcode = '23514';
  end if;

  if v_dispute.provider_reversal_amount_cents > v_dispute.recovered_amount_cents
    and not p_definitive_provider_shortfall then
    raise exception 'SESSION_DISPUTE_RECOVERY_AMBIGUOUS' using errcode = '23514';
  end if;

  v_due := greatest(0, v_dispute.recovery_amount_cents - v_dispute.recovered_amount_cents);

  select * into v_debt
  from public.therapist_financial_debts
  where session_dispute_id = v_dispute.id and origin = 'dispute'
  for update;

  if v_debt.id is null and v_due > 0 then
    insert into public.therapist_financial_debts (
      therapist_profile_id, session_payment_id, session_dispute_id,
      stripe_transfer_id, origin, reason_code,
      principal_amount_cents, open_amount_cents, metadata
    ) values (
      v_payment.therapist_profile_id, v_payment.id, v_dispute.id,
      v_dispute.stripe_transfer_id, 'dispute', 'chargeback_lost',
      v_due, v_due,
      jsonb_build_object(
        'stripeDisputeId', v_dispute.stripe_dispute_id,
        'recoveredAmountCents', v_dispute.recovered_amount_cents
      )
    ) returning * into v_debt;

    insert into public.financial_ledger_entries (
      entry_type, direction, currency, amount_cents,
      therapist_profile_id, booking_id, session_payment_id,
      stripe_transfer_id, financial_policy_version_id,
      therapist_financial_debt_id, source_table, source_id, occurred_at
    ) values (
      'therapist_debt', 'debit', 'BRL', v_due,
      v_payment.therapist_profile_id, v_payment.booking_id, v_payment.id,
      v_dispute.stripe_transfer_id, v_payment.policy_version_id,
      v_debt.id, 'therapist_financial_debts', v_debt.id, now()
    ) returning id into v_ledger_id;

    insert into public.therapist_financial_debt_events (
      therapist_financial_debt_id, event_type, direction, amount_cents,
      idempotency_key, financial_ledger_entry_id, metadata
    ) values (
      v_debt.id, 'created', 'increase', v_due,
      'tes:v10:dispute-debt:' || v_dispute.id::text,
      v_ledger_id,
      jsonb_build_object('stripeDisputeId', v_dispute.stripe_dispute_id)
    );
  end if;

  update public.session_disputes
  set recovery_state = 'complete', updated_at = now()
  where id = v_dispute.id;

  return jsonb_build_object(
    'status', 'complete',
    'debtAmountCents', v_due,
    'recoveredAmountCents', v_dispute.recovered_amount_cents,
    'therapistFinancialDebtId', v_debt.id
  );
end;
$$;

revoke all on function public.reconcile_session_dispute_event_v10(
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.claim_session_dispute_recovery_v10(text)
  from public, anon, authenticated;
revoke all on function public.mark_session_dispute_recovery_review_v10(text, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_session_dispute_transfer_reversal_v10(
  text, text, text, integer, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.complete_session_dispute_recovery_v10(text, boolean)
  from public, anon, authenticated;

grant execute on function public.reconcile_session_dispute_event_v10(
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.claim_session_dispute_recovery_v10(text)
  to service_role;
grant execute on function public.mark_session_dispute_recovery_review_v10(text, text)
  to service_role;
grant execute on function public.reconcile_session_dispute_transfer_reversal_v10(
  text, text, text, integer, text, text, timestamptz
) to service_role;
grant execute on function public.complete_session_dispute_recovery_v10(text, boolean)
  to service_role;

comment on function public.reconcile_session_dispute_event_v10(
  text, text, integer, text, text, text, text, timestamptz, timestamptz
) is 'Persiste a contestacao e bloqueia novos efeitos. Recuperacao V10 somente e liberada apos perda definitiva.';

comment on function public.complete_session_dispute_recovery_v10(text, boolean)
is 'Conclui a recuperacao de contestacao perdida e cria somente a divida residual nao recuperada no provedor.';
