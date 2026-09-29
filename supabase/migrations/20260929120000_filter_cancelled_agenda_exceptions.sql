-- Keep the agenda V1 response untouched for existing consumers. The schedule
-- sidebar needs only currently-effective exceptions, because cancellations are
-- intentionally retained for audit and the Blocks history.
create function public.get_therapist_agenda_v2(
  p_range_start timestamptz default null,
  p_range_end timestamptz default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_exceptions jsonb;
  v_profile_id uuid;
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_result jsonb;
begin
  v_result := public.get_therapist_agenda_v1(p_range_start, p_range_end);
  v_profile_id := (v_result ->> 'therapistProfileId')::uuid;
  v_range_start := (v_result #>> '{range,start}')::timestamptz;
  v_range_end := (v_result #>> '{range,end}')::timestamptz;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', exception.id,
        'serviceId', exception.service_id,
        'startsAt', exception.starts_at,
        'endsAt', exception.ends_at,
        'isAvailable', exception.is_available,
        'status', 'active'
      )
      order by exception.starts_at, exception.id
    ),
    '[]'::jsonb
  )
    into v_exceptions
  from public.availability_exceptions as exception
  where exception.therapist_profile_id = v_profile_id
    and coalesce(exception.status, 'active') = 'active'
    and exception.starts_at < v_range_end
    and exception.ends_at > v_range_start;

  return jsonb_set(
    v_result || jsonb_build_object('contractVersion', 2),
    '{availability,exceptions}',
    v_exceptions
  );
end;
$$;

revoke all on function public.get_therapist_agenda_v2(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.get_therapist_agenda_v2(timestamptz, timestamptz)
  to authenticated, service_role;

comment on function public.get_therapist_agenda_v2(timestamptz, timestamptz) is
  'Authenticated therapist agenda V2. Keeps V1 compatibility and returns only active availability exceptions.';
