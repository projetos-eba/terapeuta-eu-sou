begin;
\ir fixtures/attended-attempt-local.inc
select no_plan();

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
select ('b1410000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  '2024-01-01 13:00:00+00'::timestamptz + make_interval(days => series),
  '2024-01-01 13:20:00+00'::timestamptz + make_interval(days => series),
  'America/Sao_Paulo', 'confirmed', 'paid'
from generate_series(1, 3) series;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, currency,
  financial_status, stripe_charge_id, stripe_balance_transaction_id
)
select ('b1410000-0000-4000-8001-' || lpad(series::text, 12, '0'))::uuid,
  ('b1410000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  policy.id, 17000, 2000, 3400, 13600, 'BRL', 'paid',
  'ch_refunded_confirmation_' || series, 'txn_refunded_confirmation_' || series
from generate_series(1, 3) series
cross join lateral (
  select id from public.financial_policy_versions
  where version = 'tes-payments-v2-session-attendance'
) policy;

select pg_temp.prepare_attended_attempt('b1410000-0000-4000-8000-000000000001');
select pg_temp.prepare_attended_attempt('b1410000-0000-4000-8000-000000000003');
select public.record_session_participant_confirmation_v1(
  (select user_id from public.patient_profiles
    where id = '91000000-0000-4000-8000-000000000001'),
  'b1410000-0000-4000-8000-000000000003',
  'completed', 'b1410000-0000-4000-8002-000000000003', 'manual'
);

update public.session_payments
set financial_status = 'refunded',
    stripe_event_id = 'evt_refunded_confirmation_' || right(booking_id::text, 1),
    stripe_event_created_at = now()
where booking_id in (
  'b1410000-0000-4000-8000-000000000001',
  'b1410000-0000-4000-8000-000000000002',
  'b1410000-0000-4000-8000-000000000003'
);

select is((select status::text from public.bookings
  where id = 'b1410000-0000-4000-8000-000000000001'),
  'refunded', 'the fully refunded attended booking remains refunded');
select is((select status::text from public.bookings
  where id = 'b1410000-0000-4000-8000-000000000002'),
  'refunded', 'the fully refunded unattended booking remains refunded');
select is((select status::text from public.bookings
  where id = 'b1410000-0000-4000-8000-000000000003'),
  'refunded', 'a previously answered attended booking remains refunded');

create temporary table refunded_payment_snapshot as
select md5(to_jsonb(payment)::text) as fingerprint
from public.session_payments payment
where booking_id = 'b1410000-0000-4000-8000-000000000001';
grant select on refunded_payment_snapshot to service_role;

set local role service_role;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.patient_profiles
    where id = '91000000-0000-4000-8000-000000000001'), true);
select public.auto_confirm_sessions((select ends_at + interval '7 days' - interval '1 microsecond'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000001'));
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000001'),
  0, 'refunded attendance is not confirmed before day seven');

select public.auto_confirm_sessions((select ends_at + interval '7 days'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000001'));
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000001'
    and participant_role = 'patient' and source = 'automatic'),
  1, 'the refunded attended patient receives automatic confirmation at day seven');
select is(public.get_session_quality_feedback_v1('b1410000-0000-4000-8000-000000000001')->>'status',
  'automatically_confirmed', 'the patient feedback prompt closes after own automatic confirmation');
select is(public.get_session_quality_feedback_v1('b1410000-0000-4000-8000-000000000003')->>'status',
  'previously_recorded', 'a manual response from the same attended attempt is not requested again');
select is(public.get_session_attempt_attendance_batch_v1(
  array['b1410000-0000-4000-8000-000000000001'::uuid])
  #>> '{b1410000-0000-4000-8000-000000000001,actorRealized}',
  'true', 'the patient is individually confirmed despite the refund');
select ok(not exists(select 1 from jsonb_array_elements(public.get_patient_session_feedback_queue_v1()) item
  where item->>'bookingId' = 'b1410000-0000-4000-8000-000000000001'),
  'the refunded patient is no longer prompted after day seven');

select public.auto_confirm_sessions((select ends_at + interval '30 days' - interval '1 microsecond'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000001'));
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000001'),
  1, 'the therapist is not automatically confirmed before day thirty');
select public.auto_confirm_sessions((select ends_at + interval '30 days'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000001'));
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000001'
    and participant_role = 'therapist' and source = 'automatic'),
  1, 'the refunded attended therapist receives automatic confirmation at day thirty');
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000003'
    and participant_role = 'patient' and source = 'manual'),
  1, 'the scheduler preserves the previous manual patient confirmation');
select public.auto_confirm_sessions((select ends_at + interval '30 days'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000003'));
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000003'
    and participant_role = 'therapist' and source = 'automatic'),
  1, 'the scheduler still confirms the unanswered therapist independently');
select is(public.auto_confirm_sessions((select ends_at + interval '31 days'
  from public.bookings where id = 'b1410000-0000-4000-8000-000000000003')),
  0, 'a repeated run does not duplicate refunded confirmations');
select is((select count(*)::integer from public.session_participant_confirmations
  where booking_id = 'b1410000-0000-4000-8000-000000000002'),
  0, 'a refunded booking without bilateral joins remains unconfirmed');
select is(public.get_session_quality_feedback_v1('b1410000-0000-4000-8000-000000000002')->>'status',
  'unavailable', 'a refunded booking without bilateral joins offers no quality form');
select ok(not exists(select 1 from jsonb_array_elements(public.get_patient_session_feedback_queue_v1()) item
  where item->>'bookingId' = 'b1410000-0000-4000-8000-000000000002'),
  'a refunded booking without bilateral joins is absent from the evaluation queue');
select is((select count(*)::integer from public.session_quality_feedback
  where booking_id = 'b1410000-0000-4000-8000-000000000001'),
  0, 'automatic confirmation does not fabricate a quality rating');
select is((select status::text from public.bookings
  where id = 'b1410000-0000-4000-8000-000000000001'),
  'refunded', 'automatic confirmation does not change the refunded booking badge source');
select is((select md5(to_jsonb(payment)::text) from public.session_payments payment
  where booking_id = 'b1410000-0000-4000-8000-000000000001'),
  (select fingerprint from refunded_payment_snapshot),
  'automatic confirmation leaves the refunded payment row untouched');

select * from finish();
rollback;
