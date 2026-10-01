begin;

select plan(12);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1680000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now() - interval '2 days', now() - interval '2 days' + interval '50 minutes',
  'America/Sao_Paulo', 'confirmed', 'paid'
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
  'b1680000-0000-4000-8000-000000000021',
  'b1680000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transfer_pending', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_reporting_168', 'pi_test_reporting_168',
  now() - interval '2 days', now() - interval '3 days'
from public.financial_policy_versions as policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc
  limit 1
) as account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

select public.ensure_video_session_for_paid_booking_v1(
  'b1680000-0000-4000-8000-000000000011',
  'development',
  'bilateral-reporting-test'
);

update public.booking_session_attempts as attempt
set created_at = booking.starts_at - interval '1 day'
from public.bookings as booking
where booking.id = 'b1680000-0000-4000-8000-000000000011'
  and attempt.id = public.current_session_attempt_id_v1(booking.id);

update public.video_sessions as video
set status = 'ended',
    scheduled_starts_at = booking.starts_at,
    scheduled_ends_at = booking.ends_at,
    actual_started_at = booking.starts_at,
    actual_ended_at = booking.ends_at,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
from public.bookings as booking
where booking.id = 'b1680000-0000-4000-8000-000000000011'
  and video.booking_id = booking.id;

insert into public.video_session_participations (
  video_session_id, booking_id, participant_correlation_key,
  participant_role, event_type, joined_at, metadata
)
select
  video.id,
  booking.id,
  'bilateral-reporting-' || participant.role,
  participant.role::public.video_session_participant_role,
  'session.user_joined',
  booking.starts_at + interval '1 minute',
  '{}'::jsonb
from public.video_sessions as video
join public.bookings as booking on booking.id = video.booking_id
cross join (values ('patient'), ('therapist')) as participant(role)
where booking.id = 'b1680000-0000-4000-8000-000000000011';

create temporary table reporting_context as
select
  patient.user_id as patient_actor,
  therapist.user_id as therapist_actor
from public.bookings as booking
join public.patient_profiles as patient on patient.id = booking.patient_profile_id
join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
where booking.id = 'b1680000-0000-4000-8000-000000000011';

create temporary table payment_snapshot as
select md5(to_jsonb(payment)::text) as fingerprint
from public.session_payments as payment
where payment.id = 'b1680000-0000-4000-8000-000000000021';

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_session_metrics_v3(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the bilateral session metrics reader'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_session_metrics_v3(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the bilateral session metrics reader'
);

select is(
  public.is_session_realized_for_reporting_v1(
    'b1680000-0000-4000-8000-000000000011'
  ),
  false,
  'attendance alone is not a realized reporting session'
);

select set_config(
  'request.jwt.claim.sub',
  (select patient_actor::text from reporting_context),
  true
);
select public.submit_session_quality_feedback_v1(
  (select patient_actor from reporting_context),
  'b1680000-0000-4000-8000-000000000011',
  public.current_session_attempt_id_v1('b1680000-0000-4000-8000-000000000011'),
  true, 5::smallint, null, 'Avaliação positiva da pessoa atendida.',
  'b1680000-0000-4000-8000-000000000501'
);

select is(
  public.is_session_realized_for_reporting_v1(
    'b1680000-0000-4000-8000-000000000011'
  ),
  false,
  'one positive quality response remains insufficient for reporting'
);

select set_config(
  'request.jwt.claim.sub',
  (select therapist_actor::text from reporting_context),
  true
);
select public.submit_session_quality_feedback_v1(
  (select therapist_actor from reporting_context),
  'b1680000-0000-4000-8000-000000000011',
  public.current_session_attempt_id_v1('b1680000-0000-4000-8000-000000000011'),
  true, 5::smallint, null, 'Avaliação positiva do terapeuta.',
  'b1680000-0000-4000-8000-000000000502'
);

select ok(
  public.is_session_realized_for_reporting_v1(
    'b1680000-0000-4000-8000-000000000011'
  ),
  'two positive current-attempt quality responses realize the reporting session'
);

select is(
  public.get_session_attempt_attendance_batch_v1(
    array['b1680000-0000-4000-8000-000000000011'::uuid]
  ) #>> '{b1680000-0000-4000-8000-000000000011,actorRealized}',
  'true',
  'the existing green badge input becomes true only after bilateral quality'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select therapist_actor::text from reporting_context),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select therapist_actor::text from reporting_context),
    'role', 'authenticated'
  )::text,
  true
);

select ok(
  (public.get_therapist_metrics_overview_v3(30) #>> '{counters,sessionsCompleted,value}')::integer >= 1,
  'overview counts the bilaterally realized session'
);

select ok(
  (public.get_therapist_session_metrics_v3(30) #>> '{summary,sessionsCompleted,value}')::integer >= 1,
  'sessions tab counts the bilaterally realized session'
);

select ok(
  (public.get_therapist_sessions_v3() #>> '{summary,completed}')::integer >= 1,
  'session history summary counts the bilaterally realized session'
);

select ok(
  (public.get_private_therapist_financial_metrics_v3(
    null, null, 'America/Sao_Paulo'
  ) #>> '{sessions,completedCount}')::integer >= 1,
  'financial summary uses the same operational realized-session count'
);

select ok(
  (public.get_therapist_metrics_dashboard_v5(30)
    #>> '{overview,counters,sessionsCompleted,value}')::integer >= 1,
  'dashboard composes the bilateral overview contract'
);

select results_eq(
  $$
    select md5(to_jsonb(payment)::text)
    from public.session_payments as payment
    where payment.id = 'b1680000-0000-4000-8000-000000000021'
  $$,
  $$select fingerprint from payment_snapshot$$,
  'reporting readers do not mutate the payment record'
);

select * from finish();
rollback;
