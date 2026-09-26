-- A Stripe cancellation performed by the session-closure worker emits a
-- payment_intent.canceled webhook after the same worker has already closed the
-- booking locally. Accept only that exact, fully terminal replay as a no-op.
-- Every non-terminal or divergent binding continues through the original
-- fail-closed validation.

do $migration$
declare
  v_signature constant text :=
    'public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz)';
  v_procedure regprocedure;
  v_definition text;
  v_anchor constant text := $anchor$
  select * into v_booking from public.bookings where id = v_schedule.booking_id;

  if v_schedule.session_payment_id <> v_payment.id
$anchor$;
  v_replacement constant text := $replacement$
  select * into v_booking from public.bookings where id = v_schedule.booking_id;

  -- The session-start closure owns the terminal transition. Stripe delivers
  -- its cancellation asynchronously, so the exact same event binding is an
  -- idempotent replay once every local authority is already canceled.
  if p_status = 'canceled'
    and v_schedule.session_payment_id = v_payment.id
    and v_schedule.session_payment_id = p_session_payment_id
    and v_schedule.booking_id = p_booking_id
    and v_schedule.booking_version = p_booking_version
    and v_schedule.stripe_environment = p_stripe_environment
    and v_schedule.booking_id = v_payment.booking_id
    and v_setup.id is not null
    and v_setup.session_payment_id = v_payment.id
    and v_setup.booking_version = v_schedule.booking_version
    and v_setup.status = 'succeeded'
    and v_setup.superseded_at is null
    and v_setup.stripe_customer_id = trim(p_stripe_customer_id)
    and (
      p_stripe_payment_method_id is null
      or v_setup.stripe_payment_method_id = trim(p_stripe_payment_method_id)
      or exists (
        select 1
        from public.session_charge_recoveries_v10 recovery
        where recovery.schedule_id = v_schedule.id
          and recovery.stripe_payment_intent_id = trim(p_payment_intent_id)
          and recovery.patient_profile_id = v_booking.patient_profile_id
          and recovery.status in ('open', 'consumed', 'canceled')
      )
    )
    and v_payment.gross_amount_cents = p_amount_cents
    and lower(v_payment.currency::text) = lower(trim(p_currency))
    and v_schedule.stripe_payment_intent_id = trim(p_payment_intent_id)
    and v_payment.stripe_payment_intent_id = trim(p_payment_intent_id)
    and v_booking.status = 'cancelled_by_payment'
    and v_booking.payment_status = 'cancelled'
    and v_booking.cancellation_reason = 'payment_not_completed_before_session'
    and v_payment.financial_status = 'canceled'
    and v_schedule.status = 'canceled'
    and v_schedule.last_error_code = 'payment_not_completed_before_session'
    and not exists (
      select 1
      from public.session_transfer_jobs transfer_job
      where transfer_job.session_payment_id = v_payment.id
    )
    and not exists (
      select 1
      from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    return jsonb_build_object(
      'scheduleStatus', 'canceled',
      'applied', false
    );
  end if;

  if v_schedule.session_payment_id <> v_payment.id
$replacement$;
  v_hit_count integer;
begin
  v_procedure := pg_catalog.to_regprocedure(v_signature);
  if v_procedure is null then
    raise exception 'SESSION_PAYMENT_INTENT_V10_CANCELED_REPLAY_SCHEMA_DRIFT: %',
      v_signature using errcode = 'P0001';
  end if;

  select pg_catalog.pg_get_functiondef(v_procedure::oid)
  into v_definition;

  v_hit_count := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);

  if v_hit_count <> 1
    or position('The session-start closure owns the terminal transition.' in v_definition) > 0
  then
    raise exception 'SESSION_PAYMENT_INTENT_V10_CANCELED_REPLAY_SCHEMA_DRIFT: %',
      v_signature using errcode = 'P0001';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

comment on function public.record_session_payment_intent_v10(
  uuid, uuid, uuid, bigint, text, text, text, integer, text, text, text,
  text, text, timestamptz
) is
  'Registra o PaymentIntent V10 e aceita como no-op somente o cancelamento Stripe exatamente vinculado que ja foi encerrado localmente no inicio da sessao.';
