begin;

\ir fixtures/publication-ready-local.inc

select set_config('timezone', 'America/Sao_Paulo', true);
select plan(35);

select ok(
  to_regprocedure('public.record_public_therapist_metric_events_v2(uuid,jsonb)') is not null,
  'public telemetry ingress V2 is installed additively'
);

select ok(
  to_regprocedure('public.record_public_therapist_metric_events_v1(uuid,jsonb)') is not null,
  'public telemetry ingress V1 remains available for existing callers'
);

select ok(
  has_function_privilege(
    'anon',
    'public.record_public_therapist_metric_events_v2(uuid,jsonb)',
    'EXECUTE'
  ),
  'anonymous visitors can use the validated V2 ingress only'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.set_therapist_metrics_runtime_v1(boolean,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'only the server role can run the audited telemetry operation'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.set_therapist_metrics_runtime_v1(boolean,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  false,
  'a browser session cannot change telemetry configuration'
);

select is(
  has_table_privilege(
    'service_role',
    'public.therapist_metrics_runtime_config',
    'UPDATE'
  ),
  false,
  'the service role cannot bypass the audited activation operation with a direct update'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_therapist_metrics_telemetry_health_v1()',
    'EXECUTE'
  ),
  'authenticated admins can request the aggregate health read model after authorization'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_therapist_metrics_telemetry_health_v1()',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot access the telemetry health read model'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.purge_therapist_metrics_telemetry_v1(timestamp with time zone)',
    'EXECUTE'
  ),
  'the server role can run the 120-day retention routine'
);

select is(
  has_table_privilege(
    'anon',
    'public.therapist_metric_ingestion_daily_health',
    'SELECT'
  ),
  false,
  'anonymous visitors cannot read operational telemetry counters directly'
);

insert into auth.users (id, email)
values (
  'a1530000-0000-4000-8000-000000000001',
  'metrics-governance-admin@example.test'
)
on conflict (id) do update
set email = excluded.email;

insert into public.profiles (id, role, display_name, email)
values (
  'a1530000-0000-4000-8000-000000000001',
  'admin',
  'Metrics Governance Admin',
  'metrics-governance-admin@example.test'
)
on conflict (id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email;

update public.therapist_metrics_runtime_config
set public_telemetry_enabled = false;

set local role anon;

select is(
  public.record_public_therapist_metric_events_v2(
    '15300000-0000-4000-8000-000000000001',
    '[{
      "eventId": "15300000-0000-4000-8000-000000000011",
      "eventType": "profile_view",
      "therapistSlug": "ana-oliveira",
      "sourceSurface": "therapist_profile"
    }]'::jsonb
  ) ->> 'status',
  'disabled',
  'V2 keeps telemetry disabled until the server-side operation is approved and run'
);

reset role;

set local role service_role;

select is(
  public.set_therapist_metrics_runtime_v1(
    true,
    'a1530000-0000-4000-8000-000000000001',
    'Ativação controlada aprovada pelos sócios do TES para homologação.',
    '15300000-0000-4000-8000-000000000021',
    'mtr-governance-test'
  ) ->> 'enabled',
  'true',
  'the service-side operation enables telemetry only for a validated admin actor'
);

select is(
  (
    select count(*)
    from public.admin_audit_events
    where request_id = '15300000-0000-4000-8000-000000000021'
      and action = 'metrics.telemetry.enabled'
      and next_state @> '{"approval":"tes_partners","retentionDays":120}'::jsonb
  ),
  1::bigint,
  'the approved activation is recorded in the append-only administrative audit trail'
);

select is(
  public.set_therapist_metrics_runtime_v1(
    true,
    'a1530000-0000-4000-8000-000000000001',
    'Esta chamada não deve substituir a ativação já registrada.',
    '15300000-0000-4000-8000-000000000022',
    'mtr-governance-test'
  ) ->> 'applied',
  'false',
  'repeating the same target state is idempotent and creates no second transition'
);

select throws_ok(
  $$
    select public.set_therapist_metrics_runtime_v1(
      false,
      'bbbbbbbb-0000-4000-8000-000000000001',
      'Tentativa sem perfil administrativo válido para a operação interna.',
      '15300000-0000-4000-8000-000000000023',
      'mtr-governance-test'
    )
  $$,
  '42501',
  'FORBIDDEN',
  'the server operation rejects an actor without an administrative profile'
);

reset role;

set local role anon;

select is(
  public.record_public_therapist_metric_events_v2(
    '15300000-0000-4000-8000-000000000031',
    '[{
      "eventId": "15300000-0000-4000-8000-000000000032",
      "eventType": "search_impression",
      "therapistSlug": "ana-oliveira",
      "resultSetId": "15300000-0000-4000-8000-000000000033",
      "resultPosition": 1,
      "sourceSurface": "therapist_search"
    }]'::jsonb
  ) ->> 'accepted',
  '1',
  'V2 accepts a privacy-safe public search impression'
);

select is(
  public.record_public_therapist_metric_events_v2(
    '15300000-0000-4000-8000-000000000031',
    '[{
      "eventId": "15300000-0000-4000-8000-000000000032",
      "eventType": "search_impression",
      "therapistSlug": "ana-oliveira",
      "resultSetId": "15300000-0000-4000-8000-000000000033",
      "resultPosition": 1,
      "sourceSurface": "therapist_search"
    }]'::jsonb
  ) ->> 'duplicates',
  '1',
  'V2 preserves the existing search impression deduplication contract'
);

select is(
  public.record_public_therapist_metric_events_v2(
    null,
    '{}'::jsonb
  ) ->> 'status',
  'invalid',
  'V2 records invalid payloads only as an aggregate outcome'
);

reset role;

select is(
  (
    select accepted_events
    from public.therapist_metric_ingestion_daily_health
    where metric_date = (now() at time zone 'America/Sao_Paulo')::date
  ),
  1,
  'health counters record accepted events without storing a visitor record'
);

select is(
  (
    select duplicate_events
    from public.therapist_metric_ingestion_daily_health
    where metric_date = (now() at time zone 'America/Sao_Paulo')::date
  ),
  1,
  'health counters record deduplicated events'
);

select is(
  (
    select invalid_requests
    from public.therapist_metric_ingestion_daily_health
    where metric_date = (now() at time zone 'America/Sao_Paulo')::date
  ),
  1,
  'health counters record invalid requests without their payload'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_metrics_overview_v1(90) #>> '{meta,periodDays}',
  '90',
  'the V1 overview keeps its previous compatibility period'
);

select is(
  public.get_therapist_metrics_overview_v2(60) ->> 'contractVersion',
  '2',
  'the V2 overview publishes its new versioned contract'
);

select is(
  public.get_therapist_metrics_overview_v2(60) #>> '{meta,periodDays}',
  '60',
  'the V2 overview supports the 60-day complete period'
);

select throws_ok(
  'select public.get_therapist_metrics_overview_v2(90)',
  '22023',
  'VALIDATION_ERROR',
  'the V2 overview rejects periods outside the 30 and 60-day interface contract'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1530000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  public.admin_get_therapist_metrics_telemetry_health_v1() ? 'counters',
  'the admin health model returns aggregate counters'
);

select is(
  public.admin_get_therapist_metrics_telemetry_health_v1()::text like '%15300000-0000-4000-8000-000000000031%',
  false,
  'the admin health model does not expose visitor session identifiers'
);

reset role;

set local role service_role;

select ok(
  public.check_therapist_metrics_telemetry_health_v1(now()) ->> 'status'
    in ('healthy', 'attention', 'no_activity', 'telemetry_disabled'),
  'the daily health routine returns a bounded aggregate status'
);

reset role;

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'tes-therapist-metrics-discovery-health-v1'
  ),
  'the daily telemetry health and retention job is scheduled'
);

insert into public.therapist_metric_events (
  event_id,
  event_type,
  event_source,
  therapist_profile_id,
  session_key_hash,
  source_surface,
  dedupe_key,
  metric_date,
  occurred_at
)
values (
  '15300000-0000-4000-8000-000000000041',
  'profile_view',
  'browser',
  'c1000000-0000-4000-8000-000000000001',
  'retention-test-session-hash',
  'therapist_profile',
  'retention-test-dedupe-key',
  current_date - 120,
  now() - interval '121 days'
);

insert into public.therapist_metric_daily_aggregates (
  therapist_profile_id,
  metric_date,
  definition_version,
  fresh_through
)
values (
  'c1000000-0000-4000-8000-000000000001',
  current_date - 120,
  1,
  now() - interval '120 days'
)
on conflict (therapist_profile_id, metric_date, definition_version) do update
set fresh_through = excluded.fresh_through;

insert into public.therapist_metric_ingestion_daily_health (metric_date)
values (current_date - 120)
on conflict (metric_date) do nothing;

insert into public.therapist_metric_telemetry_health_runs (metric_date, status)
values (current_date - 120, 'healthy')
on conflict (metric_date) do nothing;

insert into public.therapist_metric_ingestion_daily_health (metric_date)
values (current_date - 119)
on conflict (metric_date) do nothing;

set local role service_role;

select ok(
  (public.purge_therapist_metrics_telemetry_v1(now()) ->> 'retentionDays')::integer = 120,
  'the retention routine reports the approved 120-day policy'
);

reset role;

select is(
  (
    select count(*) from public.therapist_metric_events
    where event_id = '15300000-0000-4000-8000-000000000041'
  ),
  0::bigint,
  'raw pseudonymous events older than 120 days expire'
);

select is(
  (
    select count(*) from public.therapist_metric_daily_aggregates
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and metric_date = current_date - 120
      and definition_version = 1
  ),
  0::bigint,
  'daily aggregates older than the 120-day window expire'
);

select is(
  (
    select count(*) from public.therapist_metric_ingestion_daily_health
    where metric_date = current_date - 120
  ),
  0::bigint,
  'operational ingestion counters older than the 120-day window expire'
);

select is(
  (
    select count(*) from public.therapist_metric_telemetry_health_runs
    where metric_date = current_date - 120
  ),
  0::bigint,
  'operational health runs older than the 120-day window expire'
);

select is(
  (
    select count(*) from public.therapist_metric_ingestion_daily_health
    where metric_date = current_date - 119
  ),
  1::bigint,
  'the 120th retained local day remains available'
);

select * from finish();

rollback;
