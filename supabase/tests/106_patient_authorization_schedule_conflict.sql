begin;

select plan(16);

alter table public.booking_holds disable trigger validate_booking_hold_schedule;

-- Paid but not yet projected into the booking is already authoritative.
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values (
  'a1060000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-03-01 10:00:00+00', '2099-03-01 10:50:00+00',
  'America/Sao_Paulo', 'pending_payment', 'pending'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  stripe_checkout_session_id, paid_at
)
select
  'e1060000-0000-4000-8000-000000000001',
  'a1060000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 12000, 2000, 2400, 9600, 'paid', 'cs_test_106_paid', now()
from public.financial_policy_versions where is_active limit 1;

select throws_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('b1060000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-03-01 10:10:00+00', '2099-03-01 11:10:00+00', 'America/Sao_Paulo', 'patient-paid-not-projected-106', '2099-12-31 00:00:00+00')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'paid session blocks the patient before booking projection completes'
);

-- A claimed manual authorization blocks; a merely-open checkout does not.
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  (
    'a1060000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-03-02 10:00:00+00', '2099-03-02 10:50:00+00',
    'America/Sao_Paulo', 'pending_payment', 'pending'
  ),
  (
    'a1060000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-03-03 10:00:00+00', '2099-03-03 10:50:00+00',
    'America/Sao_Paulo', 'pending_payment', 'pending'
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  stripe_checkout_session_id, stripe_payment_intent_id
)
select
  input.payment_id, input.booking_id, input.patient_id,
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 12000, 2000, 2400, 9600, input.financial_status,
  input.checkout_id, input.payment_intent_id
from public.financial_policy_versions as policy
cross join (values
  ('e1060000-0000-4000-8000-000000000002'::uuid, 'a1060000-0000-4000-8000-000000000002'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'processing'::public.session_financial_status, 'cs_test_106_capture', 'pi_test_106_capture'),
  ('e1060000-0000-4000-8000-000000000003'::uuid, 'a1060000-0000-4000-8000-000000000003'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'pending'::public.session_financial_status, 'cs_test_106_open', null)
) as input(payment_id, booking_id, patient_id, financial_status, checkout_id, payment_intent_id)
where policy.is_active;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  stripe_payment_intent_id, attempt_kind, status, slot_claimed_at
) values
  (
    'e1060000-0000-4000-8000-000000000002',
    'reservation-capture-106-0002', 'cs_test_106_capture',
    'pi_test_106_capture', 'payment_retry', 'capture_pending', now()
  ),
  (
    'e1060000-0000-4000-8000-000000000003',
    'reservation-open-106-0003', 'cs_test_106_open',
    null, 'payment_retry', 'checkout_created', null
  );

select throws_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('b1060000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-03-02 10:10:00+00', '2099-03-02 11:10:00+00', 'America/Sao_Paulo', 'patient-capture-pending-106', '2099-12-31 00:00:00+00')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'claimed authorization blocks an overlapping patient hold'
);

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('b1060000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-03-03 10:10:00+00', '2099-03-03 11:10:00+00', 'America/Sao_Paulo', 'patient-checkout-open-106', '2099-12-31 00:00:00+00')$$,
  'open checkout without authorization does not block the patient'
);

select is(
  (select count(*)::text from public.get_patient_schedule_blocking_bookings_v1(
    'b1000000-0000-4000-8000-000000000002',
    '2099-03-02 10:50:00+00', '2099-03-02 11:50:00+00', null
  )),
  '0',
  'exactly consecutive patient interval remains free'
);

-- Retry preflight and authorization claim use the same canonical patient rule.
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  (
    'a1060000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-03-04 10:00:00+00', '2099-03-04 10:50:00+00',
    'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'a1060000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    '2099-03-04 10:10:00+00', '2099-03-04 11:10:00+00',
    'America/Sao_Paulo', 'cancelled_by_payment', 'failed'
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  stripe_checkout_session_id
)
select
  'e1060000-0000-4000-8000-000000000005',
  'a1060000-0000-4000-8000-000000000005',
  'b1000000-0000-4000-8000-000000000004',
  'c1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000002',
  id, 12000, 2000, 2400, 9600, 'failed', 'cs_test_106_retry_conflict'
from public.financial_policy_versions where is_active limit 1;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  attempt_kind, status
) values (
  'e1060000-0000-4000-8000-000000000005',
  'reservation-retry-106-0005', 'cs_test_106_retry_conflict',
  'payment_retry', 'checkout_created'
);

select is(
  (public.preflight_session_payment_retry_v1(
    'a1060000-0000-4000-8000-000000000005'
  )->>'reason'),
  'patient_schedule_conflict',
  'retry is denied before Stripe when the patient has an overlap'
);

select is(
  (public.claim_session_payment_authorization_v1(
    'e1060000-0000-4000-8000-000000000005',
    'cs_test_106_retry_conflict', 'pi_test_106_retry_conflict',
    now(), 'evt_test_106_retry_conflict'
  )->>'reason'),
  'patient_schedule_conflict',
  'late retry authorization loses the patient schedule race'
);

select is(
  (select status from public.session_payment_attempts
   where session_payment_id = 'e1060000-0000-4000-8000-000000000005'),
  'slot_conflict',
  'losing authorization is terminally marked as slot conflict'
);

select is(
  (select terminal_reason from public.session_payment_attempts
   where session_payment_id = 'e1060000-0000-4000-8000-000000000005'),
  'patient_schedule_conflict',
  'losing authorization preserves the patient-specific terminal reason'
);

set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000004';

select is(
  (select count(*)::text
   from public.get_my_patient_schedule_blocking_intervals_v1(
     '2099-03-04 10:00:00+00', '2099-03-04 11:00:00+00'
   )),
  '1',
  'authenticated patient interval RPC returns only the own blocker'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_patient_schedule_blocking_intervals_v1(timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'authenticated role can read its protected schedule intervals'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_my_patient_schedule_blocking_intervals_v1(timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'anonymous callers cannot read patient schedule intervals'
);

select is(
  (public.get_patient_reservation_attempt_status_v1(
    'a1060000-0000-4000-8000-000000000005',
    'cs_test_106_retry_conflict'
  )->>'conflictKind'),
  'patient_schedule',
  'public attempt status distinguishes a patient schedule conflict'
);

select is(
  (select status::text from public.bookings
   where id = 'a1060000-0000-4000-8000-000000000005'),
  'cancelled_by_payment',
  'losing retry never reopens its booking'
);

select is(
  (select financial_status::text from public.session_payments
   where id = 'e1060000-0000-4000-8000-000000000005'),
  'failed',
  'losing retry never changes the payment to processing'
);

select is(
  (select count(*)::text from public.get_patient_schedule_blocking_bookings_v1(
    'b1000000-0000-4000-8000-000000000003',
    '2099-03-03 10:00:00+00', '2099-03-03 11:00:00+00', null
  )),
  '0',
  'an open retry checkout remains outside the canonical blockers'
);

select is(
  (select count(*)::text from public.get_patient_schedule_blocking_bookings_v1(
    'b1000000-0000-4000-8000-000000000002',
    '2099-03-02 10:00:00+00', '2099-03-02 11:00:00+00', null
  )),
  '1',
  'current claimed authorization is returned exactly once'
);

alter table public.booking_holds enable trigger validate_booking_hold_schedule;

select * from finish();
rollback;
