-- Include only inside BEGIN, and always finish the caller with ROLLBACK.
-- Live attendance scenarios share seed identities. Remove conflicting seed
-- occupancy transactionally without disabling production overlap guards.
create or replace function pg_temp.isolate_booking_window(
  p_booking_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
)
returns void language plpgsql as $$
declare
  v_target public.bookings;
  v_patient_during tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
  v_occupied_during tstzrange;
begin
  select * into strict v_target from public.bookings where id = p_booking_id;
  v_occupied_during := tstzrange(
    p_starts_at - make_interval(mins => v_target.buffer_before_minutes_snapshot),
    p_ends_at + make_interval(mins => v_target.buffer_after_minutes_snapshot), '[)');

  update public.bookings booking
  set status = 'cancelled_by_patient'
  where booking.id <> v_target.id
    and booking.status in ('draft', 'pending_payment', 'confirmed', 'completed')
    and ((booking.therapist_profile_id = v_target.therapist_profile_id
        and booking.occupied_during && v_occupied_during)
      or (booking.patient_profile_id = v_target.patient_profile_id
        and tstzrange(booking.starts_at, booking.ends_at, '[)') && v_patient_during));

  update public.booking_holds hold
  set status = 'expired'
  where hold.status = 'active'
    and ((hold.therapist_profile_id = v_target.therapist_profile_id
        and hold.occupied_during && v_occupied_during)
      or (hold.patient_profile_id = v_target.patient_profile_id
        and tstzrange(hold.starts_at, hold.ends_at, '[)') && v_patient_during));
end;
$$;
