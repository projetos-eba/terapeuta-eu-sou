-- Let the authenticated reservation page recover when a previous retry
-- reopened the booking but failed before persisting its replacement Checkout.

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
    'canRetry', (
      (
        booking.status = 'cancelled_by_payment'
        and payment.financial_status in ('failed', 'canceled')
      )
      or (
        booking.status = 'pending_payment'
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
        )
      )
    ),
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
  where booking.id = p_booking_id
    and patient.user_id = auth.uid();

  return v_result;
end;
$$;

revoke all on function public.get_patient_reservation_retry_context_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_patient_reservation_retry_context_v1(uuid)
  to authenticated, service_role;

comment on function public.get_patient_reservation_retry_context_v1(uuid) is
  'Returns the authenticated retry snapshot with a server-derived retry eligibility flag.';
