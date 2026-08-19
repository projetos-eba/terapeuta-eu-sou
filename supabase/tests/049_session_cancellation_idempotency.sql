begin;

select plan(9);

select ok(
  to_regprocedure(
    'public.claim_session_cancellation_decision_v1(uuid,uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,integer,boolean,timestamp with time zone,jsonb)'
  ) is not null,
  'the cancellation decision claim RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.claim_session_cancellation_decision_v1(uuid,uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,integer,boolean,timestamp with time zone,jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot claim cancellation decisions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.claim_session_cancellation_decision_v1(uuid,uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,integer,boolean,timestamp with time zone,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot claim cancellation decisions directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_session_cancellation_decision_v1(uuid,uuid,uuid,uuid,text,uuid,text,text,integer,integer,integer,integer,boolean,timestamp with time zone,jsonb)',
    'EXECUTE'
  ),
  'service_role can claim cancellation decisions through the trusted Edge Function'
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
) values
  (
    'f9000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2045-01-19T13:00:00Z',
    '2045-01-19T13:50:00Z',
    'America/Sao_Paulo',
    'draft',
    'not_started'
  ),
  (
    'f9000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2045-01-20T13:00:00Z',
    '2045-01-20T13:50:00Z',
    'America/Sao_Paulo',
    'draft',
    'not_started'
  );

select is(
  (
    select created_new
    from public.claim_session_cancellation_decision_v1(
      'f9000000-0000-4000-8000-000000000001',
      null,
      null,
      'bbbbbbbb-0000-4000-8000-000000000005',
      'patient',
      'f9000000-0000-4000-8000-000000000011',
      'patient_cancellation',
      'free_cancellation_full_refund',
      0,
      0,
      0,
      0,
      false,
      null,
      '{"source":"pgtap"}'::jsonb
    )
  ),
  true,
  'the first cancellation command creates its financial decision'
);

select is(
  (
    select created_new
    from public.claim_session_cancellation_decision_v1(
      'f9000000-0000-4000-8000-000000000001',
      null,
      null,
      'bbbbbbbb-0000-4000-8000-000000000005',
      'patient',
      'f9000000-0000-4000-8000-000000000011',
      'patient_cancellation',
      'free_cancellation_full_refund',
      0,
      0,
      0,
      0,
      false,
      null,
      '{"source":"pgtap"}'::jsonb
    )
  ),
  false,
  'a retry with the same command id replays the original decision'
);

select is(
  (
    select count(*)::integer
    from public.session_cancellation_decisions
    where booking_id = 'f9000000-0000-4000-8000-000000000001'
  ),
  1,
  'a retry does not create a second cancellation decision'
);

select is(
  (
    select request_id::text
    from public.claim_session_cancellation_decision_v1(
      'f9000000-0000-4000-8000-000000000001',
      null,
      null,
      'bbbbbbbb-0000-4000-8000-000000000005',
      'patient',
      'f9000000-0000-4000-8000-000000000012',
      'patient_cancellation',
      'free_cancellation_full_refund',
      0,
      0,
      0,
      0,
      false,
      null,
      '{"source":"pgtap"}'::jsonb
    )
  ),
  'f9000000-0000-4000-8000-000000000011',
  'a concurrent logical command for the same booking reuses the original decision'
);

select throws_ok(
  $$
    select *
    from public.claim_session_cancellation_decision_v1(
      'f9000000-0000-4000-8000-000000000002',
      null,
      null,
      'bbbbbbbb-0000-4000-8000-000000000005',
      'patient',
      'f9000000-0000-4000-8000-000000000011',
      'patient_cancellation',
      'free_cancellation_full_refund',
      0,
      0,
      0,
      0,
      false,
      null,
      '{"source":"pgtap"}'::jsonb
    );
  $$,
  '22023',
  'IDEMPOTENCY_KEY_REUSED',
  'a command id cannot be reused for another booking'
);

select * from finish();
rollback;
