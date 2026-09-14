-- TES Payments V10 phase 2: reservation checkout, SetupIntent binding,
-- promotion reservation and authoritative checkout return state.
--
-- The V10 policy remains inactive. New V10 writes are reachable only when a
-- server-side Function flag explicitly selects the policy for a new booking.

alter table public.session_promotion_reservations
  add constraint session_promotion_reservations_discount_value_check
  check (
    (discount_type = 'percent' and discount_value between 0 and 10000)
    or (discount_type = 'fixed_amount' and discount_value >= 0)
  );

create or replace function public.enforce_session_payment_v10_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy_key text;
  v_account public.therapist_connect_accounts%rowtype;
  v_amounts_changed boolean;
begin
  v_amounts_changed := tg_op = 'UPDATE' and (
    new.platform_commission_bps is distinct from old.platform_commission_bps
    or new.platform_gross_commission_cents is distinct from old.platform_gross_commission_cents
    or new.therapist_amount_cents is distinct from old.therapist_amount_cents
    or new.gross_amount_cents is distinct from old.gross_amount_cents
  );

  if tg_op = 'UPDATE'
    and (old.payment_flow_version = 'v10' or new.payment_flow_version = 'v10')
  then
    if new.payment_flow_version is distinct from old.payment_flow_version
      or new.policy_version_id is distinct from old.policy_version_id
      or new.connect_account_id_snapshot is distinct from old.connect_account_id_snapshot
      or new.stripe_connect_account_id_snapshot is distinct from old.stripe_connect_account_id_snapshot
      or new.payment_due_at is distinct from old.payment_due_at
    then
      raise exception 'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE'
        using errcode = '23514';
    end if;

    -- A promotion may replace the Checkout only before a card setup, charge or
    -- transfer obligation exists. Once any of those authorities is persisted,
    -- the monetary snapshot is immutable.
    if v_amounts_changed and not (
      old.payment_flow_version = 'v10'
      and new.payment_flow_version = 'v10'
      and old.financial_status = 'pending'
      and new.financial_status = 'pending'
      and not exists (
        select 1
        from public.session_payment_setups as setup
        where setup.session_payment_id = old.id
          and setup.status = 'succeeded'
          and setup.superseded_at is null
      )
      and not exists (
        select 1
        from public.session_payment_schedules as schedule
        where schedule.session_payment_id = old.id
          and schedule.status not in ('canceled', 'superseded')
      )
      and not exists (
        select 1
        from public.session_transfer_jobs as job
        where job.session_payment_id = old.id
      )
      and not exists (
        select 1
        from public.stripe_transfers as transfer
        where transfer.session_payment_id = old.id
      )
    ) then
      raise exception 'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;

  if new.payment_flow_version <> 'v10' then
    return new;
  end if;

  select policy.policy_key
  into v_policy_key
  from public.financial_policy_versions as policy
  where policy.id = new.policy_version_id;

  if v_policy_key is distinct from 'tes-payments-v10-setup-t24-immediate-transfer' then
    raise exception 'SESSION_PAYMENT_V10_POLICY_REQUIRED'
      using errcode = '23514';
  end if;

  select account.*
  into v_account
  from public.therapist_connect_accounts as account
  where account.id = new.connect_account_id_snapshot;

  if not found
    or v_account.therapist_profile_id <> new.therapist_profile_id
    or v_account.stripe_account_id <> new.stripe_connect_account_id_snapshot
  then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_SNAPSHOT_INVALID'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and (
    not v_account.is_current
    or v_account.closed_at is not null
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or not v_account.payouts_enabled
    or v_account.payout_status <> 'enabled'
    or v_account.payout_schedule_interval <> 'daily'
  ) then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_NOT_READY'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_session_payment_v10(
  p_booking_id uuid,
  p_stripe_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.therapist_connect_accounts%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_policy public.financial_policy_versions%rowtype;
  v_snapshot record;
  v_due_at timestamptz;
begin
  if p_booking_id is null or p_stripe_customer_id is null then
    raise exception 'SESSION_PAYMENT_V10_PREPARE_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tes:v10:session-payment:' || p_booking_id::text, 0)
  );

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found
    or v_booking.status not in ('draft', 'pending_payment')
    or v_booking.service_price_cents_snapshot <= 0
    or v_booking.currency_snapshot <> 'BRL'
  then
    raise exception 'SESSION_PAYMENT_V10_BOOKING_NOT_PREPARABLE'
      using errcode = '23514';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.booking_id = v_booking.id
  for update;

  if found then
    if v_payment.payment_flow_version <> 'v10'
      or v_payment.stripe_customer_id is distinct from p_stripe_customer_id
    then
      raise exception 'SESSION_PAYMENT_V10_EXISTING_FLOW_CONFLICT'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'bookingVersion', v_booking.version,
      'connectAccountId', v_payment.connect_account_id_snapshot,
      'paymentDueAt', v_payment.payment_due_at,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'sessionPaymentId', v_payment.id,
      'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id,
      'stripeConnectAccountId', v_payment.stripe_connect_account_id_snapshot
    );
  end if;

  select policy.*
  into v_policy
  from public.financial_policy_versions as policy
  where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

  if not found or v_policy.platform_commission_bps <> 1500 then
    raise exception 'SESSION_PAYMENT_V10_POLICY_NOT_READY'
      using errcode = '23514';
  end if;

  select account.*
  into v_account
  from public.therapist_connect_accounts as account
  where account.therapist_profile_id = v_booking.therapist_profile_id
    and account.is_current
    and account.closed_at is null
    and account.operational_status = 'ready'
    and account.stripe_transfers_status = 'active'
    and account.payouts_enabled
    and account.payout_status = 'enabled'
    and account.payout_schedule_interval = 'daily'
  order by account.updated_at desc, account.id
  limit 1
  for update;

  if not found then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_NOT_READY'
      using errcode = '23514';
  end if;

  select *
  into v_snapshot
  from public.calculate_session_payment_snapshot(
    v_booking.service_price_cents_snapshot,
    v_policy.platform_commission_bps
  );

  v_due_at := v_booking.starts_at - interval '24 hours';

  insert into public.session_payments (
    booking_id,
    patient_profile_id,
    therapist_profile_id,
    service_id,
    policy_version_id,
    gross_amount_cents,
    platform_commission_bps,
    platform_gross_commission_cents,
    therapist_amount_cents,
    currency,
    stripe_customer_id,
    payment_flow_version,
    connect_account_id_snapshot,
    stripe_connect_account_id_snapshot,
    payment_due_at,
    metadata
  )
  values (
    v_booking.id,
    v_booking.patient_profile_id,
    v_booking.therapist_profile_id,
    v_booking.service_id,
    v_policy.id,
    v_snapshot.gross_amount_cents,
    v_snapshot.platform_commission_bps,
    v_snapshot.platform_gross_commission_cents,
    v_snapshot.therapist_amount_cents,
    'BRL',
    p_stripe_customer_id,
    'v10',
    v_account.id,
    v_account.stripe_account_id,
    v_due_at,
    jsonb_build_object(
      'stripe_checkout', jsonb_build_object(
        'original_amount_cents', v_booking.service_price_cents_snapshot,
        'charged_amount_cents', v_booking.service_price_cents_snapshot,
        'discount_amount_cents', 0
      )
    )
  )
  returning * into v_payment;

  -- The legacy payment projection trigger moves a draft booking to
  -- pending_payment when the payment is inserted, which advances the booking
  -- version. Return the version that is actually persisted after that trigger
  -- instead of the stale row captured before the insert.
  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id;

  return jsonb_build_object(
    'bookingVersion', v_booking.version,
    'connectAccountId', v_payment.connect_account_id_snapshot,
    'paymentDueAt', v_payment.payment_due_at,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'sessionPaymentId', v_payment.id,
    'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id,
    'stripeConnectAccountId', v_payment.stripe_connect_account_id_snapshot
  );
end;
$$;

create or replace function public.swap_session_payment_checkout_v10(
  p_session_payment_id uuid,
  p_booking_version bigint,
  p_stripe_environment text,
  p_expected_checkout_session_id text,
  p_new_checkout_session_id text,
  p_original_amount_cents integer,
  p_discount_amount_cents integer,
  p_total_amount_cents integer,
  p_checkout_timing text,
  p_promotion_code text default null,
  p_stripe_promotion_code_id text default null,
  p_stripe_coupon_id text default null,
  p_discount_type text default null,
  p_discount_value integer default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_existing_reservation public.session_promotion_reservations%rowtype;
  v_existing_reservation_found boolean := false;
  v_payment public.session_payments%rowtype;
  v_snapshot record;
  v_has_promotion boolean;
begin
  v_has_promotion := nullif(trim(p_promotion_code), '') is not null;

  if p_session_payment_id is null
    or p_booking_version is null or p_booking_version <= 0
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_new_checkout_session_id), '') is null
    or p_original_amount_cents is null or p_original_amount_cents < 0
    or p_discount_amount_cents is null or p_discount_amount_cents < 0
    or p_total_amount_cents is null or p_total_amount_cents < 0
    or p_original_amount_cents <> p_discount_amount_cents + p_total_amount_cents
    or p_checkout_timing not in ('scheduled', 'immediate')
    or (
      v_has_promotion and (
        nullif(trim(p_stripe_promotion_code_id), '') is null
        or nullif(trim(p_stripe_coupon_id), '') is null
        or p_discount_type not in ('percent', 'fixed_amount')
        or p_discount_value is null or p_discount_value < 0
        or nullif(trim(p_idempotency_key), '') is null
      )
    )
    or (
      not v_has_promotion and (
        p_stripe_promotion_code_id is not null
        or p_stripe_coupon_id is not null
        or p_discount_type is not null
        or p_discount_value is not null
      )
    )
  then
    raise exception 'SESSION_PAYMENT_V10_CHECKOUT_SWAP_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'pending'
  then
    raise exception 'SESSION_PAYMENT_V10_NOT_REPLACEABLE'
      using errcode = '23514';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id
  for update;

  if not found
    or v_booking.version <> p_booking_version
    or v_booking.service_price_cents_snapshot <> p_original_amount_cents
  then
    raise exception 'SESSION_PAYMENT_BOOKING_VERSION_MISMATCH'
      using errcode = '23514';
  end if;

  if v_payment.stripe_checkout_session_id is distinct from p_new_checkout_session_id
    and v_payment.stripe_checkout_session_id is distinct from p_expected_checkout_session_id
  then
    raise exception 'SESSION_PAYMENT_V10_CHECKOUT_SWAP_CONFLICT'
      using errcode = '40001';
  end if;

  if v_has_promotion then
    select reservation.*
    into v_existing_reservation
    from public.session_promotion_reservations as reservation
    where reservation.stripe_environment = p_stripe_environment
      and reservation.idempotency_key = trim(p_idempotency_key)
    for update;
    v_existing_reservation_found := found;

    if v_existing_reservation_found and (
      v_existing_reservation.booking_id <> v_booking.id
      or v_existing_reservation.booking_version <> p_booking_version
      or v_existing_reservation.session_payment_id <> v_payment.id
      or v_existing_reservation.stripe_promotion_code_id <> trim(p_stripe_promotion_code_id)
      or v_existing_reservation.stripe_coupon_id <> trim(p_stripe_coupon_id)
      or v_existing_reservation.subtotal_cents <> p_original_amount_cents
      or v_existing_reservation.discount_cents <> p_discount_amount_cents
      or v_existing_reservation.total_cents <> p_total_amount_cents
    ) then
      raise exception 'SESSION_PROMOTION_RESERVATION_IDEMPOTENCY_CONFLICT'
        using errcode = '23505';
    end if;

    update public.session_promotion_reservations
    set status = 'released',
        released_at = coalesce(released_at, now()),
        updated_at = now()
    where booking_id = v_booking.id
      and booking_version = p_booking_version
      and status in ('reserved', 'consumed')
      and (
        not v_existing_reservation_found
        or id <> v_existing_reservation.id
      );

    if not v_existing_reservation_found then
      insert into public.session_promotion_reservations (
        booking_id,
        booking_version,
        session_payment_id,
        stripe_environment,
        stripe_promotion_code_id,
        stripe_coupon_id,
        promotion_code_snapshot,
        discount_type,
        discount_value,
        subtotal_cents,
        discount_cents,
        total_cents,
        idempotency_key,
        metadata
      )
      values (
        v_booking.id,
        p_booking_version,
        v_payment.id,
        p_stripe_environment,
        trim(p_stripe_promotion_code_id),
        trim(p_stripe_coupon_id),
        upper(trim(p_promotion_code)),
        p_discount_type,
        p_discount_value,
        p_original_amount_cents,
        p_discount_amount_cents,
        p_total_amount_cents,
        trim(p_idempotency_key),
        jsonb_build_object('checkoutTiming', p_checkout_timing)
      )
      returning * into v_existing_reservation;
    else
      update public.session_promotion_reservations
      set status = 'reserved',
          released_at = null,
          updated_at = now()
      where id = v_existing_reservation.id
      returning * into v_existing_reservation;
    end if;
  else
    update public.session_promotion_reservations
    set status = 'released',
        released_at = coalesce(released_at, now()),
        updated_at = now()
    where booking_id = v_booking.id
      and booking_version = p_booking_version
      and status in ('reserved', 'consumed');
  end if;

  select *
  into v_snapshot
  from public.calculate_session_payment_snapshot(
    p_total_amount_cents,
    v_payment.platform_commission_bps
  );

  update public.session_payments
  set gross_amount_cents = v_snapshot.gross_amount_cents,
      platform_gross_commission_cents = v_snapshot.platform_gross_commission_cents,
      therapist_amount_cents = v_snapshot.therapist_amount_cents,
      stripe_checkout_session_id = trim(p_new_checkout_session_id),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'stripe_checkout', jsonb_build_object(
          'original_amount_cents', p_original_amount_cents,
          'charged_amount_cents', p_total_amount_cents,
          'discount_amount_cents', p_discount_amount_cents,
          'checkout_timing', p_checkout_timing,
          'promotion_code_id', case when v_has_promotion then trim(p_stripe_promotion_code_id) else null end,
          'coupon_id', case when v_has_promotion then trim(p_stripe_coupon_id) else null end
        )
      ),
      updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  return jsonb_build_object(
    'applied', true,
    'promotionReservationId', case when v_has_promotion then v_existing_reservation.id else null end,
    'sessionPaymentId', v_payment.id,
    'stripeCheckoutSessionId', v_payment.stripe_checkout_session_id,
    'therapistAmountCents', v_payment.therapist_amount_cents,
    'totalAmountCents', v_payment.gross_amount_cents
  );
end;
$$;

create or replace function public.complete_session_payment_setup_v10(
  p_session_payment_id uuid,
  p_booking_version bigint,
  p_stripe_environment text,
  p_stripe_checkout_session_id text,
  p_stripe_customer_id text,
  p_stripe_setup_intent_id text,
  p_stripe_payment_method_id text,
  p_consent_version text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_customer public.stripe_customers%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule jsonb;
  v_schedule_key text;
  v_setup jsonb;
  v_setup_id uuid;
  v_fingerprint text;
begin
  if p_session_payment_id is null
    or p_booking_version is null or p_booking_version <= 0
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_stripe_checkout_session_id), '') is null
    or nullif(trim(p_stripe_customer_id), '') is null
    or nullif(trim(p_stripe_setup_intent_id), '') is null
    or nullif(trim(p_stripe_payment_method_id), '') is null
    or nullif(trim(p_consent_version), '') is null
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'SESSION_PAYMENT_SETUP_COMPLETION_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_checkout_session_id <> trim(p_stripe_checkout_session_id)
  then
    raise exception 'SESSION_PAYMENT_SETUP_COMPLETION_V10_CONFLICT'
      using errcode = '23514';
  end if;

  select customer.*
  into v_customer
  from public.stripe_customers as customer
  where customer.id = v_payment.stripe_customer_id;

  if not found
    or v_customer.stripe_customer_id <> trim(p_stripe_customer_id)
    or v_customer.environment <> p_stripe_environment
  then
    raise exception 'SESSION_PAYMENT_SETUP_CUSTOMER_V10_CONFLICT'
      using errcode = '23514';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_payment.booking_id
  for update;

  if not found or v_booking.legal_acceptance_recorded_at is null
  then
    raise exception 'SESSION_PAYMENT_SETUP_CONSENT_V10_MISSING'
      using errcode = '23514';
  end if;

  select setup.id
  into v_setup_id
  from public.session_payment_setups as setup
  where setup.session_payment_id = v_payment.id
    and setup.booking_version = p_booking_version
    and setup.stripe_environment = p_stripe_environment
    and setup.stripe_customer_id = trim(p_stripe_customer_id)
    and setup.stripe_setup_intent_id = trim(p_stripe_setup_intent_id)
    and setup.stripe_payment_method_id = trim(p_stripe_payment_method_id)
    and setup.consent_version = trim(p_consent_version)
    and setup.status = 'succeeded'
    and setup.superseded_at is null;

  if found and exists (
    select 1
    from public.session_payment_schedules as schedule
    where schedule.session_payment_id = v_payment.id
      and schedule.session_payment_setup_id = v_setup_id
      and schedule.status in ('scheduled', 'claimed', 'processing', 'retry_scheduled')
  ) and v_booking.status = 'confirmed' then
    return jsonb_build_object(
      'bookingId', v_booking.id,
      'bookingVersion', p_booking_version,
      'scheduleId', (
        select schedule.id
        from public.session_payment_schedules as schedule
        where schedule.session_payment_id = v_payment.id
          and schedule.session_payment_setup_id = v_setup_id
        limit 1
      ),
      'setupId', v_setup_id,
      'status', 'scheduled'
    );
  end if;

  if v_booking.version <> p_booking_version then
    raise exception 'SESSION_PAYMENT_BOOKING_VERSION_MISMATCH'
      using errcode = '23514';
  end if;

  v_setup := public.register_session_payment_setup_v10(
    v_payment.id,
    p_booking_version,
    p_stripe_environment,
    trim(p_stripe_customer_id),
    trim(p_stripe_setup_intent_id),
    trim(p_stripe_payment_method_id),
    'succeeded',
    trim(p_consent_version),
    v_booking.legal_acceptance_recorded_at,
    null
  );
  v_setup_id := (v_setup ->> 'setupId')::uuid;
  v_schedule_key := 'tes:v10:session-charge:' || v_payment.id::text
    || ':booking-version:' || p_booking_version::text;
  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        ':',
        p_stripe_environment,
        v_payment.id::text,
        v_setup_id::text,
        trim(p_stripe_payment_method_id),
        v_payment.payment_due_at::text,
        v_payment.gross_amount_cents::text,
        v_payment.currency::text
      ),
      'sha256'
    ),
    'hex'
  );

  v_schedule := public.schedule_session_payment_v10(
    v_payment.id,
    v_setup_id,
    v_payment.payment_due_at,
    v_schedule_key,
    v_fingerprint
  );

  update public.bookings
  set status = case
        when status in ('draft', 'pending_payment') then 'confirmed'
        else status
      end,
      payment_status = 'pending',
      updated_at = now()
  where id = v_booking.id
    and status not in (
      'cancelled_by_patient', 'cancelled_by_therapist',
      'cancelled_by_payment', 'refunded'
    );

  if not found then
    raise exception 'SESSION_PAYMENT_SETUP_BOOKING_CLOSED'
      using errcode = '23514';
  end if;

  update public.session_payment_attempts
  set status = 'setup_succeeded',
      stripe_setup_intent_id = trim(p_stripe_setup_intent_id),
      updated_at = now()
  where session_payment_id = v_payment.id
    and stripe_checkout_session_id = trim(p_stripe_checkout_session_id);

  update public.session_promotion_reservations
  set status = 'consumed',
      consumed_at = coalesce(consumed_at, p_stripe_event_created_at),
      updated_at = now()
  where session_payment_id = v_payment.id
    and booking_version = p_booking_version
    and status = 'reserved';

  return jsonb_build_object(
    'bookingId', v_booking.id,
    'bookingVersion', p_booking_version,
    'scheduleId', v_schedule ->> 'scheduleId',
    'setupId', v_setup_id,
    'status', 'scheduled'
  );
end;
$$;

-- Complete the existing Phase 1 contract so paid V10 state, booking state,
-- ledger and direct Transfer outbox are one database transaction.
create or replace function public.confirm_session_payment_and_enqueue_transfer_v10(
  p_session_payment_id uuid,
  p_stripe_environment text,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text,
  p_paid_at timestamptz,
  p_stripe_event_id text default null,
  p_stripe_event_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applied jsonb;
  v_fingerprint text;
  v_idempotency_key text;
  v_job public.session_transfer_jobs%rowtype;
  v_payment public.session_payments%rowtype;
begin
  if p_session_payment_id is null
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_stripe_payment_intent_id), '') is null
    or nullif(trim(p_stripe_charge_id), '') is null
    or p_paid_at is null
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'SESSION_PAYMENT_CONFIRMATION_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PAYMENT_V10_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_payment.financial_status = 'paid' and (
    v_payment.stripe_payment_intent_id is distinct from trim(p_stripe_payment_intent_id)
    or v_payment.stripe_charge_id is distinct from trim(p_stripe_charge_id)
  ) then
    raise exception 'SESSION_PAYMENT_CONFIRMATION_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  if v_payment.financial_status not in ('pending', 'processing', 'paid') then
    raise exception 'SESSION_PAYMENT_V10_NOT_CONFIRMABLE'
      using errcode = '23514';
  end if;

  v_applied := public.apply_session_payment_state_v1(
    v_payment.id,
    'paid',
    trim(p_stripe_event_id),
    p_stripe_event_created_at,
    trim(p_stripe_payment_intent_id),
    trim(p_stripe_charge_id),
    v_payment.stripe_checkout_session_id
  );

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id;

  if v_payment.financial_status <> 'paid'
    or v_payment.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id)
    or v_payment.stripe_charge_id <> trim(p_stripe_charge_id)
  then
    raise exception 'SESSION_PAYMENT_CONFIRMATION_V10_NOT_APPLIED'
      using errcode = '23514';
  end if;

  update public.session_payment_schedules
  set status = 'paid',
      stripe_payment_intent_id = trim(p_stripe_payment_intent_id),
      stripe_charge_id = trim(p_stripe_charge_id),
      succeeded_at = coalesce(succeeded_at, p_paid_at),
      lease_owner = null,
      lease_expires_at = null,
      next_retry_at = null,
      last_error_code = null,
      updated_at = now()
  where session_payment_id = v_payment.id
    and status <> 'paid';

  if v_payment.therapist_amount_cents = 0 then
    update public.session_payments
    set transfer_status = 'not_eligible', updated_at = now()
    where id = v_payment.id;

    return jsonb_build_object(
      'sessionPaymentId', v_payment.id,
      'financialStatus', 'paid',
      'transferJobId', null,
      'transferStatus', 'not_eligible'
    );
  end if;

  update public.session_payments
  set transfer_status = 'transfer_pending',
      transfer_blocked_reason = null,
      eligible_at = null,
      updated_at = now()
  where id = v_payment.id;

  v_idempotency_key := 'tes:v10:session-transfer:' || v_payment.id::text;
  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        ':',
        p_stripe_environment,
        v_payment.id::text,
        trim(p_stripe_charge_id),
        v_payment.connect_account_id_snapshot::text,
        v_payment.therapist_amount_cents::text,
        v_payment.currency::text
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.session_transfer_jobs (
    session_payment_id,
    booking_id,
    policy_version_id,
    connect_account_id,
    stripe_environment,
    stripe_source_charge_id,
    therapist_gross_amount_cents,
    debt_offset_amount_cents,
    transfer_amount_cents,
    idempotency_key,
    request_fingerprint
  )
  values (
    v_payment.id,
    v_payment.booking_id,
    v_payment.policy_version_id,
    v_payment.connect_account_id_snapshot,
    p_stripe_environment,
    trim(p_stripe_charge_id),
    v_payment.therapist_amount_cents,
    0,
    v_payment.therapist_amount_cents,
    v_idempotency_key,
    v_fingerprint
  )
  on conflict (session_payment_id) do update
  set updated_at = public.session_transfer_jobs.updated_at
  returning * into v_job;

  if v_job.stripe_source_charge_id <> trim(p_stripe_charge_id)
    or v_job.connect_account_id <> v_payment.connect_account_id_snapshot
    or v_job.transfer_amount_cents <> v_payment.therapist_amount_cents
    or v_job.request_fingerprint <> v_fingerprint
  then
    raise exception 'SESSION_TRANSFER_JOB_V10_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id,
    'financialStatus', 'paid',
    'transferJobId', v_job.id,
    'transferStatus', 'transfer_pending'
  );
end;
$$;

create or replace function public.confirm_zero_total_session_payment_v10(
  p_session_payment_id uuid,
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
  v_payment public.session_payments%rowtype;
begin
  if p_session_payment_id is null
    or nullif(trim(p_stripe_checkout_session_id), '') is null
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
  then
    raise exception 'SESSION_PAYMENT_ZERO_TOTAL_V10_INVALID'
      using errcode = '22023';
  end if;

  select payment.*
  into v_payment
  from public.session_payments as payment
  where payment.id = p_session_payment_id
  for update;

  if not found
    or v_payment.payment_flow_version <> 'v10'
    or v_payment.gross_amount_cents <> 0
    or v_payment.therapist_amount_cents <> 0
    or v_payment.stripe_checkout_session_id <> trim(p_stripe_checkout_session_id)
  then
    raise exception 'SESSION_PAYMENT_ZERO_TOTAL_V10_CONFLICT'
      using errcode = '23514';
  end if;

  perform public.apply_session_payment_state_v1(
    v_payment.id,
    'paid',
    trim(p_stripe_event_id),
    p_stripe_event_created_at,
    null,
    null,
    trim(p_stripe_checkout_session_id)
  );

  update public.session_payments
  set transfer_status = 'not_eligible', updated_at = now()
  where id = v_payment.id;

  update public.session_promotion_reservations
  set status = 'consumed',
      consumed_at = coalesce(consumed_at, p_stripe_event_created_at),
      updated_at = now()
  where session_payment_id = v_payment.id
    and status = 'reserved';

  return jsonb_build_object(
    'sessionPaymentId', v_payment.id,
    'financialStatus', 'paid',
    'transferJobId', null,
    'transferStatus', 'not_eligible'
  );
end;
$$;

create or replace function public.get_patient_reservation_attempt_status_v1(
  p_booking_id uuid,
  p_stripe_checkout_session_id text default null
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
  v_schedule public.session_payment_schedules%rowtype;
begin
  select booking.* into v_booking
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  where booking.id = p_booking_id
    and patient.user_id = auth.uid();

  if not found then
    return jsonb_build_object('status', 'failed');
  end if;

  select * into v_payment
  from public.session_payments
  where booking_id = v_booking.id;

  select * into v_attempt
  from public.session_payment_attempts
  where session_payment_id = v_payment.id
    and stripe_checkout_session_id = coalesce(
      p_stripe_checkout_session_id,
      v_payment.stripe_checkout_session_id
    )
  order by created_at desc
  limit 1;

  if p_stripe_checkout_session_id is not null and not found then
    return jsonb_build_object('status', 'failed');
  end if;

  if v_payment.payment_flow_version = 'v10' then
    select schedule.*
    into v_schedule
    from public.session_payment_schedules as schedule
    where schedule.session_payment_id = v_payment.id
    order by schedule.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'status', case
      when v_payment.financial_status = 'paid' and v_booking.status = 'confirmed'
        then 'confirmed'
      when v_payment.payment_flow_version = 'v10'
        and v_booking.status = 'confirmed'
        and v_payment.financial_status = 'pending'
        and v_attempt.status = 'setup_succeeded'
        and v_schedule.status in ('scheduled', 'claimed', 'processing', 'retry_scheduled')
        then 'scheduled'
      when v_attempt.status = 'slot_conflict'
        or (v_attempt.status in ('failed', 'canceled', 'expired')
          and v_attempt.terminal_reason in ('patient_schedule_conflict', 'slot_conflict'))
        then 'slot_conflict'
      when v_attempt.status = 'expired'
        or (v_attempt.status in ('failed', 'canceled')
          and v_attempt.terminal_reason = 'reservation_expired')
        then 'expired'
      when v_attempt.status in ('failed', 'canceled') then 'failed'
      when v_attempt.status = 'capture_pending'
        or v_attempt.status = 'paid'
        or v_payment.financial_status in ('processing', 'paid') then 'authorizing'
      when v_attempt.status in ('checkout_created', 'waiting_payment', 'processing')
        then 'waiting_payment'
      when v_payment.financial_status in ('failed', 'canceled') then 'failed'
      else 'waiting_payment'
    end,
    'bookingId', v_booking.id,
    'conflictKind', case
      when v_attempt.status in ('slot_conflict', 'failed', 'canceled', 'expired')
        and v_attempt.terminal_reason = 'patient_schedule_conflict'
        then 'patient_schedule'
      when v_attempt.status = 'slot_conflict'
        or (v_attempt.status in ('failed', 'canceled', 'expired')
          and v_attempt.terminal_reason = 'slot_conflict')
        then 'therapist_slot'
      else null
    end
  );
end;
$$;

revoke all on function public.prepare_session_payment_v10(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_session_payment_v10(uuid, uuid)
  to service_role;

revoke all on function public.swap_session_payment_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text,
  text, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.swap_session_payment_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text,
  text, text, text, text, integer, text
) to service_role;

revoke all on function public.complete_session_payment_setup_v10(
  uuid, bigint, text, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_session_payment_setup_v10(
  uuid, bigint, text, text, text, text, text, text, text, timestamptz
) to service_role;

revoke all on function public.confirm_zero_total_session_payment_v10(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.confirm_zero_total_session_payment_v10(
  uuid, text, text, timestamptz
) to service_role;

revoke all on function public.get_patient_reservation_attempt_status_v1(uuid, text)
  from public, anon;
grant execute on function public.get_patient_reservation_attempt_status_v1(uuid, text)
  to authenticated, service_role;

comment on function public.prepare_session_payment_v10(uuid, uuid) is
  'Creates one immutable V10 payment/account/due-date snapshot per booking; service_role only.';
comment on function public.swap_session_payment_checkout_v10(
  uuid, bigint, text, text, text, integer, integer, integer, text,
  text, text, text, text, integer, text
) is 'Atomically swaps an open V10 Checkout and its promotion/money snapshot before setup or charge authority exists.';
comment on function public.complete_session_payment_setup_v10(
  uuid, bigint, text, text, text, text, text, text, text, timestamptz
) is 'Binds the successful off-session SetupIntent and PaymentMethod to one booking version and schedules its T-24 charge.';
comment on function public.confirm_zero_total_session_payment_v10(uuid, text, text, timestamptz) is
  'Confirms a signed no-payment-required V10 Checkout without creating a card setup or Transfer obligation.';
