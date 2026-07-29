begin;

select plan(29);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_session_metrics_v1(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the MTR-4 read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_interest_metrics_v1(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the MTR-5 read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_session_metrics_v1(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke MTR-4'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_interest_metrics_v1(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke MTR-5'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'bookings'
      and indexname = 'bookings_therapist_patient_completed_starts_idx'
  ),
  'continuity queries have a partial completed-booking index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_reschedule_requests'
      and indexname = 'booking_reschedule_requests_applied_booking_idx'
  ),
  'applied reschedule queries have a dedicated partial index'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_session_metrics_v1(30) ->> 'contractVersion',
  '1',
  'MTR-4 exposes a versioned contract'
);

select is(
  public.get_therapist_session_metrics_v1(90) #>> '{meta,periodDays}',
  '90',
  'MTR-4 accepts the approved 90-day period'
);

select is(
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{summary,sessionsCompleted,value}'
  )::bigint,
  (
    select count(*)
    from public.bookings as booking
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and booking.status = 'completed'
      and booking.starts_at >= (
        public.get_therapist_session_metrics_v1(30)
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_session_metrics_v1(30)
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'MTR-4 completed sessions match canonical bookings'
);

select is(
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{summary,sessionsRescheduled,value}'
  )::bigint,
  (
    select count(*)
    from public.booking_reschedule_requests as request
    join public.bookings as booking
      on booking.id = request.booking_id
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and request.status = 'applied'
      and request.applied_at >= (
        public.get_therapist_session_metrics_v1(30)
          #>> '{meta,periodStart}'
      )::timestamptz
      and request.applied_at < (
        public.get_therapist_session_metrics_v1(30)
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'MTR-4 counts only applied reschedules in the selected period'
);

select is(
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{summary,operationalPresence,minimumSample}'
  )::integer,
  10,
  'operational presence uses the canonical minimum sample'
);

select is(
  public.get_therapist_session_metrics_v1(30)
    #>> '{cancellationReasons,reason}',
  'cancellation_taxonomy_not_versioned',
  'free-text cancellation reasons remain unavailable'
);

select ok(
  position(
    'patientProfileId'
    in public.get_therapist_session_metrics_v1(30)::text
  ) = 0
  and position(
    'patient_profile_id'
    in public.get_therapist_session_metrics_v1(30)::text
  ) = 0,
  'MTR-4 exposes no patient identifier'
);

select ok(
  position(
    'cancellation_reason'
    in public.get_therapist_session_metrics_v1(30)::text
  ) = 0,
  'MTR-4 exposes no cancellation free text'
);

select is(
  public.get_therapist_interest_metrics_v1(30)
    #>> '{access,status}',
  'ready',
  'Premium Plus receives the protected MTR-5 contract'
);

select is(
  (
    public.get_therapist_interest_metrics_v1(30)
      #>> '{segments,minimumSample}'
  )::integer,
  10,
  'exclusive continuity segments use the minimum sample of ten'
);

select is(
  (
    public.get_therapist_interest_metrics_v1(30)
      #>> '{summary,peopleReturned,observedSample}'
  )::bigint,
  (
    select count(distinct booking.patient_profile_id)
    from public.bookings as booking
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and booking.status = 'completed'
      and booking.starts_at >= (
        public.get_therapist_interest_metrics_v1(30)
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_interest_metrics_v1(30)
          #>> '{meta,periodEnd}'
      )::timestamptz
  ),
  'people returned uses eligible people, not sessions, as its privacy sample'
);

select is(
  (
    public.get_therapist_interest_metrics_v1(30)
      #>> '{summary,sessionsPerPerson,observedSample}'
  )::bigint,
  (
    public.get_therapist_interest_metrics_v1(30)
      #>> '{summary,peopleReturned,observedSample}'
  )::bigint,
  'sessions per person uses people as its minimum-sample denominator'
);

select is(
  public.get_therapist_interest_metrics_v1(30)
    #>> '{journeyThemes,reason}',
  'free_text_analysis_prohibited',
  'journey free text remains prohibited'
);

select is(
  public.get_therapist_interest_metrics_v1(30)
    #>> '{favoriteConversion,reason}',
  'favorite_conversion_linkage_not_available',
  'favorite conversion is not invented without private linkage'
);

select ok(
  position(
    'patientProfileId'
    in public.get_therapist_interest_metrics_v1(30)::text
  ) = 0
  and position(
    'patient_profile_id'
    in public.get_therapist_interest_metrics_v1(30)::text
  ) = 0,
  'MTR-5 exposes no patient identifier'
);

select throws_ok(
  'select public.get_therapist_session_metrics_v1(31)',
  '22023',
  'VALIDATION_ERROR',
  'MTR-4 rejects unsupported periods'
);

select throws_ok(
  'select public.get_therapist_interest_metrics_v1(31)',
  '22023',
  'VALIDATION_ERROR',
  'MTR-5 rejects unsupported periods'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_interest_metrics_v1(30)
    #>> '{access,status}',
  'capability_locked',
  'Premium receives an explicit MTR-5 capability lock'
);

select ok(
  not (
    public.get_therapist_interest_metrics_v1(30) ? 'summary'
  ),
  'the Premium lock does not leak Premium Plus continuity values'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_session_metrics_v1(30)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free cannot bypass the MTR-4 capability'
);

select throws_ok(
  'select public.get_therapist_interest_metrics_v1(30)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free cannot bypass the MTR-5 capability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_session_metrics_v1(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot invoke MTR-4'
);

select throws_ok(
  'select public.get_therapist_interest_metrics_v1(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot invoke MTR-5'
);

select * from finish();

rollback;
