-- Patient schedule conflicts are contractual only after a session payment is
-- paid. Draft/pending bookings and active checkout holds remain therapist-side
-- occupancy protections, but must not prevent the same patient from starting a
-- new checkout after abandoning an unpaid attempt.

create or replace function public.validate_booking_against_active_holds_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'pending_payment', 'confirmed') then
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
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now();

  -- Therapist occupancy still protects the slot while checkout is pending.
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

  -- A patient conflict is real only for another paid session. Unpaid
  -- bookings, failed/canceled checkouts and holds are intentionally ignored.
  if exists (
    select 1
    from public.bookings as booking
    join public.session_payments as payment
      on payment.booking_id = booking.id
     and payment.financial_status = 'paid'
    where booking.patient_profile_id = new.patient_profile_id
      and booking.id is distinct from new.id
      and booking.status in ('confirmed', 'completed')
      and pg_catalog.tstzrange(
        booking.starts_at,
        booking.ends_at,
        '[)'
      ) && pg_catalog.tstzrange(new.starts_at, new.ends_at, '[)')
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
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now()
    and id <> new.id;

  -- Therapist occupancy still protects the slot while checkout is pending.
  if exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  -- A paid session still blocks a patient hold, but unpaid bookings/holds do
  -- not. This keeps the patient contract consistent regardless of write path.
  if exists (
    select 1
    from public.bookings as booking
    join public.session_payments as payment
      on payment.booking_id = booking.id
     and payment.financial_status = 'paid'
    where booking.patient_profile_id = new.patient_profile_id
      and booking.status in ('confirmed', 'completed')
      and pg_catalog.tstzrange(
        booking.starts_at,
        booking.ends_at,
        '[)'
      ) && pg_catalog.tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  -- Do not reject a new hold because this patient has another unpaid hold.
  return new;
end;
$$;

revoke all on function public.validate_booking_against_active_holds_v1()
from public, anon, authenticated, service_role;

revoke all on function public.validate_hold_against_active_bookings_v1()
from public, anon, authenticated, service_role;

comment on function public.validate_booking_against_active_holds_v1() is
  'Trigger helper only. Serializes therapist then patient; therapist occupancy blocks pending checkout, while patient overlap requires another paid confirmed session.';

comment on function public.validate_hold_against_active_bookings_v1() is
  'Trigger helper only. Serializes therapist then patient and protects therapist occupancy without treating unpaid patient holds as schedule conflicts.';
