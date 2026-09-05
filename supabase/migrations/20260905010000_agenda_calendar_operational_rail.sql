-- Keep the Agenda context rail aligned with its operational meaning:
-- confirmed paid sessions today and pending reschedule requests only.

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
        select count(*)
        from public.booking_reschedule_requests as request
        join public.bookings as booking
          on booking.id = request.booking_id
        where booking.therapist_profile_id = v_therapist.id
          and request.status = 'pending'
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
        jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'starts_at', booking.starts_at,
            'kind', 'reschedule',
            'title', patient_profile.display_name,
            'description', 'Pediu reagendamento',
            'booking_id', booking.id
          )
          order by booking.starts_at, request.id
        ),
        '[]'::jsonb
      )
      from public.booking_reschedule_requests as request
      join public.bookings as booking
        on booking.id = request.booking_id
      join public.patient_profiles as patient_profile
        on patient_profile.id = booking.patient_profile_id
      where booking.therapist_profile_id = v_therapist.id
        and request.status = 'pending'
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

comment on function public.get_therapist_calendar_v1(date, text) is
  'Private therapist calendar. Its operational rail exposes only pending reschedule requests; confirmed paid sessions are selected client-side from bookings.';
