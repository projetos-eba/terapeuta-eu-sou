begin;

select plan(18);

select has_table('public', 'booking_journey_theme_selections', 'private journey theme selection table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.booking_journey_theme_selections'::regclass),
  'journey theme selections keep row-level security enabled'
);
select is(
  has_table_privilege('authenticated', 'public.booking_journey_theme_selections', 'INSERT'),
  false,
  'authenticated clients cannot create theme selections directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.save_therapist_session_journey_themes_v1(uuid,uuid,text[],boolean,uuid)',
    'EXECUTE'
  ),
  'service role can execute the private journey theme command'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.save_therapist_session_journey_themes_v1(uuid,uuid,text[],boolean,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the private journey theme command'
);
select is(
  (select prosecdef::text from pg_proc where oid = 'public.save_therapist_session_journey_themes_v1(uuid,uuid,text[],boolean,uuid)'::regprocedure),
  'true',
  'journey theme command is security definer'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_journey_session_states_v1(uuid[])',
    'EXECUTE'
  ),
  'authenticated therapists can read their private journey session states'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status, completed_at
)
values
  (
    'e9800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '3 years', now() - interval '3 years' + interval '1 hour', 'America/Sao_Paulo', 'confirmed', 'paid', null
  ),
  (
    'e9800000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '2 years', now() - interval '2 years' + interval '1 hour', 'America/Sao_Paulo', 'confirmed', 'paid', null
  ),
  (
    'e9800000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '4 years', now() - interval '4 years' + interval '1 hour', 'America/Sao_Paulo', 'completed', 'paid', now() - interval '4 years' + interval '1 hour'
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'e9810000-0000-4000-8000-000000000001',
  'e9800000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  policy.id, 17000, 1500, 2550, 14450,
  'paid', 'scheduled', 'transfer_pending', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_journey_themes_113', 'pi_test_journey_themes_113',
  now() - interval '3 years', now() - interval '3 years' - interval '1 day'
from public.financial_policy_versions as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = '92000000-0000-4000-8000-000000000011'
    and is_current
  order by created_at desc
  limit 1
) as account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

select public.ensure_video_session_for_paid_booking_v1(
  'e9800000-0000-4000-8000-000000000001',
  'development',
  'journey-themes-113'
);

insert into public.video_session_participations (
  video_session_id, booking_id, participant_correlation_key,
  participant_role, event_type, joined_at, metadata
)
select id, booking_id, 'journey-themes-patient', 'patient',
  'session.user_joined', scheduled_starts_at + interval '1 minute', '{}'::jsonb
from public.video_sessions
where booking_id = 'e9800000-0000-4000-8000-000000000001'
union all
select id, booking_id, 'journey-themes-therapist', 'therapist',
  'session.user_joined', scheduled_starts_at + interval '1 minute', '{}'::jsonb
from public.video_sessions
where booking_id = 'e9800000-0000-4000-8000-000000000001';

insert into public.session_quality_feedback (
  booking_id, session_attempt_id, author_profile_id, author_role,
  successful, rating, request_id, payload_hash
)
values (
  'e9800000-0000-4000-8000-000000000001',
  public.current_session_attempt_id_v1('e9800000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000011', 'therapist',
  true, 5, 'e9820000-0000-4000-8000-000000000001',
  'journey-themes-quality-feedback'
);

create temporary table stale_attempt as
select public.current_session_attempt_id_v1('e9800000-0000-4000-8000-000000000002') as id;

insert into public.session_quality_feedback (
  booking_id, session_attempt_id, author_profile_id, author_role,
  successful, rating, request_id, payload_hash
)
select
  'e9800000-0000-4000-8000-000000000002', id,
  '90000000-0000-4000-8000-000000000011', 'therapist',
  true, 5, 'e9820000-0000-4000-8000-000000000002',
  'journey-themes-stale-quality-feedback'
from stale_attempt;

update public.bookings
set starts_at = starts_at + interval '1 day',
    ends_at = ends_at + interval '1 day'
where id = 'e9800000-0000-4000-8000-000000000002';

update public.therapist_profiles
set plan = 'premium_plus'
where id = '92000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select results_eq(
  $$select booking_id::text, realization_status, confirmation_status
      from public.get_therapist_journey_session_states_v1(array[
        'e9800000-0000-4000-8000-000000000001'::uuid,
        'e9800000-0000-4000-8000-000000000002'::uuid,
        'e9800000-0000-4000-8000-000000000003'::uuid
      ])
      order by booking_id$$,
  $$values
      ('e9800000-0000-4000-8000-000000000001', 'performed', 'pending'),
      ('e9800000-0000-4000-8000-000000000002', 'pending', 'pending'),
      ('e9800000-0000-4000-8000-000000000003', 'performed', 'pending')$$,
  'journey states use current evidence, retain pending confirmations and preserve legacy completed sessions'
);

reset role;
set local role service_role;

select is(
  public.save_therapist_session_journey_themes_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9800000-0000-4000-8000-000000000001',
    array['work_and_career', 'self_knowledge'], true,
    'e9830000-0000-4000-8000-000000000001'
  )->'selection'->'themeKeys',
  '["self_knowledge", "work_and_career"]'::jsonb,
  'positive current-attempt feedback with bilateral attendance stores only validated structured themes'
);
select is(
  public.save_therapist_session_journey_themes_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9800000-0000-4000-8000-000000000001',
    array['self_knowledge', 'work_and_career'], true,
    'e9830000-0000-4000-8000-000000000001'
  )->>'idempotentReplay',
  'true',
  'same request replays an immutable selection'
);
select is(
  (select count(*)::integer from public.booking_journey_theme_selections where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  1,
  'one immutable selection exists per booking'
);
select throws_ok(
  $$select public.save_therapist_session_journey_themes_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9800000-0000-4000-8000-000000000001', array['family'], true,
    'e9830000-0000-4000-8000-000000000002'
  )$$,
  '23505', 'JOURNEY_THEME_SELECTION_IMMUTABLE',
  'a stored selection cannot be changed'
);
select throws_ok(
  $$select public.save_therapist_session_journey_themes_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9800000-0000-4000-8000-000000000002', array['family'], true,
    'e9830000-0000-4000-8000-000000000003'
  )$$,
  '42501', 'JOURNEY_THEME_SESSION_NOT_ELIGIBLE',
  'a stale quality feedback from a previous attempt is rejected'
);
select throws_ok(
  $$select public.save_therapist_session_journey_themes_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'e9800000-0000-4000-8000-000000000001', array['family'], true,
    'e9830000-0000-4000-8000-000000000004'
  )$$,
  '42501', 'JOURNEY_THEME_SESSION_NOT_ELIGIBLE',
  'another Premium Plus therapist cannot register a theme for this booking'
);
select is(
  (select service_status::text from public.session_payments where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  'scheduled',
  'theme registration does not change the financial service state'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.booking_journey_theme_selections where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  0,
  'the patient cannot read private journey themes'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.booking_journey_theme_selections where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  0,
  'another therapist cannot read private journey themes'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.booking_journey_theme_selections where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  1,
  'the owning Premium Plus therapist can read the private selection'
);

select * from finish();
rollback;
