-- Read-only pre-deploy audit for active patient schedule overlaps.
-- Output contains operational UUIDs and intervals only; do not copy it to
-- application logs or customer-facing tools.

with blocking_intervals as (
  select
    case
      when booking.status in ('confirmed', 'completed') then 'confirmed'
      when payment.financial_status = 'paid' then 'paid_awaiting_projection'
      else 'authorization_pending'
    end::text as blocker_kind,
    booking.id as record_id,
    booking.patient_profile_id,
    booking.starts_at,
    booking.ends_at,
    booking.status::text as booking_status
  from public.bookings as booking
  left join public.session_payments as payment
    on payment.booking_id = booking.id
  left join public.session_payment_attempts as attempt
    on attempt.session_payment_id = payment.id
   and attempt.stripe_checkout_session_id = payment.stripe_checkout_session_id
  where booking.status in ('confirmed', 'completed')
    or (
      booking.status in ('draft', 'pending_payment')
      and payment.financial_status = 'paid'
    )
    or (
      booking.status in ('draft', 'pending_payment')
      and payment.financial_status = 'processing'
      and attempt.status = 'capture_pending'
      and attempt.slot_claimed_at is not null
    )
), detected_overlaps as (
  select
    left_interval.patient_profile_id,
    left_interval.blocker_kind as left_blocker_kind,
    left_interval.record_id as left_record_id,
    left_interval.booking_status as left_booking_status,
    left_interval.starts_at as left_starts_at,
    left_interval.ends_at as left_ends_at,
    right_interval.blocker_kind as right_blocker_kind,
    right_interval.record_id as right_record_id,
    right_interval.booking_status as right_booking_status,
    right_interval.starts_at as right_starts_at,
    right_interval.ends_at as right_ends_at
  from blocking_intervals as left_interval
  join blocking_intervals as right_interval
    on right_interval.patient_profile_id = left_interval.patient_profile_id
    and right_interval.record_id > left_interval.record_id
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
