-- Production hotfix: serialize schedule mutations by therapist and patient.
-- The therapist lock remains byte-for-byte compatible with the existing Agenda
-- command RPCs. The namespaced patient lock is additive and protects the real
-- encounter interval without changing the therapist buffer semantics.

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

  -- Preserve the established therapist-conflict precedence when both
  -- dimensions conflict for the same write.
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

  if exists (
    select 1
    from public.bookings as booking
    where booking.patient_profile_id = new.patient_profile_id
      and booking.id is distinct from new.id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and pg_catalog.tstzrange(
        booking.starts_at,
        booking.ends_at,
        '[)'
      ) && pg_catalog.tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.booking_holds as hold
    where hold.patient_profile_id = new.patient_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and pg_catalog.tstzrange(
        hold.starts_at,
        hold.ends_at,
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

  -- Preserve the established therapist-conflict precedence when both
  -- dimensions conflict for the same write.
  if exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.booking_holds as hold
    where hold.patient_profile_id = new.patient_profile_id
      and hold.id <> new.id
      and hold.status = 'active'
      and hold.expires_at > now()
      and pg_catalog.tstzrange(
        hold.starts_at,
        hold.ends_at,
        '[)'
      ) && pg_catalog.tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.bookings as booking
    where booking.patient_profile_id = new.patient_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
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

revoke all on function public.validate_booking_against_active_holds_v1()
from public, anon, authenticated, service_role;

revoke all on function public.validate_hold_against_active_bookings_v1()
from public, anon, authenticated, service_role;

comment on function public.validate_booking_against_active_holds_v1() is
  'Trigger helper only. Serializes therapist then patient and rejects active patient schedule overlaps before booking writes.';

comment on function public.validate_hold_against_active_bookings_v1() is
  'Trigger helper only. Serializes therapist then patient and rejects active patient schedule overlaps before hold writes.';
