-- A3.1: canonical therapist schedule settings, read model and atomic command.

create table if not exists public.therapist_schedule_settings (
  therapist_profile_id uuid primary key
    references public.therapist_profiles (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_schedule_settings_version_positive check (version > 0)
);

create table if not exists public.therapist_schedule_events (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null,
  request_id uuid not null,
  previous_version bigint not null,
  resulting_version bigint not null,
  timezone text not null,
  rule_count integer not null,
  service_settings_count integer not null,
  created_at timestamptz not null default now(),
  constraint therapist_schedule_events_type_check check (
    event_type in ('schedule_saved')
  ),
  constraint therapist_schedule_events_versions_check check (
    previous_version > 0 and resulting_version > previous_version
  ),
  constraint therapist_schedule_events_counts_check check (
    rule_count >= 0 and service_settings_count >= 0
  ),
  unique (therapist_profile_id, request_id)
);

create index if not exists therapist_schedule_events_profile_created_idx
  on public.therapist_schedule_events (therapist_profile_id, created_at desc);

create or replace function public.is_valid_timezone_v1(p_timezone text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone_name
    where timezone_name.name = p_timezone
  );
$$;

create or replace function public.validate_therapist_schedule_timezone_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_valid_timezone_v1(new.timezone) then
    raise exception 'invalid_schedule_timezone' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_therapist_schedule_timezone
on public.therapist_schedule_settings;
create trigger validate_therapist_schedule_timezone
before insert or update of timezone
on public.therapist_schedule_settings
for each row execute function public.validate_therapist_schedule_timezone_v1();

drop trigger if exists set_therapist_schedule_settings_updated_at
on public.therapist_schedule_settings;
create trigger set_therapist_schedule_settings_updated_at
before update on public.therapist_schedule_settings
for each row execute function public.set_updated_at();

insert into public.therapist_schedule_settings (
  therapist_profile_id,
  timezone
)
select
  therapist.id,
  coalesce(
    case
      when public.is_valid_timezone_v1(
        nullif(therapist.metadata ->> 'timezone', '')
      )
        then nullif(therapist.metadata ->> 'timezone', '')
      else null
    end,
    (
      select rule.timezone
      from public.availability_rules as rule
      where rule.therapist_profile_id = therapist.id
        and public.is_valid_timezone_v1(rule.timezone)
      group by rule.timezone
      order by count(*) desc, rule.timezone
      limit 1
    ),
    'America/Sao_Paulo'
  )
from public.therapist_profiles as therapist
on conflict (therapist_profile_id) do nothing;

create or replace function public.initialize_therapist_schedule_settings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text := nullif(new.metadata ->> 'timezone', '');
begin
  if not public.is_valid_timezone_v1(v_timezone) then
    v_timezone := 'America/Sao_Paulo';
  end if;

  insert into public.therapist_schedule_settings (
    therapist_profile_id,
    timezone
  )
  values (new.id, v_timezone)
  on conflict (therapist_profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists initialize_therapist_schedule_settings
on public.therapist_profiles;
create trigger initialize_therapist_schedule_settings
after insert on public.therapist_profiles
for each row execute function public.initialize_therapist_schedule_settings_v1();

alter table public.therapist_schedule_settings enable row level security;
alter table public.therapist_schedule_events enable row level security;

grant select on public.therapist_schedule_settings to authenticated, service_role;
grant select on public.therapist_schedule_events to authenticated, service_role;
grant select on public.therapist_service_booking_settings
  to authenticated, service_role;

drop policy if exists "Therapists can read own schedule settings"
on public.therapist_schedule_settings;
create policy "Therapists can read own schedule settings"
on public.therapist_schedule_settings
for select
to authenticated
using (
  public.is_current_therapist_profile(therapist_profile_id)
);

drop policy if exists "Therapists can read own schedule events"
on public.therapist_schedule_events;
create policy "Therapists can read own schedule events"
on public.therapist_schedule_events
for select
to authenticated
using (
  public.is_current_therapist_profile(therapist_profile_id)
);

drop policy if exists "Therapists can read own service booking settings"
on public.therapist_service_booking_settings;
create policy "Therapists can read own service booking settings"
on public.therapist_service_booking_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_services as service
    where service.id = therapist_service_booking_settings.service_id
      and public.is_current_therapist_profile(service.therapist_profile_id)
  )
);

create or replace function public.get_therapist_schedule_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_settings public.therapist_schedule_settings%rowtype;
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

  select schedule_settings.*
    into v_settings
  from public.therapist_schedule_settings as schedule_settings
  where schedule_settings.therapist_profile_id = v_therapist.id;

  if not found then
    raise exception 'schedule_settings_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'scheduleVersion', v_settings.version,
    'timezone', v_settings.timezone,
    'updatedAt', v_settings.updated_at,
    'summary', jsonb_build_object(
      'configuredDays', (
        select count(distinct rule.day_of_week)
        from public.availability_rules as rule
        where rule.therapist_profile_id = v_therapist.id
          and rule.service_id is null
          and rule.is_active
      ),
      'weeklyAvailableMinutes', (
        select coalesce(
          sum(
            extract(
              epoch from (rule.end_time - rule.start_time)
            ) / 60
          ),
          0
        )::integer
        from public.availability_rules as rule
        where rule.therapist_profile_id = v_therapist.id
          and rule.service_id is null
          and rule.is_active
      )
    ),
    'rules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', rule.id,
            'serviceId', rule.service_id,
            'dayOfWeek', rule.day_of_week,
            'startTime', rule.start_time,
            'endTime', rule.end_time,
            'isActive', rule.is_active
          )
          order by
            rule.day_of_week,
            rule.service_id nulls first,
            rule.start_time,
            rule.id
        ),
        '[]'::jsonb
      )
      from public.availability_rules as rule
      where rule.therapist_profile_id = v_therapist.id
    ),
    'services', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'title', service.title,
            'status', service.status,
            'durationMinutes', service.duration_minutes,
            'settings', jsonb_build_object(
              'bufferBeforeMinutes',
                coalesce(booking_settings.buffer_before_minutes, 10),
              'bufferAfterMinutes',
                coalesce(booking_settings.buffer_after_minutes, 10),
              'minimumNoticeMinutes',
                coalesce(booking_settings.min_notice_minutes, 120),
              'bookingHorizonDays',
                coalesce(booking_settings.max_days_ahead, 30),
              'slotStepMinutes',
                coalesce(booking_settings.interval_minutes, 30)
            ),
            'weeklyAvailableMinutes', (
              select coalesce(
                sum(
                  extract(
                    epoch from (service_rule.end_time - service_rule.start_time)
                  ) / 60
                ),
                0
              )::integer
              from public.availability_rules as service_rule
              where service_rule.therapist_profile_id = v_therapist.id
                and service_rule.is_active
                and (
                  service_rule.service_id is null
                  or service_rule.service_id = service.id
                )
            )
          )
          order by service.created_at, service.id
        ),
        '[]'::jsonb
      )
      from public.therapist_services as service
      left join public.therapist_service_booking_settings as booking_settings
        on booking_settings.service_id = service.id
      where service.therapist_profile_id = v_therapist.id
        and service.status <> 'archived'
    )
  );
end;
$$;

create or replace function public.save_therapist_schedule_v1(
  p_actor_user_id uuid,
  p_expected_version bigint,
  p_timezone text,
  p_rules jsonb,
  p_service_settings jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_current_version bigint;
  v_resulting_version bigint;
  v_rule record;
  v_service_setting record;
  v_replayed_version bigint;
  v_replayed_timezone text;
begin
  if jsonb_typeof(p_rules) <> 'array'
    or jsonb_typeof(p_service_settings) <> 'array' then
    raise exception 'invalid_schedule_payload' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rules) > 100
    or jsonb_array_length(p_service_settings) > 50 then
    raise exception 'schedule_payload_too_large' using errcode = '22023';
  end if;

  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = p_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'therapist-schedule:' || v_therapist.id::text,
      0
    )
  );

  select event.resulting_version, event.timezone
    into v_replayed_version, v_replayed_timezone
  from public.therapist_schedule_events as event
  where event.therapist_profile_id = v_therapist.id
    and event.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'scheduleVersion', v_replayed_version,
      'timezone', v_replayed_timezone,
      'idempotentReplay', true
    );
  end if;

  if not public.is_valid_timezone_v1(p_timezone) then
    raise exception 'invalid_schedule_timezone' using errcode = '22023';
  end if;

  insert into public.therapist_schedule_settings (
    therapist_profile_id,
    timezone
  )
  values (v_therapist.id, p_timezone)
  on conflict (therapist_profile_id) do nothing;

  select schedule_settings.version
    into v_current_version
  from public.therapist_schedule_settings as schedule_settings
  where schedule_settings.therapist_profile_id = v_therapist.id
  for update;

  if v_current_version <> p_expected_version then
    raise exception 'schedule_version_conflict' using errcode = '40001';
  end if;

  if exists (
    with parsed_rules as (
      select
        rule.ordinality,
        nullif(rule.value ->> 'serviceId', '')::uuid as service_id,
        (rule.value ->> 'dayOfWeek')::integer as day_of_week,
        (rule.value ->> 'startTime')::time as start_time,
        (rule.value ->> 'endTime')::time as end_time,
        coalesce((rule.value ->> 'isActive')::boolean, true) as is_active
      from jsonb_array_elements(p_rules) with ordinality
        as rule(value, ordinality)
    )
    select 1
    from parsed_rules as left_rule
    join parsed_rules as right_rule
      on left_rule.ordinality < right_rule.ordinality
      and left_rule.is_active
      and right_rule.is_active
      and left_rule.day_of_week = right_rule.day_of_week
      and (
        left_rule.service_id is null
        or right_rule.service_id is null
        or left_rule.service_id = right_rule.service_id
      )
      and left_rule.start_time < right_rule.end_time
      and right_rule.start_time < left_rule.end_time
  ) then
    raise exception 'overlapping_availability_rule' using errcode = '23P01';
  end if;

  for v_rule in
    select
      rule."id" as id,
      rule."serviceId" as service_id,
      rule."dayOfWeek" as day_of_week,
      rule."startTime" as start_time,
      rule."endTime" as end_time,
      coalesce(rule."isActive", true) as is_active
    from jsonb_to_recordset(p_rules) as rule(
      "id" uuid,
      "serviceId" uuid,
      "dayOfWeek" integer,
      "startTime" time,
      "endTime" time,
      "isActive" boolean
    )
  loop
    if v_rule.day_of_week is null
      or v_rule.day_of_week < 0
      or v_rule.day_of_week > 6
      or v_rule.start_time is null
      or v_rule.end_time is null
      or v_rule.start_time >= v_rule.end_time then
      raise exception 'invalid_availability_range' using errcode = '22023';
    end if;

    if v_rule.service_id is not null
      and not exists (
        select 1
        from public.therapist_services as service
        where service.id = v_rule.service_id
          and service.therapist_profile_id = v_therapist.id
          and service.status <> 'archived'
      ) then
      raise exception 'schedule_service_forbidden' using errcode = '42501';
    end if;

    if v_rule.id is not null
      and exists (
        select 1
        from public.availability_rules as existing_rule
        where existing_rule.id = v_rule.id
          and existing_rule.therapist_profile_id <> v_therapist.id
      ) then
      raise exception 'schedule_rule_forbidden' using errcode = '42501';
    end if;
  end loop;

  for v_service_setting in
    select
      setting."serviceId" as service_id,
      setting."bufferBeforeMinutes" as buffer_before_minutes,
      setting."bufferAfterMinutes" as buffer_after_minutes,
      setting."minimumNoticeMinutes" as minimum_notice_minutes,
      setting."bookingHorizonDays" as booking_horizon_days,
      setting."slotStepMinutes" as slot_step_minutes
    from jsonb_to_recordset(p_service_settings) as setting(
      "serviceId" uuid,
      "bufferBeforeMinutes" integer,
      "bufferAfterMinutes" integer,
      "minimumNoticeMinutes" integer,
      "bookingHorizonDays" integer,
      "slotStepMinutes" integer
    )
  loop
    if v_service_setting.service_id is null
      or v_service_setting.buffer_before_minutes is null
      or v_service_setting.buffer_before_minutes < 0
      or v_service_setting.buffer_after_minutes is null
      or v_service_setting.buffer_after_minutes < 0
      or v_service_setting.minimum_notice_minutes is null
      or v_service_setting.minimum_notice_minutes < 0
      or v_service_setting.booking_horizon_days is null
      or v_service_setting.booking_horizon_days < 1
      or v_service_setting.slot_step_minutes is null
      or v_service_setting.slot_step_minutes < 1 then
      raise exception 'invalid_service_booking_settings' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.therapist_services as service
      where service.id = v_service_setting.service_id
        and service.therapist_profile_id = v_therapist.id
        and service.status <> 'archived'
    ) then
      raise exception 'schedule_service_forbidden' using errcode = '42501';
    end if;
  end loop;

  delete from public.availability_rules as existing_rule
  where existing_rule.therapist_profile_id = v_therapist.id
    and not exists (
      select 1
      from jsonb_to_recordset(p_rules) as incoming_rule("id" uuid)
      where incoming_rule."id" = existing_rule.id
    );

  for v_rule in
    select
      rule."id" as id,
      rule."serviceId" as service_id,
      rule."dayOfWeek" as day_of_week,
      rule."startTime" as start_time,
      rule."endTime" as end_time,
      coalesce(rule."isActive", true) as is_active
    from jsonb_to_recordset(p_rules) as rule(
      "id" uuid,
      "serviceId" uuid,
      "dayOfWeek" integer,
      "startTime" time,
      "endTime" time,
      "isActive" boolean
    )
  loop
    if v_rule.id is null then
      insert into public.availability_rules (
        therapist_profile_id,
        service_id,
        day_of_week,
        start_time,
        end_time,
        timezone,
        is_active
      )
      values (
        v_therapist.id,
        v_rule.service_id,
        v_rule.day_of_week,
        v_rule.start_time,
        v_rule.end_time,
        p_timezone,
        v_rule.is_active
      );
    else
      insert into public.availability_rules (
        id,
        therapist_profile_id,
        service_id,
        day_of_week,
        start_time,
        end_time,
        timezone,
        is_active
      )
      values (
        v_rule.id,
        v_therapist.id,
        v_rule.service_id,
        v_rule.day_of_week,
        v_rule.start_time,
        v_rule.end_time,
        p_timezone,
        v_rule.is_active
      )
      on conflict (id) do update
      set
        service_id = excluded.service_id,
        day_of_week = excluded.day_of_week,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        timezone = excluded.timezone,
        is_active = excluded.is_active,
        updated_at = now()
      where availability_rules.therapist_profile_id = v_therapist.id;
    end if;
  end loop;

  for v_service_setting in
    select
      setting."serviceId" as service_id,
      setting."bufferBeforeMinutes" as buffer_before_minutes,
      setting."bufferAfterMinutes" as buffer_after_minutes,
      setting."minimumNoticeMinutes" as minimum_notice_minutes,
      setting."bookingHorizonDays" as booking_horizon_days,
      setting."slotStepMinutes" as slot_step_minutes
    from jsonb_to_recordset(p_service_settings) as setting(
      "serviceId" uuid,
      "bufferBeforeMinutes" integer,
      "bufferAfterMinutes" integer,
      "minimumNoticeMinutes" integer,
      "bookingHorizonDays" integer,
      "slotStepMinutes" integer
    )
  loop
    insert into public.therapist_service_booking_settings (
      service_id,
      buffer_before_minutes,
      buffer_after_minutes,
      min_notice_minutes,
      max_days_ahead,
      interval_minutes
    )
    values (
      v_service_setting.service_id,
      v_service_setting.buffer_before_minutes,
      v_service_setting.buffer_after_minutes,
      v_service_setting.minimum_notice_minutes,
      v_service_setting.booking_horizon_days,
      v_service_setting.slot_step_minutes
    )
    on conflict (service_id) do update
    set
      buffer_before_minutes = excluded.buffer_before_minutes,
      buffer_after_minutes = excluded.buffer_after_minutes,
      min_notice_minutes = excluded.min_notice_minutes,
      max_days_ahead = excluded.max_days_ahead,
      interval_minutes = excluded.interval_minutes,
      updated_at = now();
  end loop;

  update public.therapist_schedule_settings as schedule_settings
  set
    timezone = p_timezone,
    version = schedule_settings.version + 1,
    updated_at = now()
  where schedule_settings.therapist_profile_id = v_therapist.id
  returning schedule_settings.version into v_resulting_version;

  -- Temporary compatibility projection for read models predating A3.
  update public.therapist_profiles as therapist
  set metadata = jsonb_set(
    therapist.metadata,
    '{timezone}',
    to_jsonb(p_timezone),
    true
  )
  where therapist.id = v_therapist.id;

  insert into public.therapist_schedule_events (
    therapist_profile_id,
    actor_user_id,
    event_type,
    request_id,
    previous_version,
    resulting_version,
    timezone,
    rule_count,
    service_settings_count
  )
  values (
    v_therapist.id,
    p_actor_user_id,
    'schedule_saved',
    p_request_id,
    v_current_version,
    v_resulting_version,
    p_timezone,
    jsonb_array_length(p_rules),
    jsonb_array_length(p_service_settings)
  );

  return jsonb_build_object(
    'scheduleVersion', v_resulting_version,
    'timezone', p_timezone,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.is_valid_timezone_v1(text) from public;
revoke all on function public.validate_therapist_schedule_timezone_v1()
  from public;
revoke all on function public.initialize_therapist_schedule_settings_v1()
  from public;
revoke all on function public.get_therapist_schedule_v1() from public;
revoke all on function public.save_therapist_schedule_v1(
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  uuid
) from public;

grant execute on function public.get_therapist_schedule_v1()
  to authenticated, service_role;
grant execute on function public.save_therapist_schedule_v1(
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  uuid
) to service_role;

comment on table public.therapist_schedule_settings is
  'Canonical therapist business timezone and optimistic schedule version.';
comment on table public.therapist_schedule_events is
  'Sanitized audit trail for atomic schedule configuration changes.';
comment on function public.get_therapist_schedule_v1() is
  'A3 versioned therapist schedule read model derived from auth.uid().';
comment on function public.save_therapist_schedule_v1(
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  uuid
) is
  'A3 atomic and idempotent schedule command restricted to trusted Edge Functions.';
