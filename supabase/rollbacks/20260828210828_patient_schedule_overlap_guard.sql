-- Compensating script for 20260828210828_patient_schedule_overlap_guard.sql.
-- Apply only as a reviewed forward deployment if the hotfix must be disabled.
-- It preserves all data and restores the two trigger helpers that immediately
-- preceded the hotfix. It intentionally does not drop tables, indexes or rows.

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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );

  update public.booking_holds
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now();

  if exists (
    select 1 from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.id is distinct from new.id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.booking_holds as hold
    where hold.therapist_profile_id = new.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && new.occupied_during
  ) then
    raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
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

  update public.booking_holds
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now()
    and id <> new.id;

  if exists (
    select 1 from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_booking_against_active_holds_v1()
from public, anon, authenticated, service_role;

revoke all on function public.validate_hold_against_active_bookings_v1()
from public, anon, authenticated, service_role;

comment on function public.validate_booking_against_active_holds_v1() is
  'Trigger helper only. Restored therapist-wide overlap validation after the patient schedule hotfix was compensated.';

comment on function public.validate_hold_against_active_bookings_v1() is
  'Trigger helper only. Restored therapist-wide booking validation after the patient schedule hotfix was compensated.';
