begin;
\ir fixtures/attended-attempt-local.inc

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
  0,
  'active policy has no additional transfer safety period'
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
  operational_status,
  payout_status,
  payout_schedule_interval
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
  'ready',
  'enabled',
  'daily'
)
on conflict (therapist_profile_id) where is_current do update
set onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    stripe_transfers_status = excluded.stripe_transfers_status,
    operational_status = excluded.operational_status,
    payout_status = excluded.payout_status,
    payout_schedule_interval = excluded.payout_schedule_interval;

-- Historical trusted joins must match the current attempt and its effective dates.
-- Keep the intervals away from the current-day bookings in the local seed.
update public.bookings set
  starts_at = case when id = '96000000-0000-4000-8000-000000000002'
    then now() - interval '408 days 1 hour'
    when id = '96000000-0000-4000-8000-000000000003' then now() - interval '400 days 4 hours'
    else now() - interval '400 days 2 hours' end,
  ends_at = case when id = '96000000-0000-4000-8000-000000000002'
    then now() - interval '408 days'
    when id = '96000000-0000-4000-8000-000000000003' then now() - interval '400 days 3 hours'
    else now() - interval '400 days 1 hour' end
where id in ('96000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000003');
do $$ declare v_id uuid; begin
  for v_id in select id from public.bookings
    where id in ('96000000-0000-4000-8000-000000000001',
      '96000000-0000-4000-8000-000000000002',
      '96000000-0000-4000-8000-000000000003')
  loop perform pg_temp.prepare_attended_attempt(v_id); end loop;
end $$;

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
  public.get_session_quality_feedback_v1('96000000-0000-4000-8000-000000000001')->>'status',
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
  'scheduled',
  'participant finalization does not write the financial service projection'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000001'),
  'not_eligible',
  'participant finalization preserves the original legacy transfer state'
);

select is(
  (
    select eligible_at - service_confirmed_at
    from public.session_payments
    where booking_id = '96000000-0000-4000-8000-000000000001'
  ),
  null::interval,
  'participant confirmation does not create a financial eligibility clock'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')->'attendance'->>'bothJoined',
  'true',
  'admin audit exposes safe bilateral attendance state'
);

select ok(
  public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')->'confirmation'->'patient' is not null
    and public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')->'confirmation'->'therapist' is not null,
  'admin audit exposes both confirmation states'
);

select ok(
  public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')::text not like '%requestId%'
    and public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')::text not like '%payloadHash%',
  'admin audit omits replay and hashing internals'
);

reset role;
set local role service_role;

select public.auto_confirm_sessions((select ends_at + interval '8 days' from public.bookings where id = '96000000-0000-4000-8000-000000000002'));
select is(
  (select count(*)::integer from public.session_participant_confirmations
   where booking_id='96000000-0000-4000-8000-000000000002'),
  1, 'day eight confirms only the patient; therapist deadline is thirty days'
);

select is(
  (select source from public.session_participant_confirmations where booking_id = '96000000-0000-4000-8000-000000000002' and participant_role = 'patient'),
  'automatic',
  'patient automatic confirmation is marked automatic'
);

select is(
  (select source from public.session_participant_confirmations where booking_id = '96000000-0000-4000-8000-000000000002' and participant_role = 'therapist'),
  null::text,
  'therapist is not automatically confirmed before day thirty'
);

select is(
  (select service_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000002'),
  'scheduled',
  'automatic participant confirmation does not classify financial service state'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000002'),
  'not_eligible',
  'automatic participant confirmation preserves the original transfer state'
);

select is(
  public.submit_session_quality_feedback_v1(
    '90000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000003',
    public.current_session_attempt_id_v1('96000000-0000-4000-8000-000000000003'),
    true,
    5::smallint,
    null,
    'O encontro aconteceu.',
    '97700000-0000-4000-8000-000000000031'
  )->'feedback'->>'successful',
  'true',
  'successful quality stores the patient response privately'
);

select is(
  public.submit_session_quality_feedback_v1(
    '90000000-0000-4000-8000-000000000011',
    '96000000-0000-4000-8000-000000000003',
    public.current_session_attempt_id_v1('96000000-0000-4000-8000-000000000003'),
    false,
    null,
    'internet_problem',
    'A conexão caiu durante o atendimento.',
    '97700000-0000-4000-8000-000000000032'
  )->'feedback'->>'successful',
  'false',
  'negative quality remains separate from non-performance and confirmation'
);

select is(
  public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000003')->>'divergent',
  'false',
  'different quality opinions do not create divergent attendance reports'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000003'),
  'not_eligible',
  'negative quality preserves the original transfer state'
);

select pg_temp.prepare_attended_attempt('96000000-0000-4000-8000-000000000005');
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
  '7 days',
  'patient operational deadline is seven days independently of the legacy financial policy'
);

select ok(
  public.auto_confirm_sessions((select ends_at + interval '31 days' from public.bookings where id = '96000000-0000-4000-8000-000000000005')) >= 1,
  'legacy payment snapshot auto-confirms the unanswered participant after thirty days'
);

select is(
  (
    select policy.version
    from public.session_participant_confirmations confirmation
    join public.financial_policy_versions policy on policy.id = confirmation.policy_version_id
    where confirmation.booking_id = '96000000-0000-4000-8000-000000000005'
      and confirmation.participant_role = 'patient'
  ),
  'tes-payments-v1',
  'participant audit preserves the financial policy identifier'
);

select is(
  (select transfer_status::text from public.session_payments where booking_id = '96000000-0000-4000-8000-000000000005'),
  'not_eligible',
  'legacy financial snapshot is untouched by operational confirmation'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.admin_get_session_feedback_v2('96000000-0000-4000-8000-000000000001')$$,
  '42501',
  'SESSION_ATTENDANCE_ADMIN_REQUIRED',
  'participant cannot use the admin audit boundary'
);

select * from finish();

rollback;
