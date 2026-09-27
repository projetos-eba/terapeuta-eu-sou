-- Full-base Admin sessions pagination.
--
-- This read-only contract intentionally bypasses the legacy 50-row operation
-- window only for Sessions. Other Admin modules keep their current contracts.

create or replace function public.admin_get_sessions_module_v1(
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_metrics jsonb := '{}'::jsonb;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_rows jsonb := '[]'::jsonb;
  v_search text := nullif(
    left(btrim(coalesce(p_query ->> 'search', '')), 120),
    ''
  );
  v_sort text := coalesce(
    nullif(btrim(coalesce(p_query ->> 'sort', '')), ''),
    'recent'
  );
  v_status text := nullif(
    left(btrim(coalesce(p_query ->> 'status', '')), 80),
    ''
  );
  v_total integer := 0;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  if v_page_text ~ '^[0-9]{1,9}$' then
    v_page := least(greatest(v_page_text::integer, 1), 1000000);
  end if;

  if v_page_size_text ~ '^[0-9]{1,3}$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  if v_sort not in ('recent', 'oldest', 'status', 'name') then
    v_sort := 'recent';
  end if;

  select jsonb_build_object(
    'total-sessions', count(*)::integer,
    'future-sessions', count(*) filter (
      where bookings.starts_at >= now()
    )::integer,
    'attention-sessions', count(*) filter (
      where bookings.status in (
        'pending_payment'::public.booking_status,
        'no_show_patient'::public.booking_status,
        'no_show_therapist'::public.booking_status,
        'refunded'::public.booking_status
      )
    )::integer
  )
  into v_metrics
  from public.bookings;

  with filtered_sessions as (
    select
      bookings.id,
      bookings.status,
      bookings.payment_status,
      bookings.starts_at,
      bookings.ends_at,
      bookings.timezone,
      bookings.service_title_snapshot,
      bookings.service_duration_minutes_snapshot,
      therapist_profiles.public_name as therapist_name,
      patient_profiles.display_name as patient_name,
      bookings.created_at,
      bookings.updated_at
    from public.bookings
    left join public.therapist_profiles
      on therapist_profiles.id = bookings.therapist_profile_id
    left join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    where (
        v_search is null
        or lower(concat_ws(
          ' ',
          bookings.id::text,
          bookings.status::text,
          bookings.payment_status::text,
          bookings.service_title_snapshot,
          therapist_profiles.public_name,
          patient_profiles.display_name
        )) like '%' || lower(v_search) || '%'
      )
      and (
        v_status is null
        or bookings.status::text = v_status
      )
  ),
  numbered_sessions as (
    select
      filtered_sessions.*,
      row_number() over (
        order by
          case
            when v_sort = 'name'
              then lower(coalesce(filtered_sessions.service_title_snapshot, ''))
          end asc nulls last,
          case
            when v_sort = 'name'
              then lower(coalesce(filtered_sessions.therapist_name, ''))
          end asc nulls last,
          case
            when v_sort = 'status'
              then filtered_sessions.status::text
          end asc nulls last,
          case
            when v_sort = 'oldest'
              then filtered_sessions.starts_at
          end asc nulls last,
          case
            when v_sort in ('recent', 'name', 'status')
              then filtered_sessions.starts_at
          end desc nulls last,
          filtered_sessions.id desc
      )::integer as row_number
    from filtered_sessions
  ),
  page_sessions as (
    select *
    from numbered_sessions
    where row_number > greatest((v_page - 1) * v_page_size, 0)
      and row_number <= greatest((v_page - 1) * v_page_size, 0) + v_page_size
  )
  select
    (select count(*)::integer from filtered_sessions),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_sessions.id,
          'status', page_sessions.status,
          'payment_status', page_sessions.payment_status,
          'starts_at', page_sessions.starts_at,
          'ends_at', page_sessions.ends_at,
          'timezone', page_sessions.timezone,
          'service_title_snapshot', page_sessions.service_title_snapshot,
          'service_duration_minutes_snapshot',
            page_sessions.service_duration_minutes_snapshot,
          'therapist_name', page_sessions.therapist_name,
          'patient_name', page_sessions.patient_name,
          'created_at', page_sessions.created_at,
          'updated_at', page_sessions.updated_at
        )
        order by page_sessions.row_number
      ),
      '[]'::jsonb
    )
  into v_total, v_rows
  from page_sessions;

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'search', v_search,
      'sort', v_sort,
      'status', v_status
    ),
    'generatedAt', now(),
    'metrics', v_metrics,
    'module', 'sessions',
    'page', jsonb_build_object(
      'hasNext', (v_page * v_page_size) < v_total,
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total
    ),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.admin_get_sessions_module_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_sessions_module_v1(jsonb)
  to authenticated, service_role;

comment on function public.admin_get_sessions_module_v1(jsonb) is
  'Read-only Admin sessions list over the full bookings base. Applies safe search, status, sort and pagination before returning the existing sanitized DTO.';
