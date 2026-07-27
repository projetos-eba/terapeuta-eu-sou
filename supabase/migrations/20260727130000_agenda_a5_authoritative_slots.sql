-- A5: authoritative service slots and therapist calendar read model.

alter table public.therapies
  add column if not exists calendar_color_key text not null default 'purple';

alter table public.therapies
  drop constraint if exists therapies_calendar_color_key_valid,
  add constraint therapies_calendar_color_key_valid check (
    calendar_color_key in (
      'purple',
      'green',
      'orange',
      'blue',
      'pink',
      'neutral'
    )
  );

comment on column public.therapies.calendar_color_key is
  'Stable semantic palette key shared by calendars, therapy pages and service views. Arbitrary CSS values are not stored.';

update public.therapies
set calendar_color_key = case
  when slug in ('reiki', 'thetahealing') then 'purple'
  when slug in ('aromaterapia', 'fitoterapia') then 'green'
  when slug in ('mesa-radionica', 'constelacao-familiar') then 'orange'
  when slug in ('mindfulness', 'meditacao') then 'blue'
  when slug in ('taro', 'tarologia') then 'pink'
  else 'neutral'
end;

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
    coalesce(booking_settings.max_days_ahead, 30),
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
      and (rule.service_id is null or rule.service_id = p_service_id)
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
      source_window.local_start
        + v_buffer_before * interval '1 minute',
      source_window.local_end
        - (v_duration + v_buffer_after) * interval '1 minute',
      v_step * interval '1 minute'
    ) as generated(local_starts_at)
    where source_window.local_start
      + v_buffer_before * interval '1 minute'
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
    -- Reject nonexistent local wall-clock instants at DST transitions.
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

create or replace function public.is_service_schedule_slot_v1(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reference_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_service_schedule_candidates_v1(
      p_service_id,
      p_starts_at - interval '1 minute',
      p_ends_at + interval '1 minute',
      p_reference_at,
      10
    ) as candidate
    where candidate.starts_at = p_starts_at
      and candidate.ends_at = p_ends_at
  );
$$;

create or replace function public.validate_booking_hold_schedule_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  -- Preserve the more specific A2 conflict errors. Existing triggers and the
  -- exclusion constraint remain authoritative for these overlapping cases.
  if exists (
    select 1
    from public.booking_holds as hold
    where hold.therapist_profile_id = new.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && new.occupied_during
  ) or exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    return new;
  end if;

  if not public.is_service_schedule_slot_v1(
      new.service_id,
      new.starts_at,
      new.ends_at,
      now()
    )
  then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_booking_hold_schedule
on public.booking_holds;
create trigger validate_booking_hold_schedule
before insert on public.booking_holds
for each row execute function public.validate_booking_hold_schedule_v1();

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
  v_now timestamptz := now();
  v_range_end timestamptz := coalesce(
    p_range_end,
    now() + interval '30 days'
  );
  v_range_start timestamptz := coalesce(p_range_start, now());
  v_service record;
begin
  if v_range_start >= v_range_end
    or v_range_end - v_range_start > interval '31 days'
    or p_limit not between 1 and 500
  then
    raise exception 'invalid_slot_range' using errcode = '22023';
  end if;

  select
    service.id,
    service.duration_minutes,
    service.title,
    therapy.calendar_color_key,
    therapy.id as therapy_id,
    therapy.name as therapy_name,
    schedule_settings.timezone,
    service.therapist_profile_id
  into v_service
  from public.therapist_services as service
  join public.therapies as therapy
    on therapy.id = service.therapy_id
  join public.therapist_profiles as therapist
    on therapist.id = service.therapist_profile_id
  join public.therapist_schedule_settings as schedule_settings
    on schedule_settings.therapist_profile_id = therapist.id
  where service.id = p_service_id
    and service.status = 'active'
    and therapy.status = 'published'
    and therapist.status = 'approved'
    and therapist.is_public
    and therapist.is_accepting_bookings;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'service', jsonb_build_object(
      'id', v_service.id,
      'title', v_service.title,
      'durationMinutes', v_service.duration_minutes,
      'therapyId', v_service.therapy_id,
      'therapyName', v_service.therapy_name,
      'colorKey', v_service.calendar_color_key
    ),
    'timezone', v_service.timezone,
    'range', jsonb_build_object(
      'start', v_range_start,
      'end', v_range_end,
      'endExclusive', true
    ),
    'slots', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'startsAt', candidate.starts_at,
            'endsAt', candidate.ends_at
          )
          order by candidate.starts_at
        ),
        '[]'::jsonb
      )
      from public.list_service_schedule_candidates_v1(
        p_service_id,
        v_range_start,
        v_range_end,
        v_now,
        p_limit
      ) as candidate
      where not exists (
        select 1
        from public.bookings as booking
        where booking.therapist_profile_id =
          v_service.therapist_profile_id
          and booking.status in ('draft', 'pending_payment', 'confirmed')
          and booking.occupied_during && candidate.occupied_during
      )
      and not exists (
        select 1
        from public.booking_holds as hold
        where hold.therapist_profile_id =
          v_service.therapist_profile_id
          and hold.status = 'active'
          and hold.expires_at > v_now
          and hold.occupied_during && candidate.occupied_during
      )
    )
  );
end;
$$;

create or replace function public.get_therapist_calendar_v1(
  p_anchor_date date default null,
  p_view text default 'week'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_anchor date;
  v_local_end date;
  v_local_start date;
  v_now timestamptz := now();
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
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

  if p_view not in ('day', 'week', 'month') then
    raise exception 'invalid_calendar_view' using errcode = '22023';
  end if;

  select schedule_settings.timezone
  into v_timezone
  from public.therapist_schedule_settings as schedule_settings
  where schedule_settings.therapist_profile_id = v_therapist.id;

  if not found then
    raise exception 'schedule_settings_not_found' using errcode = 'P0002';
  end if;

  v_anchor := coalesce(p_anchor_date, (v_now at time zone v_timezone)::date);

  if p_view = 'day' then
    v_local_start := v_anchor;
    v_local_end := v_anchor + 1;
  elsif p_view = 'week' then
    v_local_start := v_anchor
      - (extract(isodow from v_anchor)::integer - 1);
    v_local_end := v_local_start + 7;
  else
    v_local_start := date_trunc('month', v_anchor)::date;
    v_local_start := v_local_start
      - (extract(isodow from v_local_start)::integer - 1);
    v_local_end := v_local_start + 42;
  end if;

  v_range_start := v_local_start::timestamp at time zone v_timezone;
  v_range_end := v_local_end::timestamp at time zone v_timezone;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'timezone', v_timezone,
    'view', p_view,
    'anchorDate', v_anchor,
    'range', jsonb_build_object(
      'localStart', v_local_start,
      'localEndExclusive', v_local_end,
      'start', v_range_start,
      'end', v_range_end,
      'endExclusive', true
    ),
    'summary', jsonb_build_object(
      'bookings', (
        select count(*)
        from public.bookings as booking
        where booking.therapist_profile_id = v_therapist.id
          and booking.starts_at < v_range_end
          and booking.ends_at > v_range_start
      ),
      'activeHolds', (
        select count(*)
        from public.booking_holds as hold
        where hold.therapist_profile_id = v_therapist.id
          and hold.status = 'active'
          and hold.expires_at > v_now
          and hold.starts_at < v_range_end
          and hold.ends_at > v_range_start
      ),
      'pendingAttention', (
        select
          (
            select count(*)
            from public.booking_reschedule_requests as request
            join public.bookings as booking
              on booking.id = request.booking_id
            where booking.therapist_profile_id = v_therapist.id
              and request.status = 'pending'
          )
          + (
            select count(*)
            from public.availability_exception_booking_impacts as impact
            where impact.therapist_profile_id = v_therapist.id
              and impact.status = 'pending'
          )
      )
    ),
    'services', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'title', service.title,
            'therapyId', therapy.id,
            'therapyName', therapy.name,
            'colorKey', therapy.calendar_color_key,
            'durationMinutes', service.duration_minutes
          )
          order by service.title, service.id
        ),
        '[]'::jsonb
      )
      from public.therapist_services as service
      join public.therapies as therapy
        on therapy.id = service.therapy_id
      where service.therapist_profile_id = v_therapist.id
        and service.status <> 'archived'
    ),
    'bookings', (
      select coalesce(
        jsonb_agg(
          (
            to_jsonb(session_row)
            - '_therapistProfileId'
            - '_videoSessionReady'
          ) || jsonb_build_object(
            'therapyId', therapy.id,
            'therapyName', therapy.name,
            'colorKey', therapy.calendar_color_key,
            'zoomAccess',
            public.build_video_session_access_state_v1(
              session_row."bookingStatus",
              session_row."financialStatus",
              session_row."startsAt",
              session_row."endsAt",
              session_row."videoSessionStatus",
              session_row."_videoSessionReady",
              v_now
            )
          )
          order by session_row."startsAt", session_row."bookingId"
        ),
        '[]'::jsonb
      )
      from public.therapist_session_read_model_v1 as session_row
      join public.bookings as booking
        on booking.id = session_row."bookingId"
      join public.therapist_services as service
        on service.id = booking.service_id
      join public.therapies as therapy
        on therapy.id = service.therapy_id
      where session_row."_therapistProfileId" = v_therapist.id
        and session_row."startsAt" < v_range_end
        and session_row."endsAt" > v_range_start
    ),
    'holds', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', hold.id,
            'serviceId', hold.service_id,
            'serviceTitle', hold.service_title_snapshot,
            'startsAt', hold.starts_at,
            'endsAt', hold.ends_at,
            'expiresAt', hold.expires_at,
            'colorKey', therapy.calendar_color_key
          )
          order by hold.starts_at, hold.id
        ),
        '[]'::jsonb
      )
      from public.booking_holds as hold
      join public.therapist_services as service
        on service.id = hold.service_id
      join public.therapies as therapy
        on therapy.id = service.therapy_id
      where hold.therapist_profile_id = v_therapist.id
        and hold.status = 'active'
        and hold.expires_at > v_now
        and hold.starts_at < v_range_end
        and hold.ends_at > v_range_start
    ),
    'blocks', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', exception.id,
            'serviceId', exception.service_id,
            'startsAt', exception.starts_at,
            'endsAt', exception.ends_at,
            'allDay', exception.all_day,
            'reason', exception.reason,
            'reasonCode', exception.reason_code
          )
          order by exception.starts_at, exception.id
        ),
        '[]'::jsonb
      )
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = v_therapist.id
        and not exception.is_available
        and exception.status = 'active'
        and exception.starts_at < v_range_end
        and exception.ends_at > v_range_start
    ),
    'attentionItems', (
      select coalesce(
        jsonb_agg(item order by priority, starts_at, id),
        '[]'::jsonb
      )
      from (
        select
          request.id,
          1 as priority,
          booking.starts_at,
          'reschedule'::text as kind,
          patient_profile.display_name as title,
          'Pediu reagendamento'::text as description,
          booking.id as booking_id
        from public.booking_reschedule_requests as request
        join public.bookings as booking
          on booking.id = request.booking_id
        join public.patient_profiles as patient_profile
          on patient_profile.id = booking.patient_profile_id
        where booking.therapist_profile_id = v_therapist.id
          and request.status = 'pending'

        union all

        select
          impact.id,
          2 as priority,
          booking.starts_at,
          'block_impact'::text as kind,
          patient_profile.display_name as title,
          'Sessão afetada por bloqueio'::text as description,
          booking.id as booking_id
        from public.availability_exception_booking_impacts as impact
        join public.bookings as booking
          on booking.id = impact.booking_id
        join public.patient_profiles as patient_profile
          on patient_profile.id = booking.patient_profile_id
        where impact.therapist_profile_id = v_therapist.id
          and impact.status = 'pending'

        union all

        select
          booking.id,
          3 as priority,
          booking.starts_at,
          'pending_payment'::text as kind,
          patient_profile.display_name as title,
          'Pagamento pendente'::text as description,
          booking.id as booking_id
        from public.bookings as booking
        join public.patient_profiles as patient_profile
          on patient_profile.id = booking.patient_profile_id
        left join public.session_payments as payment
          on payment.booking_id = booking.id
        where booking.therapist_profile_id = v_therapist.id
          and booking.status = 'pending_payment'
          and coalesce(payment.financial_status::text, 'pending') <> 'paid'
      ) as item
    ),
    'demand', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'dayOfWeek', demand.day_of_week,
            'hourBlock', demand.hour_block,
            'count', demand.booking_count
          )
          order by demand.hour_block, demand.day_of_week
        ),
        '[]'::jsonb
      )
      from (
        select
          extract(
            dow from booking.starts_at at time zone v_timezone
          )::integer as day_of_week,
          (
            floor(
              extract(
                hour from booking.starts_at at time zone v_timezone
              ) / 2
            ) * 2
          )::integer as hour_block,
          count(*)::integer as booking_count
        from public.bookings as booking
        where booking.therapist_profile_id = v_therapist.id
          and booking.starts_at >= v_now - interval '90 days'
          and booking.starts_at < v_now
          and booking.status in (
            'completed',
            'no_show_patient',
            'no_show_therapist'
          )
        group by day_of_week, hour_block
      ) as demand
    )
  );
end;
$$;

revoke all on function public.list_service_schedule_candidates_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;
revoke all on function public.is_service_schedule_slot_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.validate_booking_hold_schedule_v1()
  from public, anon, authenticated;

revoke all on function public.get_service_available_slots_v1(
  uuid,
  timestamptz,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.get_service_available_slots_v1(
  uuid,
  timestamptz,
  timestamptz,
  integer
) to anon, authenticated, service_role;

revoke all on function public.get_therapist_calendar_v1(date, text)
  from public, anon, authenticated;
grant execute on function public.get_therapist_calendar_v1(date, text)
  to authenticated, service_role;

grant execute on function public.list_service_schedule_candidates_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  integer
) to service_role;
grant execute on function public.is_service_schedule_slot_v1(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz
) to service_role;

comment on function public.get_service_available_slots_v1(
  uuid,
  timestamptz,
  timestamptz,
  integer
) is
  'A5 public safe slot endpoint. Composes schedule rules, active exceptions, service settings, bookings and live holds without exposing participant data.';

comment on function public.get_therapist_calendar_v1(date, text) is
  'Private A5/A7-compatible therapist calendar read model. Identity is derived from auth.uid() and all intervals are projected from the canonical schedule timezone.';
