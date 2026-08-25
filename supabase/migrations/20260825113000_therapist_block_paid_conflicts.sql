-- A4 follow-up: return confirmed and paid sessions affected by a new block.
-- The original v1 command remains responsible for materializing blocks and
-- recording all existing booking impacts. This wrapper preserves that
-- behavior and adds the paid-session alert contract atomically.

create or replace function public.create_therapist_block_v2(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_timezone text,
  p_starts_on date,
  p_start_time time,
  p_end_time time,
  p_all_day boolean,
  p_recurrence_frequency text,
  p_recurrence_ends_on date,
  p_service_id uuid,
  p_reason_code text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_series_id uuid;
  v_paid_impacts jsonb := '[]'::jsonb;
begin
  v_result := public.create_therapist_block_v1(
    p_actor_user_id,
    p_request_id,
    p_timezone,
    p_starts_on,
    p_start_time,
    p_end_time,
    p_all_day,
    p_recurrence_frequency,
    p_recurrence_ends_on,
    p_service_id,
    p_reason_code,
    p_reason
  );

  v_series_id := nullif(v_result ->> 'seriesId', '')::uuid;

  if v_series_id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bookingId', booking.id,
          'endsAt', booking.ends_at,
          'patientName', patient.display_name,
          'serviceTitle', coalesce(
            booking.service_title_snapshot,
            booking_service.title,
            'Sessão'
          ),
          'startsAt', booking.starts_at,
          'timezone', exception.timezone
        )
        order by booking.starts_at, booking.id
      ),
      '[]'::jsonb
    )
    into v_paid_impacts
    from public.availability_exceptions as exception
    join public.bookings as booking
      on booking.therapist_profile_id = exception.therapist_profile_id
     and booking.starts_at < exception.ends_at
     and booking.ends_at > exception.starts_at
     and booking.status = 'confirmed'
     and (
       p_service_id is null
       or booking.service_id = p_service_id
     )
    join public.patient_profiles as patient
      on patient.id = booking.patient_profile_id
    left join public.therapist_services as booking_service
      on booking_service.id = booking.service_id
    where exception.series_id = v_series_id
      and exists (
        select 1
        from public.session_payments as payment
        where payment.booking_id = booking.id
          and payment.financial_status = 'paid'
      );
  end if;

  return v_result || jsonb_build_object(
    'paidImpactedBookings', v_paid_impacts
  );
end;
$$;

revoke all on function public.create_therapist_block_v2(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_therapist_block_v2(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) to service_role;

comment on function public.create_therapist_block_v2(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) is
  'A4 service-role block command that additionally returns confirmed and paid sessions overlapping the created block.';
