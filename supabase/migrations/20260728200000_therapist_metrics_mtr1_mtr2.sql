-- MTR-1 and MTR-2: privacy-gated public telemetry, append-only events,
-- versioned daily aggregates and the private overview read model.

create table if not exists public.therapist_metrics_runtime_config (
  singleton boolean primary key default true,
  public_telemetry_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint therapist_metrics_runtime_config_singleton check (singleton)
);

insert into public.therapist_metrics_runtime_config (
  singleton,
  public_telemetry_enabled
)
values (true, false)
on conflict (singleton) do nothing;

comment on table public.therapist_metrics_runtime_config is
'Internal MTR runtime gate. Public telemetry stays disabled until privacy, legal basis and retention are formally approved.';

create table if not exists public.therapist_metric_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  event_type text not null,
  event_source text not null,
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  service_id uuid references public.therapist_services (id) on delete set null,
  therapy_id uuid references public.therapies (id) on delete set null,
  session_key_hash text,
  result_set_id uuid,
  result_position smallint,
  source_surface text,
  dedupe_key text not null unique,
  metric_date date not null,
  definition_version integer not null default 1,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint therapist_metric_events_type check (
    event_type in (
      'search_impression',
      'profile_view',
      'booking_flow_started',
      'favorite_therapist_added'
    )
  ),
  constraint therapist_metric_events_source check (
    event_source in ('browser', 'authoritative')
  ),
  constraint therapist_metric_events_surface check (
    source_surface is null
    or source_surface in ('therapist_search', 'therapist_profile')
  ),
  constraint therapist_metric_events_position check (
    result_position is null
    or result_position between 1 and 100
  ),
  constraint therapist_metric_events_definition_version check (
    definition_version > 0
  ),
  constraint therapist_metric_events_browser_shape check (
    (
      event_source = 'browser'
      and session_key_hash is not null
      and source_surface is not null
    )
    or (
      event_source = 'authoritative'
      and event_type = 'favorite_therapist_added'
      and session_key_hash is null
      and source_surface is null
    )
  )
);

comment on table public.therapist_metric_events is
'Private append-only MTR events. Contains pseudonymous objective product signals only; no IP, user agent, query string, free text or clinical content.';

create index if not exists therapist_metric_events_profile_date_type_idx
on public.therapist_metric_events (
  therapist_profile_id,
  metric_date,
  event_type
);

create index if not exists therapist_metric_events_profile_session_idx
on public.therapist_metric_events (
  therapist_profile_id,
  session_key_hash,
  occurred_at
)
where session_key_hash is not null;

create table if not exists public.therapist_metric_daily_aggregates (
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  metric_date date not null,
  definition_version integer not null default 1,
  search_impressions integer not null default 0,
  profile_views integer not null default 0,
  booking_flow_starts integer not null default 0,
  favorites_added integer not null default 0,
  fresh_through timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (
    therapist_profile_id,
    metric_date,
    definition_version
  ),
  constraint therapist_metric_daily_aggregates_non_negative check (
    search_impressions >= 0
    and profile_views >= 0
    and booking_flow_starts >= 0
    and favorites_added >= 0
  ),
  constraint therapist_metric_daily_aggregates_version_positive check (
    definition_version > 0
  )
);

comment on table public.therapist_metric_daily_aggregates is
'Versioned private daily MTR projection. Browser signals are deduplicated before this projection is incremented.';

create index if not exists therapist_metric_daily_aggregates_date_idx
on public.therapist_metric_daily_aggregates (
  metric_date,
  therapist_profile_id
);

alter table public.therapist_metrics_runtime_config enable row level security;
alter table public.therapist_metric_events enable row level security;
alter table public.therapist_metric_daily_aggregates enable row level security;

revoke all on public.therapist_metrics_runtime_config
from public, anon, authenticated;
revoke all on public.therapist_metric_events
from public, anon, authenticated;
revoke all on public.therapist_metric_daily_aggregates
from public, anon, authenticated;

grant select, update on public.therapist_metrics_runtime_config
to service_role;
grant select on public.therapist_metric_events to service_role;
grant select on public.therapist_metric_daily_aggregates
to authenticated, service_role;

drop policy if exists "Therapists can read own metric aggregates"
on public.therapist_metric_daily_aggregates;
create policy "Therapists can read own metric aggregates"
on public.therapist_metric_daily_aggregates
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

create or replace function public.increment_therapist_metric_daily_v1(
  p_therapist_profile_id uuid,
  p_metric_date date,
  p_event_type text,
  p_fresh_through timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.therapist_metric_daily_aggregates (
    therapist_profile_id,
    metric_date,
    definition_version,
    search_impressions,
    profile_views,
    booking_flow_starts,
    favorites_added,
    fresh_through
  )
  values (
    p_therapist_profile_id,
    p_metric_date,
    1,
    case when p_event_type = 'search_impression' then 1 else 0 end,
    case when p_event_type = 'profile_view' then 1 else 0 end,
    case when p_event_type = 'booking_flow_started' then 1 else 0 end,
    case when p_event_type = 'favorite_therapist_added' then 1 else 0 end,
    p_fresh_through
  )
  on conflict (
    therapist_profile_id,
    metric_date,
    definition_version
  )
  do update set
    search_impressions =
      public.therapist_metric_daily_aggregates.search_impressions
      + excluded.search_impressions,
    profile_views =
      public.therapist_metric_daily_aggregates.profile_views
      + excluded.profile_views,
    booking_flow_starts =
      public.therapist_metric_daily_aggregates.booking_flow_starts
      + excluded.booking_flow_starts,
    favorites_added =
      public.therapist_metric_daily_aggregates.favorites_added
      + excluded.favorites_added,
    fresh_through = greatest(
      public.therapist_metric_daily_aggregates.fresh_through,
      excluded.fresh_through
    ),
    updated_at = now();

  insert into public.therapist_profile_daily_analytics (
    therapist_profile_id,
    metric_date,
    profile_views,
    search_impressions,
    favorites_added
  )
  values (
    p_therapist_profile_id,
    p_metric_date,
    case when p_event_type = 'profile_view' then 1 else 0 end,
    case when p_event_type = 'search_impression' then 1 else 0 end,
    case when p_event_type = 'favorite_therapist_added' then 1 else 0 end
  )
  on conflict (therapist_profile_id, metric_date)
  do update set
    profile_views =
      public.therapist_profile_daily_analytics.profile_views
      + excluded.profile_views,
    search_impressions =
      public.therapist_profile_daily_analytics.search_impressions
      + excluded.search_impressions,
    favorites_added =
      public.therapist_profile_daily_analytics.favorites_added
      + excluded.favorites_added,
    updated_at = now();
end;
$$;

revoke all on function public.increment_therapist_metric_daily_v1(
  uuid,
  date,
  text,
  timestamptz
) from public, anon, authenticated;

create or replace function public.record_public_therapist_metric_events_v1(
  p_session_id uuid,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_event jsonb;
  v_event_id uuid;
  v_event_type text;
  v_slug text;
  v_service_id uuid;
  v_therapy_id uuid;
  v_result_set_id uuid;
  v_result_position integer;
  v_source_surface text;
  v_therapist_profile_id uuid;
  v_timezone text;
  v_metric_date date;
  v_session_hash text;
  v_dedupe_key text;
  v_inserted_id uuid;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_ignored integer := 0;
  v_event_count integer;
begin
  if not coalesce(
    (
      select config.public_telemetry_enabled
      from public.therapist_metrics_runtime_config as config
      where config.singleton = true
    ),
    false
  ) then
    return jsonb_build_object(
      'status', 'disabled',
      'accepted', 0,
      'duplicates', 0,
      'ignored', 0
    );
  end if;

  if p_session_id is null
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) < 1
    or jsonb_array_length(p_events) > 20 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select profile.role
    into v_actor_role
  from public.profiles as profile
  where profile.id = auth.uid();

  if v_actor_role in ('therapist', 'admin') then
    return jsonb_build_object(
      'status', 'ignored',
      'accepted', 0,
      'duplicates', 0,
      'ignored', jsonb_array_length(p_events)
    );
  end if;

  v_session_hash := encode(
    extensions.digest(p_session_id::text, 'sha256'::text),
    'hex'
  );

  select count(*)
    into v_event_count
  from public.therapist_metric_events as metric_event
  where metric_event.event_source = 'browser'
    and metric_event.session_key_hash = v_session_hash
    and metric_event.occurred_at >= now() - interval '1 day';

  if v_event_count + jsonb_array_length(p_events) > 100 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  for v_event in
    select value
    from jsonb_array_elements(p_events)
  loop
    begin
      if jsonb_typeof(v_event) <> 'object'
        or (v_event - array[
          'eventId',
          'eventType',
          'therapistSlug',
          'serviceId',
          'resultSetId',
          'resultPosition',
          'sourceSurface'
        ]::text[]) <> '{}'::jsonb then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
      end if;

      v_event_id := (v_event ->> 'eventId')::uuid;
      v_event_type := nullif(trim(v_event ->> 'eventType'), '');
      v_slug := nullif(trim(v_event ->> 'therapistSlug'), '');
      v_service_id := nullif(v_event ->> 'serviceId', '')::uuid;
      v_result_set_id := nullif(v_event ->> 'resultSetId', '')::uuid;
      v_result_position := nullif(v_event ->> 'resultPosition', '')::integer;
      v_source_surface := nullif(trim(v_event ->> 'sourceSurface'), '');

      if v_event_type not in (
        'search_impression',
        'profile_view',
        'booking_flow_started'
      )
        or v_slug is null
        or length(v_slug) > 120
        or v_source_surface not in (
          'therapist_search',
          'therapist_profile'
        ) then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
      end if;

      if v_event_type = 'search_impression' and (
        v_source_surface <> 'therapist_search'
        or v_result_set_id is null
        or v_result_position is null
        or v_result_position not between 1 and 100
        or v_service_id is not null
      ) then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
      end if;

      if v_event_type = 'profile_view' and (
        v_source_surface <> 'therapist_profile'
        or v_result_set_id is not null
        or v_result_position is not null
        or v_service_id is not null
      ) then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
      end if;

      if v_event_type = 'booking_flow_started' and (
        v_source_surface not in ('therapist_profile', 'therapist_search')
        or v_service_id is null
        or v_result_set_id is not null
        or v_result_position is not null
      ) then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
      end if;

      select public_profile.id, schedule_settings.timezone
        into v_therapist_profile_id, v_timezone
      from public.public_therapist_profiles_v as public_profile
      join public.therapist_schedule_settings as schedule_settings
        on schedule_settings.therapist_profile_id = public_profile.id
      where public_profile.slug = v_slug;

      if not found then
        v_ignored := v_ignored + 1;
        continue;
      end if;

      v_therapy_id := null;
      if v_service_id is not null then
        select service.therapy_id
          into v_therapy_id
        from public.therapist_services as service
        join public.therapies as therapy
          on therapy.id = service.therapy_id
        where service.id = v_service_id
          and service.therapist_profile_id = v_therapist_profile_id
          and service.status = 'active'
          and service.is_bookable = true
          and service.online_only = true
          and therapy.status = 'published'
          and therapy.is_public_visible = true;

        if not found then
          v_ignored := v_ignored + 1;
          continue;
        end if;
      end if;

      v_metric_date := (now() at time zone v_timezone)::date;
      v_dedupe_key := encode(
        extensions.digest(
          concat_ws(
            ':',
            v_event_type,
            v_therapist_profile_id::text,
            v_session_hash,
            coalesce(v_service_id::text, ''),
            coalesce(v_result_set_id::text, ''),
            case
              when v_event_type = 'profile_view'
                then v_metric_date::text
              when v_event_type = 'booking_flow_started'
                then v_metric_date::text
              else ''
            end
          ),
          'sha256'::text
        ),
        'hex'
      );

      v_inserted_id := null;
      insert into public.therapist_metric_events (
        event_id,
        event_type,
        event_source,
        therapist_profile_id,
        service_id,
        therapy_id,
        session_key_hash,
        result_set_id,
        result_position,
        source_surface,
        dedupe_key,
        metric_date,
        definition_version,
        occurred_at
      )
      values (
        v_event_id,
        v_event_type,
        'browser',
        v_therapist_profile_id,
        v_service_id,
        v_therapy_id,
        v_session_hash,
        v_result_set_id,
        v_result_position,
        v_source_surface,
        v_dedupe_key,
        v_metric_date,
        1,
        now()
      )
      on conflict do nothing
      returning id into v_inserted_id;

      if v_inserted_id is null then
        if exists (
          select 1
          from public.therapist_metric_events as existing_event
          where existing_event.event_id = v_event_id
            and existing_event.dedupe_key <> v_dedupe_key
        ) then
          raise exception 'REQUEST_CONFLICT' using errcode = '23505';
        end if;

        v_duplicates := v_duplicates + 1;
      else
        perform public.increment_therapist_metric_daily_v1(
          v_therapist_profile_id,
          v_metric_date,
          v_event_type,
          now()
        );
        v_accepted := v_accepted + 1;
      end if;
    exception
      when invalid_text_representation
        or numeric_value_out_of_range
        or check_violation then
        raise exception 'VALIDATION_ERROR' using errcode = '22023';
    end;
  end loop;

  return jsonb_build_object(
    'status', 'accepted',
    'accepted', v_accepted,
    'duplicates', v_duplicates,
    'ignored', v_ignored
  );
end;
$$;

comment on function public.record_public_therapist_metric_events_v1(
  uuid,
  jsonb
) is
'MTR-1 browser ingestion. Validates public entities, deduplicates, rate-limits and stores no raw IP, user agent, query string or free text.';

revoke all on function public.record_public_therapist_metric_events_v1(
  uuid,
  jsonb
) from public;
grant execute on function public.record_public_therapist_metric_events_v1(
  uuid,
  jsonb
) to anon, authenticated;

create or replace function public.record_favorite_therapist_metric_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_metric_date date;
  v_inserted_id uuid;
begin
  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = new.therapist_profile_id;

  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_metric_date := (new.created_at at time zone v_timezone)::date;

  insert into public.therapist_metric_events (
    event_id,
    event_type,
    event_source,
    therapist_profile_id,
    dedupe_key,
    metric_date,
    definition_version,
    occurred_at
  )
  values (
    new.id,
    'favorite_therapist_added',
    'authoritative',
    new.therapist_profile_id,
    'favorite:' || new.id::text,
    v_metric_date,
    1,
    new.created_at
  )
  on conflict do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    perform public.increment_therapist_metric_daily_v1(
      new.therapist_profile_id,
      v_metric_date,
      'favorite_therapist_added',
      new.created_at
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_favorite_therapist_metric_v1()
from public, anon, authenticated;

drop trigger if exists record_favorite_therapist_metric
on public.favorite_therapists;
create trigger record_favorite_therapist_metric
after insert on public.favorite_therapists
for each row execute function public.record_favorite_therapist_metric_v1();

-- Backfill only currently existing profile favorites. Deleted historical
-- favorites cannot be reconstructed and are intentionally not invented.
insert into public.therapist_metric_events (
  event_id,
  event_type,
  event_source,
  therapist_profile_id,
  dedupe_key,
  metric_date,
  definition_version,
  occurred_at
)
select
  favorite.id,
  'favorite_therapist_added',
  'authoritative',
  favorite.therapist_profile_id,
  'favorite:' || favorite.id::text,
  (
    favorite.created_at at time zone coalesce(
      settings.timezone,
      'America/Sao_Paulo'
    )
  )::date,
  1,
  favorite.created_at
from public.favorite_therapists as favorite
left join public.therapist_schedule_settings as settings
  on settings.therapist_profile_id = favorite.therapist_profile_id
on conflict do nothing;

insert into public.therapist_metric_daily_aggregates (
  therapist_profile_id,
  metric_date,
  definition_version,
  favorites_added,
  fresh_through
)
select
  metric_event.therapist_profile_id,
  metric_event.metric_date,
  1,
  count(*)::integer,
  max(metric_event.occurred_at)
from public.therapist_metric_events as metric_event
where metric_event.event_type = 'favorite_therapist_added'
group by metric_event.therapist_profile_id, metric_event.metric_date
on conflict (
  therapist_profile_id,
  metric_date,
  definition_version
)
do update set
  favorites_added = excluded.favorites_added,
  fresh_through = greatest(
    public.therapist_metric_daily_aggregates.fresh_through,
    excluded.fresh_through
  ),
  updated_at = now();

create or replace function public.therapist_metric_rate_v1(
  p_current_numerator bigint,
  p_current_denominator bigint,
  p_previous_numerator bigint,
  p_previous_denominator bigint,
  p_copy_key_prefix text,
  p_minimum_sample integer default 10
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_current numeric;
  v_previous numeric;
  v_direction text;
begin
  if p_current_denominator < p_minimum_sample then
    return jsonb_build_object(
      'status', 'insufficient_sample',
      'value', null,
      'previousValue', null,
      'direction', null,
      'directionCopyKey', null,
      'unit', 'percent',
      'minimumSample', p_minimum_sample,
      'observedSample', p_current_denominator
    );
  end if;

  v_current := round(
    p_current_numerator::numeric * 100 / nullif(p_current_denominator, 0),
    1
  );
  v_previous := case
    when p_previous_denominator >= p_minimum_sample then round(
      p_previous_numerator::numeric * 100 / p_previous_denominator,
      1
    )
    else null
  end;
  v_direction := case
    when v_previous is null then 'stable'
    when v_current > v_previous then 'up'
    when v_current < v_previous then 'down'
    else 'stable'
  end;

  return jsonb_build_object(
    'status', 'ready',
    'value', v_current,
    'previousValue', v_previous,
    'direction', v_direction,
    'directionCopyKey', p_copy_key_prefix || '.' || v_direction,
    'unit', 'percent',
    'minimumSample', p_minimum_sample,
    'observedSample', p_current_denominator
  );
end;
$$;

revoke all on function public.therapist_metric_rate_v1(
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  integer
) from public, anon, authenticated;

create or replace function public.therapist_metric_sampled_counter_v1(
  p_current bigint,
  p_previous bigint,
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
  if p_current < p_minimum_sample then
    return jsonb_build_object(
      'status', 'insufficient_sample',
      'value', null,
      'previousValue', null,
      'direction', null,
      'directionCopyKey', null,
      'unit', p_unit,
      'minimumSample', p_minimum_sample,
      'observedSample', p_current
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
    'observedSample', p_current
  );
end;
$$;

revoke all on function public.therapist_metric_sampled_counter_v1(
  bigint,
  bigint,
  text,
  text,
  integer
) from public, anon, authenticated;

create or replace function public.get_therapist_metrics_overview_v1(
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
  v_current_minutes bigint := 0;
  v_previous_minutes bigint := 0;
  v_current_search bigint := 0;
  v_previous_search bigint := 0;
  v_current_profile bigint := 0;
  v_previous_profile bigint := 0;
  v_current_booking_start bigint := 0;
  v_previous_booking_start bigint := 0;
  v_current_favorites bigint := 0;
  v_previous_favorites bigint := 0;
  v_current_search_sessions bigint := 0;
  v_previous_search_sessions bigint := 0;
  v_current_profile_sessions bigint := 0;
  v_previous_profile_sessions bigint := 0;
  v_current_search_to_profile bigint := 0;
  v_previous_search_to_profile bigint := 0;
  v_current_profile_to_booking bigint := 0;
  v_previous_profile_to_booking bigint := 0;
  v_telemetry_enabled boolean := false;
  v_first_browser_event_at timestamptz;
  v_browser_fresh_through timestamptz;
  v_discovery_status text;
  v_completed_sample bigint := 0;
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
    count(distinct booking.patient_profile_id) filter (
      where booking.starts_at >= v_current_start
    ),
    count(distinct booking.patient_profile_id) filter (
      where booking.starts_at < v_current_start
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
    ),
    coalesce(sum(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at >= v_current_start
    ), 0),
    coalesce(sum(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at < v_current_start
    ), 0)
    into
      v_current_people,
      v_previous_people,
      v_current_sessions,
      v_previous_sessions,
      v_current_minutes,
      v_previous_minutes
  from public.bookings as booking
  where booking.therapist_profile_id = v_therapist.id
    and booking.status = 'completed'
    and booking.starts_at >= v_previous_start
    and booking.starts_at < v_current_end;

  v_completed_sample := v_current_sessions;

  select
    coalesce(sum(aggregate.search_impressions) filter (
      where aggregate.metric_date >= v_current_local_start
    ), 0),
    coalesce(sum(aggregate.search_impressions) filter (
      where aggregate.metric_date < v_current_local_start
    ), 0),
    coalesce(sum(aggregate.profile_views) filter (
      where aggregate.metric_date >= v_current_local_start
    ), 0),
    coalesce(sum(aggregate.profile_views) filter (
      where aggregate.metric_date < v_current_local_start
    ), 0),
    coalesce(sum(aggregate.booking_flow_starts) filter (
      where aggregate.metric_date >= v_current_local_start
    ), 0),
    coalesce(sum(aggregate.booking_flow_starts) filter (
      where aggregate.metric_date < v_current_local_start
    ), 0),
    coalesce(sum(aggregate.favorites_added) filter (
      where aggregate.metric_date >= v_current_local_start
    ), 0),
    coalesce(sum(aggregate.favorites_added) filter (
      where aggregate.metric_date < v_current_local_start
    ), 0),
    max(aggregate.fresh_through)
    into
      v_current_search,
      v_previous_search,
      v_current_profile,
      v_previous_profile,
      v_current_booking_start,
      v_previous_booking_start,
      v_current_favorites,
      v_previous_favorites,
      v_browser_fresh_through
  from public.therapist_metric_daily_aggregates as aggregate
  where aggregate.therapist_profile_id = v_therapist.id
    and aggregate.definition_version = 1
    and aggregate.metric_date >= v_previous_local_start
    and aggregate.metric_date < v_current_local_end;

  select config.public_telemetry_enabled
    into v_telemetry_enabled
  from public.therapist_metrics_runtime_config as config
  where config.singleton = true;

  select min(metric_event.occurred_at)
    into v_first_browser_event_at
  from public.therapist_metric_events as metric_event
  where metric_event.therapist_profile_id = v_therapist.id
    and metric_event.event_source = 'browser';

  with period_events as (
    select
      metric_event.event_type,
      metric_event.session_key_hash,
      metric_event.occurred_at
    from public.therapist_metric_events as metric_event
    where metric_event.therapist_profile_id = v_therapist.id
      and metric_event.event_source = 'browser'
      and metric_event.occurred_at >= v_previous_start
      and metric_event.occurred_at < v_current_end
  )
  select
    count(distinct session_key_hash) filter (
      where event_type = 'search_impression'
        and occurred_at >= v_current_start
    ),
    count(distinct session_key_hash) filter (
      where event_type = 'search_impression'
        and occurred_at < v_current_start
    ),
    count(distinct session_key_hash) filter (
      where event_type = 'profile_view'
        and occurred_at >= v_current_start
    ),
    count(distinct session_key_hash) filter (
      where event_type = 'profile_view'
        and occurred_at < v_current_start
    )
    into
      v_current_search_sessions,
      v_previous_search_sessions,
      v_current_profile_sessions,
      v_previous_profile_sessions
  from period_events;

  select
    count(distinct profile_event.session_key_hash) filter (
      where profile_event.occurred_at >= v_current_start
    ),
    count(distinct profile_event.session_key_hash) filter (
      where profile_event.occurred_at < v_current_start
    )
    into v_current_search_to_profile, v_previous_search_to_profile
  from public.therapist_metric_events as profile_event
  where profile_event.therapist_profile_id = v_therapist.id
    and profile_event.event_type = 'profile_view'
    and profile_event.event_source = 'browser'
    and profile_event.occurred_at >= v_previous_start
    and profile_event.occurred_at < v_current_end
    and exists (
      select 1
      from public.therapist_metric_events as search_event
      where search_event.therapist_profile_id = v_therapist.id
        and search_event.event_type = 'search_impression'
        and search_event.event_source = 'browser'
        and search_event.session_key_hash = profile_event.session_key_hash
        and search_event.occurred_at <= profile_event.occurred_at
    );

  select
    count(distinct booking_event.session_key_hash) filter (
      where booking_event.occurred_at >= v_current_start
    ),
    count(distinct booking_event.session_key_hash) filter (
      where booking_event.occurred_at < v_current_start
    )
    into v_current_profile_to_booking, v_previous_profile_to_booking
  from public.therapist_metric_events as booking_event
  where booking_event.therapist_profile_id = v_therapist.id
    and booking_event.event_type = 'booking_flow_started'
    and booking_event.event_source = 'browser'
    and booking_event.occurred_at >= v_previous_start
    and booking_event.occurred_at < v_current_end
    and exists (
      select 1
      from public.therapist_metric_events as profile_event
      where profile_event.therapist_profile_id = v_therapist.id
        and profile_event.event_type = 'profile_view'
        and profile_event.event_source = 'browser'
        and profile_event.session_key_hash = booking_event.session_key_hash
        and profile_event.occurred_at <= booking_event.occurred_at
    );

  v_discovery_status := case
    when not coalesce(v_telemetry_enabled, false) then 'unavailable'
    when v_first_browser_event_at is null then 'processing'
    when (
      v_current_search
      + v_current_profile
      + v_current_booking_start
    ) = 0 then 'empty'
    else 'ready'
  end;

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
    'counters', jsonb_build_object(
      'peopleServed', public.therapist_metric_counter_v1(
        v_current_people,
        v_previous_people,
        'therapist_metrics.people_served',
        'people'
      ),
      'sessionsCompleted', public.therapist_metric_counter_v1(
        v_current_sessions,
        v_previous_sessions,
        'therapist_metrics.sessions_completed',
        'sessions'
      ),
      'serviceMinutes', public.therapist_metric_counter_v1(
        v_current_minutes,
        v_previous_minutes,
        'therapist_metrics.service_minutes',
        'minutes'
      )
    ),
    'activity', jsonb_build_object(
      'status', case
        when v_current_sessions = 0 then 'empty'
        else 'ready'
      end,
      'freshThrough', v_current_end,
      'points', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'date', day.metric_date::date,
              'sessionsCompleted', coalesce(bookings.completed_count, 0)
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
            count(*)::integer as completed_count
          from public.bookings as booking
          where booking.therapist_profile_id = v_therapist.id
            and booking.status = 'completed'
            and booking.starts_at >= v_current_start
            and booking.starts_at < v_current_end
          group by (booking.starts_at at time zone v_timezone)::date
        ) as bookings
          on bookings.metric_date = day.metric_date::date
      )
    ),
    'discovery', jsonb_build_object(
      'status', v_discovery_status,
      'reason', case
        when v_discovery_status = 'unavailable'
          then 'privacy_activation_pending'
        else null
      end,
      'freshThrough', v_browser_fresh_through,
      'stages', jsonb_build_object(
        'searchImpressions', public.therapist_metric_counter_v1(
          v_current_search,
          v_previous_search,
          'therapist_metrics.search_impressions',
          'events'
        ),
        'profileViews', public.therapist_metric_counter_v1(
          v_current_profile,
          v_previous_profile,
          'therapist_metrics.profile_views',
          'events'
        ),
        'bookingFlowStarts', public.therapist_metric_counter_v1(
          v_current_booking_start,
          v_previous_booking_start,
          'therapist_metrics.booking_flow_starts',
          'events'
        )
      ),
      'funnel', jsonb_build_object(
        'searchToProfile', public.therapist_metric_rate_v1(
          v_current_search_to_profile,
          v_current_search_sessions,
          v_previous_search_to_profile,
          v_previous_search_sessions,
          'therapist_metrics.search_to_profile',
          10
        ),
        'profileToBooking', public.therapist_metric_rate_v1(
          v_current_profile_to_booking,
          v_current_profile_sessions,
          v_previous_profile_to_booking,
          v_previous_profile_sessions,
          'therapist_metrics.profile_to_booking',
          10
        )
      )
    ),
    'profileFavorites', public.therapist_metric_sampled_counter_v1(
      v_current_favorites,
      v_previous_favorites,
      'therapist_metrics.profile_favorites',
      'favorites',
      10
    ),
    'therapyRanking', jsonb_build_object(
      'status', case
        when v_completed_sample = 0 then 'empty'
        when v_completed_sample < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_completed_sample,
      'items', case
        when v_completed_sample < 10 then '[]'::jsonb
        else (
          with current_counts as (
            select
              therapy.id,
              therapy.name,
              count(*)::bigint as current_count
            from public.bookings as booking
            join public.therapist_services as service
              on service.id = booking.service_id
            join public.therapies as therapy
              on therapy.id = service.therapy_id
            where booking.therapist_profile_id = v_therapist.id
              and booking.status = 'completed'
              and booking.starts_at >= v_current_start
              and booking.starts_at < v_current_end
            group by therapy.id, therapy.name
          ),
          previous_counts as (
            select
              therapy.id,
              count(*)::bigint as previous_count
            from public.bookings as booking
            join public.therapist_services as service
              on service.id = booking.service_id
            join public.therapies as therapy
              on therapy.id = service.therapy_id
            where booking.therapist_profile_id = v_therapist.id
              and booking.status = 'completed'
              and booking.starts_at >= v_previous_start
              and booking.starts_at < v_current_start
            group by therapy.id
          )
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'therapyId', current_counts.id,
                'therapyName', current_counts.name,
                'counter', public.therapist_metric_counter_v1(
                  current_counts.current_count,
                  coalesce(previous_counts.previous_count, 0),
                  'therapist_metrics.therapy_bookings',
                  'sessions'
                )
              )
              order by
                current_counts.current_count desc,
                current_counts.name
            ),
            '[]'::jsonb
          )
          from current_counts
          left join previous_counts
            on previous_counts.id = current_counts.id
        )
      end
    ),
    'occupancy', jsonb_build_object(
      'status', 'unavailable',
      'reason', 'historical_availability_not_versioned'
    )
  );
end;
$$;

comment on function public.get_therapist_metrics_overview_v1(integer)
is 'MTR-2 private overview read model. Uses complete local days, own-history comparisons, versioned states and no patient identifiers.';

revoke all on function public.get_therapist_metrics_overview_v1(integer)
from public, anon;
grant execute on function public.get_therapist_metrics_overview_v1(integer)
to authenticated;
