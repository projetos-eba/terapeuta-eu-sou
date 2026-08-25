create or replace function public.get_therapist_session_evolution_comparison_v1(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
  v_current_local_end date;
  v_current_local_start date;
  v_previous_local_start date;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_current_completed bigint := 0;
  v_previous_completed bigint := 0;
begin
  if p_period_days not in (30, 60, 90, 120) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select therapist.*
    into v_therapist
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'PROFILE_LOCKED' using errcode = '42501';
  end if;

  if v_therapist.plan not in (
    'premium'::public.therapist_plan,
    'premium_plus'::public.therapist_plan
  ) then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id;

  if v_timezone is null then
    raise exception 'UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_current_local_end := (now() at time zone v_timezone)::date;
  v_current_local_start := v_current_local_end - p_period_days;
  v_previous_local_start := v_current_local_start - p_period_days;
  v_current_start := v_current_local_start::timestamp at time zone v_timezone;
  v_current_end := v_current_local_end::timestamp at time zone v_timezone;
  v_previous_start := v_previous_local_start::timestamp at time zone v_timezone;

  select
    count(*) filter (where booking.starts_at >= v_current_start),
    count(*) filter (where booking.starts_at < v_current_start)
    into v_current_completed, v_previous_completed
  from public.bookings as booking
  where booking.therapist_profile_id = v_therapist.id
    and booking.status = 'completed'
    and booking.starts_at >= v_previous_start
    and booking.starts_at < v_current_end;

  return jsonb_build_object(
    'contractVersion', 1,
    'metricDefinitionVersion', 1,
    'therapist', jsonb_build_object(
      'profileId', v_therapist.id,
      'plan', v_therapist.plan
    ),
    'meta', jsonb_build_object(
      'timezone', v_timezone,
      'periodDays', p_period_days,
      'periodStart', v_current_start,
      'periodEnd', v_current_end,
      'previousPeriodStart', v_previous_start,
      'previousPeriodEnd', v_current_start,
      'computedAt', now(),
      'freshThrough', v_current_end
    ),
    'status', case
      when v_current_completed = 0 and v_previous_completed = 0 then 'empty'
      else 'ready'
    end,
    'points', (
      with completed_by_day as (
        select
          (booking.starts_at at time zone v_timezone)::date as metric_date,
          count(*)::integer as completed_count
        from public.bookings as booking
        where booking.therapist_profile_id = v_therapist.id
          and booking.status = 'completed'
          and booking.starts_at >= v_previous_start
          and booking.starts_at < v_current_end
        group by (booking.starts_at at time zone v_timezone)::date
      )
      select jsonb_agg(
        jsonb_build_object(
          'index', day_offset.value,
          'currentDate', v_current_local_start + day_offset.value,
          'previousDate', v_previous_local_start + day_offset.value,
          'current', coalesce(current_day.completed_count, 0),
          'previous', coalesce(previous_day.completed_count, 0)
        )
        order by day_offset.value
      )
      from generate_series(0, p_period_days - 1) as day_offset(value)
      left join completed_by_day as current_day
        on current_day.metric_date = v_current_local_start + day_offset.value
      left join completed_by_day as previous_day
        on previous_day.metric_date = v_previous_local_start + day_offset.value
    )
  );
end;
$$;

comment on function public.get_therapist_session_evolution_comparison_v1(integer)
is 'Returns aligned aggregate completed-session series for the selected complete period and its immediately preceding period. Uses auth.uid(), contains no patient identifiers and supports 30, 60, 90 and 120 complete days.';

revoke all on function public.get_therapist_session_evolution_comparison_v1(integer)
from public, anon;
grant execute on function public.get_therapist_session_evolution_comparison_v1(integer)
to authenticated;
