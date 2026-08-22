begin;

select plan(20);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_metrics_dashboard_v2(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke dashboard v2'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_metrics_dashboard_v2(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke dashboard v2'
);

select is(
  has_table_privilege('authenticated', 'public.availability_rule_history', 'SELECT'),
  false,
  'authenticated users cannot read availability rule history directly'
);

select is(
  has_table_privilege('authenticated', 'public.availability_exception_history', 'SELECT'),
  false,
  'authenticated users cannot read exception history directly'
);

select ok(
  exists (
    select 1
    from public.availability_rule_history
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'existing rules begin history at migration or first observed write'
);

select is(
  (
    select count(*)
    from public.availability_rule_history
    where source_rule_id = 'e1000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'one immutable event exists before a rule change'
);

update public.availability_rules
set end_time = '20:45', updated_at = now()
where id = 'e1000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.availability_rule_history
    where source_rule_id = 'e1000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'updating a rule appends rather than replaces history'
);

select is(
  (
    select operation
    from public.availability_rule_history
    where source_rule_id = 'e1000000-0000-4000-8000-000000000001'
    order by recorded_at desc, id desc
    limit 1
  ),
  'update',
  'the appended rule event records its operation'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_metrics_dashboard_v2(30) ->> 'contractVersion',
  '2',
  'dashboard exposes contract version two'
);

select is(
  public.get_therapist_metrics_dashboard_v2(30) #>> '{occupancy,status}',
  'forming',
  'occupancy remains in formation without complete coverage'
);

select is(
  public.get_therapist_metrics_dashboard_v2(60) #>> '{meta,periodDays}',
  '60',
  'dashboard preserves the canonical 60 day period'
);

select is(
  public.get_therapist_metrics_dashboard_v2(90) #>> '{meta,periodDays}',
  '90',
  'dashboard preserves the canonical 90 day period'
);

select ok(
  position('patientProfileId' in public.get_therapist_metrics_dashboard_v2(30)::text) = 0
  and position('patient_profile_id' in public.get_therapist_metrics_dashboard_v2(30)::text) = 0,
  'dashboard exposes no patient identifiers'
);

select is(
  public.get_therapist_metrics_dashboard_v2(120) #>> '{meta,periodDays}',
  '120',
  'dashboard preserves the canonical 120 day period'
);

reset role;

select lives_ok(
  $sql$
    select public.get_therapist_occupancy_metrics_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      120
    )
  $sql$,
  'occupancy accepts the approved 120-day period'
);

set local role authenticated;

select throws_ok(
  'select public.get_therapist_metrics_dashboard_v2(31)',
  '22023',
  'VALIDATION_ERROR',
  'unsupported periods are rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_metrics_dashboard_v2(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot invoke the therapist dashboard'
);

reset role;

update public.therapist_availability_history_coverage
set started_at = now() - interval '31 days'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

insert into public.availability_rule_history (
  source_rule_id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active,
  operation,
  recorded_at
) values (
  'e2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  null,
  2,
  '08:00',
  '18:00',
  'America/Sao_Paulo',
  true,
  'baseline',
  now() - interval '31 days'
);

select is(
  public.get_therapist_occupancy_metrics_v2(
    'c1000000-0000-4000-8000-000000000001',
    'America/Sao_Paulo',
    30
  ) ->> 'status',
  'ready',
  'occupancy becomes available after complete trustworthy coverage'
);

select ok(
  (
    public.get_therapist_occupancy_metrics_v2(
      'c1000000-0000-4000-8000-000000000001',
      'America/Sao_Paulo',
      30
    ) #>> '{current,offeredMinutes}'
  )::bigint > 0,
  'capacity is derived from historical availability buckets'
);

select is(
  (
    select count(*)
    from public.availability_exception_history
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  (
    select count(*)
    from public.availability_exceptions
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'every observed current exception has an immutable history event'
);

select * from finish();

rollback;
