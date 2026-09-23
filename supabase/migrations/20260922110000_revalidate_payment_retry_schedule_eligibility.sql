-- A payment retry is an opportunity to reserve the original slot again, not a
-- continuation of its expired hold. Keep the presentation read-only while the
-- retry commands still revalidate under their established locks.

create or replace function public.get_session_payment_retry_slot_eligibility_v1(
  p_booking_id uuid,
  p_reference_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_found');
  end if;

  select * into v_payment
  from public.session_payments
  where booking_id = v_booking.id;

  if v_booking.status <> 'cancelled_by_payment'
    or v_payment.financial_status not in ('failed', 'canceled') then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  if v_booking.starts_at <= p_reference_at then
    return jsonb_build_object('allowed', false, 'reason', 'booking_started');
  end if;

  -- Match the immutable booking interval against a candidate generated with
  -- the therapist's current service settings, availability and exceptions.
  if not exists (
    select 1
    from public.list_service_schedule_candidates_v1(
      v_booking.service_id,
      v_booking.starts_at - interval '1 day',
      v_booking.ends_at + interval '1 day',
      p_reference_at,
      64
    ) as candidate
    where candidate.starts_at = v_booking.starts_at
      and candidate.ends_at = v_booking.ends_at
      and candidate.timezone = v_booking.timezone
      and candidate.occupied_during = v_booking.occupied_during
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'schedule_unavailable');
  end if;

  if exists (
    select 1
    from public.bookings as conflict
    where conflict.therapist_profile_id = v_booking.therapist_profile_id
      and conflict.id <> v_booking.id
      and conflict.status in ('draft', 'pending_payment', 'confirmed')
      and conflict.occupied_during && v_booking.occupied_during
  ) or exists (
    select 1
    from public.booking_holds as hold
    where hold.therapist_profile_id = v_booking.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > p_reference_at
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

revoke all on function public.get_session_payment_retry_slot_eligibility_v1(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_session_payment_retry_slot_eligibility_v1(uuid, timestamptz)
  to service_role;

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

  return public.get_session_payment_retry_slot_eligibility_v1(
    v_booking.id,
    now()
  );
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
    'canRetry', case
      when booking.status = 'cancelled_by_payment'
        and payment.financial_status in ('failed', 'canceled')
        then coalesce((retry_eligibility.decision ->> 'allowed')::boolean, false)
      when booking.status = 'pending_payment'
        and booking.payment_status = 'pending'
        and booking.starts_at > now()
        and payment.payment_flow_version = 'v10'
        and payment.financial_status = 'pending'
        and payment.stripe_payment_intent_id is null
        and payment.stripe_charge_id is null
        and attempt.id is not null
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
        ) then true
      else false
    end,
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
  join public.session_payments as payment
    on payment.booking_id = booking.id
  left join lateral (
    select current_attempt.*
    from public.session_payment_attempts as current_attempt
    where current_attempt.session_payment_id = payment.id
      and current_attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
    order by current_attempt.created_at desc
    limit 1
  ) as attempt on true
  left join lateral (
    select public.get_session_payment_retry_slot_eligibility_v1(
      booking.id,
      now()
    ) as decision
  ) as retry_eligibility on true
  where booking.id = p_booking_id
    and patient.user_id = auth.uid();

  return v_result;
end;
$$;

create or replace function public.get_patient_reservation_retry_contexts_v1(
  p_booking_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      booking.id::text,
      jsonb_build_object(
        'bookingId', booking.id,
        'canRetry', coalesce((eligibility.decision ->> 'allowed')::boolean, false)
      )
    ),
    '{}'::jsonb
  )
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  cross join lateral (
    select public.get_session_payment_retry_slot_eligibility_v1(
      booking.id,
      now()
    ) as decision
  ) as eligibility
  where booking.id = any(p_booking_ids)
    and booking.status = 'cancelled_by_payment'
    and patient.user_id = auth.uid();
$$;

revoke all on function public.get_patient_reservation_retry_context_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_patient_reservation_retry_context_v1(uuid)
  to authenticated, service_role;
revoke all on function public.get_patient_reservation_retry_contexts_v1(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_patient_reservation_retry_contexts_v1(uuid[])
  to authenticated, service_role;

comment on function public.get_session_payment_retry_slot_eligibility_v1(uuid, timestamptz) is
  'Read-only retry eligibility using the canonical current service schedule, availability, notice and occupancy rules.';
comment on function public.get_patient_reservation_retry_contexts_v1(uuid[]) is
  'Returns authenticated patient-owned payment retry availability for cancelled payment bookings in one read.';
