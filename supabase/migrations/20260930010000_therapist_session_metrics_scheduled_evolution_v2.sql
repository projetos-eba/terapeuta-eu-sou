-- MTR-4 V2 adds the daily series of sessions that reached the schedule.
-- V1 remains unchanged for existing consumers; V2 delegates its established
-- permissions, period and privacy checks to V1 and adds only an aggregate.
create or replace function public.get_therapist_session_metrics_v2(
  p_period_days integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_profile_id uuid;
  v_timezone text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_points jsonb;
begin
  v_base := public.get_therapist_session_metrics_v1(p_period_days);
  v_profile_id := (v_base #>> '{therapist,profileId}')::uuid;
  v_timezone := v_base #>> '{meta,timezone}';
  v_period_start := (v_base #>> '{meta,periodStart}')::timestamptz;
  v_period_end := (v_base #>> '{meta,periodEnd}')::timestamptz;

  if v_profile_id is null
    or v_timezone is null
    or v_period_start is null
    or v_period_end is null then
    raise exception 'THERAPIST_SESSION_METRICS_V2_BASE_CONTRACT_INVALID'
      using errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_set(
        daily.point,
        '{sessionsScheduled}',
        to_jsonb(coalesce(scheduled.sessions_scheduled, 0)),
        true
      )
      order by (daily.point ->> 'date')::date
    ),
    '[]'::jsonb
  )
  into v_points
  from jsonb_array_elements(v_base #> '{evolution,points}') as daily(point)
  left join (
    select
      (booking.starts_at at time zone v_timezone)::date as local_date,
      count(*)::integer as sessions_scheduled
    from public.bookings as booking
    where booking.therapist_profile_id = v_profile_id
      and booking.starts_at >= v_period_start
      and booking.starts_at < v_period_end
      and booking.status in (
        'confirmed',
        'completed',
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'cancelled_by_admin',
        'cancelled_by_payment',
        'no_show_patient',
        'no_show_therapist',
        'no_show_both',
        'refunded'
      )
    group by (booking.starts_at at time zone v_timezone)::date
  ) as scheduled
    on scheduled.local_date = (daily.point ->> 'date')::date;

  return jsonb_set(
    jsonb_set(v_base, '{contractVersion}', to_jsonb(2), true),
    '{evolution}',
    jsonb_build_object(
      'status', v_base #> '{evolution,status}',
      'points', v_points
    ),
    true
  );
end;
$$;

comment on function public.get_therapist_session_metrics_v2(integer) is
  'MTR-4 V2: private therapist session metrics. Adds a daily sessionsScheduled aggregate based on the scheduled booking date and eligible scheduled statuses; V1 remains available unchanged.';

revoke all on function public.get_therapist_session_metrics_v2(integer)
from public;
grant execute on function public.get_therapist_session_metrics_v2(integer)
to authenticated;
