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

  return new;
end;
$$;

revoke all on function public.validate_booking_against_active_holds_v1()
from public, anon, authenticated, service_role;

comment on function public.validate_booking_against_active_holds_v1() is
  'Normalizes booking overlap conflicts before the GiST exclusion constraint while preserving the constraint as a concurrency backstop.';
