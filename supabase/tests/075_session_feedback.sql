begin;

select plan(33);

select has_table(
  'public',
  'session_feedback',
  'private session feedback table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.session_feedback'::regclass),
  'session feedback table keeps row-level security enabled'
);

select is(
  has_table_privilege('authenticated', 'public.session_feedback', 'SELECT'),
  false,
  'authenticated clients cannot read the private table directly'
);

select is(
  has_table_privilege('authenticated', 'public.session_feedback', 'INSERT'),
  false,
  'authenticated clients cannot insert private feedback directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_session_feedback_v1(uuid)',
    'EXECUTE'
  ),
  'participants can use the authenticated feedback read RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.submit_session_feedback_for_actor_v1(uuid,uuid,text,smallint,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot call the server-only feedback command RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_session_feedback_for_actor_v1(uuid,uuid,text,smallint,text,text,uuid)',
    'EXECUTE'
  ),
  'service role can execute the feedback command RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_session_feedback_v1(uuid)',
    'EXECUTE'
  ),
  'authenticated clients can reach the admin feedback read boundary'
);

select is(
  (
    select prosecdef::text
    from pg_proc
    where oid = 'public.submit_session_feedback_for_actor_v1(uuid,uuid,text,smallint,text,text,uuid)'::regprocedure
  ),
  'true',
  'feedback command RPC is security definer'
);

select is(
  (
    select coalesce(
      (
        select setting
        from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg(setting)
        where setting like 'search_path=%'
        limit 1
      ),
      ''
    )
    from pg_proc p
    where p.oid = 'public.submit_session_feedback_for_actor_v1(uuid,uuid,text,smallint,text,text,uuid)'::regprocedure
  ),
  'search_path=""',
  'feedback command RPC keeps an empty search_path'
);

insert into public.financial_policy_versions (
  id,
  version,
  is_active
)
values (
  '97500000-0000-4000-8000-000000000001',
  'pgtap-session-feedback',
  false
)
on conflict (id) do nothing;

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  currency,
  financial_status
)
values (
  '97600000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  '97500000-0000-4000-8000-000000000001',
  17000,
  2000,
  3400,
  13600,
  'BRL',
  'paid'
)
on conflict (booking_id) do update
set financial_status = excluded.financial_status;

update public.bookings
set starts_at = '2020-01-01 14:00:00-03'::timestamptz,
    ends_at = '2020-01-01 15:00:00-03'::timestamptz
where id = '96000000-0000-4000-8000-000000000001';

insert into public.video_sessions (
  id,
  booking_id,
  environment,
  session_name,
  status,
  scheduled_starts_at,
  scheduled_ends_at,
  actual_started_at,
  actual_ended_at
)
values (
  '97900000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  'development',
  'tes-feedback-video-session',
  'ended',
  now() - interval '2 hours',
  now() - interval '1 hour',
  now() - interval '2 hours',
  now() - interval '1 hour'
)
on conflict (booking_id) do update
set status = excluded.status,
    scheduled_starts_at = excluded.scheduled_starts_at,
    scheduled_ends_at = excluded.scheduled_ends_at,
    actual_started_at = excluded.actual_started_at,
    actual_ended_at = excluded.actual_ended_at;

insert into public.video_session_participations (
  id,
  video_session_id,
  booking_id,
  participant_correlation_key,
  participant_role,
  event_type,
  joined_at,
  metadata
)
values
  (
    '97900000-0000-4000-8000-000000000011',
    '97900000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'feedback-patient',
    'patient',
    'session.user_joined',
    now() - interval '2 hours',
    '{}'::jsonb
  ),
  (
    '97900000-0000-4000-8000-000000000012',
    '97900000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'feedback-therapist',
    'therapist',
    'session.user_joined',
    now() - interval '2 hours',
    '{}'::jsonb
  )
on conflict (id) do nothing;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000002')->'pendingRoles',
  '["patient", "therapist"]'::jsonb,
  'admin read model shows both participants pending when no responses exist'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (public.get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->>'status'),
  'eligible',
  'participant feedback read becomes eligible only after both trusted entries'
);

select is(
  (public.get_session_feedback_v1('96000000-0000-4000-8000-000000000002')->>'status'),
  'unavailable',
  'participant feedback read distinguishes a session without a confirmed payment'
);

reset role;
set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'completed',
    5::smallint,
    null,
    'A chamada teve boa qualidade.',
    '97700000-0000-4000-8000-000000000001'
  )->'feedback'->>'outcome',
  'completed',
  'patient response stores the completed outcome'
);

select is(
  (select count(*)::integer from public.session_feedback where booking_id = '96000000-0000-4000-8000-000000000001' and author_role = 'patient'),
  1,
  'one patient response is stored per booking'
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'completed',
    5::smallint,
    null,
    'A chamada teve boa qualidade.',
    '97700000-0000-4000-8000-000000000099'
  )->>'idempotentReplay',
  'true',
  'same patient payload is idempotent even when transport request id changes'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'pendingRoles',
  '["therapist"]'::jsonb,
  'admin read model shows only the therapist pending after the patient response'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'patient'->>'rating',
  '5',
  'admin read model includes the patient rating'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text,
  replace(
    public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text,
    '',
    ''
  ),
  'admin read model is stable across repeated reads'
);

select ok(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text not like '%requestId%'
    and public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text not like '%payloadHash%',
  'admin read model omits replay and hashing internals'
);

select throws_ok(
  $$select public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'completed',
    4::smallint,
    null,
    'Outra resposta.',
    '97700000-0000-4000-8000-000000000002'
  )$$,
  '23505',
  'FEEDBACK_REQUEST_CONFLICT',
  'different duplicate response is rejected'
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000001',
    'not_performed',
    null,
    'internet_problem',
    'A sessão não aconteceu por instabilidade.',
    '97800000-0000-4000-8000-000000000001'
  )->'feedback'->>'notPerformedReason',
  'internet_problem',
  'therapist response stores the non-performed reason'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'pendingRoles',
  '[]'::jsonb,
  'admin read model has no pending participant after both responses'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->>'divergent',
  'true',
  'admin read model explicitly marks conflicting participant reports'
);

select is(
  (select count(*)::integer from public.session_feedback where booking_id = '96000000-0000-4000-8000-000000000001'),
  2,
  'bilateral responses remain independent records'
);

select is(
  (select service_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000001'),
  'not_performed',
  'a non-performed participant report blocks service confirmation'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000001'),
  'blocked',
  'negative feedback blocks the transfer for administrative review'
);

select is(
  (select status::text from public.bookings where id = '96000000-0000-4000-8000-000000000001'),
  'confirmed',
  'feedback does not mutate booking status'
);

select throws_ok(
  $$select public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000001',
    'not_performed',
    null,
    null,
    '',
    '97800000-0000-4000-8000-000000000002'
  )$$,
  '22023',
  'FEEDBACK_VALIDATION_ERROR',
  'non-performed response requires a reason'
);

select throws_ok(
  $$select public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000001',
    'completed',
    6::smallint,
    null,
    '',
    '97800000-0000-4000-8000-000000000003'
  )$$,
  '22023',
  'FEEDBACK_VALIDATION_ERROR',
  'completed response rating stays within one to five'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'feedback'->>'authorRole',
  'patient',
  'patient can read only the patient feedback projection'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_session_feedback_v1('96000000-0000-4000-8000-000000000002')$$,
  '42501',
  'FEEDBACK_PARTICIPANT_REQUIRED',
  'unrelated authenticated user cannot read another booking feedback'
);

select throws_ok(
  $$select public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')$$,
  '42501',
  'FEEDBACK_ADMIN_REQUIRED',
  'non-admin authenticated user cannot use the admin audit read model'
);

select * from finish();

rollback;
