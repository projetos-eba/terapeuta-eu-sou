-- Patient schedule protection during Stripe authorization reconciliation.
-- Initial checkout holds remain therapist-only occupancy. A patient interval
-- becomes blocking only for a confirmed/completed booking, a paid booking not
-- projected yet, or the current manually-authorized payment awaiting capture.

create or replace function public.get_patient_schedule_blocking_bookings_v1(
  p_patient_profile_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_exclude_booking_id uuid
)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    booking.id,
    booking.starts_at,
    booking.ends_at
  from public.bookings as booking
  left join public.session_payments as payment
    on payment.booking_id = booking.id
  left join public.session_payment_attempts as attempt
    on attempt.session_payment_id = payment.id
   and attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
  where booking.patient_profile_id = p_patient_profile_id
    and booking.id is distinct from p_exclude_booking_id
    and booking.starts_at < p_range_end
    and booking.ends_at > p_range_start
    and (
      booking.status in ('confirmed', 'completed')
      or (
        booking.status in ('draft', 'pending_payment')
        and payment.financial_status = 'paid'
      )
      or (
        booking.status in ('draft', 'pending_payment')
        and payment.financial_status = 'processing'
        and attempt.status = 'capture_pending'
        and attempt.slot_claimed_at is not null
      )
    );
$$;

create or replace function public.patient_has_schedule_conflict_v1(
  p_patient_profile_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_booking_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.get_patient_schedule_blocking_bookings_v1(
      p_patient_profile_id,
      p_starts_at,
      p_ends_at,
      p_exclude_booking_id
    )
  );
$$;

create or replace function public.get_my_patient_schedule_blocking_intervals_v1(
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_patient_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_range_start is null
    or p_range_end is null
    or p_range_start >= p_range_end
    or p_range_end - p_range_start > interval '120 days' then
    raise exception 'INVALID_PATIENT_SCHEDULE_RANGE' using errcode = '22023';
  end if;

  select patient.id
    into v_patient_profile_id
  from public.patient_profiles as patient
  where patient.user_id = auth.uid();

  if v_patient_profile_id is null then
    raise exception 'PATIENT_PROFILE_REQUIRED' using errcode = '42501';
  end if;

  return query
  select blocker.starts_at, blocker.ends_at
  from public.get_patient_schedule_blocking_bookings_v1(
    v_patient_profile_id,
    p_range_start,
    p_range_end,
    null
  ) as blocker
  order by blocker.starts_at, blocker.ends_at;
end;
$$;

create or replace function public.validate_booking_against_active_holds_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'pending_payment', 'confirmed', 'completed') then
    return new;
  end if;

  -- Stable lock order: therapist first, patient second.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || new.patient_profile_id::text,
      0
    )
  );

  update public.booking_holds
  set status = 'expired', updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now();

  -- Completed bookings are patient history only; therapist occupancy keeps the
  -- established active-status and buffer contract.
  if new.status in ('draft', 'pending_payment', 'confirmed') then
    if exists (
      select 1
      from public.bookings as booking
      where booking.therapist_profile_id = new.therapist_profile_id
        and booking.id is distinct from new.id
        and booking.status in ('draft', 'pending_payment', 'confirmed')
        and booking.occupied_during && new.occupied_during
    ) then
      raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.booking_holds as hold
      where hold.therapist_profile_id = new.therapist_profile_id
        and hold.status = 'active'
        and hold.expires_at > now()
        and hold.occupied_during && new.occupied_during
    ) then
      raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
    end if;
  end if;

  if public.patient_has_schedule_conflict_v1(
    new.patient_profile_id,
    new.starts_at,
    new.ends_at,
    new.id
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.validate_hold_against_active_bookings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || new.patient_profile_id::text,
      0
    )
  );

  update public.booking_holds
  set status = 'expired', updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now()
    and id <> new.id;

  if exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if public.patient_has_schedule_conflict_v1(
    new.patient_profile_id,
    new.starts_at,
    new.ends_at,
    null
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  -- Another unsubmitted patient hold intentionally does not block this hold.
  return new;
end;
$$;

create or replace function public.preflight_session_payment_retry_v1(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_found');
  end if;

  select * into v_payment
  from public.session_payments
  where booking_id = v_booking.id
  for update;

  if v_booking.status <> 'cancelled_by_payment'
    or v_payment.financial_status not in ('failed', 'canceled') then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  if v_booking.starts_at <= now() then
    return jsonb_build_object('allowed', false, 'reason', 'booking_started');
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

  if exists (
    select 1 from public.bookings as conflict
    where conflict.therapist_profile_id = v_booking.therapist_profile_id
      and conflict.id <> v_booking.id
      and conflict.status in ('draft', 'pending_payment', 'confirmed')
      and conflict.occupied_during && v_booking.occupied_during
  ) or exists (
    select 1 from public.booking_holds as hold
    where hold.therapist_profile_id = v_booking.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && v_booking.occupied_during
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'slot_conflict');
  end if;

  if public.patient_has_schedule_conflict_v1(
    v_booking.patient_profile_id,
    v_booking.starts_at,
    v_booking.ends_at,
    v_booking.id
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'patient_schedule_conflict'
    );
  end if;

  return jsonb_build_object('allowed', true, 'reason', 'available');
end;
$$;

create or replace function public.claim_session_payment_authorization_v1(
  p_session_payment_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_event_created_at timestamptz,
  p_request_id text
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
  select * into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'payment_not_found');
  end if;

  if v_payment.stripe_checkout_session_id is distinct from
    p_stripe_checkout_session_id then
    return jsonb_build_object('claimed', false, 'reason', 'superseded');
  end if;

  select * into v_attempt
  from public.session_payment_attempts
  where session_payment_id = v_payment.id
    and stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;

  if not found or v_attempt.attempt_kind = 'legacy' then
    return jsonb_build_object('claimed', false, 'reason', 'attempt_not_found');
  end if;

  if v_attempt.slot_claimed_at is not null then
    return jsonb_build_object('claimed', true, 'reason', 'already_claimed');
  end if;

  if v_attempt.status in ('expired', 'slot_conflict', 'failed', 'canceled') then
    return jsonb_build_object(
      'claimed', false,
      'reason', coalesce(v_attempt.terminal_reason, v_attempt.status)
    );
  end if;

  if v_attempt.attempt_kind = 'initial_hold'
    and (
      v_attempt.reservation_expires_at is null
      or p_event_created_at > v_attempt.reservation_expires_at
      or now() > v_attempt.reservation_expires_at
    ) then
    update public.session_payment_attempts
    set status = 'expired', terminal_reason = 'reservation_expired',
        updated_at = now()
    where id = v_attempt.id;

    update public.session_payments
    set financial_status = 'canceled', canceled_at = coalesce(canceled_at, now()),
        updated_at = now()
    where id = v_payment.id and financial_status in ('pending', 'processing');

    return jsonb_build_object('claimed', false, 'reason', 'expired');
  end if;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

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
    update public.session_payment_attempts
    set status = 'slot_conflict',
        terminal_reason = 'patient_schedule_conflict',
        authorization_received_at = coalesce(
          authorization_received_at,
          p_event_created_at
        ),
        stripe_payment_intent_id = coalesce(
          p_stripe_payment_intent_id,
          stripe_payment_intent_id
        ),
        updated_at = now()
    where id = v_attempt.id;

    return jsonb_build_object(
      'claimed', false,
      'reason', 'patient_schedule_conflict'
    );
  end if;

  if v_attempt.attempt_kind = 'payment_retry' then
    if v_booking.status <> 'cancelled_by_payment'
      or v_payment.financial_status not in ('failed', 'canceled') then
      return jsonb_build_object('claimed', false, 'reason', 'booking_not_retryable');
    end if;

    begin
      perform pg_catalog.set_config('tes.booking_reason', 'payment_retry_authorized', true);
      perform pg_catalog.set_config('tes.booking_source', 'payment_retry_claim', true);
      perform pg_catalog.set_config('tes.booking_request_id', left(p_request_id, 200), true);

      update public.bookings
      set status = 'pending_payment', cancellation_reason = null,
          cancelled_at = null, payment_status = 'pending', updated_at = now()
      where id = v_booking.id;
    exception
      when exclusion_violation or raise_exception then
        perform pg_catalog.set_config('tes.booking_reason', '', true);
        perform pg_catalog.set_config('tes.booking_source', '', true);
        perform pg_catalog.set_config('tes.booking_request_id', '', true);
        update public.session_payment_attempts
        set status = 'slot_conflict', terminal_reason = 'slot_conflict',
            authorization_received_at = coalesce(
              authorization_received_at,
              p_event_created_at
            ),
            stripe_payment_intent_id = coalesce(
              p_stripe_payment_intent_id,
              stripe_payment_intent_id
            ),
            updated_at = now()
        where id = v_attempt.id;
        return jsonb_build_object('claimed', false, 'reason', 'slot_conflict');
    end;
  elsif v_booking.status not in ('draft', 'pending_payment') then
    return jsonb_build_object('claimed', false, 'reason', 'booking_not_payable');
  end if;

  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);

  update public.session_payments
  set financial_status = 'processing',
      stripe_payment_intent_id = coalesce(
        p_stripe_payment_intent_id,
        stripe_payment_intent_id
      ),
      failed_at = null, canceled_at = null, updated_at = now()
  where id = v_payment.id;

  update public.session_payment_attempts
  set status = 'capture_pending',
      authorization_received_at = coalesce(
        authorization_received_at,
        p_event_created_at
      ),
      slot_claimed_at = coalesce(slot_claimed_at, now()),
      stripe_payment_intent_id = coalesce(
        p_stripe_payment_intent_id,
        stripe_payment_intent_id
      ),
      updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object('claimed', true, 'reason', 'claimed');
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
    and (
      p_stripe_checkout_session_id is null
      or stripe_checkout_session_id = p_stripe_checkout_session_id
    )
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'status', case
      when v_payment.financial_status = 'paid' and v_booking.status = 'confirmed'
        then 'confirmed'
      when v_attempt.status = 'slot_conflict' then 'slot_conflict'
      when v_attempt.status = 'expired' then 'expired'
      when v_attempt.status in ('failed', 'canceled')
        or v_payment.financial_status in ('failed', 'canceled') then 'failed'
      when v_attempt.status = 'capture_pending'
        or v_payment.financial_status = 'processing' then 'authorizing'
      else 'waiting_payment'
    end,
    'bookingId', v_booking.id,
    'conflictKind', case
      when v_attempt.status = 'slot_conflict'
        and v_attempt.terminal_reason = 'patient_schedule_conflict'
        then 'patient_schedule'
      when v_attempt.status = 'slot_conflict' then 'therapist_slot'
      else null
    end
  );
end;
$$;

revoke all on function public.get_patient_schedule_blocking_bookings_v1(
  uuid, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.patient_has_schedule_conflict_v1(
  uuid, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.get_my_patient_schedule_blocking_intervals_v1(
  timestamptz, timestamptz
) from public, anon;

grant execute on function public.get_patient_schedule_blocking_bookings_v1(
  uuid, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.patient_has_schedule_conflict_v1(
  uuid, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.get_my_patient_schedule_blocking_intervals_v1(
  timestamptz, timestamptz
) to authenticated, service_role;

comment on function public.get_patient_schedule_blocking_bookings_v1(
  uuid, timestamptz, timestamptz, uuid
) is 'Canonical patient schedule blockers: confirmed/completed, paid awaiting projection, or the current claimed manual authorization.';
comment on function public.get_my_patient_schedule_blocking_intervals_v1(
  timestamptz, timestamptz
) is 'Returns only the authenticated patient own blocking intervals for reservation UI prevention.';
comment on function public.validate_hold_against_active_bookings_v1() is
  'Protects therapist occupancy and rejects patient overlaps only after confirmation or payment authorization claim; unsubmitted patient holds remain non-blocking.';
