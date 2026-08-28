begin;

select plan(33);

-- The local stack intentionally preserves data between runs. Isolate the two
-- fixture therapists inside this transaction so historical aggregates cannot
-- change RLS counts or the expected complete-day empty state.
delete from public.therapist_metric_daily_aggregates
where therapist_profile_id in (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002'
);

select ok(
  has_function_privilege(
    'anon',
    'public.record_public_therapist_metric_events_v1(uuid,jsonb)',
    'EXECUTE'
  ),
  'anonymous visitors can invoke the validated telemetry boundary'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_metrics_overview_v1(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private overview read model'
);

select is(
  has_table_privilege(
    'anon',
    'public.therapist_metric_events',
    'SELECT'
  ),
  false,
  'anonymous visitors cannot read raw metric events'
);

select is(
  has_table_privilege(
    'anon',
    'public.therapist_metric_events',
    'INSERT'
  ),
  false,
  'anonymous visitors cannot insert raw metric events directly'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.therapist_metric_daily_aggregates',
    'SELECT'
  ),
  'authenticated users have an RLS-protected aggregate read surface'
);

update public.therapist_metrics_runtime_config
set public_telemetry_enabled = false;

set local role anon;

select is(
  public.record_public_therapist_metric_events_v1(
    '10000000-0000-4000-8000-000000000001',
    '[{
      "eventId": "20000000-0000-4000-8000-000000000001",
      "eventType": "profile_view",
      "therapistSlug": "ana-oliveira",
      "sourceSurface": "therapist_profile"
    }]'::jsonb
  ) ->> 'status',
  'disabled',
  'public telemetry fails closed before the privacy activation gate'
);

reset role;

update public.therapist_metrics_runtime_config
set public_telemetry_enabled = true;

set local role anon;

select is(
  (
    public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000001',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000001",
        "eventType": "search_impression",
        "therapistSlug": "ana-oliveira",
        "resultSetId": "30000000-0000-4000-8000-000000000001",
        "resultPosition": 1,
        "sourceSurface": "therapist_search"
      }, {
        "eventId": "20000000-0000-4000-8000-000000000002",
        "eventType": "profile_view",
        "therapistSlug": "ana-oliveira",
        "sourceSurface": "therapist_profile"
      }, {
        "eventId": "20000000-0000-4000-8000-000000000003",
        "eventType": "booking_flow_started",
        "therapistSlug": "ana-oliveira",
        "serviceId": "d1000000-0000-4000-8000-000000000001",
        "sourceSurface": "therapist_profile"
      }]'::jsonb
    ) ->> 'accepted'
  )::integer,
  3,
  'validated search, profile and booking-flow events are accepted'
);

select is(
  (
    public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000002',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000005",
        "eventType": "booking_flow_started",
        "therapistSlug": "ana-oliveira",
        "serviceId": "d1000000-0000-4000-8000-000000000001",
        "sourceSurface": "therapist_search"
      }]'::jsonb
    ) ->> 'accepted'
  )::integer,
  1,
  'a direct booking start from the search keeps its real source surface'
);

select is(
  (
    public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000001',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000001",
        "eventType": "search_impression",
        "therapistSlug": "ana-oliveira",
        "resultSetId": "30000000-0000-4000-8000-000000000001",
        "resultPosition": 1,
        "sourceSurface": "therapist_search"
      }]'::jsonb
    ) ->> 'accepted'
  )::integer,
  0,
  'replaying the same event does not increment the aggregate'
);

select is(
  (
    public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000001',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000001",
        "eventType": "search_impression",
        "therapistSlug": "ana-oliveira",
        "resultSetId": "30000000-0000-4000-8000-000000000001",
        "resultPosition": 1,
        "sourceSurface": "therapist_search"
      }]'::jsonb
    ) ->> 'duplicates'
  )::integer,
  1,
  'idempotent replay is reported as a duplicate'
);

select throws_ok(
  $sql$
    select public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000001',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000001",
        "eventType": "profile_view",
        "therapistSlug": "ana-oliveira",
        "sourceSurface": "therapist_profile"
      }]'::jsonb
    )
  $sql$,
  '23505',
  'REQUEST_CONFLICT',
  'reusing an event id with a different payload is a conflict'
);

select throws_ok(
  $sql$
    select public.record_public_therapist_metric_events_v1(
      '10000000-0000-4000-8000-000000000001',
      '[{
        "eventId": "20000000-0000-4000-8000-000000000004",
        "eventType": "profile_view",
        "therapistSlug": "ana-oliveira",
        "sourceSurface": "therapist_profile",
        "freeText": "must not be stored"
      }]'::jsonb
    )
  $sql$,
  '22023',
  'VALIDATION_ERROR',
  'free text and unknown event fields are rejected'
);

reset role;

select is(
  (
    select count(*)
    from public.therapist_metric_events
    where event_id in (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000005'
    )
  ),
  4::bigint,
  'append-only event store contains one row per accepted event'
);

select is(
  (
    select source_surface
    from public.therapist_metric_events
    where event_id = '20000000-0000-4000-8000-000000000005'
  ),
  'therapist_search',
  'the event store does not attribute a direct search CTA to the profile'
);

select hasnt_column(
  'public',
  'therapist_metric_events',
  'ip_address',
  'event store has no raw IP column'
);

select hasnt_column(
  'public',
  'therapist_metric_events',
  'user_agent',
  'event store has no user agent column'
);

select is(
  (
    select search_impressions
    from public.therapist_metric_daily_aggregates
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and metric_date = (
        now() at time zone 'America/Sao_Paulo'
      )::date
      and definition_version = 1
  ),
  1,
  'search impression is aggregated once'
);

select is(
  (
    select profile_views
    from public.therapist_metric_daily_aggregates
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and metric_date = (
        now() at time zone 'America/Sao_Paulo'
      )::date
      and definition_version = 1
  ),
  1,
  'profile view is aggregated once'
);

select is(
  (
    select booking_flow_starts
    from public.therapist_metric_daily_aggregates
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and metric_date = (
        now() at time zone 'America/Sao_Paulo'
      )::date
      and definition_version = 1
  ),
  2,
  'each accepted booking flow start is aggregated once'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.therapist_metric_daily_aggregates
    where therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'therapist can read the own private daily aggregate'
);

select is(
  public.get_therapist_metrics_overview_v1(30) ->> 'contractVersion',
  '1',
  'overview exposes a versioned contract'
);

select is(
  public.get_therapist_metrics_overview_v1(60) #>> '{meta,periodDays}',
  '60',
  'overview accepts the approved 60-day complete period'
);

select is(
  public.get_therapist_metrics_overview_v1(90) #>> '{meta,periodDays}',
  '90',
  'overview accepts the approved 90-day complete period'
);

select is(
  public.get_therapist_metrics_overview_v1(120) #>> '{meta,periodDays}',
  '120',
  'overview accepts the approved 120-day complete period'
);

select is(
  public.get_therapist_metrics_overview_v1(30) #>> '{discovery,status}',
  'empty',
  'events from the incomplete current day do not leak into the complete-day period'
);

select is(
  public.get_therapist_metrics_overview_v1(30) #>> '{occupancy,status}',
  'unavailable',
  'occupancy remains unavailable without versioned historical offer'
);

select ok(
  position(
    'patientProfileId'
    in public.get_therapist_metrics_overview_v1(30)::text
  ) = 0,
  'private overview does not expose patient identifiers'
);

select is(
  (
    public.get_therapist_metrics_overview_v1(30)
      #>> '{profileFavorites,minimumSample}'
  )::integer,
  10,
  'profile favorites use the canonical sample lock of ten'
);

select throws_ok(
  'select public.get_therapist_metrics_overview_v1(31)',
  '22023',
  'VALIDATION_ERROR',
  'unsupported overview period is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.therapist_metric_daily_aggregates
  ),
  0::bigint,
  'another therapist cannot read the owner aggregate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_metrics_overview_v1(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patient cannot invoke the private therapist overview'
);

select throws_ok(
  'select count(*) from public.therapist_metric_events',
  '42501',
  null,
  'authenticated clients cannot read raw events'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_metrics_overview_v1(30)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapist cannot bypass the advanced metrics capability'
);

select * from finish();

rollback;
