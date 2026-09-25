-- A retry validates the immutable interval of one booking. Restrict the
-- candidate query to that exact interval so dense schedules cannot hide the
-- original slot behind an unrelated result limit.

begin;

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

  if not exists (
    select 1
    from public.list_payment_retry_schedule_candidates_v1(
      v_booking.id,
      v_booking.starts_at,
      v_booking.ends_at,
      p_reference_at,
      1
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

comment on function public.get_session_payment_retry_slot_eligibility_v1(uuid, timestamptz) is
  'Read-only exact-slot retry eligibility using immutable booking snapshots and the canonical current availability, notice and conflict rules.';

commit;
