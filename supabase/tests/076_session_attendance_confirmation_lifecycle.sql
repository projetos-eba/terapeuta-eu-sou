begin;

select plan(35);

select has_table(
  'public',
  'session_participant_confirmations',
  'bilateral participant confirmation table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.session_participant_confirmations'::regclass),
  'participant confirmation table keeps row-level security enabled'
);

select is(
  has_table_privilege('authenticated', 'public.session_participant_confirmations', 'SELECT'),
  false,
  'authenticated clients cannot read confirmation rows directly'
);

select is(
  has_table_privilege('authenticated', 'public.session_participant_confirmations', 'INSERT'),
  false,
  'authenticated clients cannot insert confirmation rows directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_session_participant_confirmation_v1(uuid,uuid,text,uuid,text,timestamptz)',
    'EXECUTE'
  ),
  false,
  'confirmation command stays server-side'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_session_participant_confirmation_v1(uuid,uuid,text,uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'service role can execute the confirmation command'
);

select is(
  (select auto_confirmation_days from public.financial_policy_versions where is_active),
  7,
  'new active policy confirms an unanswered participant after seven days'
);

select is(
  (select transfer_safety_period_days from public.financial_policy_versions where is_active),
  1,
  'new active policy keeps one day of transfer safety after final confirmation'
);

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
values
  (
    '97600000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where version = 'tes-payments-v2-session-attendance'),
    17000,
    2000,
    3400,
    13600,
    'BRL',
    'paid'
  ),
  (
    '97600000-0000-4000-8000-000000000012',
    '96000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where version = 'tes-payments-v2-session-attendance'),
    17000,
    2000,
    3400,
    13600,
    'BRL',
    'paid'
  ),
  (
    '97600000-0000-4000-8000-000000000013',
    '96000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where version = 'tes-payments-v2-session-attendance'),
    17000,
    2000,
    3400,
    13600,
    'BRL',
    'paid'
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
  payment_status,
  meeting_provider
)
values (
  '96000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  now() - interval '31 days 1 hour',
  now() - interval '31 days',
  'America/Sao_Paulo',
  'completed',
  'paid',
  'zoom'
);

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
  '97600000-0000-4000-8000-000000000014',
  '96000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  (select id from public.financial_policy_versions where version = 'tes-payments-v1'),
  17000,
  2000,
  3400,
  13600,
  'BRL',
  'paid'
);

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status
)
values (
  '97600000-0000-4000-8000-000000000021',
  '92000000-0000-4000-8000-000000000011',
  'acct_tes_attendance_lifecycle',
  'ready',
  true,
  true,
  true,
  'active',
  'ready'
)
on conflict (therapist_profile_id) do update
set onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    operational_status = excluded.operational_status;

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
values
  ('97900000-0000-4000-8000-000000000011', '96000000-0000-4000-8000-000000000001', 'development', 'tes-attendance-session-one', 'ended', now() - interval '2 hours', now() - interval '1 hour', now() - interval '2 hours', now() - interval '1 hour'),
  ('97900000-0000-4000-8000-000000000012', '96000000-0000-4000-8000-000000000002', 'development', 'tes-attendance-session-two', 'ended', now() - interval '9 days', now() - interval '8 days', now() - interval '9 days', now() - interval '8 days'),
  ('97900000-0000-4000-8000-000000000013', '96000000-0000-4000-8000-000000000003', 'development', 'tes-attendance-session-three', 'ended', now() - interval '2 hours', now() - interval '1 hour', now() - interval '2 hours', now() - interval '1 hour'),
  ('97900000-0000-4000-8000-000000000014', '96000000-0000-4000-8000-000000000005', 'development', 'tes-attendance-session-legacy', 'ended', now() - interval '31 days 1 hour', now() - interval '31 days', now() - interval '31 days 1 hour', now() - interval '31 days');

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
  ('97900000-0000-4000-8000-000000000111', '97900000-0000-4000-8000-000000000011', '96000000-0000-4000-8000-000000000001', 'attendance-one-patient', 'patient', 'session.user_joined', now() - interval '2 hours', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000112', '97900000-0000-4000-8000-000000000011', '96000000-0000-4000-8000-000000000001', 'attendance-one-therapist', 'therapist', 'session.user_joined', now() - interval '2 hours', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000121', '97900000-0000-4000-8000-000000000012', '96000000-0000-4000-8000-000000000002', 'attendance-two-patient', 'patient', 'session.user_joined', now() - interval '9 days', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000122', '97900000-0000-4000-8000-000000000012', '96000000-0000-4000-8000-000000000002', 'attendance-two-therapist', 'therapist', 'session.user_joined', now() - interval '9 days', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000131', '97900000-0000-4000-8000-000000000013', '96000000-0000-4000-8000-000000000003', 'attendance-three-patient', 'patient', 'session.user_joined', now() - interval '2 hours', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000132', '97900000-0000-4000-8000-000000000013', '96000000-0000-4000-8000-000000000003', 'attendance-three-therapist', 'therapist', 'session.user_joined', now() - interval '2 hours', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000141', '97900000-0000-4000-8000-000000000014', '96000000-0000-4000-8000-000000000005', 'attendance-legacy-patient', 'patient', 'session.user_joined', now() - interval '31 days', '{}'::jsonb),
  ('97900000-0000-4000-8000-000000000142', '97900000-0000-4000-8000-000000000014', '96000000-0000-4000-8000-000000000005', 'attendance-legacy-therapist', 'therapist', 'session.user_joined', now() - interval '31 days', '{}'::jsonb);

select is(
  public.session_attendance_state_v1('96000000-0000-4000-8000-000000000001')->>'bothJoined',
  'true',
  'attendance predicate requires both trusted session.user_joined events'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->>'status',
  'eligible',
  'quality feedback becomes eligible only after both participants entered and the room closed'
);

reset role;
set local role service_role;

select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'completed',
    '97700000-0000-4000-8000-000000000011',
    'manual',
    now()
  )->'confirmation'->>'outcome',
  'completed',
  'patient manual confirmation is stored independently'
);

select is(
  (
    public.record_session_participant_confirmation_v1(
      '90000000-0000-4000-8000-000000000001',
      '96000000-0000-4000-8000-000000000001',
      'completed',
      '97700000-0000-4000-8000-000000000099',
      'manual',
      now()
    )->>'idempotentReplay'
  ),
  'true',
  'same participant confirmation replays idempotently'
);

select is(
  (
    public.record_session_participant_confirmation_v1(
      '90000000-0000-4000-8000-000000000011',
      '96000000-0000-4000-8000-000000000001',
      'completed',
      '97700000-0000-4000-8000-000000000012',
      'manual',
      now()
    )->'confirmation'->>'outcome'
  ),
  'completed',
  'therapist manual confirmation is stored independently'
);

select is(
  public.finalize_bilateral_session_confirmation_v1('96000000-0000-4000-8000-000000000001'),
  'confirmed',
  'finalization waits for both participant confirmations'
);

select is(
  (select service_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000001'),
  'confirmed_bilateral',
  'finalization uses the canonical bilateral service status'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000001'),
  'waiting_safety_period',
  'finalization starts the one-day transfer safety period'
);

select is(
  (
    select eligible_at - service_confirmed_at
    from public.session_payments
    where booking_id = '96000000-0000-4000-8000-000000000001'
  ),
  interval '1 day',
  'financial eligibility is one day after final confirmation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'attendance'->>'bothJoined',
  'true',
  'admin audit exposes safe bilateral attendance state'
);

select ok(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'confirmation'->'patient' is not null
    and public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')->'confirmation'->'therapist' is not null,
  'admin audit exposes both confirmation states'
);

select ok(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text not like '%requestId%'
    and public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')::text not like '%payloadHash%',
  'admin audit omits replay and hashing internals'
);

reset role;
set local role service_role;

select is(
  public.auto_confirm_sessions((select ends_at + interval '8 days' from public.bookings where id = '96000000-0000-4000-8000-000000000002')),
  2,
  'automatic confirmation creates one confirmation per unanswered participant after seven days'
);

select is(
  (select source from public.session_participant_confirmations where booking_id = '96000000-0000-4000-8000-000000000002' and participant_role = 'patient'),
  'automatic',
  'patient automatic confirmation is marked automatic'
);

select is(
  (select source from public.session_participant_confirmations where booking_id = '96000000-0000-4000-8000-000000000002' and participant_role = 'therapist'),
  'automatic',
  'therapist automatic confirmation is marked automatic'
);

select is(
  (select service_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000002'),
  'confirmed_bilateral',
  'automatic bilateral confirmation uses the canonical bilateral service status'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000002'),
  'eligible',
  'legacy seven-day role deadlines become eligible after their one-day safety period'
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000003',
    'completed',
    5::smallint,
    null,
    'O encontro aconteceu.',
    '97700000-0000-4000-8000-000000000031'
  )->'feedback'->>'outcome',
  'completed',
  'completed feedback stores the patient response privately'
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000003',
    'not_performed',
    null,
    'internet_problem',
    'A conexão caiu durante o atendimento.',
    '97700000-0000-4000-8000-000000000032'
  )->'feedback'->>'outcome',
  'not_performed',
  'participant incident response remains independent from the quality feedback'
);

select is(
  public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000003')->>'divergent',
  'true',
  'admin audit marks divergent bilateral reports explicitly'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000003'),
  'blocked',
  'divergent not-performed report blocks transfer eligibility'
);

select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000005',
    'completed',
    '97700000-0000-4000-8000-000000000014',
    'manual',
    now()
  )->'confirmation'->>'outcome',
  'completed',
  'legacy payment can still record a manual participant confirmation'
);

select is(
  (
    select due_at - (select ends_at from public.bookings where id = '96000000-0000-4000-8000-000000000005')
    from public.session_participant_confirmations
    where booking_id = '96000000-0000-4000-8000-000000000005'
  )::text,
  '30 days',
  'existing payment snapshot keeps the legacy thirty-day confirmation deadline'
);

select ok(
  public.auto_confirm_sessions((select ends_at + interval '31 days' from public.bookings where id = '96000000-0000-4000-8000-000000000005')) >= 1,
  'legacy payment snapshot auto-confirms the unanswered participant after thirty days'
);

select is(
  (
    select policy.version
    from public.session_service_confirmations confirmation
    join public.financial_policy_versions policy on policy.id = confirmation.policy_version_id
    where confirmation.booking_id = '96000000-0000-4000-8000-000000000005'
      and confirmation.source = 'bilateral'
  ),
  'tes-payments-v1',
  'service confirmation preserves the payment policy snapshot'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000005'),
  'waiting_safety_period',
  'legacy payment snapshot keeps the seven-day safety period'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.admin_get_session_feedback_v1('96000000-0000-4000-8000-000000000001')$$,
  '42501',
  'FEEDBACK_ADMIN_REQUIRED',
  'participant cannot use the admin audit boundary'
);

select * from finish();

rollback;
