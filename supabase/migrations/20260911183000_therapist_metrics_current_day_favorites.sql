-- Keep historical comparisons on complete local days while exposing a small,
-- explicitly separate projection for activity recorded during the current day.

create or replace function public.get_therapist_metrics_today_v1()
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
  v_local_date date;
  v_favorites_added bigint := 0;
  v_fresh_through timestamptz;
begin
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

  if v_therapist.plan <> 'premium_plus'::public.therapist_plan then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id;

  if v_timezone is null then
    raise exception 'UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_local_date := (now() at time zone v_timezone)::date;

  select
    coalesce(sum(aggregate.favorites_added), 0),
    max(aggregate.fresh_through)
    into v_favorites_added, v_fresh_through
  from public.therapist_metric_daily_aggregates as aggregate
  where aggregate.therapist_profile_id = v_therapist.id
    and aggregate.metric_date = v_local_date
    and aggregate.definition_version = 1;

  return jsonb_build_object(
    'contractVersion', 1,
    'metricDefinitionVersion', 1,
    'therapist', jsonb_build_object(
      'profileId', v_therapist.id,
      'plan', v_therapist.plan
    ),
    'meta', jsonb_build_object(
      'timezone', v_timezone,
      'localDate', v_local_date,
      'computedAt', now(),
      'freshThrough', v_fresh_through
    ),
    'profileFavoritesAdded', jsonb_build_object(
      'status', case
        when v_favorites_added = 0 then 'empty'
        else 'ready'
      end,
      'unit', 'favorites',
      'value', v_favorites_added
    )
  );
end;
$$;

comment on function public.get_therapist_metrics_today_v1() is
'Authenticated current-local-day metrics projection. It complements, and never changes, complete-day historical comparisons.';

revoke all on function public.get_therapist_metrics_today_v1()
from public, anon;
grant execute on function public.get_therapist_metrics_today_v1()
to authenticated;
