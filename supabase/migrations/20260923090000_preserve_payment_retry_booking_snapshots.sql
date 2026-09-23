-- This successor migration retains the immutable interval sold with the cancelled
-- booking. Current availability rules remain authoritative, but later service
-- buffer changes must not invalidate an otherwise available original slot.

create or replace function public.list_payment_retry_schedule_candidates_v1(
  p_booking_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_reference_at timestamptz default now(),
  p_limit integer default 500
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  occupied_during tstzrange
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_horizon_days integer;
  v_min_notice integer;
  v_step integer;
begin
  if p_range_start is null
    or p_range_end is null
    or p_range_start >= p_range_end
    or p_range_end - p_range_start > interval '62 days'
    or p_limit not between 1 and 1000
  then
    raise exception 'invalid_slot_range' using errcode = '22023';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  join public.therapist_services as service
    on service.id = booking.service_id
    and service.therapist_profile_id = booking.therapist_profile_id
    and service.status = 'active'
  join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
    and therapist.status = 'approved'
    and therapist.is_accepting_bookings
  join public.therapist_schedule_settings as schedule
    on schedule.therapist_profile_id = booking.therapist_profile_id
  where booking.id = p_booking_id
    and booking.status = 'cancelled_by_payment';

  if not found then
    return;
  end if;

  select
    coalesce(settings.min_notice_minutes, 120),
    coalesce(settings.max_days_ahead, 90),
    coalesce(settings.interval_minutes, 30)
  into v_min_notice, v_horizon_days, v_step
  from public.therapist_service_booking_settings as settings
  where settings.service_id = v_booking.service_id;

  if not found then
    v_min_notice := 120;
    v_horizon_days := 90;
    v_step := 30;
  end if;

  return query
  with local_days as (
    select generated.local_day::date as local_day
    from pg_catalog.generate_series(
      (p_range_start at time zone v_booking.timezone)::date - 1,
      (p_range_end at time zone v_booking.timezone)::date + 1,
      interval '1 day'
    ) as generated(local_day)
  ),
  rule_windows as (
    select
      local_day.local_day + rule.start_time as local_start,
      local_day.local_day + rule.end_time as local_end
    from local_days as local_day
    join public.availability_rules as rule
      on rule.therapist_profile_id = v_booking.therapist_profile_id
      and rule.service_id = v_booking.service_id
      and rule.is_active
      and rule.day_of_week = extract(dow from local_day.local_day)::integer
  ),
  available_exception_windows as (
    select
      exception.starts_at at time zone v_booking.timezone as local_start,
      exception.ends_at at time zone v_booking.timezone as local_end
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = v_booking.therapist_profile_id
      and exception.is_available
      and coalesce(exception.status, 'active') = 'active'
      and (exception.service_id is null or exception.service_id = v_booking.service_id)
      and exception.starts_at < p_range_end
      and exception.ends_at > p_range_start
  ),
  source_windows as (
    select local_start, local_end from rule_windows
    union
    select local_start, local_end from available_exception_windows
  ),
  local_candidates as (
    select generated.local_starts_at::timestamp as local_starts_at
    from source_windows as source_window
    cross join lateral pg_catalog.generate_series(
      source_window.local_start,
      source_window.local_end
        - v_booking.service_duration_minutes_snapshot * interval '1 minute',
      v_step * interval '1 minute'
    ) as generated(local_starts_at)
    where source_window.local_start <= source_window.local_end
      - v_booking.service_duration_minutes_snapshot * interval '1 minute'
  ),
  utc_candidates as (
    select distinct
      candidate.local_starts_at at time zone v_booking.timezone as starts_at,
      (candidate.local_starts_at at time zone v_booking.timezone)
        + v_booking.service_duration_minutes_snapshot * interval '1 minute' as ends_at,
      candidate.local_starts_at
    from local_candidates as candidate
  )
  select
    candidate.starts_at,
    candidate.ends_at,
    v_booking.timezone,
    pg_catalog.tstzrange(
      candidate.starts_at
        - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
      candidate.ends_at
        + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
      '[)'
    )
  from utc_candidates as candidate
  where candidate.starts_at >= p_range_start
    and candidate.ends_at <= p_range_end
    and candidate.starts_at >= p_reference_at + v_min_notice * interval '1 minute'
    and candidate.starts_at < p_reference_at + v_horizon_days * interval '1 day'
    and (candidate.starts_at at time zone v_booking.timezone) = candidate.local_starts_at
    and not exists (
      select 1
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = v_booking.therapist_profile_id
        and not exception.is_available
        and coalesce(exception.status, 'active') = 'active'
        and (exception.service_id is null or exception.service_id = v_booking.service_id)
        and pg_catalog.tstzrange(exception.starts_at, exception.ends_at, '[)')
          && pg_catalog.tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
  order by candidate.starts_at
  limit p_limit;
end;
$$;
revoke all on function public.list_payment_retry_schedule_candidates_v1(
  uuid, timestamptz, timestamptz, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.list_payment_retry_schedule_candidates_v1(
  uuid, timestamptz, timestamptz, timestamptz, integer
) to service_role;
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
      v_booking.starts_at - interval '1 day',
      v_booking.ends_at + interval '1 day',
      p_reference_at,
      64
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
comment on function public.list_payment_retry_schedule_candidates_v1(
  uuid, timestamptz, timestamptz, timestamptz, integer
) is 'Service-role-only retry candidate generator: preserves booking snapshots while applying current schedule availability and booking eligibility.';
comment on function public.get_session_payment_retry_slot_eligibility_v1(uuid, timestamptz) is
  'Read-only retry eligibility using immutable booking snapshots and the canonical current availability, notice and conflict rules.';
