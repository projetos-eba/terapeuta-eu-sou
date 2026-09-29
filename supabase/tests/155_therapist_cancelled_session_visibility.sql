begin;

select plan(8);

select ok(
  to_regprocedure(
    'public.get_therapist_sessions_v2(integer,timestamp with time zone,uuid,timestamp with time zone,timestamp with time zone,public.booking_status,public.session_financial_status,uuid,uuid,text,boolean)'
  ) is not null,
  'the additive therapist sessions reader exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_sessions_v2(integer,timestamp with time zone,uuid,timestamp with time zone,timestamp with time zone,public.booking_status,public.session_financial_status,uuid,uuid,text,boolean)',
    'EXECUTE'
  ),
  'an authenticated therapist can use the scoped sessions reader'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_therapist_sessions_v2(integer,timestamp with time zone,uuid,timestamp with time zone,timestamp with time zone,public.booking_status,public.session_financial_status,uuid,uuid,text,boolean)',
    'EXECUTE'
  ),
  'the public role cannot use the therapist sessions reader'
);

-- This test owns only the therapist read model. Create terminal fixtures
-- directly instead of exercising cancellation commands or mutating shared
-- seed bookings; lifecycle command coverage belongs to its dedicated tests.
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, cancelled_at
)
values
  (
    'a1550000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    now() + interval '1 day', now() + interval '1 day 60 minutes',
    'America/Sao_Paulo', 'cancelled_by_patient', 'cancelled', now()
  ),
  (
    'a1550000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() + interval '2 days', now() + interval '2 days 50 minutes',
    'America/Sao_Paulo', 'cancelled_by_admin', 'cancelled', now()
  ),
  (
    'a1550000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-12-30 13:00:00+00', '2099-12-30 13:50:00+00',
    'America/Sao_Paulo', 'confirmed', 'paid', null
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_sessions_v2(
    p_limit => 100,
    p_period_start => now() - interval '30 days',
    p_period_end => now()
  ) ->> 'version',
  '1',
  'the V2 response preserves the V1 JSON payload contract'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v2(
        p_limit => 100,
        p_period_start => now() - interval '30 days',
        p_period_end => now()
      ) -> 'items'
    ) as item
    where item ->> 'bookingId' = 'a1550000-0000-4000-8000-000000000004'
  ),
  'future cancellations stay out of ordinary historical windows by default'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v2(
        p_limit => 100,
        p_period_start => now() - interval '30 days',
        p_period_end => now(),
        p_include_future_terminal => true
      ) -> 'items'
    ) as item
    where item ->> 'bookingId' = 'a1550000-0000-4000-8000-000000000004'
      and item ->> 'bookingStatus' = 'cancelled_by_patient'
  ),
  'a future cancellation by the person remains visible to the therapist'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v2(
        p_limit => 100,
        p_period_start => now() - interval '30 days',
        p_period_end => now(),
        p_include_future_terminal => true
      ) -> 'items'
    ) as item
    where item ->> 'bookingId' = 'a1550000-0000-4000-8000-000000000005'
      and item ->> 'bookingStatus' = 'cancelled_by_admin'
  ),
  'a future administrative cancellation remains visible to the therapist'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v2(
        p_limit => 100,
        p_period_start => now() - interval '30 days',
        p_period_end => now(),
        p_include_future_terminal => true
      ) -> 'items'
    ) as item
    where item ->> 'bookingId' = 'a1550000-0000-4000-8000-000000000002'
  ),
  'an active future session is not moved into history'
);

select * from finish();
rollback;
