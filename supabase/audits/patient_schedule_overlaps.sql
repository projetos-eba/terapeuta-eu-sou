-- Read-only pre-deploy audit for active patient schedule overlaps.
-- Output contains operational UUIDs and intervals only; do not copy it to
-- application logs or customer-facing tools.

with active_intervals as (
  select
    'booking'::text as record_type,
    booking.id as record_id,
    booking.patient_profile_id,
    booking.starts_at,
    booking.ends_at,
    booking.status::text as status
  from public.bookings as booking
  where booking.status in ('draft', 'pending_payment', 'confirmed')

  union all

  select
    'hold'::text,
    hold.id,
    hold.patient_profile_id,
    hold.starts_at,
    hold.ends_at,
    hold.status::text
  from public.booking_holds as hold
  where hold.status = 'active'
    and hold.expires_at > now()
), detected_overlaps as (
  select
    left_interval.patient_profile_id,
    left_interval.record_type as left_record_type,
    left_interval.record_id as left_record_id,
    left_interval.status as left_status,
    left_interval.starts_at as left_starts_at,
    left_interval.ends_at as left_ends_at,
    right_interval.record_type as right_record_type,
    right_interval.record_id as right_record_id,
    right_interval.status as right_status,
    right_interval.starts_at as right_starts_at,
    right_interval.ends_at as right_ends_at
  from active_intervals as left_interval
  join active_intervals as right_interval
    on right_interval.patient_profile_id = left_interval.patient_profile_id
    and (right_interval.record_type, right_interval.record_id::text)
      > (left_interval.record_type, left_interval.record_id::text)
    and tstzrange(
      right_interval.starts_at,
      right_interval.ends_at,
      '[)'
    ) && tstzrange(
      left_interval.starts_at,
      left_interval.ends_at,
      '[)'
    )
)
select *
from detected_overlaps
order by patient_profile_id, left_starts_at, right_starts_at;
