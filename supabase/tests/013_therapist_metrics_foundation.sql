begin;

select plan(18);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_metrics_foundation_v1()',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the MTR-0.1 read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_metrics_foundation_v1()',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the private metrics read model'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_metrics_foundation_v1() ->> 'contractVersion',
  '1',
  'read model exposes contract version 1'
);

select is(
  public.get_therapist_metrics_foundation_v1()
    #>> '{therapist,profileId}',
  'c1000000-0000-4000-8000-000000000001',
  'therapist identity is derived from auth.uid()'
);

select is(
  public.get_therapist_metrics_foundation_v1() #>> '{meta,periodDays}',
  '30',
  'current period uses the approved 30 complete local days'
);

select is(
  (
    public.get_therapist_metrics_foundation_v1() #>> '{meta,periodEnd}'
  )::timestamptz,
  (
    (
      now() at time zone (
        public.get_therapist_metrics_foundation_v1() #>> '{meta,timezone}'
      )
    )::date::timestamp at time zone (
      public.get_therapist_metrics_foundation_v1() #>> '{meta,timezone}'
    )
  ),
  'period ends at the start of the current therapist-local day'
);

select ok(
  (
    public.get_therapist_metrics_foundation_v1()
      #> '{counters,peopleServed}'
  ) ?& array[
    'status',
    'value',
    'previousValue',
    'direction',
    'directionCopyKey',
    'unit'
  ],
  'people served counter includes its full directional contract'
);

select ok(
  (
    public.get_therapist_metrics_foundation_v1()
      #> '{counters,sessionsCompleted}'
  ) ?& array[
    'status',
    'value',
    'previousValue',
    'direction',
    'directionCopyKey',
    'unit'
  ],
  'sessions counter includes its full directional contract'
);

select ok(
  (
    public.get_therapist_metrics_foundation_v1()
      #> '{counters,serviceMinutes}'
  ) ?& array[
    'status',
    'value',
    'previousValue',
    'direction',
    'directionCopyKey',
    'unit'
  ],
  'service time counter includes its full directional contract'
);

select ok(
  (
    public.get_therapist_metrics_foundation_v1()
      #>> '{counters,sessionsCompleted,value}'
  )::integer >= 0,
  'completed sessions are returned as a non-negative real aggregate'
);

select ok(
  (
    public.get_therapist_metrics_foundation_v1()
      #>> '{counters,serviceMinutes,value}'
  )::integer >= 0,
  'service time is returned in non-negative integer minutes'
);

select is(
  (
    public.get_therapist_metrics_foundation_v1()
      #>> '{counters,peopleServed,value}'
  )::bigint,
  (
    select count(distinct booking.patient_profile_id)
    from public.bookings as booking
    where booking.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and booking.status = 'completed'
      and booking.starts_at >= (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'people served matches the canonical distinct-patient aggregation'
);

select is(
  (
    public.get_therapist_metrics_foundation_v1()
      #>> '{counters,sessionsCompleted,value}'
  )::bigint,
  (
    select count(*)
    from public.bookings as booking
    where booking.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and booking.status = 'completed'
      and booking.starts_at >= (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'sessions completed matches the canonical booking aggregation'
);

select is(
  (
    public.get_therapist_metrics_foundation_v1()
      #>> '{counters,serviceMinutes,value}'
  )::bigint,
  (
    select coalesce(sum(booking.service_duration_minutes_snapshot), 0)
    from public.bookings as booking
    where booking.therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and booking.status = 'completed'
      and booking.starts_at >= (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_metrics_foundation_v1()
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'service time matches the canonical immutable snapshot aggregation'
);

reset role;

select ok(
  not (
    public.list_private_therapist_services_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'
    ) #> '{items,0,metrics}'
  ) ? 'favoriteCount',
  'private service contracts no longer expose profile favorites as service data'
);

select ok(
  not exists (
    select 1
    from public.therapist_service_metrics_v1
    where favorite_count is not null
  ),
  'legacy service favorite column is neutralized instead of duplicating profile favorites'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_metrics_foundation_v1()',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapist cannot bypass the advanced metrics capability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_metrics_foundation_v1()',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patient cannot invoke the private therapist metrics read model'
);

select * from finish();

rollback;
