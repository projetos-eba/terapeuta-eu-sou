-- Avoid one patient-conflict RPC evaluation per candidate slot. On real HML
-- histories that N+1 pattern can exceed the Edge/PostgREST statement timeout
-- for the 90-day `next` scope. Materialize each blocker set once per request.

create or replace function public.get_booking_reschedule_availability_v1(
  p_booking_id uuid,
  p_actor_profile_id uuid,
  p_scope text default 'next',
  p_anchor date default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_horizon_ends_at timestamptz;
  v_horizon_days integer;
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_therapy_name text;
begin
  if p_scope not in ('next', 'month', 'day')
    or p_limit not between 1 and 1000
    or (p_scope in ('month', 'day') and p_anchor is null)
  then
    raise exception 'INVALID_RESCHEDULE_RANGE' using errcode = '22023';
  end if;

  if not public.is_booking_participant_profile_v1(
    p_booking_id,
    p_actor_profile_id
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.status = 'confirmed';

  if not found then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  select therapy.name into v_therapy_name
  from public.therapist_services as service
  join public.therapies as therapy on therapy.id = service.therapy_id
  where service.id = v_booking.service_id;

  if not found then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  select coalesce(
    (select settings.max_days_ahead
      from public.therapist_service_booking_settings as settings
      where settings.service_id = v_booking.service_id),
    90
  ) into v_horizon_days;

  v_horizon_ends_at := now() + v_horizon_days * interval '1 day';

  if p_scope = 'day' then
    v_range_start := greatest(
      now(),
      p_anchor::timestamp at time zone v_booking.timezone
    );
    v_range_end := least(
      (p_anchor + 1)::timestamp at time zone v_booking.timezone,
      v_horizon_ends_at
    );
  elsif p_scope = 'month' then
    v_range_start := greatest(
      now(),
      date_trunc('month', p_anchor)::timestamp at time zone v_booking.timezone
    );
    v_range_end := least(
      (date_trunc('month', p_anchor) + interval '1 month')::timestamp
        at time zone v_booking.timezone,
      v_horizon_ends_at
    );
  else
    v_range_start := now();
    v_range_end := v_horizon_ends_at;
  end if;

  return pg_catalog.jsonb_build_object(
    'contractVersion', 1,
    'booking', pg_catalog.jsonb_build_object(
      'id', v_booking.id,
      'version', v_booking.version,
      'startsAt', v_booking.starts_at
    ),
    'service', pg_catalog.jsonb_build_object(
      'id', v_booking.service_id,
      'title', v_booking.service_title_snapshot,
      'therapyName', v_therapy_name,
      'durationMinutes', v_booking.service_duration_minutes_snapshot,
      'priceCents', v_booking.service_price_cents_snapshot,
      'currency', v_booking.currency_snapshot
    ),
    'timezone', v_booking.timezone,
    'horizonEndsAt', v_horizon_ends_at,
    'scope', p_scope,
    'range', pg_catalog.jsonb_build_object(
      'start', v_range_start,
      'end', v_range_end,
      'endExclusive', true
    ),
    'slots', case
      when v_range_start >= v_range_end then '[]'::jsonb
      else (
        with candidate_slots as materialized (
          select
            candidate.starts_at,
            candidate.ends_at,
            candidate.occupied_during
          from public.list_booking_reschedule_candidates_v1(
            v_booking.id,
            v_range_start,
            v_range_end,
            now(),
            5000
          ) as candidate
          where candidate.starts_at is distinct from v_booking.starts_at
        ),
        therapist_blockers as materialized (
          select conflict.occupied_during
          from public.bookings as conflict
          where conflict.therapist_profile_id = v_booking.therapist_profile_id
            and conflict.id <> v_booking.id
            and conflict.status in ('draft', 'pending_payment', 'confirmed')
            and conflict.occupied_during && pg_catalog.tstzrange(
              v_range_start,
              v_range_end,
              '[)'
            )
        ),
        live_holds as materialized (
          select hold.occupied_during
          from public.booking_holds as hold
          where hold.therapist_profile_id = v_booking.therapist_profile_id
            and hold.status = 'active'
            and hold.expires_at > now()
            and hold.occupied_during && pg_catalog.tstzrange(
              v_range_start,
              v_range_end,
              '[)'
            )
        ),
        patient_blockers as materialized (
          select pg_catalog.tstzrange(
            blocker.starts_at,
            blocker.ends_at,
            '[)'
          ) as occupied_during
          from public.get_patient_schedule_blocking_bookings_v1(
            v_booking.patient_profile_id,
            v_range_start,
            v_range_end,
            v_booking.id
          ) as blocker
        ),
        available as (
          select candidate.starts_at, candidate.ends_at
          from candidate_slots as candidate
          where not exists (
              select 1
              from therapist_blockers as conflict
              where conflict.occupied_during && candidate.occupied_during
            )
            and not exists (
              select 1
              from live_holds as hold
              where hold.occupied_during && candidate.occupied_during
            )
            and not exists (
              select 1
              from patient_blockers as blocker
              where blocker.occupied_during && pg_catalog.tstzrange(
                candidate.starts_at,
                candidate.ends_at,
                '[)'
              )
            )
          order by candidate.starts_at
          limit p_limit
        )
        select coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'startsAt', available.starts_at,
              'endsAt', available.ends_at
            ) order by available.starts_at
          ),
          '[]'::jsonb
        )
        from available
      )
    end
  );
end;
$$;

comment on function public.get_booking_reschedule_availability_v1(
  uuid, uuid, text, date, integer
) is 'Participant-authorized booking availability with immutable service snapshots and set-based current schedule, hold, therapist and patient conflict filtering.';
