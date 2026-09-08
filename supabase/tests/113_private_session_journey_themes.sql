begin;

select plan(16);

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
    now() - interval '3 years', now() - interval '3 years' + interval '1 hour', 'America/Sao_Paulo', 'completed', 'paid', now() - interval '3 years' + interval '1 hour'
  ),
  (
    'e9800000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '2 years', now() - interval '2 years' + interval '1 hour', 'America/Sao_Paulo', 'confirmed', 'paid', null
  );

insert into public.session_feedback (
  booking_id, author_profile_id, author_role, outcome, rating, request_id, payload_hash
)
values (
  'e9800000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000011',
  'therapist', 'completed', 5,
  'e9810000-0000-4000-8000-000000000001',
  'journey-themes-feedback'
);

insert into public.session_participant_confirmations (
  booking_id, participant_role, outcome, source, confirmed_by_profile_id,
  request_id, payload_hash, due_at, policy_version_id
)
values (
  'e9800000-0000-4000-8000-000000000001',
  'therapist', 'completed', 'manual', '90000000-0000-4000-8000-000000000011',
  'e9820000-0000-4000-8000-000000000001', 'journey-themes-confirmation', now(),
  (select id from public.financial_policy_versions where is_active)
);

update public.therapist_profiles
set plan = 'premium_plus'
where id = '92000000-0000-4000-8000-000000000011';

set local role service_role;

select is(
  public.save_therapist_session_journey_themes_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9800000-0000-4000-8000-000000000001',
    array['work_and_career', 'self_knowledge'], true,
    'e9830000-0000-4000-8000-000000000001'
  )->'selection'->'themeKeys',
  '["self_knowledge", "work_and_career"]'::jsonb,
  'completed therapist confirmation stores only validated structured themes'
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
  'a session without completed therapist confirmation is rejected'
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
  (select count(*)::integer from public.session_payments where booking_id = 'e9800000-0000-4000-8000-000000000001'),
  0,
  'theme registration does not create a financial payment'
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
