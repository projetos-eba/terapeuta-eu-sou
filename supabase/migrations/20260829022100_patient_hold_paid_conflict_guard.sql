-- Follow-up to 20260829022000: keep the hold write path aligned with the
-- paid-session-only patient conflict contract.

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
  set status = 'expired',
      updated_at = now()
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

  return new;
end;
$$;

revoke all on function public.validate_hold_against_active_bookings_v1()
from public, anon, authenticated, service_role;

comment on function public.validate_hold_against_active_bookings_v1() is
  'Trigger helper only. Therapist occupancy blocks pending checkout; patient overlap requires another paid confirmed session.';
