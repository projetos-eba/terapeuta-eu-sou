-- Incremental hardening found by local checkout and full regression tests.
-- No historical data is rewritten; published migrations remain unchanged.

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

  -- An unchanged, already confirmed historical interval is not a new booking.
  -- Preserve completion/reconciliation of legacy overlaps, but revalidate every
  -- insert, patient change, time change and transition from an unpaid booking.
  if tg_op = 'UPDATE'
    and old.status in ('confirmed', 'completed')
    and new.status in ('confirmed', 'completed')
    and new.patient_profile_id is not distinct from old.patient_profile_id
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
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

create or replace function public.preserve_reservation_attempt_state_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.attempt_kind = 'legacy' then return new; end if;

  -- Financial cancellation acknowledges the rejected authorization; it must not
  -- erase the scheduling decision. A real paid result still takes precedence.
  if old.status in ('slot_conflict', 'expired')
    and new.status in ('canceled', 'failed', 'processing', 'expired') then
    new.status := old.status;
    new.terminal_reason := old.terminal_reason;
  elsif old.status = 'capture_pending'
    and old.slot_claimed_at is not null
    and new.status = 'processing' then
    new.status := 'capture_pending';
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_reservation_attempt_state
  on public.session_payment_attempts;
create trigger preserve_reservation_attempt_state
before update of status on public.session_payment_attempts
for each row execute function public.preserve_reservation_attempt_state_v1();

revoke all on function public.preserve_reservation_attempt_state_v1()
  from public, anon, authenticated;

comment on function public.preserve_reservation_attempt_state_v1() is
  'Preserves reservation conflict/expiry and claimed authorization semantics across generic financial projections; paid evidence remains authoritative.';

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
    and stripe_checkout_session_id = coalesce(
      p_stripe_checkout_session_id,
      v_payment.stripe_checkout_session_id
    )
  order by created_at desc
  limit 1;

  if p_stripe_checkout_session_id is not null and not found then
    -- Do not attribute a booking result to an unrelated browser-supplied session.
    return jsonb_build_object('status', 'failed');
  end if;

  return jsonb_build_object(
    'status', case
      when v_payment.financial_status = 'paid' and v_booking.status = 'confirmed'
        then 'confirmed'
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
      -- A retry deliberately keeps the previous canceled financial projection
      -- until its new authorization arrives. The current attempt is the source
      -- of truth during this window; otherwise a delayed webhook is presented
      -- as an immediate failure even though Stripe is still processing it.
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
