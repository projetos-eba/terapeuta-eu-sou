-- A schedule may be created by checkout before booking confirmation or by an
-- internal recovery path after confirmation. Freeze the version that will be
-- authoritative at claim time in both cases.
create or replace function public.default_session_payment_schedule_booking_version_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_status public.booking_status;
  v_booking_version bigint;
begin
  if new.expected_booking_version is not null then
    return new;
  end if;

  select booking.status, booking.version
  into v_booking_status, v_booking_version
  from public.bookings as booking
  where booking.id = new.booking_id;

  if not found then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_BOOKING_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  new.expected_booking_version := case
    when v_booking_status = 'confirmed' then v_booking_version
    else v_booking_version + 1
  end;
  return new;
end;
$$;
