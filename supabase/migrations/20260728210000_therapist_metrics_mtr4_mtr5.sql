-- MTR-4 and MTR-5: private, authenticated read models for session operations
-- and therapist-owned continuity signals. No patient identity or free text is
-- returned by either contract.

create index if not exists bookings_therapist_patient_completed_starts_idx
on public.bookings (
  therapist_profile_id,
  patient_profile_id,
  starts_at
)
where status = 'completed';

create index if not exists booking_reschedule_requests_applied_booking_idx
on public.booking_reschedule_requests (applied_at, booking_id)
where status = 'applied';

create or replace function public.therapist_metric_sampled_counter_by_sample_v1(
  p_current numeric,
  p_previous numeric,
  p_observed_sample bigint,
  p_copy_key_prefix text,
  p_unit text,
  p_minimum_sample integer default 10
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_direction text;
begin
  if p_observed_sample < p_minimum_sample then
    return jsonb_build_object(
      'status', 'insufficient_sample',
      'value', null,
      'previousValue', null,
      'direction', null,
      'directionCopyKey', null,
      'unit', p_unit,
      'minimumSample', p_minimum_sample,
      'observedSample', p_observed_sample
    );
  end if;

  v_direction := case
    when p_current > p_previous then 'up'
    when p_current < p_previous then 'down'
    else 'stable'
  end;

  return jsonb_build_object(
    'status', 'ready',
    'value', p_current,
    'previousValue', p_previous,
    'direction', v_direction,
    'directionCopyKey', p_copy_key_prefix || '.' || v_direction,
    'unit', p_unit,
    'minimumSample', p_minimum_sample,
    'observedSample', p_observed_sample
  );
end;
$$;

revoke all on function public.therapist_metric_sampled_counter_by_sample_v1(
  numeric,
  numeric,
  bigint,
  text,
  text,
  integer
) from public, anon, authenticated;

create or replace function public.get_therapist_session_metrics_v1(
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
  v_current_cancelled bigint := 0;
  v_previous_cancelled bigint := 0;
  v_current_no_shows bigint := 0;
  v_previous_no_shows bigint := 0;
  v_current_reschedules bigint := 0;
  v_previous_reschedules bigint := 0;
  v_current_average_minutes bigint := 0;
  v_previous_average_minutes bigint := 0;
  v_current_presence_sample bigint := 0;
  v_previous_presence_sample bigint := 0;
  v_current_outcome_sample bigint := 0;
begin
  if p_period_days not in (30, 90) then
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
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status = 'completed'
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status = 'completed'
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status in (
          'cancelled_by_patient',
          'cancelled_by_therapist'
        )
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status in (
          'cancelled_by_patient',
          'cancelled_by_therapist'
        )
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status in ('no_show_patient', 'no_show_therapist')
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status in ('no_show_patient', 'no_show_therapist')
    ),
    coalesce(round(avg(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at >= v_current_start
        and booking.status = 'completed'
    )), 0),
    coalesce(round(avg(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at < v_current_start
        and booking.status = 'completed'
    )), 0)
    into
      v_current_completed,
      v_previous_completed,
      v_current_cancelled,
      v_previous_cancelled,
      v_current_no_shows,
      v_previous_no_shows,
      v_current_average_minutes,
      v_previous_average_minutes
  from public.bookings as booking
  where booking.therapist_profile_id = v_therapist.id
    and booking.starts_at >= v_previous_start
    and booking.starts_at < v_current_end;

  select
    count(*) filter (
      where request.applied_at >= v_current_start
    ),
    count(*) filter (
      where request.applied_at < v_current_start
    )
    into v_current_reschedules, v_previous_reschedules
  from public.booking_reschedule_requests as request
  join public.bookings as booking
    on booking.id = request.booking_id
  where booking.therapist_profile_id = v_therapist.id
    and request.status = 'applied'
    and request.applied_at >= v_previous_start
    and request.applied_at < v_current_end;

  v_current_presence_sample := v_current_completed + v_current_no_shows;
  v_previous_presence_sample := v_previous_completed + v_previous_no_shows;
  v_current_outcome_sample :=
    v_current_completed + v_current_no_shows + v_current_cancelled;

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
    'summary', jsonb_build_object(
      'sessionsCompleted', public.therapist_metric_counter_v1(
        v_current_completed,
        v_previous_completed,
        'therapist_metrics.sessions_completed',
        'sessions'
      ),
      'operationalPresence', public.therapist_metric_rate_v1(
        v_current_completed,
        v_current_presence_sample,
        v_previous_completed,
        v_previous_presence_sample,
        'therapist_metrics.operational_presence',
        10
      ),
      'sessionsCancelled', public.therapist_metric_counter_v1(
        v_current_cancelled,
        v_previous_cancelled,
        'therapist_metrics.sessions_cancelled',
        'sessions'
      ),
      'sessionsRescheduled', public.therapist_metric_counter_v1(
        v_current_reschedules,
        v_previous_reschedules,
        'therapist_metrics.sessions_rescheduled',
        'sessions'
      ),
      'reservedDurationAverage', public.therapist_metric_counter_v1(
        v_current_average_minutes,
        v_previous_average_minutes,
        'therapist_metrics.reserved_duration_average',
        'minutes'
      )
    ),
    'outcomeDistribution', jsonb_build_object(
      'status', case
        when v_current_outcome_sample = 0 then 'empty'
        when v_current_outcome_sample < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_outcome_sample,
      'items', case
        when v_current_outcome_sample < 10 then '[]'::jsonb
        else (
          with outcome_keys(key, label, sort_order) as (
            values
              ('completed', 'Compareceram', 1),
              ('no_show_patient', 'Ausência da pessoa atendida', 2),
              ('no_show_therapist', 'Ausência do terapeuta', 3),
              ('cancelled_by_patient', 'Canceladas pela pessoa atendida', 4),
              ('cancelled_by_therapist', 'Canceladas pelo terapeuta', 5)
          ),
          outcome_counts as (
            select booking.status::text as key, count(*)::bigint as value
            from public.bookings as booking
            where booking.therapist_profile_id = v_therapist.id
              and booking.starts_at >= v_current_start
              and booking.starts_at < v_current_end
              and booking.status in (
                'completed',
                'no_show_patient',
                'no_show_therapist',
                'cancelled_by_patient',
                'cancelled_by_therapist'
              )
            group by booking.status
          )
          select jsonb_agg(
            jsonb_build_object(
              'key', outcome_keys.key,
              'label', outcome_keys.label,
              'value', coalesce(outcome_counts.value, 0),
              'percentage', round(
                coalesce(outcome_counts.value, 0)::numeric
                  * 100 / v_current_outcome_sample,
                1
              )
            )
            order by outcome_keys.sort_order
          )
          from outcome_keys
          left join outcome_counts using (key)
        )
      end
    ),
    'evolution', jsonb_build_object(
      'status', case
        when v_current_outcome_sample = 0 and v_current_reschedules = 0
          then 'empty'
        else 'ready'
      end,
      'points', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'date', day.metric_date::date,
              'sessionsCompleted', coalesce(outcomes.completed_count, 0),
              'sessionsCancelled', coalesce(outcomes.cancelled_count, 0),
              'noShows', coalesce(outcomes.no_show_count, 0),
              'sessionsRescheduled', coalesce(reschedules.rescheduled_count, 0)
            )
            order by day.metric_date
          ),
          '[]'::jsonb
        )
        from generate_series(
          v_current_local_start,
          v_current_local_end - 1,
          interval '1 day'
        ) as day(metric_date)
        left join (
          select
            (booking.starts_at at time zone v_timezone)::date as metric_date,
            count(*) filter (
              where booking.status = 'completed'
            )::integer as completed_count,
            count(*) filter (
              where booking.status in (
                'cancelled_by_patient',
                'cancelled_by_therapist'
              )
            )::integer as cancelled_count,
            count(*) filter (
              where booking.status in (
                'no_show_patient',
                'no_show_therapist'
              )
            )::integer as no_show_count
          from public.bookings as booking
          where booking.therapist_profile_id = v_therapist.id
            and booking.starts_at >= v_current_start
            and booking.starts_at < v_current_end
          group by (booking.starts_at at time zone v_timezone)::date
        ) as outcomes
          on outcomes.metric_date = day.metric_date::date
        left join (
          select
            (request.applied_at at time zone v_timezone)::date as metric_date,
            count(*)::integer as rescheduled_count
          from public.booking_reschedule_requests as request
          join public.bookings as booking
            on booking.id = request.booking_id
          where booking.therapist_profile_id = v_therapist.id
            and request.status = 'applied'
            and request.applied_at >= v_current_start
            and request.applied_at < v_current_end
          group by (request.applied_at at time zone v_timezone)::date
        ) as reschedules
          on reschedules.metric_date = day.metric_date::date
      )
    ),
    'heatmap', jsonb_build_object(
      'status', case
        when v_current_completed = 0 then 'empty'
        when v_current_completed < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_completed,
      'items', case
        when v_current_completed < 10 then '[]'::jsonb
        else (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'dayOfWeek', heat.day_of_week,
                'hourBucketStart', heat.hour_bucket_start,
                'sessions', heat.sessions
              )
              order by heat.day_of_week, heat.hour_bucket_start
            ),
            '[]'::jsonb
          )
          from (
            select
              extract(
                isodow from booking.starts_at at time zone v_timezone
              )::integer as day_of_week,
              (
                floor(
                  extract(hour from booking.starts_at at time zone v_timezone)
                    / 2
                ) * 2
              )::integer as hour_bucket_start,
              count(*)::integer as sessions
            from public.bookings as booking
            where booking.therapist_profile_id = v_therapist.id
              and booking.status = 'completed'
              and booking.starts_at >= v_current_start
              and booking.starts_at < v_current_end
            group by 1, 2
          ) as heat
        )
      end
    ),
    'presenceByDay', (
      with presence as (
        select
          extract(
            isodow from booking.starts_at at time zone v_timezone
          )::integer as day_of_week,
          count(*) filter (
            where booking.status = 'completed'
          )::bigint as completed_count,
          count(*)::bigint as sample
        from public.bookings as booking
        where booking.therapist_profile_id = v_therapist.id
          and booking.status in (
            'completed',
            'no_show_patient',
            'no_show_therapist'
          )
          and booking.starts_at >= v_current_start
          and booking.starts_at < v_current_end
        group by 1
      )
      select jsonb_build_object(
        'status', case
          when v_current_presence_sample = 0 then 'empty'
          when not exists (select 1 from presence where sample >= 10)
            then 'insufficient_sample'
          else 'ready'
        end,
        'minimumSample', 10,
        'observedSample', v_current_presence_sample,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'dayOfWeek', day_of_week,
              'percentage', round(
                completed_count::numeric * 100 / sample,
                1
              ),
              'sample', sample
            )
            order by completed_count::numeric / sample desc, day_of_week
          )
          from presence
          where sample >= 10
        ), '[]'::jsonb)
      )
    ),
    'presenceByHour', (
      with presence as (
        select
          (
            floor(
              extract(hour from booking.starts_at at time zone v_timezone) / 2
            ) * 2
          )::integer as hour_bucket_start,
          count(*) filter (
            where booking.status = 'completed'
          )::bigint as completed_count,
          count(*)::bigint as sample
        from public.bookings as booking
        where booking.therapist_profile_id = v_therapist.id
          and booking.status in (
            'completed',
            'no_show_patient',
            'no_show_therapist'
          )
          and booking.starts_at >= v_current_start
          and booking.starts_at < v_current_end
        group by 1
      )
      select jsonb_build_object(
        'status', case
          when v_current_presence_sample = 0 then 'empty'
          when not exists (select 1 from presence where sample >= 10)
            then 'insufficient_sample'
          else 'ready'
        end,
        'minimumSample', 10,
        'observedSample', v_current_presence_sample,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'hourBucketStart', hour_bucket_start,
              'percentage', round(
                completed_count::numeric * 100 / sample,
                1
              ),
              'sample', sample
            )
            order by completed_count::numeric / sample desc, hour_bucket_start
          )
          from presence
          where sample >= 10
        ), '[]'::jsonb)
      )
    ),
    'therapyDistribution', jsonb_build_object(
      'status', case
        when v_current_completed = 0 then 'empty'
        when v_current_completed < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_completed,
      'items', case
        when v_current_completed < 10 then '[]'::jsonb
        else (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'therapyId', therapy_count.therapy_id,
                'therapyName', therapy_count.therapy_name,
                'sessions', therapy_count.sessions,
                'percentage', round(
                  therapy_count.sessions::numeric
                    * 100 / v_current_completed,
                  1
                )
              )
              order by therapy_count.sessions desc, therapy_count.therapy_name
            ),
            '[]'::jsonb
          )
          from (
            select
              service.therapy_id,
              therapy.name as therapy_name,
              count(*)::integer as sessions
            from public.bookings as booking
            join public.therapist_services as service
              on service.id = booking.service_id
            join public.therapies as therapy
              on therapy.id = service.therapy_id
            where booking.therapist_profile_id = v_therapist.id
              and booking.status = 'completed'
              and booking.starts_at >= v_current_start
              and booking.starts_at < v_current_end
            group by service.therapy_id, therapy.name
          ) as therapy_count
        )
      end
    ),
    'cancellationReasons', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'cancellation_taxonomy_not_versioned'
    )
  );
end;
$$;

comment on function public.get_therapist_session_metrics_v1(integer)
is 'MTR-4 private session read model. Uses booking outcomes, immutable duration snapshots and applied reschedules; returns no patient identity or cancellation free text.';

revoke all on function public.get_therapist_session_metrics_v1(integer)
from public, anon;
grant execute on function public.get_therapist_session_metrics_v1(integer)
to authenticated;

create or replace function public.get_therapist_interest_metrics_v1(
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
  v_current_people bigint := 0;
  v_previous_people bigint := 0;
  v_current_sessions bigint := 0;
  v_previous_sessions bigint := 0;
  v_current_returned bigint := 0;
  v_previous_returned bigint := 0;
  v_current_favorites bigint := 0;
  v_previous_favorites bigint := 0;
  v_segment_total bigint := 0;
  v_segment_small_groups bigint := 0;
  v_segment_items jsonb := '[]'::jsonb;
  v_cohort_observed bigint := 0;
  v_cohort_items jsonb := '[]'::jsonb;
begin
  if p_period_days not in (30, 90) then
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

  if v_therapist.plan = 'premium'::public.therapist_plan then
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
      'access', jsonb_build_object(
        'status', 'capability_locked',
        'requiredPlan', 'premium_plus'
      )
    );
  end if;

  with completed as (
    select booking.patient_profile_id, booking.starts_at
    from public.bookings as booking
    where booking.therapist_profile_id = v_therapist.id
      and booking.status = 'completed'
      and booking.starts_at < v_current_end
  )
  select
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_current_start
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_previous_start
        and completed.starts_at < v_current_start
    ),
    count(*) filter (where completed.starts_at >= v_current_start),
    count(*) filter (
      where completed.starts_at >= v_previous_start
        and completed.starts_at < v_current_start
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_current_start
        and exists (
          select 1
          from completed as earlier
          where earlier.patient_profile_id = completed.patient_profile_id
            and earlier.starts_at < v_current_start
        )
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_previous_start
        and completed.starts_at < v_current_start
        and exists (
          select 1
          from completed as earlier
          where earlier.patient_profile_id = completed.patient_profile_id
            and earlier.starts_at < v_previous_start
        )
    )
    into
      v_current_people,
      v_previous_people,
      v_current_sessions,
      v_previous_sessions,
      v_current_returned,
      v_previous_returned
  from completed;

  select
    coalesce(sum(aggregate.favorites_added) filter (
      where aggregate.metric_date >= v_current_local_start
    ), 0),
    coalesce(sum(aggregate.favorites_added) filter (
      where aggregate.metric_date < v_current_local_start
    ), 0)
    into v_current_favorites, v_previous_favorites
  from public.therapist_metric_daily_aggregates as aggregate
  where aggregate.therapist_profile_id = v_therapist.id
    and aggregate.definition_version = 1
    and aggregate.metric_date >= v_previous_local_start
    and aggregate.metric_date < v_current_local_end;

  with booking_summary as (
    select
      booking.patient_profile_id,
      min(booking.starts_at) as first_completed_at,
      max(booking.starts_at) as last_completed_at,
      count(*)::bigint as completed_count
    from public.bookings as booking
    where booking.therapist_profile_id = v_therapist.id
      and booking.status = 'completed'
      and booking.starts_at < v_current_end
    group by booking.patient_profile_id
  ),
  patient_universe as (
    select
      coalesce(
        relationship.patient_profile_id,
        booking_summary.patient_profile_id
      ) as patient_profile_id,
      relationship.status as relationship_status,
      booking_summary.first_completed_at,
      booking_summary.last_completed_at,
      coalesce(booking_summary.completed_count, 0) as completed_count
    from public.therapist_patient_relationships as relationship
    full join booking_summary
      on booking_summary.patient_profile_id = relationship.patient_profile_id
      and relationship.therapist_profile_id = v_therapist.id
    where relationship.therapist_profile_id = v_therapist.id
      or relationship.therapist_profile_id is null
  ),
  segmented as (
    select case
      when relationship_status = 'paused' then 'paused'
      when relationship_status = 'closed'
        or last_completed_at < v_current_end - interval '90 days'
        then 'inactive'
      when first_completed_at >= v_current_end - interval '30 days'
        and completed_count = 1
        then 'new'
      when completed_count >= 2
        and last_completed_at >= v_current_end - interval '90 days'
        then 'recurring'
      else 'active'
    end as segment
    from patient_universe
  ),
  segment_counts as (
    select segment, count(*)::bigint as segment_count
    from segmented
    group by segment
  ),
  segment_counts_with_total as (
    select
      segment,
      segment_count,
      sum(segment_count) over () as total_count
    from segment_counts
  )
  select
    coalesce(sum(segment_count), 0),
    count(*) filter (
      where segment_count between 1 and 9
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', segment,
          'value', segment_count,
          'percentage', round(
            segment_count::numeric
              * 100 / nullif(total_count, 0),
            1
          )
        )
        order by case segment
          when 'active' then 1
          when 'recurring' then 2
          when 'new' then 3
          when 'inactive' then 4
          else 5
        end
      ),
      '[]'::jsonb
    )
    into v_segment_total, v_segment_small_groups, v_segment_items
  from segment_counts_with_total;

  with completed as (
    select
      booking.patient_profile_id,
      date_trunc(
        'month',
        booking.starts_at at time zone v_timezone
      )::date as session_month
    from public.bookings as booking
    where booking.therapist_profile_id = v_therapist.id
      and booking.status = 'completed'
      and booking.starts_at < (
        date_trunc(
          'month',
          v_current_local_end::timestamp
        )::date::timestamp at time zone v_timezone
      )
  ),
  cohort_members as (
    select
      patient_profile_id,
      min(session_month) as cohort_month
    from completed
    group by patient_profile_id
  ),
  cohort_sizes as (
    select cohort_month, count(*)::bigint as cohort_size
    from cohort_members
    where cohort_month >= (
      date_trunc('month', v_current_local_end::timestamp)::date
        - interval '6 months'
    )::date
    group by cohort_month
  ),
  eligible_cohorts as (
    select *
    from cohort_sizes
    where cohort_size >= 10
  ),
  cohort_retention_points as (
    select
      eligible.cohort_month,
      eligible.cohort_size,
      offsets.month_offset,
      round(
        count(distinct completed.patient_profile_id)::numeric
          * 100 / eligible.cohort_size,
        1
      ) as percentage
    from eligible_cohorts as eligible
    cross join generate_series(0, 5) as offsets(month_offset)
    left join cohort_members as member
      on member.cohort_month = eligible.cohort_month
    left join completed
      on completed.patient_profile_id = member.patient_profile_id
      and completed.session_month = (
        eligible.cohort_month
          + make_interval(months => offsets.month_offset)
      )::date
    where (
      eligible.cohort_month
        + make_interval(months => offsets.month_offset)
    )::date < date_trunc(
      'month',
      v_current_local_end::timestamp
    )::date
    group by
      eligible.cohort_month,
      eligible.cohort_size,
      offsets.month_offset
  ),
  cohort_rows as (
    select
      point.cohort_month,
      point.cohort_size,
      jsonb_agg(
        jsonb_build_object(
          'monthOffset', point.month_offset,
          'percentage', point.percentage
        )
        order by point.month_offset
      ) as retention
    from cohort_retention_points as point
    group by point.cohort_month, point.cohort_size
  )
  select
    coalesce(max(cohort_size), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cohortMonth', cohort_month,
          'cohortSize', cohort_size,
          'retention', retention
        )
        order by cohort_month
      ),
      '[]'::jsonb
    )
    into v_cohort_observed, v_cohort_items
  from cohort_rows;

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
    'access', jsonb_build_object(
      'status', 'ready',
      'requiredPlan', 'premium_plus'
    ),
    'summary', jsonb_build_object(
      'peopleReturned', public.therapist_metric_sampled_counter_by_sample_v1(
        v_current_returned,
        v_previous_returned,
        v_current_people,
        'therapist_metrics.people_returned',
        'people',
        10
      ),
      'returnRate', public.therapist_metric_rate_v1(
        v_current_returned,
        v_current_people,
        v_previous_returned,
        v_previous_people,
        'therapist_metrics.return_rate',
        10
      ),
      'sessionsPerPerson', public.therapist_metric_sampled_counter_by_sample_v1(
        round(
          v_current_sessions::numeric / nullif(v_current_people, 0),
          1
        ),
        round(
          v_previous_sessions::numeric / nullif(v_previous_people, 0),
          1
        ),
        v_current_people,
        'therapist_metrics.sessions_per_person',
        'ratio',
        10
      ),
      'profileFavorites', public.therapist_metric_sampled_counter_v1(
        v_current_favorites,
        v_previous_favorites,
        'therapist_metrics.profile_favorites',
        'favorites',
        10
      )
    ),
    'segments', jsonb_build_object(
      'status', case
        when v_segment_total = 0 then 'empty'
        when v_segment_total < 10 or v_segment_small_groups > 0
          then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_segment_total,
      'items', case
        when v_segment_total < 10 or v_segment_small_groups > 0
          then '[]'::jsonb
        else v_segment_items
      end,
      'definitionVersion', 1
    ),
    'baseEvolution', jsonb_build_object(
      'status', case
        when v_current_sessions = 0 then 'empty'
        when v_current_sessions < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_sessions,
      'items', case
        when v_current_sessions < 10 then '[]'::jsonb
        else (
          with first_sessions as (
            select
              booking.patient_profile_id,
              min(booking.starts_at) as first_completed_at
            from public.bookings as booking
            where booking.therapist_profile_id = v_therapist.id
              and booking.status = 'completed'
              and booking.starts_at < v_current_end
            group by booking.patient_profile_id
          )
          select jsonb_agg(
            jsonb_build_object(
              'date', point.bucket_start::date,
              'totalPeople', (
                select count(*)
                from first_sessions
                where first_completed_at < least(
                  point.bucket_start + interval '7 days',
                  v_current_end
                )
              ),
              'newPeople', (
                select count(*)
                from first_sessions
                where first_completed_at >= point.bucket_start
                  and first_completed_at < least(
                    point.bucket_start + interval '7 days',
                    v_current_end
                  )
              )
            )
            order by point.bucket_start
          )
          from generate_series(
            v_current_start,
            v_current_end - interval '1 day',
            interval '7 days'
          ) as point(bucket_start)
        )
      end
    ),
    'cohorts', jsonb_build_object(
      'status', case
        when v_cohort_observed = 0 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_cohort_observed,
      'items', v_cohort_items
    ),
    'therapyReturn', (
      with current_people as (
        select
          service.therapy_id,
          therapy.name as therapy_name,
          booking.patient_profile_id
        from public.bookings as booking
        join public.therapist_services as service
          on service.id = booking.service_id
        join public.therapies as therapy
          on therapy.id = service.therapy_id
        where booking.therapist_profile_id = v_therapist.id
          and booking.status = 'completed'
          and booking.starts_at >= v_current_start
          and booking.starts_at < v_current_end
        group by service.therapy_id, therapy.name, booking.patient_profile_id
      ),
      therapy_people as (
        select
          current_people.therapy_id,
          current_people.therapy_name,
          current_people.patient_profile_id,
          exists (
            select 1
            from public.bookings as earlier
            join public.therapist_services as earlier_service
              on earlier_service.id = earlier.service_id
            where earlier.therapist_profile_id = v_therapist.id
              and earlier.patient_profile_id =
                current_people.patient_profile_id
              and earlier_service.therapy_id = current_people.therapy_id
              and earlier.status = 'completed'
              and earlier.starts_at < v_current_start
          ) as returned
        from current_people
      ),
      therapy_counts as (
        select
          therapy_id,
          therapy_name,
          count(*)::bigint as people,
          count(*) filter (where returned)::bigint as returned_people
        from therapy_people
        group by therapy_id, therapy_name
      )
      select jsonb_build_object(
        'status', case
          when coalesce(sum(people), 0) = 0 then 'empty'
          when not exists (
            select 1 from therapy_counts where people >= 10
          ) then 'insufficient_sample'
          else 'ready'
        end,
        'minimumSample', 10,
        'observedSample', coalesce(max(people), 0),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'therapyId', therapy_id,
              'therapyName', therapy_name,
              'people', people,
              'returnedPeople', returned_people,
              'returnRate', round(
                returned_people::numeric * 100 / people,
                1
              )
            )
            order by
              returned_people::numeric / people desc,
              therapy_name
          )
          from therapy_counts
          where people >= 10
        ), '[]'::jsonb)
      )
      from therapy_counts
    ),
    'favoriteConversion', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'favorite_conversion_linkage_not_available'
    ),
    'sentiment', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'sentiment_schema_and_consent_not_implemented'
    ),
    'availabilityGap', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'availability_gap_event_not_implemented'
    ),
    'journeyThemes', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'free_text_analysis_prohibited'
    ),
    'exitReasons', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'relationship_exit_taxonomy_not_versioned'
    )
  );
end;
$$;

comment on function public.get_therapist_interest_metrics_v1(integer)
is 'MTR-5 private continuity read model for Premium Plus. Cohorts and segments are aggregate-only, use sample locks of ten and return no patient identifiers or free text.';

revoke all on function public.get_therapist_interest_metrics_v1(integer)
from public, anon;
grant execute on function public.get_therapist_interest_metrics_v1(integer)
to authenticated;
