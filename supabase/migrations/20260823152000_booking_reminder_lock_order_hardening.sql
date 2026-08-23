create or replace function public.schedule_booking_reminder_jobs_v1(
  p_booking_id uuid,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_patient_user_id uuid;
  v_created integer := 0;
begin
  if p_booking_id is null or p_now is null then
    raise exception 'BOOKING_REMINDER_INVALID_SCHEDULE_REQUEST';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.status <> 'confirmed' or v_booking.starts_at <= p_now then
    return 0;
  end if;

  select *
    into v_payment
  from public.session_payments
  where booking_id = p_booking_id;

  if not found
    or v_payment.financial_status not in ('paid', 'partially_refunded')
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.internal_contested_at is not null
    or v_payment.admin_blocked_at is not null
  then
    return 0;
  end if;

  select patient.user_id
    into v_patient_user_id
  from public.patient_profiles patient
  where patient.id = v_booking.patient_profile_id;

  if v_patient_user_id is null then
    return 0;
  end if;

  insert into public.booking_reminder_jobs (
    booking_id,
    booking_version,
    action_key,
    recipient_user_id,
    scheduled_for
  )
  select
    v_booking.id,
    v_booking.version,
    reminder.action_key,
    v_patient_user_id,
    reminder.scheduled_for
  from (
    values
      (
        'booking_reminder_24h_patient'::text,
        v_booking.starts_at - interval '24 hours'
      ),
      (
        'booking_reminder_1h_patient'::text,
        v_booking.starts_at - interval '1 hour'
      )
  ) as reminder(action_key, scheduled_for)
  where reminder.scheduled_for > p_now
  on conflict (
    booking_id,
    booking_version,
    action_key,
    recipient_user_id
  ) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function public.schedule_booking_reminder_jobs_v1(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.schedule_booking_reminder_jobs_v1(uuid, timestamptz)
to service_role;
