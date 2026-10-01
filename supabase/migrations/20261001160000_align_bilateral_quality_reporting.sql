begin;

-- A positive quality response is an explicit participant statement about the
-- attended attempt. It is deliberately independent from the longer-running
-- confirmation/payment lifecycle. Reporting may use two positive statements
-- as evidence of a realized session, but this function never writes a booking,
-- payment, ledger entry, confirmation or transfer.
create function public.is_session_realized_for_reporting_v1(
  p_booking_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_evidence jsonb;
  v_attempt_id uuid;
begin
  if not exists (
    select 1
    from public.bookings as booking
    where booking.id = p_booking_id
  ) then
    return false;
  end if;

  v_evidence := public.session_attempt_evidence_v1(p_booking_id);
  v_attempt_id := (v_evidence ->> 'sessionAttemptId')::uuid;

  -- A no-show, incident, or explicit negative quality answer must never be
  -- presented as a realized session.
  if v_evidence ->> 'classification' is not null
    or exists (
      select 1
      from public.session_quality_feedback as feedback
      where feedback.session_attempt_id = v_attempt_id
        and feedback.successful = false
    )
  then
    return false;
  end if;

  return coalesce((v_evidence ->> 'bothJoined')::boolean, false)
    and coalesce((v_evidence ->> 'sessionClosed')::boolean, false)
    and v_attempt_id is not null
    and exists (
      select 1
      from public.session_quality_feedback as feedback
      where feedback.session_attempt_id = v_attempt_id
        and feedback.author_role = 'patient'::public.user_role
        and feedback.successful = true
    )
    and exists (
      select 1
      from public.session_quality_feedback as feedback
      where feedback.session_attempt_id = v_attempt_id
        and feedback.author_role = 'therapist'::public.user_role
        and feedback.successful = true
    );
end;
$$;

revoke all on function public.is_session_realized_for_reporting_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_session_realized_for_reporting_v1(uuid)
  to service_role;

comment on function public.is_session_realized_for_reporting_v1(uuid) is
  'Read-only reporting predicate. A current attempt is realized only after both participants submit successful quality feedback. It never changes lifecycle or finance state.';

-- The therapist and patient history badges retain their existing copy and
-- presentation. Only their existing actorRealized input is made bilateral so a
-- single response (including a negative one) cannot create the green badge.
create or replace function public.get_session_attempt_attendance_batch_v1(
  p_booking_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scoped as (
    select
      booking.id as booking_id,
      case
        when patient.user_id = auth.uid() then 'patient'::public.user_role
        when therapist.user_id = auth.uid() then 'therapist'::public.user_role
      end as actor_role
    from public.bookings as booking
    join public.patient_profiles as patient
      on patient.id = booking.patient_profile_id
    join public.therapist_profiles as therapist
      on therapist.id = booking.therapist_profile_id
    where booking.id = any(coalesce(p_booking_ids, '{}'::uuid[]))
      and (patient.user_id = auth.uid() or therapist.user_id = auth.uid())
  ), attended as (
    select scoped.booking_id, scoped.actor_role,
      public.session_attempt_evidence_v1(scoped.booking_id) as evidence
    from scoped
  )
  select coalesce(
    jsonb_object_agg(
      attended.booking_id::text,
      attended.evidence || jsonb_build_object(
        'actorRealized',
        public.is_session_realized_for_reporting_v1(attended.booking_id)
      )
    ),
    '{}'::jsonb
  )
  from attended;
$$;

revoke all on function public.get_session_attempt_attendance_batch_v1(uuid[])
  from public, anon;
grant execute on function public.get_session_attempt_attendance_batch_v1(uuid[])
  to authenticated, service_role;

comment on function public.get_session_attempt_attendance_batch_v1(uuid[]) is
  'Participant-scoped current-attempt evidence. actorRealized is true only for the shared reporting realization predicate; badge copy remains a client concern.';

-- Internal aggregate source used only by security-definer reporting readers.
-- It keeps time filtering and the realized predicate together without exposing
-- booking or participant data to a browser role.
create function public.private_therapist_realized_reporting_rows_v1(
  p_therapist_profile_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table(
  booking_id uuid,
  patient_profile_id uuid,
  service_id uuid,
  starts_at timestamptz,
  service_duration_minutes_snapshot integer,
  booking_status public.booking_status,
  is_realized boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.id,
    booking.patient_profile_id,
    booking.service_id,
    booking.starts_at,
    booking.service_duration_minutes_snapshot,
    booking.status,
    public.is_session_realized_for_reporting_v1(booking.id)
  from public.bookings as booking
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.starts_at >= p_starts_at
    and booking.starts_at < p_ends_at;
$$;

revoke all on function public.private_therapist_realized_reporting_rows_v1(
  uuid, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.private_therapist_realized_reporting_rows_v1(
  uuid, timestamptz, timestamptz
) to service_role;

create function public.get_therapist_sessions_v3(
  p_limit integer default 20,
  p_cursor_starts_at timestamptz default null,
  p_cursor_booking_id uuid default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_booking_status public.booking_status default null,
  p_financial_status public.session_financial_status default null,
  p_patient_profile_id uuid default null,
  p_service_id uuid default null,
  p_modality text default null,
  p_include_future_terminal boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_profile_id uuid;
  v_completed integer := 0;
  v_confirmed integer := 0;
begin
  -- V2 remains the authorization, validation, filtering and pagination
  -- authority. V3 only aligns its summary count with the shared predicate.
  v_payload := public.get_therapist_sessions_v2(
    p_limit,
    p_cursor_starts_at,
    p_cursor_booking_id,
    p_period_start,
    p_period_end,
    p_booking_status,
    p_financial_status,
    p_patient_profile_id,
    p_service_id,
    p_modality,
    p_include_future_terminal
  );
  v_profile_id := (v_payload ->> 'therapistProfileId')::uuid;

  select
    count(*) filter (
      where public.is_session_realized_for_reporting_v1(session_row."bookingId")
    )::integer,
    count(*) filter (
      where session_row."bookingStatus" = 'confirmed'::public.booking_status
    )::integer
    into v_completed, v_confirmed
  from public.therapist_session_read_model_v1 as session_row
  where session_row."_therapistProfileId" = v_profile_id
    and (p_period_start is null or session_row."endsAt" > p_period_start)
    and (p_period_end is null or session_row."startsAt" < p_period_end)
    and (p_booking_status is null or session_row."bookingStatus" = p_booking_status)
    and (p_financial_status is null or session_row."financialStatus" = p_financial_status)
    and (p_patient_profile_id is null or session_row."patientProfileId" = p_patient_profile_id)
    and (p_service_id is null or session_row."serviceId" = p_service_id)
    and (p_modality is null or session_row.modality = 'online');

  return jsonb_set(
    v_payload,
    '{summary}',
    (v_payload -> 'summary') || jsonb_build_object(
      'completed', v_completed,
      'attendanceRate', case
        when v_confirmed > 0 then round(
          (v_completed::numeric / greatest(v_confirmed, v_completed)::numeric) * 100
        )::integer
        else null
      end
    ),
    true
  );
end;
$$;

revoke all on function public.get_therapist_sessions_v3(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  public.booking_status, public.session_financial_status, uuid, uuid, text,
  boolean
) from public, anon;
grant execute on function public.get_therapist_sessions_v3(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  public.booking_status, public.session_financial_status, uuid, uuid, text,
  boolean
) to authenticated;

comment on function public.get_therapist_sessions_v3(
  integer, timestamptz, uuid, timestamptz, timestamptz,
  public.booking_status, public.session_financial_status, uuid, uuid, text,
  boolean
) is
  'Therapist session reader V3. Preserves V2 list and filters, while its completed summary uses the bilateral quality reporting predicate.';

create function public.get_therapist_metrics_overview_v3(
  p_period_days integer default 30
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
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_current_local_start date;
  v_current_local_end date;
  v_current_people bigint := 0;
  v_previous_people bigint := 0;
  v_current_sessions bigint := 0;
  v_previous_sessions bigint := 0;
  v_current_minutes bigint := 0;
  v_previous_minutes bigint := 0;
  v_activity jsonb := '[]'::jsonb;
  v_ranking jsonb := '[]'::jsonb;
begin
  v_base := public.get_therapist_metrics_overview_v2(p_period_days);
  v_profile_id := (v_base #>> '{therapist,profileId}')::uuid;
  v_timezone := v_base #>> '{meta,timezone}';
  v_current_start := (v_base #>> '{meta,periodStart}')::timestamptz;
  v_current_end := (v_base #>> '{meta,periodEnd}')::timestamptz;
  v_previous_start := (v_base #>> '{meta,previousPeriodStart}')::timestamptz;
  v_current_local_start := (v_current_start at time zone v_timezone)::date;
  v_current_local_end := (v_current_end at time zone v_timezone)::date;

  select
    count(distinct row.patient_profile_id) filter (where row.starts_at >= v_current_start),
    count(distinct row.patient_profile_id) filter (where row.starts_at < v_current_start),
    count(*) filter (where row.starts_at >= v_current_start),
    count(*) filter (where row.starts_at < v_current_start),
    coalesce(sum(row.service_duration_minutes_snapshot) filter (
      where row.starts_at >= v_current_start
    ), 0),
    coalesce(sum(row.service_duration_minutes_snapshot) filter (
      where row.starts_at < v_current_start
    ), 0)
    into
      v_current_people,
      v_previous_people,
      v_current_sessions,
      v_previous_sessions,
      v_current_minutes,
      v_previous_minutes
  from public.private_therapist_realized_reporting_rows_v1(
    v_profile_id, v_previous_start, v_current_end
  ) as row
  where row.is_realized;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', day.metric_date::date,
      'sessionsCompleted', coalesce(completed.sessions, 0)
    ) order by day.metric_date
  ), '[]'::jsonb)
    into v_activity
  from generate_series(
    v_current_local_start,
    v_current_local_end - 1,
    interval '1 day'
  ) as day(metric_date)
  left join (
    select
      (row.starts_at at time zone v_timezone)::date as metric_date,
      count(*)::integer as sessions
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_current_start, v_current_end
    ) as row
    where row.is_realized
    group by 1
  ) as completed on completed.metric_date = day.metric_date::date;

  if v_current_sessions >= 10 then
    with current_counts as (
      select
        therapy.id,
        therapy.name,
        count(*)::bigint as current_count
      from public.private_therapist_realized_reporting_rows_v1(
        v_profile_id, v_current_start, v_current_end
      ) as row
      join public.therapist_services as service on service.id = row.service_id
      join public.therapies as therapy on therapy.id = service.therapy_id
      where row.is_realized
      group by therapy.id, therapy.name
    ), previous_counts as (
      select
        therapy.id,
        count(*)::bigint as previous_count
      from public.private_therapist_realized_reporting_rows_v1(
        v_profile_id, v_previous_start, v_current_start
      ) as row
      join public.therapist_services as service on service.id = row.service_id
      join public.therapies as therapy on therapy.id = service.therapy_id
      where row.is_realized
      group by therapy.id
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'therapyId', current_counts.id,
        'therapyName', current_counts.name,
        'counter', public.therapist_metric_counter_v1(
          current_counts.current_count,
          coalesce(previous_counts.previous_count, 0),
          'therapist_metrics.therapy_bookings',
          'sessions'
        )
      ) order by current_counts.current_count desc, current_counts.name
    ), '[]'::jsonb)
      into v_ranking
    from current_counts
    left join previous_counts on previous_counts.id = current_counts.id;
  end if;

  return jsonb_set(
    jsonb_set(
      jsonb_set(
        v_base || jsonb_build_object('contractVersion', 3, 'metricDefinitionVersion', 3),
        '{counters}',
        jsonb_build_object(
          'peopleServed', public.therapist_metric_counter_v1(
            v_current_people, v_previous_people,
            'therapist_metrics.people_served', 'people'
          ),
          'sessionsCompleted', public.therapist_metric_counter_v1(
            v_current_sessions, v_previous_sessions,
            'therapist_metrics.sessions_completed', 'sessions'
          ),
          'serviceMinutes', public.therapist_metric_counter_v1(
            v_current_minutes, v_previous_minutes,
            'therapist_metrics.service_minutes', 'minutes'
          )
        ),
        true
      ),
      '{activity}',
      jsonb_build_object(
        'status', case when v_current_sessions = 0 then 'empty' else 'ready' end,
        'freshThrough', v_current_end,
        'points', v_activity
      ),
      true
    ),
    '{therapyRanking}',
    jsonb_build_object(
      'status', case
        when v_current_sessions = 0 then 'empty'
        when v_current_sessions < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_sessions,
      'items', case when v_current_sessions < 10 then '[]'::jsonb else v_ranking end
    ),
    true
  );
end;
$$;

revoke all on function public.get_therapist_metrics_overview_v3(integer)
  from public, anon;
grant execute on function public.get_therapist_metrics_overview_v3(integer)
  to authenticated;

comment on function public.get_therapist_metrics_overview_v3(integer) is
  'MTR overview V3. Keeps V2 authorization, discovery and privacy behavior while realized-session counters, activity and therapy ranking use bilateral quality reporting.';

create function public.get_therapist_session_metrics_v3(
  p_period_days integer default 30
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
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_current_local_start date;
  v_current_local_end date;
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
  v_evolution jsonb := '[]'::jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_heatmap jsonb := '[]'::jsonb;
  v_presence_by_day jsonb := '[]'::jsonb;
  v_presence_by_hour jsonb := '[]'::jsonb;
  v_therapy_distribution jsonb := '[]'::jsonb;
begin
  v_base := public.get_therapist_session_metrics_v2(p_period_days);
  v_profile_id := (v_base #>> '{therapist,profileId}')::uuid;
  v_timezone := v_base #>> '{meta,timezone}';
  v_current_start := (v_base #>> '{meta,periodStart}')::timestamptz;
  v_current_end := (v_base #>> '{meta,periodEnd}')::timestamptz;
  v_previous_start := (v_base #>> '{meta,previousPeriodStart}')::timestamptz;
  v_current_local_start := (v_current_start at time zone v_timezone)::date;
  v_current_local_end := (v_current_end at time zone v_timezone)::date;

  select
    count(*) filter (where row.starts_at >= v_current_start and row.is_realized),
    count(*) filter (where row.starts_at < v_current_start and row.is_realized),
    count(*) filter (
      where row.starts_at >= v_current_start
        and row.booking_status in ('cancelled_by_patient', 'cancelled_by_therapist')
    ),
    count(*) filter (
      where row.starts_at < v_current_start
        and row.booking_status in ('cancelled_by_patient', 'cancelled_by_therapist')
    ),
    count(*) filter (
      where row.starts_at >= v_current_start
        and row.booking_status in ('no_show_patient', 'no_show_therapist')
    ),
    count(*) filter (
      where row.starts_at < v_current_start
        and row.booking_status in ('no_show_patient', 'no_show_therapist')
    ),
    coalesce(round(avg(row.service_duration_minutes_snapshot) filter (
      where row.starts_at >= v_current_start and row.is_realized
    )), 0),
    coalesce(round(avg(row.service_duration_minutes_snapshot) filter (
      where row.starts_at < v_current_start and row.is_realized
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
  from public.private_therapist_realized_reporting_rows_v1(
    v_profile_id, v_previous_start, v_current_end
  ) as row;

  select
    count(*) filter (where request.applied_at >= v_current_start),
    count(*) filter (where request.applied_at < v_current_start)
    into v_current_reschedules, v_previous_reschedules
  from public.booking_reschedule_requests as request
  join public.bookings as booking on booking.id = request.booking_id
  where booking.therapist_profile_id = v_profile_id
    and request.status = 'applied'
    and request.applied_at >= v_previous_start
    and request.applied_at < v_current_end;

  v_current_presence_sample := v_current_completed + v_current_no_shows;
  v_previous_presence_sample := v_previous_completed + v_previous_no_shows;
  v_current_outcome_sample :=
    v_current_completed + v_current_no_shows + v_current_cancelled;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', day.metric_date::date,
      'sessionsCompleted', coalesce(outcomes.completed_count, 0),
      'sessionsCancelled', coalesce(outcomes.cancelled_count, 0),
      'noShows', coalesce(outcomes.no_show_count, 0),
      'sessionsRescheduled', coalesce(reschedules.rescheduled_count, 0),
      'sessionsScheduled', coalesce(scheduled.scheduled_count, 0)
    ) order by day.metric_date
  ), '[]'::jsonb)
    into v_evolution
  from generate_series(
    v_current_local_start,
    v_current_local_end - 1,
    interval '1 day'
  ) as day(metric_date)
  left join (
    select
      (row.starts_at at time zone v_timezone)::date as metric_date,
      count(*) filter (where row.is_realized)::integer as completed_count,
      count(*) filter (
        where row.booking_status in ('cancelled_by_patient', 'cancelled_by_therapist')
      )::integer as cancelled_count,
      count(*) filter (
        where row.booking_status in ('no_show_patient', 'no_show_therapist')
      )::integer as no_show_count
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_current_start, v_current_end
    ) as row
    group by 1
  ) as outcomes on outcomes.metric_date = day.metric_date::date
  left join (
    select
      (request.applied_at at time zone v_timezone)::date as metric_date,
      count(*)::integer as rescheduled_count
    from public.booking_reschedule_requests as request
    join public.bookings as booking on booking.id = request.booking_id
    where booking.therapist_profile_id = v_profile_id
      and request.status = 'applied'
      and request.applied_at >= v_current_start
      and request.applied_at < v_current_end
    group by 1
  ) as reschedules on reschedules.metric_date = day.metric_date::date
  left join (
    select
      (booking.starts_at at time zone v_timezone)::date as metric_date,
      count(*)::integer as scheduled_count
    from public.bookings as booking
    where booking.therapist_profile_id = v_profile_id
      and booking.starts_at >= v_current_start
      and booking.starts_at < v_current_end
      and booking.status in (
        'confirmed', 'completed', 'cancelled_by_patient', 'cancelled_by_therapist',
        'cancelled_by_admin', 'cancelled_by_payment', 'no_show_patient',
        'no_show_therapist', 'no_show_both', 'refunded'
      )
    group by 1
  ) as scheduled on scheduled.metric_date = day.metric_date::date;

  if v_current_outcome_sample >= 10 then
    with outcome_keys(key, label, sort_order) as (
      values
        ('completed', 'Compareceram', 1),
        ('no_show_patient', 'Ausência da pessoa atendida', 2),
        ('no_show_therapist', 'Ausência do terapeuta', 3),
        ('cancelled_by_patient', 'Canceladas pela pessoa atendida', 4),
        ('cancelled_by_therapist', 'Canceladas pelo terapeuta', 5)
    ), outcome_counts as (
      select
        'completed'::text as key,
        count(*)::bigint as value
      from public.private_therapist_realized_reporting_rows_v1(
        v_profile_id, v_current_start, v_current_end
      ) as row
      where row.is_realized
      union all
      select row.booking_status::text, count(*)::bigint
      from public.private_therapist_realized_reporting_rows_v1(
        v_profile_id, v_current_start, v_current_end
      ) as row
      where row.booking_status in (
        'no_show_patient', 'no_show_therapist',
        'cancelled_by_patient', 'cancelled_by_therapist'
      )
      group by row.booking_status
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'key', outcome_keys.key,
        'label', outcome_keys.label,
        'value', coalesce(outcome_counts.value, 0),
        'percentage', round(
          coalesce(outcome_counts.value, 0)::numeric * 100 / v_current_outcome_sample,
          1
        )
      ) order by outcome_keys.sort_order
    ), '[]'::jsonb)
      into v_outcomes
    from outcome_keys
    left join outcome_counts using (key);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', heat.day_of_week,
      'hourBucketStart', heat.hour_bucket_start,
      'sessions', heat.sessions
    ) order by heat.day_of_week, heat.hour_bucket_start
  ), '[]'::jsonb)
    into v_heatmap
  from (
    select
      extract(isodow from row.starts_at at time zone v_timezone)::integer as day_of_week,
      (floor(extract(hour from row.starts_at at time zone v_timezone) / 2) * 2)::integer
        as hour_bucket_start,
      count(*)::integer as sessions
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_current_start, v_current_end
    ) as row
    where row.is_realized
    group by 1, 2
  ) as heat;

  with presence as (
    select
      extract(isodow from row.starts_at at time zone v_timezone)::integer as bucket,
      count(*) filter (where row.is_realized)::bigint as realized_count,
      count(*) filter (
        where row.is_realized
          or row.booking_status in ('no_show_patient', 'no_show_therapist')
      )::bigint as sample
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_current_start, v_current_end
    ) as row
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', bucket,
      'percentage', round(realized_count::numeric * 100 / sample, 1),
      'sample', sample
    ) order by realized_count::numeric / sample desc, bucket
  ), '[]'::jsonb)
    into v_presence_by_day
  from presence
  where sample >= 10;

  with presence as (
    select
      (floor(extract(hour from row.starts_at at time zone v_timezone) / 2) * 2)::integer
        as bucket,
      count(*) filter (where row.is_realized)::bigint as realized_count,
      count(*) filter (
        where row.is_realized
          or row.booking_status in ('no_show_patient', 'no_show_therapist')
      )::bigint as sample
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_current_start, v_current_end
    ) as row
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'hourBucketStart', bucket,
      'percentage', round(realized_count::numeric * 100 / sample, 1),
      'sample', sample
    ) order by realized_count::numeric / sample desc, bucket
  ), '[]'::jsonb)
    into v_presence_by_hour
  from presence
  where sample >= 10;

  if v_current_completed >= 10 then
    with therapy_counts as (
      select
        service.therapy_id,
        therapy.name as therapy_name,
        count(*)::integer as sessions
      from public.private_therapist_realized_reporting_rows_v1(
        v_profile_id, v_current_start, v_current_end
      ) as row
      join public.therapist_services as service on service.id = row.service_id
      join public.therapies as therapy on therapy.id = service.therapy_id
      where row.is_realized
      group by service.therapy_id, therapy.name
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'therapyId', therapy_id,
        'therapyName', therapy_name,
        'sessions', sessions,
        'percentage', round(sessions::numeric * 100 / v_current_completed, 1)
      ) order by sessions desc, therapy_name
    ), '[]'::jsonb)
      into v_therapy_distribution
    from therapy_counts;
  end if;

  return jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                v_base || jsonb_build_object('contractVersion', 3, 'metricDefinitionVersion', 3),
                '{summary}',
                (v_base -> 'summary') || jsonb_build_object(
                  'sessionsCompleted', public.therapist_metric_counter_v1(
                    v_current_completed, v_previous_completed,
                    'therapist_metrics.sessions_completed', 'sessions'
                  ),
                  'operationalPresence', public.therapist_metric_rate_v1(
                    v_current_completed, v_current_presence_sample,
                    v_previous_completed, v_previous_presence_sample,
                    'therapist_metrics.operational_presence', 10
                  ),
                  'reservedDurationAverage', public.therapist_metric_counter_v1(
                    v_current_average_minutes, v_previous_average_minutes,
                    'therapist_metrics.reserved_duration_average', 'minutes'
                  )
                ),
                true
              ),
              '{evolution}',
              jsonb_build_object(
                'status', case
                  when v_current_outcome_sample = 0 and v_current_reschedules = 0 then 'empty'
                  else 'ready'
                end,
                'points', v_evolution
              ),
              true
            ),
            '{outcomeDistribution}',
            jsonb_build_object(
              'status', case
                when v_current_outcome_sample = 0 then 'empty'
                when v_current_outcome_sample < 10 then 'insufficient_sample'
                else 'ready'
              end,
              'minimumSample', 10,
              'observedSample', v_current_outcome_sample,
              'items', case when v_current_outcome_sample < 10 then '[]'::jsonb else v_outcomes end
            ),
            true
          ),
          '{heatmap}',
          jsonb_build_object(
            'status', case when v_current_completed = 0 then 'empty' else 'ready' end,
            'observedSample', v_current_completed,
            'items', v_heatmap
          ),
          true
        ),
        '{presenceByDay}',
        jsonb_build_object(
          'status', case
            when v_current_presence_sample = 0 then 'empty'
            when jsonb_array_length(v_presence_by_day) = 0 then 'insufficient_sample'
            else 'ready'
          end,
          'minimumSample', 10,
          'observedSample', v_current_presence_sample,
          'items', v_presence_by_day
        ),
        true
      ),
      '{presenceByHour}',
      jsonb_build_object(
        'status', case
          when v_current_presence_sample = 0 then 'empty'
          when jsonb_array_length(v_presence_by_hour) = 0 then 'insufficient_sample'
          else 'ready'
        end,
        'minimumSample', 10,
        'observedSample', v_current_presence_sample,
        'items', v_presence_by_hour
      ),
      true
    ),
    '{therapyDistribution}',
    jsonb_build_object(
      'status', case
        when v_current_completed = 0 then 'empty'
        when v_current_completed < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_completed,
      'items', case when v_current_completed < 10 then '[]'::jsonb else v_therapy_distribution end
    ),
    true
  );
end;
$$;

revoke all on function public.get_therapist_session_metrics_v3(integer)
  from public, anon;
grant execute on function public.get_therapist_session_metrics_v3(integer)
  to authenticated;

comment on function public.get_therapist_session_metrics_v3(integer) is
  'MTR sessions V3. Keeps V2 scheduled series and privacy thresholds, while all realized-session aggregates use bilateral current-attempt quality feedback.';

create function public.get_therapist_session_evolution_comparison_v2(
  p_period_days integer default 30
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
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_current_local_start date;
  v_previous_local_start date;
  v_current_completed bigint := 0;
  v_previous_completed bigint := 0;
  v_points jsonb := '[]'::jsonb;
begin
  v_base := public.get_therapist_session_evolution_comparison_v1(p_period_days);
  v_profile_id := (v_base #>> '{therapist,profileId}')::uuid;
  v_timezone := v_base #>> '{meta,timezone}';
  v_current_start := (v_base #>> '{meta,periodStart}')::timestamptz;
  v_current_end := (v_base #>> '{meta,periodEnd}')::timestamptz;
  v_previous_start := (v_base #>> '{meta,previousPeriodStart}')::timestamptz;
  v_current_local_start := (v_current_start at time zone v_timezone)::date;
  v_previous_local_start := (v_previous_start at time zone v_timezone)::date;

  select
    count(*) filter (where row.starts_at >= v_current_start),
    count(*) filter (where row.starts_at < v_current_start)
    into v_current_completed, v_previous_completed
  from public.private_therapist_realized_reporting_rows_v1(
    v_profile_id, v_previous_start, v_current_end
  ) as row
  where row.is_realized;

  with realized_by_day as (
    select
      (row.starts_at at time zone v_timezone)::date as metric_date,
      count(*)::integer as completed_count
    from public.private_therapist_realized_reporting_rows_v1(
      v_profile_id, v_previous_start, v_current_end
    ) as row
    where row.is_realized
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'index', date_offset.value,
      'currentDate', v_current_local_start + date_offset.value,
      'previousDate', v_previous_local_start + date_offset.value,
      'current', coalesce(current_day.completed_count, 0),
      'previous', coalesce(previous_day.completed_count, 0)
    ) order by date_offset.value
  ), '[]'::jsonb)
    into v_points
  from generate_series(0, p_period_days - 1) as date_offset(value)
  left join realized_by_day as current_day
    on current_day.metric_date = v_current_local_start + date_offset.value
  left join realized_by_day as previous_day
    on previous_day.metric_date = v_previous_local_start + date_offset.value;

  return v_base || jsonb_build_object(
    'contractVersion', 2,
    'metricDefinitionVersion', 2,
    'status', case
      when v_current_completed = 0 and v_previous_completed = 0 then 'empty'
      else 'ready'
    end,
    'points', v_points
  );
end;
$$;

revoke all on function public.get_therapist_session_evolution_comparison_v2(integer)
  from public, anon;
grant execute on function public.get_therapist_session_evolution_comparison_v2(integer)
  to authenticated;

create function public.get_therapist_metrics_dashboard_v5(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dashboard jsonb;
  v_overview jsonb;
  v_sessions jsonb;
begin
  if p_period_days not in (30, 60) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_dashboard := public.get_therapist_metrics_dashboard_v4(p_period_days);
  v_overview := public.get_therapist_metrics_overview_v3(p_period_days);
  v_sessions := public.get_therapist_session_metrics_v3(p_period_days);

  return v_dashboard || jsonb_build_object(
    'contractVersion', 5,
    'metricDefinitionVersion', 5,
    'therapist', v_overview -> 'therapist',
    'meta', v_overview -> 'meta',
    'overview', v_overview,
    'sessions', v_sessions
  );
end;
$$;

revoke all on function public.get_therapist_metrics_dashboard_v5(integer)
  from public, anon;
grant execute on function public.get_therapist_metrics_dashboard_v5(integer)
  to authenticated;

comment on function public.get_therapist_metrics_dashboard_v5(integer) is
  'Authenticated therapist metrics dashboard V5. Retains V4 future agenda and composes V3 bilateral-quality realized-session reporting.';

create function public.get_private_therapist_financial_metrics_v3(
  p_period_start date default null,
  p_period_end date default null,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_completed_count integer := 0;
begin
  -- Monetary amounts, paid-session counts, ledger and payout state remain the
  -- V2 authority. Only the operational completed-sessions card is aligned.
  v_payload := public.get_private_therapist_financial_metrics_v2(
    p_period_start, p_period_end, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  select count(*)::integer
    into v_completed_count
  from public.private_therapist_realized_reporting_rows_v1(
    v_therapist.id, v_period.starts_at, v_period.ends_at
  ) as row
  where row.is_realized;

  return jsonb_set(
    v_payload || jsonb_build_object('contractVersion', 3, 'metricDefinitionVersion', 3),
    '{sessions}',
    (v_payload -> 'sessions') || jsonb_build_object(
      'completedCount', v_completed_count
    ),
    true
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_metrics_v3(
  date, date, text
) from public, anon;
grant execute on function public.get_private_therapist_financial_metrics_v3(
  date, date, text
) to authenticated;

comment on function public.get_private_therapist_financial_metrics_v3(date, date, text) is
  'Private F2 metrics V3. Preserves V2 monetary and payout semantics; only the operational completed-session count uses bilateral quality reporting.';

commit;
