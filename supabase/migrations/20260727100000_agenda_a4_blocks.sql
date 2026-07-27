-- A4: therapist availability blocks, recurrence, impact review and audit.
-- Existing bookings are never cancelled or rescheduled by these commands.

create table if not exists public.availability_exception_series (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  service_id uuid references public.therapist_services (id) on delete cascade,
  timezone text not null,
  starts_on date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  recurrence_frequency text not null default 'none',
  recurrence_ends_on date not null,
  reason_code text not null,
  reason text,
  status text not null default 'active',
  version bigint not null default 1,
  created_by_user_id uuid not null
    references public.profiles (id) on delete restrict,
  cancelled_by_user_id uuid references public.profiles (id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exception_series_timezone_valid check (
    length(timezone) between 1 and 100
  ),
  constraint availability_exception_series_time_valid check (
    (all_day and start_time is null and end_time is null)
    or (
      not all_day
      and start_time is not null
      and end_time is not null
      and start_time < end_time
    )
  ),
  constraint availability_exception_series_recurrence_valid check (
    recurrence_frequency in ('none', 'daily', 'weekly')
    and recurrence_ends_on >= starts_on
    and (
      recurrence_frequency <> 'none'
      or recurrence_ends_on = starts_on
    )
  ),
  constraint availability_exception_series_reason_code_valid check (
    reason_code in (
      'personal',
      'vacation',
      'administrative',
      'training',
      'health',
      'other'
    )
  ),
  constraint availability_exception_series_reason_length check (
    reason is null or length(trim(reason)) between 1 and 240
  ),
  constraint availability_exception_series_status_valid check (
    status in ('active', 'cancelled')
  ),
  constraint availability_exception_series_version_positive check (
    version > 0
  )
);

alter table public.availability_exceptions
  add column if not exists series_id uuid
    references public.availability_exception_series (id) on delete cascade,
  add column if not exists occurrence_date date,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists all_day boolean not null default false,
  add column if not exists reason_code text not null default 'other',
  add column if not exists status text not null default 'active',
  add column if not exists version bigint not null default 1,
  add column if not exists created_by_user_id uuid
    references public.profiles (id) on delete restrict,
  add column if not exists cancelled_by_user_id uuid
    references public.profiles (id) on delete restrict,
  add column if not exists cancelled_at timestamptz;

alter table public.availability_exceptions
  drop constraint if exists availability_exceptions_reason_code_valid,
  add constraint availability_exceptions_reason_code_valid check (
    reason_code in (
      'personal',
      'vacation',
      'administrative',
      'training',
      'health',
      'other'
    )
  ),
  drop constraint if exists availability_exceptions_status_valid,
  add constraint availability_exceptions_status_valid check (
    status in ('active', 'cancelled')
  ),
  drop constraint if exists availability_exceptions_version_positive,
  add constraint availability_exceptions_version_positive check (version > 0);

update public.availability_exceptions as exception
set
  timezone = coalesce(
    (
      select settings.timezone
      from public.therapist_schedule_settings as settings
      where settings.therapist_profile_id = exception.therapist_profile_id
    ),
    exception.timezone
  ),
  occurrence_date = coalesce(
    exception.occurrence_date,
    (exception.starts_at at time zone exception.timezone)::date
  ),
  created_by_user_id = coalesce(
    exception.created_by_user_id,
    (
      select therapist.user_id
      from public.therapist_profiles as therapist
      where therapist.id = exception.therapist_profile_id
    )
  )
where exception.occurrence_date is null
   or exception.created_by_user_id is null;

create unique index if not exists availability_exceptions_series_occurrence_idx
  on public.availability_exceptions (series_id, occurrence_date)
  where series_id is not null;

create index if not exists availability_exceptions_active_range_idx
  on public.availability_exceptions (
    therapist_profile_id,
    starts_at,
    ends_at,
    id
  )
  where status = 'active' and not is_available;

create index if not exists availability_exception_series_profile_idx
  on public.availability_exception_series (
    therapist_profile_id,
    status,
    starts_on desc
  );

create table if not exists public.availability_exception_booking_impacts (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null
    references public.availability_exceptions (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  status text not null default 'pending',
  resolution text,
  resolved_by_user_id uuid references public.profiles (id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exception_impacts_unique unique (
    exception_id,
    booking_id
  ),
  constraint availability_exception_impacts_status_valid check (
    status in ('pending', 'resolved', 'dismissed')
  ),
  constraint availability_exception_impacts_resolution_valid check (
    resolution is null or resolution in ('keep_booking')
  )
);

create index if not exists availability_exception_impacts_profile_status_idx
  on public.availability_exception_booking_impacts (
    therapist_profile_id,
    status,
    created_at desc
  );

create table if not exists public.availability_exception_events (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  series_id uuid references public.availability_exception_series (id)
    on delete set null,
  exception_id uuid references public.availability_exceptions (id)
    on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  event_type text not null,
  request_id uuid not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint availability_exception_events_type_valid check (
    event_type in (
      'block_created',
      'block_cancelled',
      'block_series_cancelled',
      'block_impact_resolved'
    )
  ),
  constraint availability_exception_events_request_unique unique (
    therapist_profile_id,
    request_id
  )
);

create index if not exists availability_exception_events_profile_created_idx
  on public.availability_exception_events (
    therapist_profile_id,
    created_at desc
  );

drop trigger if exists set_availability_exception_series_updated_at
on public.availability_exception_series;
create trigger set_availability_exception_series_updated_at
before update on public.availability_exception_series
for each row execute function public.set_updated_at();

drop trigger if exists set_availability_exception_impacts_updated_at
on public.availability_exception_booking_impacts;
create trigger set_availability_exception_impacts_updated_at
before update on public.availability_exception_booking_impacts
for each row execute function public.set_updated_at();

create or replace function public.validate_availability_exception_series_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_valid_timezone_v1(new.timezone) then
    raise exception 'invalid_block_timezone' using errcode = '22023';
  end if;

  if new.recurrence_ends_on > new.starts_on + 366 then
    raise exception 'block_recurrence_too_long' using errcode = '22023';
  end if;

  if new.service_id is not null
    and not exists (
      select 1
      from public.therapist_services as service
      where service.id = new.service_id
        and service.therapist_profile_id = new.therapist_profile_id
    ) then
    raise exception 'block_service_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_availability_exception_series
on public.availability_exception_series;
create trigger validate_availability_exception_series
before insert or update
on public.availability_exception_series
for each row execute function public.validate_availability_exception_series_v1();

alter table public.availability_exception_series enable row level security;
alter table public.availability_exception_booking_impacts enable row level security;
alter table public.availability_exception_events enable row level security;

grant select on public.availability_exception_series
  to authenticated, service_role;
grant select on public.availability_exception_booking_impacts
  to authenticated, service_role;
grant select on public.availability_exception_events
  to authenticated, service_role;
grant select on public.availability_exceptions to service_role;

drop policy if exists "Therapists can read own block series"
on public.availability_exception_series;
create policy "Therapists can read own block series"
on public.availability_exception_series
for select to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own block impacts"
on public.availability_exception_booking_impacts;
create policy "Therapists can read own block impacts"
on public.availability_exception_booking_impacts
for select to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

drop policy if exists "Therapists can read own block events"
on public.availability_exception_events;
create policy "Therapists can read own block events"
on public.availability_exception_events
for select to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

create or replace function public.get_therapist_blocks_v1(
  p_range_start timestamptz default null,
  p_range_end timestamptz default null,
  p_status text default 'active',
  p_reason_code text default null,
  p_search text default null,
  p_limit integer default 20,
  p_cursor_starts_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_range_end timestamptz := coalesce(p_range_end, now() + interval '1 year');
  v_range_start timestamptz := coalesce(p_range_start, now() - interval '90 days');
  v_settings public.therapist_schedule_settings%rowtype;
  v_therapist public.therapist_profiles%rowtype;
begin
  if v_range_start >= v_range_end then
    raise exception 'invalid_block_range' using errcode = '22023';
  end if;

  if p_status not in ('active', 'cancelled', 'all') then
    raise exception 'invalid_block_filter' using errcode = '22023';
  end if;

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

  select settings.*
    into v_settings
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'scheduleVersion', v_settings.version,
    'timezone', v_settings.timezone,
    'summary', jsonb_build_object(
      'activeBlocks', (
        select count(*)
        from public.availability_exceptions as exception
        where exception.therapist_profile_id = v_therapist.id
          and exception.status = 'active'
          and not exception.is_available
          and exception.starts_at < v_range_end
          and exception.ends_at > v_range_start
      ),
      'recurringSeries', (
        select count(*)
        from public.availability_exception_series as series
        where series.therapist_profile_id = v_therapist.id
          and series.status = 'active'
          and series.recurrence_frequency <> 'none'
      ),
      'pendingImpacts', (
        select count(*)
        from public.availability_exception_booking_impacts as impact
        where impact.therapist_profile_id = v_therapist.id
          and impact.status = 'pending'
      )
    ),
    'blocks', (
      select coalesce(
        jsonb_agg(block_row.payload order by block_row.starts_at, block_row.id),
        '[]'::jsonb
      )
      from (
        select
          exception.id,
          exception.starts_at,
          jsonb_build_object(
            'id', exception.id,
            'seriesId', exception.series_id,
            'serviceId', exception.service_id,
            'serviceTitle', service.title,
            'startsAt', exception.starts_at,
            'endsAt', exception.ends_at,
            'timezone', exception.timezone,
            'allDay', exception.all_day,
            'reasonCode', exception.reason_code,
            'reason', exception.reason,
            'status', exception.status,
            'version', exception.version,
            'recurrenceFrequency',
              coalesce(series.recurrence_frequency, 'none'),
            'recurrenceEndsOn', series.recurrence_ends_on,
            'createdAt', exception.created_at,
            'impactedBookings', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'impactId', impact.id,
                    'bookingId', booking.id,
                    'startsAt', booking.starts_at,
                    'serviceTitle',
                      coalesce(booking.service_title_snapshot, booking_service.title),
                    'patientName', patient.display_name,
                    'status', impact.status,
                    'resolution', impact.resolution
                  )
                  order by booking.starts_at
                ),
                '[]'::jsonb
              )
              from public.availability_exception_booking_impacts as impact
              join public.bookings as booking on booking.id = impact.booking_id
              join public.patient_profiles as patient
                on patient.id = booking.patient_profile_id
              join public.therapist_services as booking_service
                on booking_service.id = booking.service_id
              where impact.exception_id = exception.id
            )
          ) as payload
        from public.availability_exceptions as exception
        left join public.availability_exception_series as series
          on series.id = exception.series_id
        left join public.therapist_services as service
          on service.id = exception.service_id
        where exception.therapist_profile_id = v_therapist.id
          and not exception.is_available
          and exception.starts_at < v_range_end
          and exception.ends_at > v_range_start
          and (p_status = 'all' or exception.status = p_status)
          and (
            p_reason_code is null
            or exception.reason_code = p_reason_code
          )
          and (
            nullif(trim(coalesce(p_search, '')), '') is null
            or coalesce(exception.reason, '') ilike
              '%' || trim(p_search) || '%'
            or coalesce(service.title, '') ilike
              '%' || trim(p_search) || '%'
          )
          and (
            p_cursor_starts_at is null
            or (exception.starts_at, exception.id) > (
              p_cursor_starts_at,
              coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000')
            )
          )
        order by exception.starts_at, exception.id
        limit v_limit
      ) as block_row
    ),
    'nextCursor', (
      select case
        when count(*) = v_limit then jsonb_build_object(
          'startsAt', max(page.starts_at),
          'id', (
            select page_last.id
            from (
              select exception.id, exception.starts_at
              from public.availability_exceptions as exception
              where exception.therapist_profile_id = v_therapist.id
                and not exception.is_available
                and exception.starts_at < v_range_end
                and exception.ends_at > v_range_start
                and (p_status = 'all' or exception.status = p_status)
                and (
                  p_reason_code is null
                  or exception.reason_code = p_reason_code
                )
                and (
                  p_cursor_starts_at is null
                  or (exception.starts_at, exception.id) > (
                    p_cursor_starts_at,
                    coalesce(
                      p_cursor_id,
                      '00000000-0000-0000-0000-000000000000'
                    )
                  )
                )
              order by exception.starts_at, exception.id
              limit v_limit
            ) as page_last
            order by page_last.starts_at desc, page_last.id desc
            limit 1
          )
        )
        else null
      end
      from (
        select exception.starts_at
        from public.availability_exceptions as exception
        where exception.therapist_profile_id = v_therapist.id
          and not exception.is_available
          and exception.starts_at < v_range_end
          and exception.ends_at > v_range_start
          and (p_status = 'all' or exception.status = p_status)
          and (
            p_reason_code is null
            or exception.reason_code = p_reason_code
          )
          and (
            p_cursor_starts_at is null
            or (exception.starts_at, exception.id) > (
              p_cursor_starts_at,
              coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000')
            )
          )
        order by exception.starts_at, exception.id
        limit v_limit
      ) as page
    )
  );
end;
$$;

create or replace function public.create_therapist_block_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_timezone text,
  p_starts_on date,
  p_start_time time,
  p_end_time time,
  p_all_day boolean,
  p_recurrence_frequency text,
  p_recurrence_ends_on date,
  p_service_id uuid,
  p_reason_code text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_end_at timestamptz;
  v_existing public.availability_exception_events%rowtype;
  v_frequency text := coalesce(p_recurrence_frequency, 'none');
  v_impacted_count integer := 0;
  v_occurrence_count integer := 0;
  v_occurrence_date date;
  v_series public.availability_exception_series%rowtype;
  v_settings public.therapist_schedule_settings%rowtype;
  v_start_at timestamptz;
  v_step interval;
  v_therapist public.therapist_profiles%rowtype;
  v_result jsonb;
begin
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found or v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_therapist.id::text, 0)
  );

  select event.*
    into v_existing
  from public.availability_exception_events as event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id;

  if found then
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if not public.is_valid_timezone_v1(p_timezone) then
    raise exception 'invalid_block_timezone' using errcode = '22023';
  end if;

  if p_starts_on is null
    or p_recurrence_ends_on is null
    or p_recurrence_ends_on < p_starts_on
    or p_recurrence_ends_on > p_starts_on + 366
    or v_frequency not in ('none', 'daily', 'weekly')
    or (v_frequency = 'none' and p_recurrence_ends_on <> p_starts_on)
    or (
      not coalesce(p_all_day, false)
      and (
        p_start_time is null
        or p_end_time is null
        or p_start_time >= p_end_time
      )
    )
    or p_reason_code not in (
      'personal',
      'vacation',
      'administrative',
      'training',
      'health',
      'other'
    )
    or length(trim(coalesce(p_reason, ''))) > 240 then
    raise exception 'invalid_block_payload' using errcode = '22023';
  end if;

  if p_service_id is not null
    and not exists (
      select 1
      from public.therapist_services as service
      where service.id = p_service_id
        and service.therapist_profile_id = v_therapist.id
    ) then
    raise exception 'block_service_forbidden' using errcode = '42501';
  end if;

  select settings.*
    into v_settings
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id
  for update;

  insert into public.availability_exception_series (
    therapist_profile_id,
    service_id,
    timezone,
    starts_on,
    start_time,
    end_time,
    all_day,
    recurrence_frequency,
    recurrence_ends_on,
    reason_code,
    reason,
    created_by_user_id
  )
  values (
    v_therapist.id,
    p_service_id,
    p_timezone,
    p_starts_on,
    case when p_all_day then null else p_start_time end,
    case when p_all_day then null else p_end_time end,
    coalesce(p_all_day, false),
    v_frequency,
    p_recurrence_ends_on,
    p_reason_code,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_actor_user_id
  )
  returning * into v_series;

  v_step := case
    when v_frequency = 'daily' then interval '1 day'
    when v_frequency = 'weekly' then interval '7 days'
    else interval '1 day'
  end;

  for v_occurrence_date in
    select generated_at::date
    from pg_catalog.generate_series(
      p_starts_on::timestamp,
      p_recurrence_ends_on::timestamp,
      v_step
    ) as generated_at
    limit 90
  loop
    v_occurrence_count := v_occurrence_count + 1;

    if p_all_day then
      v_start_at := v_occurrence_date::timestamp at time zone p_timezone;
      v_end_at := (v_occurrence_date + 1)::timestamp at time zone p_timezone;
    else
      v_start_at := (
        v_occurrence_date::timestamp + p_start_time
      ) at time zone p_timezone;
      v_end_at := (
        v_occurrence_date::timestamp + p_end_time
      ) at time zone p_timezone;
    end if;

    with inserted_exception as (
      insert into public.availability_exceptions (
        therapist_profile_id,
        service_id,
        starts_at,
        ends_at,
        is_available,
        reason,
        series_id,
        occurrence_date,
        timezone,
        all_day,
        reason_code,
        status,
        created_by_user_id
      )
      values (
        v_therapist.id,
        p_service_id,
        v_start_at,
        v_end_at,
        false,
        nullif(trim(coalesce(p_reason, '')), ''),
        v_series.id,
        v_occurrence_date,
        p_timezone,
        coalesce(p_all_day, false),
        p_reason_code,
        'active',
        p_actor_user_id
      )
      returning id, starts_at, ends_at
    ),
    inserted_impacts as (
      insert into public.availability_exception_booking_impacts (
        exception_id,
        booking_id,
        therapist_profile_id
      )
      select
        exception.id,
        booking.id,
        v_therapist.id
      from inserted_exception as exception
      join public.bookings as booking
        on booking.therapist_profile_id = v_therapist.id
       and booking.status in ('draft', 'pending_payment', 'confirmed')
       and booking.starts_at < exception.ends_at
       and booking.ends_at > exception.starts_at
       and (
         p_service_id is null
         or booking.service_id = p_service_id
       )
      on conflict (exception_id, booking_id) do nothing
      returning id
    )
    select count(*) into v_impacted_count
    from inserted_impacts;

    v_impacted_count := (
      select count(*)
      from public.availability_exception_booking_impacts as impact
      join public.availability_exceptions as exception
        on exception.id = impact.exception_id
      where exception.series_id = v_series.id
    );
  end loop;

  if v_frequency = 'daily'
    and (p_recurrence_ends_on - p_starts_on + 1) > 90 then
    raise exception 'block_recurrence_too_long' using errcode = '22023';
  end if;

  update public.therapist_schedule_settings
  set version = version + 1
  where therapist_profile_id = v_therapist.id
  returning * into v_settings;

  v_result := jsonb_build_object(
    'seriesId', v_series.id,
    'scheduleVersion', v_settings.version,
    'occurrenceCount', v_occurrence_count,
    'impactedBookingCount', v_impacted_count,
    'idempotentReplay', false
  );

  insert into public.availability_exception_events (
    therapist_profile_id,
    actor_user_id,
    series_id,
    event_type,
    request_id,
    result
  )
  values (
    v_therapist.id,
    p_actor_user_id,
    v_series.id,
    'block_created',
    p_request_id,
    v_result
  );

  if v_impacted_count > 0 then
    insert into public.notifications (
      profile_id,
      kind,
      title,
      body,
      href
    )
    values (
      p_actor_user_id,
      'schedule_block_impact',
      'Bloqueio com sessões impactadas',
      format(
        '%s sessão(ões) existente(s) precisam da sua revisão.',
        v_impacted_count
      ),
      '/terapeuta/agenda?aba=bloqueios'
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.cancel_therapist_block_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_block_id uuid,
  p_scope text,
  p_expected_schedule_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block public.availability_exceptions%rowtype;
  v_cancelled_count integer;
  v_existing public.availability_exception_events%rowtype;
  v_result jsonb;
  v_settings public.therapist_schedule_settings%rowtype;
  v_therapist public.therapist_profiles%rowtype;
begin
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found or v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_therapist.id::text, 0)
  );

  select event.*
    into v_existing
  from public.availability_exception_events as event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id;

  if found then
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_scope not in ('occurrence', 'series') then
    raise exception 'invalid_block_scope' using errcode = '22023';
  end if;

  select exception.*
    into v_block
  from public.availability_exceptions as exception
  where exception.id = p_block_id
    and exception.therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'block_not_found' using errcode = 'P0002';
  end if;

  select settings.*
    into v_settings
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id
  for update;

  if v_settings.version <> p_expected_schedule_version then
    raise exception 'schedule_version_conflict' using errcode = '40001';
  end if;

  update public.availability_exceptions as exception
  set
    status = 'cancelled',
    version = exception.version + 1,
    cancelled_by_user_id = p_actor_user_id,
    cancelled_at = now()
  where exception.therapist_profile_id = v_therapist.id
    and exception.status = 'active'
    and (
      (p_scope = 'occurrence' and exception.id = v_block.id)
      or (
        p_scope = 'series'
        and v_block.series_id is not null
        and exception.series_id = v_block.series_id
      )
    );

  get diagnostics v_cancelled_count = row_count;

  update public.availability_exception_booking_impacts as impact
  set status = 'dismissed'
  where impact.status = 'pending'
    and exists (
      select 1
      from public.availability_exceptions as exception
      where exception.id = impact.exception_id
        and exception.therapist_profile_id = v_therapist.id
        and exception.status = 'cancelled'
        and (
          exception.id = v_block.id
          or (
            p_scope = 'series'
            and exception.series_id = v_block.series_id
          )
        )
    );

  if p_scope = 'series' and v_block.series_id is not null then
    update public.availability_exception_series
    set
      status = 'cancelled',
      version = version + 1,
      cancelled_by_user_id = p_actor_user_id,
      cancelled_at = now()
    where id = v_block.series_id;
  end if;

  update public.therapist_schedule_settings
  set version = version + 1
  where therapist_profile_id = v_therapist.id
  returning * into v_settings;

  v_result := jsonb_build_object(
    'cancelledCount', v_cancelled_count,
    'scheduleVersion', v_settings.version,
    'idempotentReplay', false
  );

  insert into public.availability_exception_events (
    therapist_profile_id,
    actor_user_id,
    series_id,
    exception_id,
    event_type,
    request_id,
    result
  )
  values (
    v_therapist.id,
    p_actor_user_id,
    v_block.series_id,
    v_block.id,
    case
      when p_scope = 'series' then 'block_series_cancelled'
      else 'block_cancelled'
    end,
    p_request_id,
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.resolve_therapist_block_impact_v1(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_impact_id uuid,
  p_resolution text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.availability_exception_events%rowtype;
  v_impact public.availability_exception_booking_impacts%rowtype;
  v_result jsonb;
  v_therapist public.therapist_profiles%rowtype;
begin
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found or v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_therapist.id::text, 0)
  );

  select event.*
    into v_existing
  from public.availability_exception_events as event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id;

  if found then
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_resolution <> 'keep_booking' then
    raise exception 'invalid_block_impact_resolution' using errcode = '22023';
  end if;

  select impact.*
    into v_impact
  from public.availability_exception_booking_impacts as impact
  where impact.id = p_impact_id
    and impact.therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'block_impact_not_found' using errcode = 'P0002';
  end if;

  if v_impact.status = 'pending' then
    update public.availability_exception_booking_impacts
    set
      status = 'resolved',
      resolution = p_resolution,
      resolved_by_user_id = p_actor_user_id,
      resolved_at = now()
    where id = v_impact.id
    returning * into v_impact;
  end if;

  v_result := jsonb_build_object(
    'impactId', v_impact.id,
    'status', v_impact.status,
    'resolution', v_impact.resolution,
    'idempotentReplay', false
  );

  insert into public.availability_exception_events (
    therapist_profile_id,
    actor_user_id,
    exception_id,
    booking_id,
    event_type,
    request_id,
    result
  )
  values (
    v_therapist.id,
    p_actor_user_id,
    v_impact.exception_id,
    v_impact.booking_id,
    'block_impact_resolved',
    p_request_id,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.get_therapist_blocks_v1(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer,
  timestamptz,
  uuid
) from public, anon;
grant execute on function public.get_therapist_blocks_v1(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer,
  timestamptz,
  uuid
) to authenticated, service_role;

revoke all on function public.create_therapist_block_v1(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_therapist_block_v1(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) to service_role;

revoke all on function public.cancel_therapist_block_v1(
  uuid,
  uuid,
  uuid,
  text,
  bigint
) from public, anon, authenticated;
grant execute on function public.cancel_therapist_block_v1(
  uuid,
  uuid,
  uuid,
  text,
  bigint
) to service_role;

revoke all on function public.resolve_therapist_block_impact_v1(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.resolve_therapist_block_impact_v1(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

comment on function public.get_therapist_blocks_v1(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  integer,
  timestamptz,
  uuid
) is
  'A4 authenticated therapist block read model. Identity derives from auth.uid().';

comment on function public.create_therapist_block_v1(
  uuid,
  uuid,
  text,
  date,
  time,
  time,
  boolean,
  text,
  date,
  uuid,
  text,
  text
) is
  'A4 service-role command that materializes timezone-safe block occurrences and records booking impacts without changing bookings.';
