-- MTR-8: immutable availability history and aggregated metrics dashboard v2.

create table public.therapist_availability_history_coverage (
  therapist_profile_id uuid primary key
    references public.therapist_profiles (id) on delete cascade,
  started_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create table public.availability_rule_history (
  id bigint generated always as identity primary key,
  source_rule_id uuid not null,
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  service_id uuid,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  timezone text not null,
  is_active boolean not null,
  operation text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint availability_rule_history_day_check check (day_of_week between 0 and 6),
  constraint availability_rule_history_time_check check (start_time < end_time),
  constraint availability_rule_history_operation_check
    check (operation in ('baseline', 'insert', 'update', 'delete'))
);

create table public.availability_exception_history (
  id bigint generated always as identity primary key,
  source_exception_id uuid not null,
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  service_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null,
  operation text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint availability_exception_history_range_check check (starts_at < ends_at),
  constraint availability_exception_history_operation_check
    check (operation in ('baseline', 'insert', 'update', 'delete'))
);

create index availability_rule_history_lookup_idx
  on public.availability_rule_history (
    therapist_profile_id,
    source_rule_id,
    recorded_at desc,
    id desc
  );

create index availability_exception_history_lookup_idx
  on public.availability_exception_history (
    therapist_profile_id,
    source_exception_id,
    recorded_at desc,
    id desc
  );

alter table public.therapist_availability_history_coverage enable row level security;
alter table public.availability_rule_history enable row level security;
alter table public.availability_exception_history enable row level security;

revoke all on table public.therapist_availability_history_coverage from public, anon, authenticated;
revoke all on table public.availability_rule_history from public, anon, authenticated;
revoke all on table public.availability_exception_history from public, anon, authenticated;

insert into public.therapist_availability_history_coverage (
  therapist_profile_id,
  started_at
)
select therapist.id, clock_timestamp()
from public.therapist_profiles as therapist
on conflict (therapist_profile_id) do nothing;

insert into public.availability_rule_history (
  source_rule_id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active,
  operation,
  recorded_at
)
select
  rule.id,
  rule.therapist_profile_id,
  rule.service_id,
  rule.day_of_week,
  rule.start_time,
  rule.end_time,
  rule.timezone,
  rule.is_active,
  'baseline',
  coverage.started_at
from public.availability_rules as rule
join public.therapist_availability_history_coverage as coverage
  on coverage.therapist_profile_id = rule.therapist_profile_id;

insert into public.availability_exception_history (
  source_exception_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  is_available,
  operation,
  recorded_at
)
select
  exception.id,
  exception.therapist_profile_id,
  exception.service_id,
  exception.starts_at,
  exception.ends_at,
  exception.is_available,
  'baseline',
  coverage.started_at
from public.availability_exceptions as exception
join public.therapist_availability_history_coverage as coverage
  on coverage.therapist_profile_id = exception.therapist_profile_id;

create or replace function public.capture_availability_rule_history_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.availability_rules%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  insert into public.therapist_availability_history_coverage (
    therapist_profile_id,
    started_at
  ) values (v_row.therapist_profile_id, clock_timestamp())
  on conflict (therapist_profile_id) do nothing;

  insert into public.availability_rule_history (
    source_rule_id,
    therapist_profile_id,
    service_id,
    day_of_week,
    start_time,
    end_time,
    timezone,
    is_active,
    operation
  ) values (
    v_row.id,
    v_row.therapist_profile_id,
    v_row.service_id,
    v_row.day_of_week,
    v_row.start_time,
    v_row.end_time,
    v_row.timezone,
    v_row.is_active,
    lower(tg_op)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.capture_availability_exception_history_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.availability_exceptions%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  insert into public.therapist_availability_history_coverage (
    therapist_profile_id,
    started_at
  ) values (v_row.therapist_profile_id, clock_timestamp())
  on conflict (therapist_profile_id) do nothing;

  insert into public.availability_exception_history (
    source_exception_id,
    therapist_profile_id,
    service_id,
    starts_at,
    ends_at,
    is_available,
    operation
  ) values (
    v_row.id,
    v_row.therapist_profile_id,
    v_row.service_id,
    v_row.starts_at,
    v_row.ends_at,
    v_row.is_available,
    lower(tg_op)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.capture_availability_rule_history_v1() from public, anon, authenticated;
revoke all on function public.capture_availability_exception_history_v1() from public, anon, authenticated;

create trigger availability_rules_capture_history
after insert or update or delete on public.availability_rules
for each row execute function public.capture_availability_rule_history_v1();

create trigger availability_exceptions_capture_history
after insert or update or delete on public.availability_exceptions
for each row execute function public.capture_availability_exception_history_v1();

create or replace function public.get_therapist_occupancy_metrics_v2(
  p_therapist_profile_id uuid,
  p_timezone text,
  p_period_days integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local_end date;
  v_local_start date;
  v_previous_local_start date;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_coverage_start timestamptz;
  v_coverage_days integer := 0;
  v_current_offered bigint := 0;
  v_current_occupied bigint := 0;
  v_previous_offered bigint := 0;
  v_previous_occupied bigint := 0;
  v_series jsonb := '[]'::jsonb;
  v_heatmap jsonb := '[]'::jsonb;
begin
  if p_period_days not in (30, 90) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select coverage.started_at
    into v_coverage_start
  from public.therapist_availability_history_coverage as coverage
  where coverage.therapist_profile_id = p_therapist_profile_id;

  v_local_end := (now() at time zone p_timezone)::date;
  v_local_start := v_local_end - p_period_days;
  v_previous_local_start := v_local_start - p_period_days;
  v_current_start := v_local_start::timestamp at time zone p_timezone;
  v_current_end := v_local_end::timestamp at time zone p_timezone;
  v_previous_start := v_previous_local_start::timestamp at time zone p_timezone;

  if v_coverage_start is not null then
    v_coverage_days := greatest(
      0,
      v_local_end - (v_coverage_start at time zone p_timezone)::date
    );
  end if;

  if v_coverage_start is null or v_coverage_start > v_current_start then
    return jsonb_build_object(
      'status', 'forming',
      'reason', 'history_in_formation',
      'coverageStart', case
        when v_coverage_start is null then null
        else (v_coverage_start at time zone p_timezone)::date
      end,
      'coverageDays', least(v_coverage_days, p_period_days),
      'requiredCoverageDays', p_period_days
    );
  end if;

  with buckets as (
    select bucket.starts_at,
      bucket.starts_at + interval '15 minutes' as ends_at,
      (bucket.starts_at at time zone p_timezone)::date as local_date,
      extract(dow from bucket.starts_at at time zone p_timezone)::integer as day_of_week,
      extract(hour from bucket.starts_at at time zone p_timezone)::integer as hour_bucket_start
    from generate_series(
      greatest(v_previous_start, v_coverage_start),
      v_current_end - interval '15 minutes',
      interval '15 minutes'
    ) as bucket(starts_at)
  ), evaluated as (
    select bucket.*,
      exists (
        select 1
        from (
          select distinct on (history.source_rule_id)
            history.operation,
            history.day_of_week,
            history.start_time,
            history.end_time,
            history.timezone,
            history.is_active
          from public.availability_rule_history as history
          where history.therapist_profile_id = p_therapist_profile_id
            and history.recorded_at <= bucket.starts_at
          order by history.source_rule_id, history.recorded_at desc, history.id desc
        ) as current_rule
        where current_rule.operation <> 'delete'
          and current_rule.is_active
          and current_rule.day_of_week = extract(dow from bucket.starts_at at time zone current_rule.timezone)::integer
          and (bucket.starts_at at time zone current_rule.timezone)::time >= current_rule.start_time
          and (bucket.ends_at at time zone current_rule.timezone)::time <= current_rule.end_time
      )
      and not exists (
        select 1
        from (
          select distinct on (history.source_exception_id)
            history.operation,
            history.starts_at,
            history.ends_at,
            history.is_available
          from public.availability_exception_history as history
          where history.therapist_profile_id = p_therapist_profile_id
            and history.recorded_at <= bucket.starts_at
          order by history.source_exception_id, history.recorded_at desc, history.id desc
        ) as current_exception
        where current_exception.operation <> 'delete'
          and not current_exception.is_available
          and current_exception.starts_at < bucket.ends_at
          and current_exception.ends_at > bucket.starts_at
      ) as offered,
      exists (
        select 1
        from public.bookings as booking
        where booking.therapist_profile_id = p_therapist_profile_id
          and booking.status in ('confirmed', 'completed', 'no_show_patient', 'no_show_therapist')
          and booking.starts_at < bucket.ends_at
          and booking.ends_at > bucket.starts_at
      ) as booked
    from buckets as bucket
  ), daily as (
    select local_date,
      count(*) filter (where offered) * 15 as offered_minutes,
      count(*) filter (where offered and booked) * 15 as occupied_minutes
    from evaluated
    where starts_at >= v_current_start
    group by local_date
  ), hourly as (
    select day_of_week, hour_bucket_start,
      count(*) filter (where offered) * 15 as offered_minutes,
      count(*) filter (where offered and booked) * 15 as occupied_minutes
    from evaluated
    where starts_at >= v_current_start
    group by day_of_week, hour_bucket_start
  )
  select
    coalesce(sum(case when evaluated.starts_at >= v_current_start and offered then 15 else 0 end), 0),
    coalesce(sum(case when evaluated.starts_at >= v_current_start and offered and booked then 15 else 0 end), 0),
    coalesce(sum(case when evaluated.starts_at < v_current_start and offered then 15 else 0 end), 0),
    coalesce(sum(case when evaluated.starts_at < v_current_start and offered and booked then 15 else 0 end), 0),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'date', daily.local_date,
      'offeredMinutes', daily.offered_minutes,
      'occupiedMinutes', daily.occupied_minutes,
      'percentage', case when daily.offered_minutes = 0 then null else round(daily.occupied_minutes::numeric * 100 / daily.offered_minutes, 1) end
    ) order by daily.local_date), '[]'::jsonb) from daily),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'dayOfWeek', hourly.day_of_week,
      'hourBucketStart', hourly.hour_bucket_start,
      'offeredMinutes', hourly.offered_minutes,
      'occupiedMinutes', hourly.occupied_minutes,
      'percentage', case when hourly.offered_minutes = 0 then null else round(hourly.occupied_minutes::numeric * 100 / hourly.offered_minutes, 1) end
    ) order by hourly.hour_bucket_start, hourly.day_of_week), '[]'::jsonb) from hourly)
    into v_current_offered, v_current_occupied, v_previous_offered,
      v_previous_occupied, v_series, v_heatmap
  from evaluated;

  return jsonb_build_object(
    'status', case when v_current_offered = 0 then 'empty' else 'ready' end,
    'coverageStart', (v_coverage_start at time zone p_timezone)::date,
    'coverageDays', least(v_coverage_days, p_period_days),
    'requiredCoverageDays', p_period_days,
    'current', jsonb_build_object(
      'offeredMinutes', v_current_offered,
      'occupiedMinutes', v_current_occupied,
      'percentage', case when v_current_offered = 0 then null else round(v_current_occupied::numeric * 100 / v_current_offered, 1) end
    ),
    'previous', jsonb_build_object(
      'offeredMinutes', v_previous_offered,
      'occupiedMinutes', v_previous_occupied,
      'percentage', case when v_previous_offered = 0 then null else round(v_previous_occupied::numeric * 100 / v_previous_offered, 1) end
    ),
    'series', v_series,
    'heatmap', v_heatmap
  );
end;
$$;

revoke all on function public.get_therapist_occupancy_metrics_v2(uuid, text, integer)
  from public, anon, authenticated;

create or replace function public.get_therapist_metrics_dashboard_v2(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_overview jsonb;
  v_sessions jsonb;
  v_interest jsonb;
  v_profile_id uuid;
  v_timezone text;
begin
  if p_period_days not in (30, 90) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_overview := public.get_therapist_metrics_overview_v1(p_period_days);
  v_sessions := public.get_therapist_session_metrics_v1(p_period_days);
  v_interest := public.get_therapist_interest_metrics_v1(p_period_days);
  v_profile_id := (v_overview #>> '{therapist,profileId}')::uuid;
  v_timezone := v_overview #>> '{meta,timezone}';

  return jsonb_build_object(
    'contractVersion', 2,
    'metricDefinitionVersion', 2,
    'therapist', v_overview -> 'therapist',
    'meta', v_overview -> 'meta',
    'overview', v_overview,
    'sessions', v_sessions,
    'interest', v_interest,
    'occupancy', public.get_therapist_occupancy_metrics_v2(
      v_profile_id,
      v_timezone,
      p_period_days
    )
  );
end;
$$;

revoke all on function public.get_therapist_metrics_dashboard_v2(integer)
  from public, anon, authenticated;
grant execute on function public.get_therapist_metrics_dashboard_v2(integer)
  to authenticated;

comment on function public.get_therapist_metrics_dashboard_v2(integer) is
  'Authenticated aggregate dashboard for therapist metrics. Preserves v1 contracts and adds occupancy only after complete immutable schedule history coverage.';
