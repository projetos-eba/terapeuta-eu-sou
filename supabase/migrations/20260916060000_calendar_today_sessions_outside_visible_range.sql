-- Keep the operational "Sessões de hoje" rail independent from the period
-- currently being inspected in the calendar grid.

alter function public.get_therapist_calendar_v1(date, text)
  rename to get_therapist_calendar_range_v1;

create function public.get_therapist_calendar_v1(
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
  v_now timestamptz := now();
  v_payload jsonb;
  v_timezone text;
  v_today_end timestamptz;
  v_today_start timestamptz;
begin
  v_payload := public.get_therapist_calendar_range_v1(
    p_anchor_date,
    p_view
  );
  v_timezone := v_payload ->> 'timezone';

  if v_timezone is null then
    raise exception 'calendar_timezone_not_found' using errcode = 'P0002';
  end if;

  v_today_start := (
    (v_now at time zone v_timezone)::date::timestamp at time zone v_timezone
  );
  v_today_end := v_today_start + interval '1 day';

  return v_payload || jsonb_build_object(
    'todayBookings', (
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
      where session_row."_therapistProfileId" =
          (v_payload ->> 'therapistProfileId')::uuid
        and session_row."startsAt" >= v_today_start
        and session_row."startsAt" < v_today_end
        and session_row."bookingStatus" = 'confirmed'
        and session_row."financialStatus" = 'paid'
    )
  );
end;
$$;

revoke all on function public.get_therapist_calendar_v1(date, text)
  from public, anon;
grant execute on function public.get_therapist_calendar_v1(date, text)
  to authenticated, service_role;

comment on function public.get_therapist_calendar_range_v1(date, text) is
  'Private internal range projection retained by get_therapist_calendar_v1. Do not call from application code.';

comment on function public.get_therapist_calendar_v1(date, text) is
  'Private therapist calendar. The grid follows the selected range; todayBookings always contains only today confirmed paid sessions in the therapist schedule timezone.';
