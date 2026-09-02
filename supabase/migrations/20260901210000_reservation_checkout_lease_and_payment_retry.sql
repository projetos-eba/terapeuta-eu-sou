-- Authoritative five-minute reservation lease and payment retry arbitration.
-- Historical attempts remain legacy and are deliberately excluded from the
-- new expiry/retry workflow.

alter table public.session_payment_attempts
  add column if not exists attempt_kind text not null default 'legacy',
  add column if not exists booking_hold_id uuid
    references public.booking_holds (id) on delete set null,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists authorization_received_at timestamptz,
  add column if not exists slot_claimed_at timestamptz,
  add column if not exists terminal_reason text;

alter table public.session_payment_attempts
  drop constraint if exists session_payment_attempts_attempt_kind_check;
alter table public.session_payment_attempts
  add constraint session_payment_attempts_attempt_kind_check
  check (attempt_kind in ('legacy', 'initial_hold', 'payment_retry'));

create index if not exists session_payment_attempts_initial_expiry_idx
  on public.session_payment_attempts (reservation_expires_at)
  where attempt_kind = 'initial_hold'
    and status in ('checkout_created', 'waiting_payment', 'processing');

create or replace function public.is_booking_status_transition_allowed_v1(
  p_current public.booking_status,
  p_next public.booking_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_current
    when 'draft' then p_next in (
      'pending_payment', 'cancelled_by_patient', 'cancelled_by_payment'
    )
    when 'pending_payment' then p_next in (
      'confirmed', 'cancelled_by_patient', 'cancelled_by_payment', 'refunded'
    )
    when 'confirmed' then p_next in (
      'completed', 'cancelled_by_patient', 'cancelled_by_therapist',
      'no_show_patient', 'no_show_therapist', 'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'no_show_patient' then p_next = 'refunded'
    when 'no_show_therapist' then p_next = 'refunded'
    when 'cancelled_by_payment' then p_next = 'pending_payment'
    when 'refunded' then false
    else false
  end;
$$;

create or replace function public.guard_payment_owned_booking_status_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := coalesce(
    pg_catalog.current_setting('tes.booking_source', true),
    ''
  );
begin
  if new.status in ('cancelled_by_payment', 'refunded')
    and new.status is distinct from old.status
    and v_source <> 'payment_state' then
    raise exception 'PAYMENT_WORKFLOW_REQUIRED' using errcode = 'P0001';
  end if;

  if old.status = 'cancelled_by_payment'
    and new.status = 'pending_payment'
    and v_source <> 'payment_retry_claim' then
    raise exception 'PAYMENT_RETRY_CLAIM_REQUIRED' using errcode = 'P0001';
  end if;

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
    return jsonb_build_object('claimed', false, 'reason', v_attempt.status);
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

create or replace function public.cancel_reservation_checkout_attempt_v1(
  p_booking_id uuid,
  p_stripe_checkout_session_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.session_payment_attempts%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select payment.* into v_payment
  from public.session_payments as payment
  where payment.booking_id = p_booking_id
    and payment.stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;

  if not found then
    return jsonb_build_object('released', false, 'reason', 'superseded');
  end if;

  select * into v_attempt
  from public.session_payment_attempts
  where session_payment_id = v_payment.id
    and stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;

  if not found or v_attempt.slot_claimed_at is not null then
    return jsonb_build_object('released', false, 'reason', 'not_releasable');
  end if;

  update public.session_payment_attempts
  set status = case when p_reason = 'reservation_expired' then 'expired' else 'canceled' end,
      terminal_reason = left(coalesce(nullif(trim(p_reason), ''), 'abandoned'), 120),
      updated_at = now()
  where id = v_attempt.id;

  if v_attempt.attempt_kind = 'initial_hold' then
    update public.session_payments
    set financial_status = 'canceled', canceled_at = coalesce(canceled_at, now()),
        updated_at = now()
    where id = v_payment.id and financial_status in ('pending', 'processing');
  end if;

  return jsonb_build_object('released', true, 'reason', p_reason);
end;
$$;

create or replace function public.expire_due_initial_checkout_attempts_v1(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  checkout_session_id text,
  session_payment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.session_payment_attempts%rowtype;
begin
  for v_attempt in
    select attempt.*
    from public.session_payment_attempts as attempt
    join public.session_payments as payment
      on payment.id = attempt.session_payment_id
     and payment.stripe_checkout_session_id = attempt.stripe_checkout_session_id
    where attempt.attempt_kind = 'initial_hold'
      and attempt.reservation_expires_at <= p_now
      and attempt.slot_claimed_at is null
      and attempt.status in ('checkout_created', 'waiting_payment', 'processing')
    order by attempt.reservation_expires_at
    for update of attempt skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    update public.session_payment_attempts
    set status = 'expired', terminal_reason = 'reservation_expired',
        updated_at = p_now
    where id = v_attempt.id;

    update public.session_payments
    set financial_status = 'canceled', canceled_at = coalesce(canceled_at, p_now),
        updated_at = p_now
    where id = v_attempt.session_payment_id
      and financial_status in ('pending', 'processing');

    checkout_session_id := v_attempt.stripe_checkout_session_id;
    session_payment_id := v_attempt.session_payment_id;
    return next;
  end loop;
end;
$$;

create or replace function public.get_patient_reservation_retry_context_v1(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'bookingId', booking.id,
    'serviceId', booking.service_id,
    'serviceLabel', booking.service_title_snapshot,
    'durationMinutes', booking.service_duration_minutes_snapshot,
    'priceCents', booking.service_price_cents_snapshot,
    'startsAt', booking.starts_at,
    'timezone', booking.timezone,
    'bookingStatus', booking.status,
    'financialStatus', payment.financial_status,
    'therapist', jsonb_build_object(
      'slug', therapist.slug,
      'name', therapist.public_name,
      'headline', coalesce(therapist.headline, 'Profissional TES'),
      'avatarUrl', therapist.photo_url,
      'isVerified', therapist.status = 'approved'
    )
  ) into v_result
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
  left join public.session_payments as payment
    on payment.booking_id = booking.id
  where booking.id = p_booking_id
    and patient.user_id = auth.uid();

  return v_result;
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
    'bookingId', v_booking.id
  );
end;
$$;

revoke all on function public.preflight_session_payment_retry_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_session_payment_authorization_v1(
  uuid, text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.cancel_reservation_checkout_attempt_v1(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.expire_due_initial_checkout_attempts_v1(
  timestamptz, integer
) from public, anon, authenticated;

grant execute on function public.preflight_session_payment_retry_v1(uuid)
  to service_role;
grant execute on function public.claim_session_payment_authorization_v1(
  uuid, text, text, timestamptz, text
) to service_role;
grant execute on function public.cancel_reservation_checkout_attempt_v1(
  uuid, text, text
) to service_role;
grant execute on function public.expire_due_initial_checkout_attempts_v1(
  timestamptz, integer
) to service_role;

revoke all on function public.get_patient_reservation_retry_context_v1(uuid)
  from public, anon;
revoke all on function public.get_patient_reservation_attempt_status_v1(
  uuid, text
) from public, anon;
grant execute on function public.get_patient_reservation_retry_context_v1(uuid)
  to authenticated, service_role;
grant execute on function public.get_patient_reservation_attempt_status_v1(
  uuid, text
) to authenticated, service_role;

comment on function public.claim_session_payment_authorization_v1(
  uuid, text, text, timestamptz, text
) is 'Claims therapist then patient locks before manual Stripe capture; payment retry can reopen cancelled_by_payment only through this RPC.';
