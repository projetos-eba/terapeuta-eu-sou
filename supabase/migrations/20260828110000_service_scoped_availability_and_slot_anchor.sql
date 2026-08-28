-- Agenda: service-scoped availability and therapist-global occupancy.
--
-- Availability ranges describe the session start/end window for one service.
-- buffer_before_minutes expands therapist occupancy, but it must not move the
-- first offered start away from the configured range start. The after buffer
-- still has to fit inside the configured range end.

lock table public.availability_rules in share row exclusive mode;

create temporary table migrated_global_availability_therapists
on commit drop
as
select distinct rule.therapist_profile_id
from public.availability_rules as rule
where rule.service_id is null;

do $$
begin
  if exists (
    select 1
    from public.availability_rules as global_rule
    where global_rule.service_id is null
      and not exists (
        select 1
        from public.therapist_services as service
        where service.therapist_profile_id = global_rule.therapist_profile_id
      )
  ) then
    raise exception 'GLOBAL_AVAILABILITY_RULE_WITHOUT_SERVICE'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.availability_rules as global_rule
    join public.therapist_services as service
      on service.therapist_profile_id = global_rule.therapist_profile_id
    join public.availability_rules as specific_rule
      on specific_rule.therapist_profile_id = global_rule.therapist_profile_id
     and specific_rule.service_id = service.id
     and specific_rule.day_of_week = global_rule.day_of_week
     and specific_rule.is_active
     and global_rule.is_active
     and specific_rule.start_time < global_rule.end_time
     and global_rule.start_time < specific_rule.end_time
    where global_rule.service_id is null
      and not (
        specific_rule.start_time = global_rule.start_time
        and specific_rule.end_time = global_rule.end_time
      )
  ) then
    raise exception 'GLOBAL_AVAILABILITY_RULE_OVERLAPS_EXPLICIT_SERVICE_RULE'
      using errcode = '23P01';
  end if;
end;
$$;

insert into public.availability_rules (
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active,
  created_at,
  updated_at
)
select
  global_rule.therapist_profile_id,
  service.id,
  global_rule.day_of_week,
  global_rule.start_time,
  global_rule.end_time,
  global_rule.timezone,
  global_rule.is_active,
  global_rule.created_at,
  now()
from public.availability_rules as global_rule
join public.therapist_services as service
  on service.therapist_profile_id = global_rule.therapist_profile_id
where global_rule.service_id is null
  and not exists (
    select 1
    from public.availability_rules as existing_rule
    where existing_rule.therapist_profile_id = global_rule.therapist_profile_id
      and existing_rule.service_id = service.id
      and existing_rule.day_of_week = global_rule.day_of_week
      and existing_rule.start_time = global_rule.start_time
      and existing_rule.end_time = global_rule.end_time
      and existing_rule.is_active = global_rule.is_active
  );

delete from public.availability_rules
where service_id is null;

update public.therapist_schedule_settings as settings
set version = settings.version + 1,
    updated_at = now()
where exists (
  select 1
  from migrated_global_availability_therapists as migrated
  where migrated.therapist_profile_id = settings.therapist_profile_id
);

alter table public.availability_rules
  alter column service_id set not null;

comment on column public.availability_rules.service_id is
  'Required service scope for offered availability. Therapist-global occupancy remains represented by bookings, active holds and global availability exceptions.';

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
    coalesce(booking_settings.buffer_before_minutes, 10),
    coalesce(booking_settings.buffer_after_minutes, 10),
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
        - (v_duration + v_buffer_after) * interval '1 minute',
      v_step * interval '1 minute'
    ) as generated(local_starts_at)
    where source_window.local_start
      <= source_window.local_end
        - (v_duration + v_buffer_after) * interval '1 minute'
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
        ) && pg_catalog.tstzrange(
          candidate.starts_at - v_buffer_before * interval '1 minute',
          candidate.ends_at + v_buffer_after * interval '1 minute',
          '[)'
        )
    )
  order by candidate.starts_at
  limit p_limit;
end;
$$;

revoke all on function public.list_service_schedule_candidates_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.list_service_schedule_candidates_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  integer
) to service_role;

-- Keep the private read model truthful after the general scope is retired.
do $$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.get_therapist_schedule_v1()'::regprocedure
  ) into v_definition;

  v_updated_definition := replace(
    v_definition,
    'and rule.service_id is null',
    'and rule.service_id is not null'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    'and \(\s*service_rule\.service_id is null\s*or service_rule\.service_id = service\.id\s*\)',
    'and service_rule.service_id = service.id',
    'g'
  );

  if v_updated_definition = v_definition
    or v_updated_definition ~ 'service_rule\.service_id is null'
  then
    raise exception 'THERAPIST_SCHEDULE_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;

comment on function public.list_service_schedule_candidates_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  integer
) is
  'Authoritative service-scoped candidate generator. Session starts are anchored to each availability window; buffers expand therapist-global occupancy and the after buffer must fit before the window end.';

-- Reject retired general rules inside the database command as well, so callers
-- outside the current UI receive the canonical domain error before NOT NULL.
do $$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)'::regprocedure
  ) into v_definition;

  -- Historical migration sources were stored with CRLF in this workspace.
  -- Normalize only the reconstructed definition before applying exact guards.
  v_definition := replace(v_definition, chr(13), '');

  v_updated_definition := replace(
    v_definition,
    'and (
        left_rule.service_id is null
        or right_rule.service_id is null
        or left_rule.service_id = right_rule.service_id
      )',
    'and left_rule.service_id = right_rule.service_id'
  );
  v_updated_definition := replace(
    v_updated_definition,
    'if v_rule.service_id is not null
      and not exists (',
    'if v_rule.service_id is null
      or not exists ('
  );

  if v_updated_definition = v_definition
    or v_updated_definition ~ 'left_rule\.service_id is null'
    or v_updated_definition ~ 'v_rule\.service_id is not null'
  then
    raise exception 'SAVE_THERAPIST_SCHEDULE_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;
