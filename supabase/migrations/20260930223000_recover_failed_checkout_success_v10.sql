create or replace function public.recover_failed_session_payment_authorization_v10(
  p_session_payment_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.session_payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
begin
  if p_session_payment_id is null
    or nullif(trim(p_stripe_checkout_session_id), '') is null
    or nullif(trim(p_stripe_payment_intent_id), '') is null
    or p_stripe_event_created_at is null
    or nullif(trim(p_stripe_event_id), '') is null
  then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_request');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:v10:session-payment:' || p_session_payment_id::text,
      0
    )
  );

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found or v_payment.payment_flow_version <> 'v10' then
    return jsonb_build_object('claimed', false, 'reason', 'payment_not_found');
  end if;

  if v_payment.stripe_checkout_session_id is distinct from
      trim(p_stripe_checkout_session_id)
  then
    return jsonb_build_object('claimed', false, 'reason', 'superseded');
  end if;

  select attempt.*
  into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
  order by attempt.created_at desc, attempt.id desc
  limit 1
  for update;

  if not found
    or v_attempt.attempt_kind not in ('initial_hold', 'payment_retry')
  then
    return jsonb_build_object('claimed', false, 'reason', 'attempt_not_found');
  end if;

  if v_payment.financial_status in ('pending', 'processing') then
    if v_payment.stripe_payment_intent_id is not null
      and v_payment.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id)
    then
      return jsonb_build_object('claimed', false, 'reason', 'binding_mismatch');
    end if;

    if v_attempt.stripe_payment_intent_id is not null
      and v_attempt.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id)
    then
      return jsonb_build_object('claimed', false, 'reason', 'binding_mismatch');
    end if;

    return jsonb_build_object('claimed', true, 'reason', 'not_required');
  end if;

  if v_payment.financial_status = 'paid' then
    if v_payment.stripe_payment_intent_id = trim(p_stripe_payment_intent_id) then
      return jsonb_build_object('claimed', true, 'reason', 'already_paid');
    end if;

    return jsonb_build_object('claimed', false, 'reason', 'binding_mismatch');
  end if;

  if v_payment.financial_status <> 'failed'
    or v_payment.stripe_payment_intent_id is distinct from
      trim(p_stripe_payment_intent_id)
    or v_attempt.status <> 'failed'
    or v_attempt.stripe_payment_intent_id is distinct from
      trim(p_stripe_payment_intent_id)
    or v_payment.stripe_event_created_at is null
    or p_stripe_event_created_at <= v_payment.stripe_event_created_at
    or (
      v_attempt.attempt_kind = 'initial_hold'
      and (
        v_attempt.reservation_expires_at is null
        or p_stripe_event_created_at > v_attempt.reservation_expires_at
      )
    )
  then
    return jsonb_build_object('claimed', false, 'reason', 'payment_not_recoverable');
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id
  for update;

  if not found
    or v_booking.status <> 'cancelled_by_payment'
    or v_booking.payment_status = 'paid'
    or v_booking.starts_at <= now()
    or exists (
      select 1
      from public.session_payment_setups as setup
      where setup.session_payment_id = v_payment.id
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    or exists (
      select 1
      from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    or exists (
      select 1
      from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1
      from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
    or exists (
      select 1
      from public.session_refunds as refund
      where refund.session_payment_id = v_payment.id
        and refund.status not in ('failed', 'canceled')
    )
    or exists (
      select 1
      from public.session_disputes as dispute
      where dispute.session_payment_id = v_payment.id
    )
  then
    return jsonb_build_object('claimed', false, 'reason', 'booking_not_recoverable');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || v_booking.patient_profile_id::text,
      0
    )
  );

  perform public.expire_booking_holds_v1(now(), v_booking.therapist_profile_id);

  if public.patient_has_schedule_conflict_v1(
    v_booking.patient_profile_id,
    v_booking.starts_at,
    v_booking.ends_at,
    v_booking.id
  ) then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'patient_schedule_conflict'
    );
  end if;

  begin
    perform pg_catalog.set_config(
      'tes.booking_reason',
      'same_checkout_payment_succeeded',
      true
    );
    perform pg_catalog.set_config(
      'tes.booking_source',
      'payment_retry_claim',
      true
    );
    perform pg_catalog.set_config(
      'tes.booking_request_id',
      left(trim(p_stripe_event_id), 200),
      true
    );

    update public.bookings
    set status = 'pending_payment',
        payment_status = 'pending',
        cancellation_reason = null,
        cancelled_at = null,
        updated_at = now()
    where id = v_booking.id
      and status = 'cancelled_by_payment';
  exception
    when exclusion_violation or raise_exception then
      perform pg_catalog.set_config('tes.booking_reason', '', true);
      perform pg_catalog.set_config('tes.booking_source', '', true);
      perform pg_catalog.set_config('tes.booking_request_id', '', true);

      return jsonb_build_object('claimed', false, 'reason', 'slot_conflict');
  end;

  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);

  update public.session_payments
  set financial_status = 'processing',
      failed_at = null,
      canceled_at = null,
      transfer_blocked_reason = null,
      updated_at = now()
  where id = v_payment.id;

  update public.payments
  set status = 'pending',
      updated_at = now()
  where booking_id = v_payment.booking_id
    and status <> 'paid';

  update public.session_payment_attempts
  set status = 'processing',
      authorization_received_at = coalesce(
        authorization_received_at,
        p_stripe_event_created_at
      ),
      slot_claimed_at = coalesce(slot_claimed_at, now()),
      terminal_reason = null,
      request_metadata = coalesce(request_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'recovery_event_id', trim(p_stripe_event_id),
          'recovery_reason', 'same_checkout_payment_succeeded'
        ),
      updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object(
    'claimed', true,
    'reason', 'recovered',
    'attemptKind', v_attempt.attempt_kind,
    'bookingVersion', v_booking.version
  );
end;
$$;

revoke all on function public.recover_failed_session_payment_authorization_v10(
  uuid, text, text, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.recover_failed_session_payment_authorization_v10(
  uuid, text, text, timestamptz, text
) to service_role;

comment on function public.recover_failed_session_payment_authorization_v10(
  uuid, text, text, timestamptz, text
) is
  'Reclaims a released V10 booking only when the same current Checkout and PaymentIntent report a later signed success and no downstream financial artifact exists.';
