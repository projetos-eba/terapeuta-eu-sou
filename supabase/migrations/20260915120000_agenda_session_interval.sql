-- Session duration, start cadence and post-session interval are independent.
-- Historical booking and hold occupancy snapshots are deliberately untouched.

begin;

alter table public.therapist_service_booking_settings
  alter column buffer_before_minutes set default 0,
  alter column buffer_after_minutes set default 0;

with changed_services as (
  update public.therapist_service_booking_settings as setting
  set buffer_before_minutes = 0,
      updated_at = now()
  where setting.buffer_before_minutes <> 0
  returning setting.service_id
)
update public.therapist_schedule_settings as schedule
set version = schedule.version + 1,
    updated_at = now()
where schedule.therapist_profile_id in (
  select distinct service.therapist_profile_id
  from changed_services as changed
  join public.therapist_services as service on service.id = changed.service_id
);

alter table public.therapist_service_booking_settings
  add constraint therapist_service_booking_settings_no_pre_session_buffer
  check (buffer_before_minutes = 0);

comment on column public.therapist_service_booking_settings.interval_minutes is
  'Fixed cadence of candidate session starts, anchored at each availability window start; never post-session rest.';
comment on column public.therapist_service_booking_settings.buffer_after_minutes is
  'Therapist-selected free time after a newly reserved session; existing booking and hold snapshots remain immutable.';
comment on column public.therapist_service_booking_settings.buffer_before_minutes is
  'Compatibility field fixed at zero for current settings; historical booking and hold snapshots are preserved.';

-- The session must fit in the offered window. Its post-session free time may
-- extend beyond that window, while booking/hold occupancy still includes it.
create or replace function public.list_service_schedule_candidates_v1(
  p_service_id uuid,
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
  v_buffer_after integer;
  v_buffer_before integer;
  v_duration integer;
  v_horizon_days integer;
  v_min_notice integer;
  v_step integer;
  v_therapist_profile_id uuid;
  v_timezone text;
begin
  if p_range_start is null
    or p_range_end is null
    or p_range_start >= p_range_end
    or p_range_end - p_range_start > interval '62 days'
    or p_limit not between 1 and 1000
  then
    raise exception 'invalid_slot_range' using errcode = '22023';
  end if;

  select
    service.therapist_profile_id,
    service.duration_minutes,
    schedule_settings.timezone,
    coalesce(booking_settings.buffer_before_minutes, 0),
    coalesce(booking_settings.buffer_after_minutes, 0),
    coalesce(booking_settings.min_notice_minutes, 120),
    coalesce(booking_settings.max_days_ahead, 90),
    coalesce(booking_settings.interval_minutes, 30)
  into
    v_therapist_profile_id,
    v_duration,
    v_timezone,
    v_buffer_before,
    v_buffer_after,
    v_min_notice,
    v_horizon_days,
    v_step
  from public.therapist_services as service
  join public.therapist_profiles as therapist
    on therapist.id = service.therapist_profile_id
  join public.therapist_schedule_settings as schedule_settings
    on schedule_settings.therapist_profile_id = service.therapist_profile_id
  left join public.therapist_service_booking_settings as booking_settings
    on booking_settings.service_id = service.id
  where service.id = p_service_id
    and service.status = 'active'
    and therapist.status = 'approved'
    and therapist.is_accepting_bookings;

  if not found then
    return;
  end if;

  return query
  with local_days as (
    select generated.local_day::date as local_day
    from pg_catalog.generate_series(
      (p_range_start at time zone v_timezone)::date - 1,
      (p_range_end at time zone v_timezone)::date + 1,
      interval '1 day'
    ) as generated(local_day)
  ),
  rule_windows as (
    select
      local_day.local_day + rule.start_time as local_start,
      local_day.local_day + rule.end_time as local_end
    from local_days as local_day
    join public.availability_rules as rule
      on rule.therapist_profile_id = v_therapist_profile_id
      and rule.is_active
      and rule.day_of_week =
        extract(dow from local_day.local_day)::integer
      and rule.service_id = p_service_id
  ),
  available_exception_windows as (
    select
      exception.starts_at at time zone v_timezone as local_start,
      exception.ends_at at time zone v_timezone as local_end
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = v_therapist_profile_id
      and exception.is_available
      and coalesce(exception.status, 'active') = 'active'
      and (exception.service_id is null or exception.service_id = p_service_id)
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
        - v_duration * interval '1 minute',
      v_step * interval '1 minute'
    ) as generated(local_starts_at)
    where source_window.local_start
      <= source_window.local_end
        - v_duration * interval '1 minute'
  ),
  utc_candidates as (
    select distinct
      local_candidate.local_starts_at at time zone v_timezone as starts_at,
      (
        local_candidate.local_starts_at at time zone v_timezone
      ) + v_duration * interval '1 minute' as ends_at,
      local_candidate.local_starts_at
    from local_candidates as local_candidate
  )
  select
    candidate.starts_at,
    candidate.ends_at,
    v_timezone,
    pg_catalog.tstzrange(
      candidate.starts_at - v_buffer_before * interval '1 minute',
      candidate.ends_at + v_buffer_after * interval '1 minute',
      '[)'
    )
  from utc_candidates as candidate
  where candidate.starts_at >= p_range_start
    and candidate.ends_at <= p_range_end
    and candidate.starts_at
      >= p_reference_at + v_min_notice * interval '1 minute'
    and candidate.starts_at
      < p_reference_at + v_horizon_days * interval '1 day'
    and (candidate.starts_at at time zone v_timezone)
      = candidate.local_starts_at
    and not exists (
      select 1
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = v_therapist_profile_id
        and not exception.is_available
        and coalesce(exception.status, 'active') = 'active'
        and (
          exception.service_id is null
          or exception.service_id = p_service_id
        )
        and pg_catalog.tstzrange(
          exception.starts_at,
          exception.ends_at,
          '[)'
        ) && pg_catalog.tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
  order by candidate.starts_at
  limit p_limit;
end;
$$;


-- Existing bookings retain their own duration and interval snapshots when rescheduled.
create or replace function public.list_booking_reschedule_candidates_v1(
  p_booking_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_reference_at timestamptz default now(),
  p_limit integer default 5000
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
    or p_range_end - p_range_start > interval '92 days'
    or p_limit not between 1 and 5000
  then
    raise exception 'INVALID_RESCHEDULE_RANGE' using errcode = '22023';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.status = 'confirmed'
    and exists (
      select 1 from public.therapist_profiles as therapist
      where therapist.id = booking.therapist_profile_id
        and therapist.status = 'approved'
    )
    and exists (
      select 1 from public.therapist_schedule_settings as schedule
      where schedule.therapist_profile_id = booking.therapist_profile_id
    );

  if not found then
    return;
  end if;

  select
    coalesce((select settings.min_notice_minutes from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 120),
    coalesce((select settings.max_days_ahead from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 90),
    coalesce((select settings.interval_minutes from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 30)
  into v_min_notice, v_horizon_days, v_step;

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


-- New service creation and missing-setting fallbacks must not restore hidden
-- ten-minute buffers. Keep the audited function bodies, grants and signatures.
do $$
declare
  v_function record;
  v_definition text;
  v_updated text;
  v_service_creation_updated boolean := false;
  v_schedule_validation_updated boolean := false;
begin
  for v_function in
    select procedure.oid,
           procedure.proname
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_function.oid);
    v_updated := v_definition;
    v_updated := replace(v_updated, 'coalesce(settings.buffer_before_minutes, 10)', 'coalesce(settings.buffer_before_minutes, 0)');
    v_updated := replace(v_updated, 'coalesce(settings.buffer_after_minutes, 10)', 'coalesce(settings.buffer_after_minutes, 0)');
    v_updated := replace(v_updated, 'coalesce(booking_settings.buffer_before_minutes, 10)', 'coalesce(booking_settings.buffer_before_minutes, 0)');
    v_updated := replace(v_updated, 'coalesce(booking_settings.buffer_after_minutes, 10)', 'coalesce(booking_settings.buffer_after_minutes, 0)');
    v_updated := replace(v_updated, 'coalesce(settings.buffer_before_minutes,10)', 'coalesce(settings.buffer_before_minutes,0)');
    v_updated := replace(v_updated, 'coalesce(settings.buffer_after_minutes,10)', 'coalesce(settings.buffer_after_minutes,0)');
    v_updated := replace(v_updated, 'values (v_service.id, 10, 10, 120, 90, 30)', 'values (v_service.id, 0, 0, 120, 90, 30)');
    v_updated := replace(v_updated, 'values (v_service.id, 10, 10, 120, 30, 30)', 'values (v_service.id, 0, 0, 120, 90, 30)');
    v_updated := replace(v_updated, 'v_service_setting.buffer_before_minutes < 0', 'v_service_setting.buffer_before_minutes <> 0');

    if v_function.proname = 'create_therapist_service_v1'
       and pg_catalog.strpos(v_updated, 'values (v_service.id, 0, 0, 120, 90, 30)') > 0 then
      v_service_creation_updated := true;
    end if;
    if v_function.proname = 'save_therapist_schedule_v1'
       and pg_catalog.strpos(v_updated, 'v_service_setting.buffer_before_minutes <> 0') > 0 then
      v_schedule_validation_updated := true;
    end if;
    if v_updated <> v_definition then
      execute v_updated;
    end if;
  end loop;

  if not v_service_creation_updated or not v_schedule_validation_updated then
    raise exception 'AGENDA_INTERVAL_FUNCTION_UPDATE_INCOMPLETE' using errcode = 'P0001';
  end if;
end;
$$;

commit;
