begin;

select plan(15);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_session_evolution_comparison_v1(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the session comparison read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_session_evolution_comparison_v1(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the session comparison read model'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_session_evolution_comparison_v1(30)
    ->> 'contractVersion',
  '1',
  'comparison exposes a versioned contract'
);

select is(
  jsonb_array_length(
    public.get_therapist_session_evolution_comparison_v1(30) -> 'points'
  ),
  30,
  '30-day comparison returns 30 aligned points'
);

select is(
  jsonb_array_length(
    public.get_therapist_session_evolution_comparison_v1(90) -> 'points'
  ),
  90,
  '90-day comparison returns 90 aligned points'
);

select is(
  public.get_therapist_session_evolution_comparison_v1(30)
    #>> '{points,0,currentDate}',
  (
    public.get_therapist_session_evolution_comparison_v1(30)
      #>> '{meta,periodStart}'
  )::timestamptz::date::text,
  'the first current point starts at the selected period boundary'
);

select is(
  public.get_therapist_session_evolution_comparison_v1(30)
    #>> '{points,0,previousDate}',
  (
    public.get_therapist_session_evolution_comparison_v1(30)
      #>> '{meta,previousPeriodStart}'
  )::timestamptz::date::text,
  'the first previous point starts at the preceding period boundary'
);

select is(
  (
    select sum((point ->> 'current')::integer)
    from jsonb_array_elements(
      public.get_therapist_session_evolution_comparison_v1(30) -> 'points'
    ) as point
  )::bigint,
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{summary,sessionsCompleted,value}'
  )::bigint,
  'current comparison series matches the canonical completed-session total'
);

select is(
  (
    select sum((point ->> 'previous')::integer)
    from jsonb_array_elements(
      public.get_therapist_session_evolution_comparison_v1(30) -> 'points'
    ) as point
  )::bigint,
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{summary,sessionsCompleted,previousValue}'
  )::bigint,
  'previous comparison series matches the canonical preceding-period total'
);

select ok(
  position(
    'patientProfileId'
    in public.get_therapist_session_evolution_comparison_v1(30)::text
  ) = 0
  and position(
    'patient_profile_id'
    in public.get_therapist_session_evolution_comparison_v1(30)::text
  ) = 0,
  'comparison exposes no patient identifier'
);

select throws_ok(
  'select public.get_therapist_session_evolution_comparison_v1(31)',
  '22023',
  'VALIDATION_ERROR',
  'comparison rejects unsupported periods'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_session_evolution_comparison_v1(30)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapists cannot invoke the comparison read model'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_session_evolution_comparison_v1(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot invoke the comparison read model'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  'select public.get_therapist_session_evolution_comparison_v1(30)',
  '42501',
  'FORBIDDEN',
  'anonymous execution remains blocked even if called directly'
);

select is(
  (
    select proconfig::text
    from pg_proc
    where oid =
      'public.get_therapist_session_evolution_comparison_v1(integer)'::regprocedure
  ),
  '{"search_path=\"\""}',
  'security definer uses an empty search_path'
);

select * from finish();

rollback;
