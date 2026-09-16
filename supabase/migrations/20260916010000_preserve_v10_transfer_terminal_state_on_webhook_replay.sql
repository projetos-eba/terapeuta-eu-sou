-- A Stripe webhook may be delivered again after the direct Transfer has already
-- completed. Payment confirmation remains idempotent, but it must never
-- regress the canonical transfer projection back to transfer_pending.
do $migration$
declare
  v_definition text;
  v_old_declaration text := $fragment$
  v_job public.session_transfer_jobs%rowtype;
  v_payment public.session_payments%rowtype;
begin$fragment$;
  v_new_declaration text := $fragment$
  v_job public.session_transfer_jobs%rowtype;
  v_payment public.session_payments%rowtype;
  v_transfer_status_before public.session_payments.transfer_status%type;
  v_transfer_blocked_reason_before public.session_payments.transfer_blocked_reason%type;
  v_eligible_at_before public.session_payments.eligible_at%type;
begin$fragment$;
  v_old_apply text := $fragment$
  v_applied := public.apply_session_payment_state_v1($fragment$;
  v_new_apply text := $fragment$
  v_transfer_status_before := v_payment.transfer_status;
  v_transfer_blocked_reason_before := v_payment.transfer_blocked_reason;
  v_eligible_at_before := v_payment.eligible_at;

  v_applied := public.apply_session_payment_state_v1($fragment$;
  v_old_transfer_update text := $fragment$
  update public.session_payments
  set transfer_status = 'transfer_pending',
      transfer_blocked_reason = null,
      eligible_at = null,
      updated_at = now()
  where id = v_payment.id;$fragment$;
  v_new_transfer_update text := $fragment$
  if v_transfer_status_before in ('transferred', 'reversed', 'blocked', 'failed') then
    update public.session_payments
    set transfer_status = v_transfer_status_before,
        transfer_blocked_reason = v_transfer_blocked_reason_before,
        eligible_at = v_eligible_at_before,
        updated_at = now()
    where id = v_payment.id;
  else
    update public.session_payments
    set transfer_status = 'transfer_pending',
        transfer_blocked_reason = null,
        eligible_at = null,
        updated_at = now()
    where id = v_payment.id;
  end if;$fragment$;
  v_old_return_status text := $fragment$
    'transferStatus', 'transfer_pending'$fragment$;
  v_new_return_status text := $fragment$
    'transferStatus', case
      when v_transfer_status_before in ('transferred', 'reversed', 'blocked', 'failed')
        then v_transfer_status_before::text
      else 'transfer_pending'
    end$fragment$;
  v_fragment text;
  v_hits integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'SESSION_PAYMENT_V10_CONFIRMATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  foreach v_fragment in array array[
    v_old_declaration,
    v_old_apply,
    v_old_transfer_update,
    v_old_return_status
  ] loop
    v_hits := (length(v_definition) - length(replace(v_definition, v_fragment, '')))
      / nullif(length(v_fragment), 0);
    if v_hits <> 1 then
      raise exception 'SESSION_PAYMENT_V10_CONFIRMATION_SCHEMA_DRIFT'
        using errcode = 'P0001';
    end if;
  end loop;

  v_definition := replace(v_definition, v_old_declaration, v_new_declaration);
  v_definition := replace(v_definition, v_old_apply, v_new_apply);
  v_definition := replace(v_definition, v_old_transfer_update, v_new_transfer_update);
  execute replace(v_definition, v_old_return_status, v_new_return_status);
end;
$migration$;

-- Repair only a demonstrably stale projection: the immutable direct Transfer is
-- already complete, while a replayed payment event has reset the summary state.
update public.session_payments as payment
set transfer_status = 'transferred',
    transfer_blocked_reason = null,
    updated_at = now()
where payment.payment_flow_version = 'v10'
  and payment.financial_status = 'paid'
  and payment.transfer_status = 'transfer_pending'
  and exists (
    select 1
    from public.stripe_transfers as transfer
    where transfer.session_payment_id = payment.id
      and transfer.transfer_origin = 'session_direct'
      and transfer.status = 'transferred'
  );

comment on function public.confirm_session_payment_and_enqueue_transfer_v10(
  uuid, text, text, text, timestamptz, text, timestamptz
) is 'Atomically records a confirmed V10 card payment and creates its direct Transfer outbox job. Replayed Stripe events preserve completed or terminal direct Transfer state.';
