-- Public agenda: a service is bookable up to 90 days ahead.  The public
-- calendar reads availability by local calendar month so an early slot count
-- can never decide whether a later month is navigable.

alter table public.therapist_service_booking_settings
  alter column max_days_ahead set default 90;

update public.therapist_service_booking_settings
set max_days_ahead = 90,
    updated_at = now()
where max_days_ahead is distinct from 90;

-- Keep legacy missing-setting fallbacks aligned with the new default. These
-- functions are recreated dynamically so their current, audited bodies and
-- privilege/security attributes remain otherwise unchanged.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.list_service_schedule_candidates_v1(uuid,timestamptz,timestamptz,timestamptz,integer)'::regprocedure
  ) into v_definition;
  v_definition := regexp_replace(
    v_definition,
    'coalesce\\(booking_settings\\.max_days_ahead, 30\\)',
    'coalesce(booking_settings.max_days_ahead, 90)',
    'gi'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.reserve_booking_hold_v1_internal(uuid,uuid,timestamptz,timestamptz,text,text,integer)'::regprocedure
  ) into v_definition;
  v_definition := regexp_replace(
    v_definition,
    'coalesce\\(settings\\.max_days_ahead, 30\\)',
    'coalesce(settings.max_days_ahead, 90)',
    'gi'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.create_therapist_service_v1(uuid,uuid,jsonb)'::regprocedure
  ) into v_definition;
  v_definition := regexp_replace(
    v_definition,
    'values\\s*\\(v_service\\.id, 10, 10, 120, 30, 30\\)',
    'values (v_service.id, 10, 10, 120, 90, 30)',
    'gi'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.get_therapist_schedule_v1()'::regprocedure
  ) into v_definition;
  v_definition := regexp_replace(
    v_definition,
    'coalesce\\(booking_settings\\.max_days_ahead, 30\\)',
    'coalesce(booking_settings.max_days_ahead, 90)',
    'gi'
  );
  execute v_definition;
end;
$$;

-- Preserve the existing slot payload and add the authoritative horizon for
-- consumers that need to determine calendar navigation. The slot range stays
-- deliberately bounded (and the 500-slot limit stays a day-detail guard).
create or replace function public.get_service_available_slots_v1(
  p_service_id uuid,
  p_range_start timestamptz default null,
  p_range_end timestamptz default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_horizon_ends_at timestamptz;
  v_result jsonb;
begin
  if not public.is_public_service_booking_eligible_v1(p_service_id) then
    return null;
  end if;

  select now() + coalesce(settings.max_days_ahead, 90) * interval '1 day'
    into v_horizon_ends_at
  from public.therapist_services as service
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = service.id
  where service.id = p_service_id;

  v_result := public.get_service_available_slots_v1_internal(
    p_service_id,
    p_range_start,
    p_range_end,
    p_limit
  );

  if v_result is null then
    return null;
  end if;

  return jsonb_set(
    v_result,
    '{horizonEndsAt}',
    to_jsonb(v_horizon_ends_at),
    true
  );
end;
$$;

create or replace function public.get_service_available_days_v1(
  p_service_id uuid,
  p_month date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_horizon_ends_at timestamptz;
  v_month date;
  v_month_end timestamptz;
  v_month_start timestamptz;
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_timezone text;
begin
  if not public.is_public_service_booking_eligible_v1(p_service_id) then
    return null;
  end if;

  select
    schedule.timezone,
    now() + coalesce(settings.max_days_ahead, 90) * interval '1 day'
  into v_timezone, v_horizon_ends_at
  from public.therapist_services as service
  join public.therapist_schedule_settings as schedule
    on schedule.therapist_profile_id = service.therapist_profile_id
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = service.id
  where service.id = p_service_id;

  v_month := date_trunc(
    'month',
    coalesce(p_month, now() at time zone v_timezone)::date
  )::date;
  v_month_start := v_month::timestamp at time zone v_timezone;
  v_month_end := (v_month + interval '1 month')::timestamp at time zone v_timezone;
  v_range_start := greatest(v_month_start, now());
  v_range_end := least(v_month_end, v_horizon_ends_at);

  return jsonb_build_object(
    'contractVersion', 1,
    'timezone', v_timezone,
    'horizonEndsAt', v_horizon_ends_at,
    'month', to_char(v_month, 'YYYY-MM'),
    'days', case
      when v_range_start >= v_range_end then '[]'::jsonb
      else (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'date',
              to_char(local_day.day::date, 'YYYY-MM-DD')
            )
            order by local_day.day
          ),
          '[]'::jsonb
        )
        from generate_series(
          (v_range_start at time zone v_timezone)::date,
          ((v_range_end - interval '1 microsecond') at time zone v_timezone)::date,
          interval '1 day'
        ) as local_day(day)
        where jsonb_array_length(
          coalesce(
            public.get_service_available_slots_v1(
              p_service_id,
              local_day.day::timestamp at time zone v_timezone,
              (local_day.day + interval '1 day')::timestamp at time zone v_timezone,
              500
            ) -> 'slots',
            '[]'::jsonb
          )
        ) > 0
      )
    end
  );
end;
$$;

create or replace function public.get_service_available_day_slots_v1(
  p_service_id uuid,
  p_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  if p_day is null or not public.is_public_service_booking_eligible_v1(p_service_id) then
    return null;
  end if;

  select schedule.timezone
    into v_timezone
  from public.therapist_services as service
  join public.therapist_schedule_settings as schedule
    on schedule.therapist_profile_id = service.therapist_profile_id
  where service.id = p_service_id;

  return public.get_service_available_slots_v1(
    p_service_id,
    p_day::timestamp at time zone v_timezone,
    (p_day + interval '1 day')::timestamp at time zone v_timezone,
    500
  );
end;
$$;

revoke all on function public.get_service_available_days_v1(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_service_available_days_v1(uuid, date)
  to anon, authenticated, service_role;

revoke all on function public.get_service_available_day_slots_v1(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_service_available_day_slots_v1(uuid, date)
  to anon, authenticated, service_role;

revoke all on function public.get_service_available_slots_v1(uuid, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.get_service_available_slots_v1(uuid, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

comment on function public.get_service_available_days_v1(uuid, date) is
  'Public calendar-month availability. Returns only local dates that have at least one currently free authoritative slot, plus timezone and horizonEndsAt.';
comment on function public.get_service_available_day_slots_v1(uuid, date) is
  'Public day-detail availability. Returns the authoritative slots for one local calendar day.';
