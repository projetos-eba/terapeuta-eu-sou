-- Keep therapist-level schedule projections truthful after weekly availability
-- becomes exclusively service-scoped. Equal or partially overlapping windows
-- from different services represent one therapist capacity, not parallel work.

create or replace function public.get_therapist_schedule_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_settings public.therapist_schedule_settings%rowtype;
begin
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = (select auth.uid())
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  select schedule_settings.*
    into v_settings
  from public.therapist_schedule_settings as schedule_settings
  where schedule_settings.therapist_profile_id = v_therapist.id;

  if not found then
    raise exception 'schedule_settings_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'scheduleVersion', v_settings.version,
    'timezone', v_settings.timezone,
    'updatedAt', v_settings.updated_at,
    'summary', jsonb_build_object(
      'configuredDays', (
        select count(distinct rule.day_of_week)
        from public.availability_rules as rule
        join public.therapist_services as service
          on service.id = rule.service_id
         and service.therapist_profile_id = v_therapist.id
         and service.status <> 'archived'
        where rule.therapist_profile_id = v_therapist.id
          and rule.is_active
      ),
      'weeklyAvailableMinutes', (
        with merged_day_windows as (
          select
            rule.day_of_week,
            range_agg(
              pg_catalog.int4range(
                floor(extract(epoch from rule.start_time) / 60)::integer,
                floor(extract(epoch from rule.end_time) / 60)::integer,
                '[)'
              )
            ) as windows
          from public.availability_rules as rule
          join public.therapist_services as service
            on service.id = rule.service_id
           and service.therapist_profile_id = v_therapist.id
           and service.status <> 'archived'
          where rule.therapist_profile_id = v_therapist.id
            and rule.is_active
          group by rule.day_of_week
        )
        select coalesce(
          sum(
            upper(window_segment.range_value)
            - lower(window_segment.range_value)
          ),
          0
        )::integer
        from merged_day_windows as merged
        cross join lateral unnest(merged.windows)
          as window_segment(range_value)
      )
    ),
    'rules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', rule.id,
            'serviceId', rule.service_id,
            'dayOfWeek', rule.day_of_week,
            'startTime', rule.start_time,
            'endTime', rule.end_time,
            'isActive', rule.is_active
          )
          order by
            rule.day_of_week,
            rule.service_id,
            rule.start_time,
            rule.id
        ),
        '[]'::jsonb
      )
      from public.availability_rules as rule
      where rule.therapist_profile_id = v_therapist.id
    ),
    'services', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'title', service.title,
            'status', service.status,
            'durationMinutes', service.duration_minutes,
            'settings', jsonb_build_object(
              'bufferBeforeMinutes',
                coalesce(booking_settings.buffer_before_minutes, 10),
              'bufferAfterMinutes',
                coalesce(booking_settings.buffer_after_minutes, 10),
              'minimumNoticeMinutes',
                coalesce(booking_settings.min_notice_minutes, 120),
              'bookingHorizonDays',
                coalesce(booking_settings.max_days_ahead, 30),
              'slotStepMinutes',
                coalesce(booking_settings.interval_minutes, 30)
            ),
            'weeklyAvailableMinutes', (
              select coalesce(
                sum(
                  extract(
                    epoch from (service_rule.end_time - service_rule.start_time)
                  ) / 60
                ),
                0
              )::integer
              from public.availability_rules as service_rule
              where service_rule.therapist_profile_id = v_therapist.id
                and service_rule.is_active
                and service_rule.service_id = service.id
            )
          )
          order by service.created_at, service.id
        ),
        '[]'::jsonb
      )
      from public.therapist_services as service
      left join public.therapist_service_booking_settings as booking_settings
        on booking_settings.service_id = service.id
      where service.therapist_profile_id = v_therapist.id
        and service.status <> 'archived'
    )
  );
end;
$$;

create or replace function public.private_therapist_agenda_capacity_v1(
  p_therapist_profile_id uuid,
  p_range_start date,
  p_range_end date,
  p_timezone text
)
returns table (
  scheduled_minutes integer,
  exception_minutes integer,
  committed_minutes integer,
  available_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window tstzrange;
  v_scheduled tstzmultirange := '{}'::tstzmultirange;
  v_after_exceptions tstzmultirange := '{}'::tstzmultirange;
  v_available tstzmultirange := '{}'::tstzmultirange;
  v_booked tstzmultirange := '{}'::tstzmultirange;
  v_service_scheduled tstzmultirange;
  v_service_blocked tstzmultirange;
  v_service record;
  v_scheduled_minutes integer := 0;
  v_after_exception_minutes integer := 0;
  v_available_minutes integer := 0;
begin
  if p_therapist_profile_id is null
    or p_range_start is null
    or p_range_end is null
    or p_range_start > p_range_end
    or p_range_end - p_range_start > 62
    or not public.is_valid_timezone_v1(p_timezone)
  then
    raise exception 'invalid_agenda_capacity_range' using errcode = '22023';
  end if;

  v_window := pg_catalog.tstzrange(
    p_range_start::timestamp at time zone p_timezone,
    (p_range_end + 1)::timestamp at time zone p_timezone,
    '[)'
  );

  for v_service in
    select service.id
    from public.therapist_services as service
    join public.therapies as therapy
      on therapy.id = service.therapy_id
    where service.therapist_profile_id = p_therapist_profile_id
      and service.status = 'active'
      and service.is_bookable = true
      and service.delivery_format = 'online'
      and service.online_only = true
      and therapy.status in ('published', 'active')
      and therapy.is_available_for_services = true
  loop
    with days as (
      select day_value::date as day_value
      from pg_catalog.generate_series(
        p_range_start,
        p_range_end,
        interval '1 day'
      ) as generated(day_value)
    ),
    source_windows as (
      select pg_catalog.tstzrange(
        (days.day_value + rule.start_time) at time zone p_timezone,
        (days.day_value + rule.end_time) at time zone p_timezone,
        '[)'
      ) as range_value
      from days
      join public.availability_rules as rule
        on rule.therapist_profile_id = p_therapist_profile_id
       and rule.service_id = v_service.id
       and rule.is_active
       and rule.day_of_week = extract(dow from days.day_value)::integer

      union all

      select pg_catalog.tstzrange(
        exception.starts_at,
        exception.ends_at,
        '[)'
      ) as range_value
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = p_therapist_profile_id
        and exception.is_available
        and coalesce(exception.status, 'active') = 'active'
        and (exception.service_id is null or exception.service_id = v_service.id)
        and exception.starts_at < upper(v_window)
        and exception.ends_at > lower(v_window)
    )
    select coalesce(
      range_agg(source.range_value * v_window),
      '{}'::tstzmultirange
    )
      into v_service_scheduled
    from source_windows as source
    where source.range_value && v_window;

    select coalesce(
      range_agg(
        pg_catalog.tstzrange(
          exception.starts_at,
          exception.ends_at,
          '[)'
        ) * v_window
      ),
      '{}'::tstzmultirange
    )
      into v_service_blocked
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = p_therapist_profile_id
      and not exception.is_available
      and coalesce(exception.status, 'active') = 'active'
      and (exception.service_id is null or exception.service_id = v_service.id)
      and exception.starts_at < upper(v_window)
      and exception.ends_at > lower(v_window);

    v_scheduled := v_scheduled + v_service_scheduled;
    v_after_exceptions :=
      v_after_exceptions + (v_service_scheduled - v_service_blocked);
  end loop;

  select coalesce(
    range_agg(booking.occupied_during * v_window),
    '{}'::tstzmultirange
  )
    into v_booked
  from public.bookings as booking
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.status in ('confirmed', 'completed')
    and booking.occupied_during && v_window
    and exists (
      select 1
      from public.session_payments as payment
      where payment.booking_id = booking.id
        and payment.therapist_profile_id = p_therapist_profile_id
        and payment.financial_status in ('paid', 'partially_refunded')
    );

  v_available := v_after_exceptions - v_booked;

  select coalesce(sum(
    extract(
      epoch from (upper(segment.range_value) - lower(segment.range_value))
    ) / 60
  ), 0)::integer
    into v_scheduled_minutes
  from unnest(v_scheduled) as segment(range_value);

  select coalesce(sum(
    extract(
      epoch from (upper(segment.range_value) - lower(segment.range_value))
    ) / 60
  ), 0)::integer
    into v_after_exception_minutes
  from unnest(v_after_exceptions) as segment(range_value);

  select coalesce(sum(
    extract(
      epoch from (upper(segment.range_value) - lower(segment.range_value))
    ) / 60
  ), 0)::integer
    into v_available_minutes
  from unnest(v_available) as segment(range_value);

  return query
  select
    v_scheduled_minutes,
    greatest(v_scheduled_minutes - v_after_exception_minutes, 0),
    greatest(v_after_exception_minutes - v_available_minutes, 0),
    v_available_minutes;
end;
$$;

revoke all on function public.private_therapist_agenda_capacity_v1(
  uuid,
  date,
  date,
  text
) from public, anon, authenticated;
grant execute on function public.private_therapist_agenda_capacity_v1(
  uuid,
  date,
  date,
  text
) to service_role;

comment on function public.private_therapist_agenda_capacity_v1(
  uuid,
  date,
  date,
  text
) is
  'Internal F3 capacity projection. Merges service availability, applies scoped exceptions, and subtracts therapist-global booking occupancy including immutable buffer snapshots.';

-- Replace the former raw sums in the private F3 payload without copying its
-- complete implementation. Exact markers make upstream drift fail closed.
do $$
declare
  v_definition text;
  v_updated_definition text;
  v_start_marker text := '  if v_forecast_window_start <= v_forecast_window_end then';
  v_end_marker text := '    greatest(v_scheduled_minutes - v_exception_minutes - v_committed_minutes, 0);';
  v_start integer;
  v_end integer;
begin
  select pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, chr(13), '');
  v_start := strpos(v_definition, v_start_marker);
  v_end := strpos(v_definition, v_end_marker);

  if v_start = 0 or v_end = 0 or v_end <= v_start then
    raise exception 'THERAPIST_FINANCE_F3_CAPACITY_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  v_end := v_end + length(v_end_marker);
  v_updated_definition :=
    substr(v_definition, 1, v_start - 1)
    || '  if v_forecast_window_start <= v_forecast_window_end then
    select capacity.scheduled_minutes,
      capacity.exception_minutes,
      capacity.committed_minutes,
      capacity.available_minutes
      into
        v_scheduled_minutes,
        v_exception_minutes,
        v_committed_minutes,
        v_available_minutes
    from public.private_therapist_agenda_capacity_v1(
      p_therapist_profile_id,
      v_forecast_window_start,
      v_forecast_window_end,
      v_period.timezone
    ) as capacity;
  end if;
'
    || substr(v_definition, v_end + 1);

  if v_updated_definition = v_definition
    or v_updated_definition not like '%private_therapist_agenda_capacity_v1%'
    or v_updated_definition like '%from rule_windows;%'
  then
    raise exception 'THERAPIST_FINANCE_F3_CAPACITY_PATCH_FAILED'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;
