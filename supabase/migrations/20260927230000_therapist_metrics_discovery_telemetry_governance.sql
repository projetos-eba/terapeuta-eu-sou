-- MTR discovery governance: an explicit server-side activation boundary,
-- privacy-safe operational health and a 120-day data lifecycle. This migration
-- never enables telemetry by itself.

comment on table public.therapist_metrics_runtime_config is
  'Internal MTR runtime gate. Public telemetry starts disabled and can change only through the audited service-role operation. Pseudonymous metric events and operational aggregates expire after 120 days.';

-- The operational ledger intentionally has no visitor, profile, search or
-- request identifiers. It is enough to detect ingestion quality without
-- becoming another source of behavioural data.
create table if not exists public.therapist_metric_ingestion_daily_health (
  metric_date date primary key,
  accepted_events integer not null default 0,
  duplicate_events integer not null default 0,
  invalid_requests integer not null default 0,
  rate_limited_requests integer not null default 0,
  failed_requests integer not null default 0,
  latest_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_metric_ingestion_daily_health_non_negative check (
    accepted_events >= 0
    and duplicate_events >= 0
    and invalid_requests >= 0
    and rate_limited_requests >= 0
    and failed_requests >= 0
  )
);

create table if not exists public.therapist_metric_telemetry_health_runs (
  metric_date date primary key,
  status text not null,
  last_event_at timestamptz,
  aggregate_mismatch_count integer not null default 0,
  funnel_violation_count integer not null default 0,
  events_purged integer not null default 0,
  aggregates_purged integer not null default 0,
  ingestion_health_rows_purged integer not null default 0,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_metric_telemetry_health_runs_status check (
    status in ('healthy', 'attention', 'no_activity', 'telemetry_disabled')
  ),
  constraint therapist_metric_telemetry_health_runs_non_negative check (
    aggregate_mismatch_count >= 0
    and funnel_violation_count >= 0
    and events_purged >= 0
    and aggregates_purged >= 0
    and ingestion_health_rows_purged >= 0
  )
);

comment on table public.therapist_metric_ingestion_daily_health is
  'Daily aggregate health counters for public therapist metrics. It contains no visitor, profile, session, search or user-agent data.';

comment on table public.therapist_metric_telemetry_health_runs is
  'Daily aggregate integrity and retention checks for public therapist metric telemetry. It contains no behavioural records.';

alter table public.therapist_metric_ingestion_daily_health enable row level security;
alter table public.therapist_metric_telemetry_health_runs enable row level security;

revoke all on public.therapist_metric_ingestion_daily_health
  from public, anon, authenticated;
revoke all on public.therapist_metric_telemetry_health_runs
  from public, anon, authenticated;

-- Activation is deliberately mediated by the operation below. Service role
-- still retains read access for controlled operational diagnostics.
revoke update on public.therapist_metrics_runtime_config from service_role;
grant select on public.therapist_metric_ingestion_daily_health,
  public.therapist_metric_telemetry_health_runs to service_role;

create or replace function public.record_therapist_metric_ingestion_health_v1(
  p_outcome text,
  p_quantity integer default 1,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metric_date date := (coalesce(p_occurred_at, now()) at time zone 'America/Sao_Paulo')::date;
begin
  if p_outcome not in (
    'accepted',
    'duplicate',
    'invalid',
    'rate_limited',
    'failed'
  ) or coalesce(p_quantity, 0) not between 1 and 20 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  insert into public.therapist_metric_ingestion_daily_health (
    metric_date,
    accepted_events,
    duplicate_events,
    invalid_requests,
    rate_limited_requests,
    failed_requests,
    latest_event_at
  )
  values (
    v_metric_date,
    case when p_outcome = 'accepted' then p_quantity else 0 end,
    case when p_outcome = 'duplicate' then p_quantity else 0 end,
    case when p_outcome = 'invalid' then p_quantity else 0 end,
    case when p_outcome = 'rate_limited' then p_quantity else 0 end,
    case when p_outcome = 'failed' then p_quantity else 0 end,
    coalesce(p_occurred_at, now())
  )
  on conflict (metric_date) do update
  set accepted_events = public.therapist_metric_ingestion_daily_health.accepted_events
        + excluded.accepted_events,
      duplicate_events = public.therapist_metric_ingestion_daily_health.duplicate_events
        + excluded.duplicate_events,
      invalid_requests = public.therapist_metric_ingestion_daily_health.invalid_requests
        + excluded.invalid_requests,
      rate_limited_requests = public.therapist_metric_ingestion_daily_health.rate_limited_requests
        + excluded.rate_limited_requests,
      failed_requests = public.therapist_metric_ingestion_daily_health.failed_requests
        + excluded.failed_requests,
      latest_event_at = greatest(
        public.therapist_metric_ingestion_daily_health.latest_event_at,
        excluded.latest_event_at
      ),
      updated_at = now();
end;
$$;

revoke all on function public.record_therapist_metric_ingestion_health_v1(
  text,
  integer,
  timestamptz
) from public, anon, authenticated, service_role;

-- V2 preserves the validated event contract while making its accepted,
-- deduplicated and rejected outcomes observable only as aggregate counts.
-- V1 stays available for compatibility; the web route moves to this boundary.
create or replace function public.record_public_therapist_metric_events_v2(
  p_session_id uuid,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_quantity integer := case
    when jsonb_typeof(p_events) = 'array'
      then greatest(1, least(20, jsonb_array_length(p_events)))
    else 1
  end;
  v_accepted integer := 0;
  v_duplicates integer := 0;
begin
  begin
    v_result := public.record_public_therapist_metric_events_v1(
      p_session_id,
      p_events
    );
  exception
    when sqlstate '22023' then
      perform public.record_therapist_metric_ingestion_health_v1(
        'invalid',
        v_quantity,
        now()
      );
      return jsonb_build_object('status', 'invalid', 'accepted', 0);
    when sqlstate 'P0001' then
      if sqlerrm = 'RATE_LIMITED' then
        perform public.record_therapist_metric_ingestion_health_v1(
          'rate_limited',
          1,
          now()
        );
        return jsonb_build_object('status', 'rate_limited', 'accepted', 0);
      end if;

      perform public.record_therapist_metric_ingestion_health_v1(
        'failed',
        1,
        now()
      );
      return jsonb_build_object('status', 'failed', 'accepted', 0);
    when others then
      perform public.record_therapist_metric_ingestion_health_v1(
        'failed',
        1,
        now()
      );
      return jsonb_build_object('status', 'failed', 'accepted', 0);
  end;

  if coalesce(v_result ->> 'status', '') = 'accepted' then
    v_accepted := greatest(0, coalesce((v_result ->> 'accepted')::integer, 0));
    v_duplicates := greatest(0, coalesce((v_result ->> 'duplicates')::integer, 0));

    if v_accepted > 0 then
      perform public.record_therapist_metric_ingestion_health_v1(
        'accepted',
        v_accepted,
        now()
      );
    end if;

    if v_duplicates > 0 then
      perform public.record_therapist_metric_ingestion_health_v1(
        'duplicate',
        v_duplicates,
        now()
      );
    end if;
  end if;

  return v_result;
end;
$$;

comment on function public.record_public_therapist_metric_events_v2(uuid, jsonb) is
  'MTR public telemetry ingress with the v1 validation and deduplication contract plus aggregate-only operational health accounting.';

revoke all on function public.record_public_therapist_metric_events_v2(
  uuid,
  jsonb
) from public;
grant execute on function public.record_public_therapist_metric_events_v2(
  uuid,
  jsonb
) to anon, authenticated;

create or replace function public.set_therapist_metrics_runtime_v1(
  p_enabled boolean,
  p_actor_user_id uuid,
  p_reason text,
  p_request_id uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_enabled boolean;
  v_action text;
begin
  if p_actor_user_id is null
    or p_request_id is null
    or length(trim(coalesce(p_reason, ''))) not between 8 and 500
    or length(trim(coalesce(p_correlation_id, ''))) > 128 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_actor_user_id
      and profile.role = 'admin'::public.user_role
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.therapist_metrics_runtime_config (
    singleton,
    public_telemetry_enabled
  )
  values (true, false)
  on conflict (singleton) do nothing;

  select config.public_telemetry_enabled
    into v_current_enabled
  from public.therapist_metrics_runtime_config as config
  where config.singleton = true
  for update;

  if v_current_enabled = p_enabled then
    return jsonb_build_object(
      'applied', false,
      'enabled', v_current_enabled,
      'retentionDays', 120
    );
  end if;

  update public.therapist_metrics_runtime_config
  set public_telemetry_enabled = p_enabled,
      updated_at = now()
  where singleton = true;

  v_action := case
    when p_enabled then 'metrics.telemetry.enabled'
    else 'metrics.telemetry.disabled'
  end;

  perform public.record_admin_audit_event_v1(
    p_actor_user_id,
    'admin',
    'admin.settings.manage',
    v_action,
    'therapist_metrics_runtime_config',
    'singleton',
    jsonb_build_object(
      'enabled', v_current_enabled,
      'publicNoticeChanged', false,
      'retentionDays', 120
    ),
    jsonb_build_object(
      'approval', 'tes_partners',
      'enabled', p_enabled,
      'publicNoticeChanged', false,
      'retentionDays', 120
    ),
    trim(p_reason),
    p_request_id::text,
    nullif(trim(coalesce(p_correlation_id, '')), ''),
    'metrics-telemetry-operation'
  );

  return jsonb_build_object(
    'applied', true,
    'enabled', p_enabled,
    'retentionDays', 120
  );
end;
$$;

comment on function public.set_therapist_metrics_runtime_v1(boolean, uuid, text, uuid, text) is
  'Service-role-only audited runtime operation for public therapist metric telemetry. The caller supplies the verified admin actor and approval reference; this function never runs from a browser.';

revoke all on function public.set_therapist_metrics_runtime_v1(
  boolean,
  uuid,
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.set_therapist_metrics_runtime_v1(
  boolean,
  uuid,
  text,
  uuid,
  text
) to service_role;

-- V2 is deliberately narrow: the existing V1 keeps its 30/60/90/120-day
-- compatibility contract, while discovery now offers 30 and 60 complete days
-- only so both current and previous periods remain inside the 120-day window.
create or replace function public.get_therapist_metrics_overview_v2(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if p_period_days not in (30, 60) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_payload := public.get_therapist_metrics_overview_v1(p_period_days);

  return v_payload || jsonb_build_object(
    'contractVersion', 2,
    'metricDefinitionVersion', 2
  );
end;
$$;

comment on function public.get_therapist_metrics_overview_v2(integer) is
  'MTR private overview v2. Limits discovery comparisons to 30 or 60 complete local days, preserves pseudonymous cohort-only funnel computation and never returns visitor or search data.';

revoke all on function public.get_therapist_metrics_overview_v2(integer)
  from public, anon;
grant execute on function public.get_therapist_metrics_overview_v2(integer)
  to authenticated;

create or replace function public.get_therapist_metrics_dashboard_v3(
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
begin
  if p_period_days not in (30, 60) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_dashboard := public.get_therapist_metrics_dashboard_v2(p_period_days);
  v_overview := public.get_therapist_metrics_overview_v2(p_period_days);

  return v_dashboard || jsonb_build_object(
    'contractVersion', 3,
    'metricDefinitionVersion', 3,
    'meta', v_overview -> 'meta',
    'overview', v_overview,
    'therapist', v_overview -> 'therapist'
  );
end;
$$;

comment on function public.get_therapist_metrics_dashboard_v3(integer) is
  'Authenticated therapist metrics dashboard with the 30/60-day discovery overview v2. Existing dashboard v2 remains unchanged for compatibility.';

revoke all on function public.get_therapist_metrics_dashboard_v3(integer)
  from public, anon;
grant execute on function public.get_therapist_metrics_dashboard_v3(integer)
  to authenticated;

create or replace function public.purge_therapist_metrics_telemetry_v1(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_cutoff_at timestamptz := v_now - interval '120 days';
  -- A daily aggregate represents one local calendar day. Keeping today plus
  -- the preceding 119 local dates caps the retained window at 120 days.
  v_cutoff_date date := (v_now at time zone 'America/Sao_Paulo')::date - 119;
  v_events_deleted integer := 0;
  v_aggregates_deleted integer := 0;
  v_ingestion_deleted integer := 0;
  v_health_runs_deleted integer := 0;
begin
  delete from public.therapist_metric_events
  where occurred_at < v_cutoff_at;
  get diagnostics v_events_deleted = row_count;

  delete from public.therapist_metric_daily_aggregates
  where metric_date < v_cutoff_date;
  get diagnostics v_aggregates_deleted = row_count;

  delete from public.therapist_metric_ingestion_daily_health
  where metric_date < v_cutoff_date;
  get diagnostics v_ingestion_deleted = row_count;

  delete from public.therapist_metric_telemetry_health_runs
  where metric_date < v_cutoff_date;
  get diagnostics v_health_runs_deleted = row_count;

  return jsonb_build_object(
    'aggregates', v_aggregates_deleted,
    'events', v_events_deleted,
    'healthRuns', v_health_runs_deleted,
    'ingestionHealth', v_ingestion_deleted,
    'retentionDays', 120
  );
end;
$$;

comment on function public.purge_therapist_metrics_telemetry_v1(timestamptz) is
  'Service-role-only 120-day retention routine for pseudonymous therapist metric events, daily aggregates and aggregate-only telemetry health records. It never touches bookings, payments, favourites or audit events.';

revoke all on function public.purge_therapist_metrics_telemetry_v1(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_therapist_metrics_telemetry_v1(timestamptz)
  to service_role;

create or replace function public.check_therapist_metrics_telemetry_health_v1(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_metric_date date := (v_now at time zone 'America/Sao_Paulo')::date;
  v_enabled boolean := false;
  v_last_event_at timestamptz;
  v_failed_requests integer := 0;
  v_aggregate_mismatches integer := 0;
  v_funnel_violations integer := 0;
  v_status text;
  v_purge jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('therapist_metrics_telemetry_health_v1'));
  v_purge := public.purge_therapist_metrics_telemetry_v1(v_now);

  select config.public_telemetry_enabled
    into v_enabled
  from public.therapist_metrics_runtime_config as config
  where config.singleton = true;

  select max(metric_event.occurred_at)
    into v_last_event_at
  from public.therapist_metric_events as metric_event;

  select coalesce(health.failed_requests, 0)
    into v_failed_requests
  from public.therapist_metric_ingestion_daily_health as health
  where health.metric_date = v_metric_date;
  v_failed_requests := coalesce(v_failed_requests, 0);

  with event_counts as (
    select
      metric_event.therapist_profile_id,
      metric_event.metric_date,
      count(*) filter (where metric_event.event_type = 'search_impression')::integer as search_impressions,
      count(*) filter (where metric_event.event_type = 'profile_view')::integer as profile_views,
      count(*) filter (where metric_event.event_type = 'booking_flow_started')::integer as booking_flow_starts,
      count(*) filter (where metric_event.event_type = 'favorite_therapist_added')::integer as favorites_added
    from public.therapist_metric_events as metric_event
    where metric_event.metric_date >= v_metric_date - 120
      and metric_event.definition_version = 1
    group by metric_event.therapist_profile_id, metric_event.metric_date
  ), compared as (
    select 1
    from event_counts as event_count
    full join public.therapist_metric_daily_aggregates as aggregate
      on aggregate.therapist_profile_id = event_count.therapist_profile_id
      and aggregate.metric_date = event_count.metric_date
      and aggregate.definition_version = 1
    where coalesce(event_count.metric_date, aggregate.metric_date) >= v_metric_date - 120
      and (
        coalesce(event_count.search_impressions, 0) <> coalesce(aggregate.search_impressions, 0)
        or coalesce(event_count.profile_views, 0) <> coalesce(aggregate.profile_views, 0)
        or coalesce(event_count.booking_flow_starts, 0) <> coalesce(aggregate.booking_flow_starts, 0)
        or coalesce(event_count.favorites_added, 0) <> coalesce(aggregate.favorites_added, 0)
      )
  )
  select count(*) into v_aggregate_mismatches from compared;

  with search_visitors as (
    select distinct
      event.therapist_profile_id,
      event.session_key_hash
    from public.therapist_metric_events as event
    where event.event_source = 'browser'
      and event.event_type = 'search_impression'
      and event.session_key_hash is not null
      and event.metric_date >= v_metric_date - 120
  ), profile_conversions as (
    select distinct
      profile_event.therapist_profile_id,
      profile_event.session_key_hash
    from public.therapist_metric_events as profile_event
    where profile_event.event_source = 'browser'
      and profile_event.event_type = 'profile_view'
      and profile_event.session_key_hash is not null
      and profile_event.metric_date >= v_metric_date - 120
      and exists (
        select 1
        from public.therapist_metric_events as search_event
        where search_event.therapist_profile_id = profile_event.therapist_profile_id
          and search_event.session_key_hash = profile_event.session_key_hash
          and search_event.event_source = 'browser'
          and search_event.event_type = 'search_impression'
          and search_event.occurred_at <= profile_event.occurred_at
      )
  ), profile_visitors as (
    select distinct
      event.therapist_profile_id,
      event.session_key_hash
    from public.therapist_metric_events as event
    where event.event_source = 'browser'
      and event.event_type = 'profile_view'
      and event.session_key_hash is not null
      and event.metric_date >= v_metric_date - 120
  ), booking_conversions as (
    select distinct
      booking_event.therapist_profile_id,
      booking_event.session_key_hash
    from public.therapist_metric_events as booking_event
    where booking_event.event_source = 'browser'
      and booking_event.event_type = 'booking_flow_started'
      and booking_event.session_key_hash is not null
      and booking_event.metric_date >= v_metric_date - 120
      and exists (
        select 1
        from public.therapist_metric_events as profile_event
        where profile_event.therapist_profile_id = booking_event.therapist_profile_id
          and profile_event.session_key_hash = booking_event.session_key_hash
          and profile_event.event_source = 'browser'
          and profile_event.event_type = 'profile_view'
          and profile_event.occurred_at <= booking_event.occurred_at
      )
  ), search_counts as (
    select therapist_profile_id, count(*)::integer as searches
    from search_visitors
    group by therapist_profile_id
  ), profile_conversion_counts as (
    select therapist_profile_id, count(*)::integer as profiles_after_search
    from profile_conversions
    group by therapist_profile_id
  ), profile_counts as (
    select therapist_profile_id, count(*)::integer as profiles
    from profile_visitors
    group by therapist_profile_id
  ), booking_conversion_counts as (
    select therapist_profile_id, count(*)::integer as bookings_after_profile
    from booking_conversions
    group by therapist_profile_id
  ), funnel_counts as (
    select
      coalesce(
        search_count.therapist_profile_id,
        profile_conversion_count.therapist_profile_id,
        profile_count.therapist_profile_id,
        booking_conversion_count.therapist_profile_id
      ) as therapist_profile_id,
      coalesce(search_count.searches, 0) as searches,
      coalesce(profile_conversion_count.profiles_after_search, 0) as profiles_after_search,
      coalesce(profile_count.profiles, 0) as profiles,
      coalesce(booking_conversion_count.bookings_after_profile, 0) as bookings_after_profile
    from search_counts as search_count
    full join profile_conversion_counts as profile_conversion_count
      on profile_conversion_count.therapist_profile_id = search_count.therapist_profile_id
    full join profile_counts as profile_count
      on profile_count.therapist_profile_id = coalesce(
        search_count.therapist_profile_id,
        profile_conversion_count.therapist_profile_id
      )
    full join booking_conversion_counts as booking_conversion_count
      on booking_conversion_count.therapist_profile_id = coalesce(
        search_count.therapist_profile_id,
        profile_conversion_count.therapist_profile_id,
        profile_count.therapist_profile_id
      )
  )
  select count(*) into v_funnel_violations
  from funnel_counts
  where profiles_after_search > searches
    or bookings_after_profile > profiles;

  v_status := case
    when not coalesce(v_enabled, false) then 'telemetry_disabled'
    when v_failed_requests > 0
      or v_aggregate_mismatches > 0
      or v_funnel_violations > 0 then 'attention'
    when v_last_event_at is null then 'no_activity'
    else 'healthy'
  end;

  insert into public.therapist_metric_telemetry_health_runs (
    metric_date,
    status,
    last_event_at,
    aggregate_mismatch_count,
    funnel_violation_count,
    events_purged,
    aggregates_purged,
    ingestion_health_rows_purged,
    checked_at
  )
  values (
    v_metric_date,
    v_status,
    v_last_event_at,
    v_aggregate_mismatches,
    v_funnel_violations,
    coalesce((v_purge ->> 'events')::integer, 0),
    coalesce((v_purge ->> 'aggregates')::integer, 0),
    coalesce((v_purge ->> 'ingestionHealth')::integer, 0),
    v_now
  )
  on conflict (metric_date) do update
  set status = excluded.status,
      last_event_at = excluded.last_event_at,
      aggregate_mismatch_count = excluded.aggregate_mismatch_count,
      funnel_violation_count = excluded.funnel_violation_count,
      events_purged = excluded.events_purged,
      aggregates_purged = excluded.aggregates_purged,
      ingestion_health_rows_purged = excluded.ingestion_health_rows_purged,
      checked_at = excluded.checked_at,
      updated_at = now();

  return jsonb_build_object(
    'aggregateMismatches', v_aggregate_mismatches,
    'funnelViolations', v_funnel_violations,
    'lastActivityAt', v_last_event_at,
    'status', v_status
  );
end;
$$;

comment on function public.check_therapist_metrics_telemetry_health_v1(timestamptz) is
  'Daily aggregate-only freshness, projection coherence, funnel monotonicity and 120-day retention check for public therapist metrics.';

revoke all on function public.check_therapist_metrics_telemetry_health_v1(timestamptz)
  from public, anon, authenticated;
grant execute on function public.check_therapist_metrics_telemetry_health_v1(timestamptz)
  to service_role;

create or replace function public.admin_get_therapist_metrics_telemetry_health_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_metric_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_daily public.therapist_metric_ingestion_daily_health%rowtype;
  v_run public.therapist_metric_telemetry_health_runs%rowtype;
  v_last_activity_at timestamptz;
  v_state text;
begin
  if not public.is_current_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select config.public_telemetry_enabled
    into v_enabled
  from public.therapist_metrics_runtime_config as config
  where config.singleton = true;

  select * into v_daily
  from public.therapist_metric_ingestion_daily_health as daily
  where daily.metric_date = v_metric_date;

  select * into v_run
  from public.therapist_metric_telemetry_health_runs as health_run
  order by health_run.checked_at desc, health_run.metric_date desc
  limit 1;

  select max(metric_event.occurred_at)
    into v_last_activity_at
  from public.therapist_metric_events as metric_event;

  v_state := case
    when not coalesce(v_enabled, false) then 'disabled'
    when v_run.status = 'attention' then 'attention'
    when v_last_activity_at is null then 'no_activity'
    else 'ready'
  end;

  return jsonb_build_object(
    'contractVersion', 1,
    'state', v_state,
    'telemetryEnabled', coalesce(v_enabled, false),
    'retentionDays', 120,
    'updatedAt', (
      select config.updated_at
      from public.therapist_metrics_runtime_config as config
      where config.singleton = true
    ),
    'lastActivityAt', v_last_activity_at,
    'lastCheckedAt', v_run.checked_at,
    'counters', jsonb_build_object(
      'acceptedEvents', coalesce(v_daily.accepted_events, 0),
      'duplicateEvents', coalesce(v_daily.duplicate_events, 0),
      'failedRequests', coalesce(v_daily.failed_requests, 0),
      'invalidRequests', coalesce(v_daily.invalid_requests, 0),
      'rateLimitedRequests', coalesce(v_daily.rate_limited_requests, 0)
    ),
    'integrity', jsonb_build_object(
      'aggregateMismatches', coalesce(v_run.aggregate_mismatch_count, 0),
      'funnelViolations', coalesce(v_run.funnel_violation_count, 0)
    )
  );
end;
$$;

comment on function public.admin_get_therapist_metrics_telemetry_health_v1() is
  'Admin-only aggregate health read model for public therapist metric telemetry. It never returns visitors, profiles, searches, IP addresses or user agents.';

revoke all on function public.admin_get_therapist_metrics_telemetry_health_v1()
  from public, anon;
grant execute on function public.admin_get_therapist_metrics_telemetry_health_v1()
  to authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'tes-therapist-metrics-discovery-health-v1'
  ) then
    perform cron.unschedule('tes-therapist-metrics-discovery-health-v1');
  end if;

  perform cron.schedule(
    'tes-therapist-metrics-discovery-health-v1',
    '20 3 * * *',
    $cron$select public.check_therapist_metrics_telemetry_health_v1(now());$cron$
  );
end;
$$;
