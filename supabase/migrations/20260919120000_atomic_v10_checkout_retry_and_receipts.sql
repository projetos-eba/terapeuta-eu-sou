begin;

-- A retry must not occupy the slot before Stripe has a persisted Checkout.
-- Keep the historical function name for deployed callers, but make it a
-- read/revalidation command. The provider session is committed separately and
-- the slot is claimed only after Stripe confirms the authorization/setup.
create or replace function public.begin_session_payment_retry_v10(
  p_booking_id uuid
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
  v_preflight jsonb;
begin
  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id;

  select payment.* into v_payment
  from public.session_payments as payment
  where payment.booking_id = p_booking_id;

  if v_booking.id is null
    or v_payment.id is null
    or v_payment.payment_flow_version <> 'v10'
    or v_booking.status <> 'cancelled_by_payment'
    or v_booking.starts_at <= now()
    or v_payment.financial_status not in ('failed', 'canceled')
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
  then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = v_payment.stripe_checkout_session_id
  order by attempt.created_at desc, attempt.id desc
  limit 1;

  if v_attempt.id is null
    or v_attempt.attempt_kind not in ('initial_hold', 'payment_retry')
    or v_attempt.status not in (
      'expired', 'failed', 'canceled', 'slot_conflict',
      'checkout_created', 'waiting_payment'
    )
    or v_attempt.slot_claimed_at is not null
    or exists (
      select 1 from public.session_payment_setups as setup
      where setup.session_payment_id = v_payment.id
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    or exists (
      select 1 from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    or exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.session_refunds as refund
      where refund.session_payment_id = v_payment.id
        and refund.status not in ('failed', 'canceled')
    )
    or exists (
      select 1 from public.session_disputes as dispute
      where dispute.session_payment_id = v_payment.id
    )
  then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  v_preflight := public.preflight_session_payment_retry_v1(p_booking_id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', case
      when v_attempt.attempt_kind = 'payment_retry'
        and v_attempt.status in ('checkout_created', 'waiting_payment')
        then 'checkout_already_created'
      else 'retry_ready'
    end,
    'bookingVersion', v_booking.version,
    'paymentDueAt', v_payment.payment_due_at,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'sessionPaymentId', v_payment.id,
    'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id
  );
end;
$$;

revoke all on function public.begin_session_payment_retry_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_session_payment_retry_v10(uuid)
  to service_role;

comment on function public.begin_session_payment_retry_v10(uuid) is
  'Revalidates an unpaid V10 retry without reopening the booking before a provider Checkout is persisted.';

create or replace function public.commit_session_payment_retry_checkout_v10(
  p_session_payment_id uuid,
  p_booking_version bigint,
  p_stripe_environment text,
  p_expected_checkout_session_id text,
  p_new_checkout_session_id text,
  p_original_amount_cents integer,
  p_discount_amount_cents integer,
  p_total_amount_cents integer,
  p_checkout_timing text,
  p_attempt_idempotency_key text,
  p_request_metadata jsonb default '{}'::jsonb,
  p_response_metadata jsonb default '{}'::jsonb,
  p_promotion_code text default null,
  p_stripe_promotion_code_id text default null,
  p_stripe_coupon_id text default null,
  p_discount_type text default null,
  p_discount_value integer default null
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
  v_preflight jsonb;
  v_swap jsonb;
  v_original_status public.session_financial_status;
begin
  if p_session_payment_id is null
    or p_booking_version is null or p_booking_version <= 0
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_expected_checkout_session_id), '') is null
    or nullif(trim(p_new_checkout_session_id), '') is null
    or nullif(trim(p_attempt_idempotency_key), '') is null
    or p_checkout_timing not in ('scheduled', 'immediate')
    or p_request_metadata is null
    or p_response_metadata is null
  then
    raise exception 'SESSION_PAYMENT_V10_RETRY_COMMIT_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:v10:session-payment:' || p_session_payment_id::text,
      0
    )
  );

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.idempotency_key = trim(p_attempt_idempotency_key)
  for update;

  if found then
    select payment.* into v_payment
    from public.session_payments as payment
    where payment.id = p_session_payment_id
    for update;

    if v_attempt.session_payment_id = p_session_payment_id
      and v_attempt.attempt_kind = 'payment_retry'
      and v_attempt.stripe_checkout_session_id = trim(p_new_checkout_session_id)
      and v_payment.stripe_checkout_session_id = trim(p_new_checkout_session_id)
    then
      return jsonb_build_object(
        'applied', false,
        'reason', 'already_committed',
        'sessionPaymentId', v_payment.id,
        'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id
      );
    end if;

    raise exception 'SESSION_PAYMENT_V10_RETRY_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  select payment.* into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status not in ('failed', 'canceled')
    or v_payment.stripe_checkout_session_id is distinct from trim(p_expected_checkout_session_id)
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
  then
    raise exception 'SESSION_PAYMENT_V10_RETRY_NOT_COMMITTABLE'
      using errcode = '23514';
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id
  for update;

  if not found
    or v_booking.status <> 'cancelled_by_payment'
    or v_booking.version <> p_booking_version
    or v_booking.starts_at <= now()
    or v_booking.service_price_cents_snapshot <> p_original_amount_cents
  then
    raise exception 'SESSION_PAYMENT_V10_RETRY_BOOKING_CONFLICT'
      using errcode = '23514';
  end if;

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = trim(p_expected_checkout_session_id)
  order by attempt.created_at desc, attempt.id desc
  limit 1
  for update;

  if not found
    or v_attempt.attempt_kind not in ('initial_hold', 'payment_retry')
    or v_attempt.status not in ('expired', 'failed', 'canceled', 'slot_conflict')
    or v_attempt.slot_claimed_at is not null
    or exists (
      select 1 from public.session_payment_setups as setup
      where setup.session_payment_id = v_payment.id
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    or exists (
      select 1 from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    or exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    raise exception 'SESSION_PAYMENT_V10_RETRY_AUTHORITY_CONFLICT'
      using errcode = '23514';
  end if;

  v_preflight := public.preflight_session_payment_retry_v1(v_booking.id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    raise exception 'SESSION_PAYMENT_V10_RETRY_SLOT_CONFLICT:%',
      coalesce(v_preflight ->> 'reason', 'booking_not_retryable')
      using errcode = '23514';
  end if;

  v_original_status := v_payment.financial_status;

  -- swap_session_payment_checkout_v10 is shared with the initial flow and
  -- requires pending. This temporary state is contained in this transaction;
  -- it is restored before commit, so no slot or pending payment leaks.
  update public.session_payments
  set financial_status = 'pending', updated_at = now()
  where id = v_payment.id;

  v_swap := public.swap_session_payment_checkout_v10(
    v_payment.id,
    p_booking_version,
    p_stripe_environment,
    trim(p_expected_checkout_session_id),
    trim(p_new_checkout_session_id),
    p_original_amount_cents,
    p_discount_amount_cents,
    p_total_amount_cents,
    p_checkout_timing,
    p_promotion_code,
    p_stripe_promotion_code_id,
    p_stripe_coupon_id,
    p_discount_type,
    p_discount_value,
    case when nullif(trim(p_promotion_code), '') is not null
      then trim(p_attempt_idempotency_key)
      else null
    end
  );

  update public.session_payments
  set financial_status = v_original_status, updated_at = now()
  where id = v_payment.id;

  insert into public.session_payment_attempts (
    session_payment_id,
    attempt_kind,
    idempotency_key,
    status,
    stripe_checkout_session_id,
    request_metadata,
    response_metadata
  ) values (
    v_payment.id,
    'payment_retry',
    trim(p_attempt_idempotency_key),
    'checkout_created',
    trim(p_new_checkout_session_id),
    p_request_metadata,
    p_response_metadata
  );

  return coalesce(v_swap, '{}'::jsonb) || jsonb_build_object(
    'applied', true,
    'reason', 'retry_checkout_committed'
  );
end;
$$;

revoke all on function public.commit_session_payment_retry_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text, text,
  jsonb, jsonb, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.commit_session_payment_retry_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text, text,
  jsonb, jsonb, text, text, text, text, integer
) to service_role;

comment on function public.commit_session_payment_retry_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text, text,
  jsonb, jsonb, text, text, text, text, integer
) is 'Atomically persists a replacement V10 Checkout and its retry attempt while the released booking remains unoccupied.';

create or replace function public.claim_session_payment_setup_retry_v10(
  p_session_payment_id uuid,
  p_booking_version bigint,
  p_stripe_checkout_session_id text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz
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
  v_preflight jsonb;
  v_setup public.session_payment_setups%rowtype;
begin
  if p_session_payment_id is null
    or p_booking_version is null or p_booking_version <= 0
    or nullif(trim(p_stripe_checkout_session_id), '') is null
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'SESSION_PAYMENT_V10_SETUP_RETRY_CLAIM_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:v10:session-payment:' || p_session_payment_id::text,
      0
    )
  );

  select payment.* into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.stripe_checkout_session_id <> trim(p_stripe_checkout_session_id)
  then
    return jsonb_build_object('claimed', false, 'reason', 'payment_not_retryable');
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id
  for update;

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
  order by attempt.created_at desc, attempt.id desc
  limit 1
  for update;

  if not found or v_attempt.attempt_kind <> 'payment_retry' then
    return jsonb_build_object('claimed', false, 'reason', 'attempt_not_retryable');
  end if;

  select setup.* into v_setup
  from public.session_payment_setups as setup
  where setup.session_payment_id = v_payment.id
    and setup.status = 'succeeded'
    and setup.superseded_at is null
  order by setup.created_at desc, setup.id desc
  limit 1;

  if v_setup.id is not null
    and v_booking.status = 'confirmed'
    and exists (
      select 1 from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.session_payment_setup_id = v_setup.id
        and schedule.status in ('scheduled', 'claimed', 'processing', 'retry_scheduled', 'paid')
    )
  then
    return jsonb_build_object(
      'claimed', true,
      'reason', 'already_completed',
      'bookingVersion', v_setup.booking_version
    );
  end if;

  if v_attempt.slot_claimed_at is not null
    and v_booking.status = 'pending_payment'
    and v_payment.financial_status = 'pending'
  then
    return jsonb_build_object(
      'claimed', true,
      'reason', 'already_claimed',
      'bookingVersion', v_booking.version
    );
  end if;

  if v_booking.status <> 'cancelled_by_payment'
    or v_booking.version <> p_booking_version
    or v_booking.starts_at <= now()
    or v_payment.financial_status not in ('failed', 'canceled')
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_attempt.status not in ('checkout_created', 'waiting_payment', 'processing')
    or v_attempt.slot_claimed_at is not null
  then
    return jsonb_build_object('claimed', false, 'reason', 'booking_not_retryable');
  end if;

  v_preflight := public.preflight_session_payment_retry_v1(v_booking.id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    update public.session_payment_attempts
    set status = 'slot_conflict',
        terminal_reason = coalesce(v_preflight ->> 'reason', 'slot_conflict'),
        authorization_received_at = coalesce(
          authorization_received_at,
          p_stripe_event_created_at
        ),
        updated_at = now()
    where id = v_attempt.id;

    return jsonb_build_object(
      'claimed', false,
      'reason', coalesce(v_preflight ->> 'reason', 'slot_conflict')
    );
  end if;

  begin
    perform pg_catalog.set_config('tes.booking_reason', 'payment_retry_authorized', true);
    perform pg_catalog.set_config('tes.booking_source', 'payment_retry_claim', true);
    perform pg_catalog.set_config('tes.booking_request_id', left(trim(p_stripe_event_id), 200), true);

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

      update public.session_payment_attempts
      set status = 'slot_conflict',
          terminal_reason = 'slot_conflict',
          authorization_received_at = coalesce(
            authorization_received_at,
            p_stripe_event_created_at
          ),
          updated_at = now()
      where id = v_attempt.id;

      return jsonb_build_object('claimed', false, 'reason', 'slot_conflict');
  end;

  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);

  update public.session_payments
  set financial_status = 'pending',
      failed_at = null,
      canceled_at = null,
      transfer_blocked_reason = null,
      updated_at = now()
  where id = v_payment.id;

  update public.session_payment_attempts
  set status = 'processing',
      authorization_received_at = coalesce(
        authorization_received_at,
        p_stripe_event_created_at
      ),
      slot_claimed_at = coalesce(slot_claimed_at, now()),
      terminal_reason = null,
      request_metadata = request_metadata || jsonb_build_object(
        'claim_event_id', trim(p_stripe_event_id)
      ),
      updated_at = now()
  where id = v_attempt.id;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id;

  return jsonb_build_object(
    'claimed', true,
    'reason', 'claimed',
    'bookingVersion', v_booking.version
  );
end;
$$;

revoke all on function public.claim_session_payment_setup_retry_v10(
  uuid, bigint, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_session_payment_setup_retry_v10(
  uuid, bigint, text, text, timestamptz
) to service_role;

comment on function public.claim_session_payment_setup_retry_v10(
  uuid, bigint, text, text, timestamptz
) is 'Claims a released V10 retry slot only after Stripe confirms the replacement SetupIntent.';

-- Reconcile only past, unpaid retry claims with terminal provider evidence and
-- no object capable of charging or transferring money. This deliberately does
-- not send retroactive messages.
with repairable as (
  select payment.id
  from public.session_payments as payment
  join public.bookings as booking on booking.id = payment.booking_id
  join public.session_payment_attempts as attempt
    on attempt.session_payment_id = payment.id
   and attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
  where payment.payment_flow_version = 'v10'
    and payment.financial_status = 'pending'
    and payment.stripe_payment_intent_id is null
    and payment.stripe_charge_id is null
    and booking.status = 'pending_payment'
    and booking.payment_status = 'pending'
    and booking.starts_at <= now()
    and attempt.attempt_kind in ('initial_hold', 'payment_retry')
    and attempt.status in ('expired', 'failed', 'canceled', 'slot_conflict')
    and attempt.slot_claimed_at is null
    and not exists (
      select 1 from public.session_payment_setups as setup
      where setup.session_payment_id = payment.id
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    and not exists (
      select 1 from public.session_payment_schedules as schedule
      where schedule.session_payment_id = payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    and not exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = payment.id
    )
    and not exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = payment.id
    )
    and not exists (
      select 1 from public.session_refunds as refund
      where refund.session_payment_id = payment.id
    )
    and not exists (
      select 1 from public.session_disputes as dispute
      where dispute.session_payment_id = payment.id
    )
    and not exists (
      select 1 from public.video_sessions as video
      where video.booking_id = booking.id
    )
)
update public.session_payments as payment
set financial_status = 'canceled',
    canceled_at = coalesce(payment.canceled_at, now()),
    transfer_status = 'not_eligible',
    transfer_blocked_reason = null,
    metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
      'v10_retry_reconciliation', jsonb_build_object(
        'reason', 'terminal_retry_without_payment_authority',
        'reconciled_at', now()
      )
    ),
    updated_at = now()
from repairable
where payment.id = repairable.id;

-- Unknown pending states must never be represented as money in progress. A
-- real provider/schedule processing state remains available as a diagnostic
-- filter and detail status.
create or replace function public.private_therapist_charge_status_v3(
  p_session_payment_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when payment.financial_status = 'disputed'
      or payment.disputed_at is not null then 'under_review'
    when public.private_therapist_finance_refunded_cents_v1(payment.id) > 0
      or payment.financial_status = 'refunded' then 'refunded'
    when payment.financial_status = 'canceled' then 'canceled'
    when payment.financial_status = 'failed' then 'failed'
    when payment.financial_status in ('paid', 'partially_refunded') then 'approved'
    when payment.financial_status = 'processing' then 'processing'
    when schedule.status in ('scheduled', 'retry_scheduled') then 'scheduled'
    when schedule.status in ('claimed', 'processing') then 'processing'
    when schedule.status in ('requires_customer_action', 'failed') then 'failed'
    when schedule.status in ('canceled', 'superseded') then 'canceled'
    when attempt.status = 'failed' then 'failed'
    when attempt.status in ('expired', 'canceled', 'slot_conflict') then 'canceled'
    else 'under_review'
  end
  from public.session_payments as payment
  left join lateral (
    select payment_schedule.status
    from public.session_payment_schedules as payment_schedule
    where payment_schedule.session_payment_id = payment.id
    order by payment_schedule.created_at desc, payment_schedule.id desc
    limit 1
  ) as schedule on true
  left join lateral (
    select payment_attempt.status
    from public.session_payment_attempts as payment_attempt
    where payment_attempt.session_payment_id = payment.id
      and payment_attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
    order by payment_attempt.created_at desc, payment_attempt.id desc
    limit 1
  ) as attempt on true
  where payment.id = p_session_payment_id;
$$;

revoke all on function public.private_therapist_charge_status_v3(uuid)
  from public, anon, authenticated;

commit;
