begin;

select plan(50);

select is(
  has_function_privilege(
    'anon',
    'public.auto_confirm_sessions(timestamptz)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute auto_confirm_sessions'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.auto_confirm_sessions(timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute auto_confirm_sessions'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.auto_confirm_sessions(timestamptz)',
    'EXECUTE'
  ),
  'service_role can execute auto_confirm_sessions'
);

select is(
  has_function_privilege(
    'anon',
    'public.calculate_session_cancellation_policy(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute cancellation policy calculator'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.calculate_session_cancellation_policy(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute cancellation policy calculator'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.calculate_session_cancellation_policy(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'service_role can execute cancellation policy calculator'
);

select is(
  has_function_privilege(
    'anon',
    'public.confirm_session_service(uuid,public.session_confirmation_source,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot confirm session service directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.confirm_session_service(uuid,public.session_confirmation_source,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot confirm session service directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.confirm_session_service(uuid,public.session_confirmation_source,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'service_role can confirm session service through trusted commands'
);

select is(
  has_function_privilege(
    'anon',
    'public.create_weekly_payout_batch(date,date,timestamptz,uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot create payout batches'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_weekly_payout_batch(date,date,timestamptz,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot create payout batches'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_weekly_payout_batch(date,date,timestamptz,uuid)',
    'EXECUTE'
  ),
  'service_role can create payout batches through jobs'
);

select is(
  has_function_privilege(
    'anon',
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)',
    'EXECUTE'
  ),
  false,
  'anon cannot refresh transfer eligibility'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot refresh transfer eligibility'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.refresh_session_transfer_eligibility(uuid,timestamptz)',
    'EXECUTE'
  ),
  'service_role can refresh transfer eligibility'
);

select is(
  to_regprocedure('public.confirm_session_from_review()'),
  null::regprocedure,
  'legacy public-review financial confirmation helper no longer exists'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgrelid = 'public.reviews'::regclass
      and tgname = 'confirm_session_from_review_trigger'
  ),
  0,
  'reviews have no trigger capable of confirming a session'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.save_patient_therapist_review_for_actor_v1(uuid,uuid,text,integer,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot bypass the patient review command authority'
);

select is(
  has_function_privilege(
    'anon',
    'public.import_legacy_payment_projection()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute legacy payment projection trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.import_legacy_payment_projection()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute legacy payment projection trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.import_legacy_payment_projection()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute legacy payment projection trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.sync_session_payment_projections()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute payment projection trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.sync_session_payment_projections()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute payment projection trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.sync_session_payment_projections()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute payment projection trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.enforce_therapist_profile_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute profile online-only trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.enforce_therapist_profile_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute profile online-only trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.enforce_therapist_profile_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute profile online-only trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.enforce_therapist_service_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute service online-only trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.enforce_therapist_service_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute service online-only trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.enforce_therapist_service_online_only_v1()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute service online-only trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.validate_availability_exception_series_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute availability series trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.validate_availability_exception_series_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute availability series trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.validate_availability_exception_series_v1()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute availability series trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.validate_service_matching_write_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute service matching write trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.validate_service_matching_write_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute service matching write trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.validate_service_matching_write_v1()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute service matching write trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.ensure_therapy_matching_theme_limit_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute therapy matching theme limit trigger helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ensure_therapy_matching_theme_limit_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapy matching theme limit trigger helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.ensure_therapy_matching_theme_limit_v1()',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute therapy matching theme limit trigger helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.ensure_therapy_has_matching_theme_for_publish_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute publish matching validation helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ensure_therapy_has_matching_theme_for_publish_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute publish matching validation helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.ensure_therapy_has_matching_theme_for_publish_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute publish matching validation helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.ensure_service_matching_rules_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute service matching validation helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ensure_service_matching_rules_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute service matching validation helper'
);

select is(
  has_function_privilege(
    'service_role',
    'public.ensure_service_matching_rules_v1(uuid)',
    'EXECUTE'
  ),
  true,
  'service_role can execute service matching validation helper for Edge Function mutations'
);

select is(
  has_function_privilege(
    'anon',
    'public.prepare_profile_for_auth_user_delete_v1()',
    'EXECUTE'
  ),
  false,
  'anon cannot execute auth deletion preparation helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.prepare_profile_for_auth_user_delete_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute auth deletion preparation helper'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_profile_for_auth_user_delete_v1()',
    'EXECUTE'
  ),
  'service_role can execute auth deletion preparation helper'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_service_available_slots_v1(uuid,timestamptz,timestamptz,integer)',
    'EXECUTE'
  ),
  'public slot read model remains callable by anon'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_public_therapy_therapists_v1(text,uuid[],uuid[],integer)',
    'EXECUTE'
  ),
  'public therapy therapist read model remains callable by anon'
);

select *
from finish();

rollback;
