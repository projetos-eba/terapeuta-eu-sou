begin;

select plan(17);

-- Reproduce pre-existing overlaps without changing persistent historical data.
alter table public.bookings disable trigger a30_validate_booking_against_active_holds;
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  ('a1070000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-04-01 10:00+00', '2099-04-01 10:50+00', 'America/Sao_Paulo', 'confirmed', 'paid'),
  ('a1070000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-04-01 10:00+00', '2099-04-01 11:00+00', 'America/Sao_Paulo', 'confirmed', 'paid');
alter table public.bookings enable trigger a30_validate_booking_against_active_holds;

select lives_ok(
  $$update public.bookings set status = 'completed' where id = 'a1070000-0000-4000-8000-000000000001'$$,
  'an unchanged confirmed legacy overlap may complete'
);
select lives_ok(
  $$update public.bookings set status = status, payment_status = 'paid' where id = 'a1070000-0000-4000-8000-000000000002'$$,
  'idempotent payment projection does not break an already confirmed interval'
);
select throws_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1070000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-04-01 10:00+00', '2099-04-01 10:50+00', 'America/Sao_Paulo', 'pending_payment', 'pending')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'grandfathering never admits a new overlapping booking'
);
select throws_ok(
  $$update public.bookings set starts_at = '2099-04-01 10:10+00', ends_at = '2099-04-01 11:10+00' where id = 'a1070000-0000-4000-8000-000000000002'$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'changing a legacy interval still revalidates the patient'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
)
select
  ('a1070000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'b1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-04-01 10:00+00'::timestamptz + n * interval '1 day',
  '2099-04-01 10:50+00'::timestamptz + n * interval '1 day',
  'America/Sao_Paulo', 'pending_payment', 'pending'
from generate_series(3, 6) n;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  stripe_checkout_session_id
)
select
  ('e1070000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('a1070000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'b1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 12000, 1500, 1800, 10200,
  case
    when n = 6 then 'canceled'::public.session_financial_status
    else 'processing'::public.session_financial_status
  end,
  'cs_test_107_' || n
from generate_series(3, 6) n
cross join public.financial_policy_versions policy where policy.is_active;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  attempt_kind, status, terminal_reason, slot_claimed_at
)
select
  ('e1070000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'attempt-test-107-' || n, 'cs_test_107_' || n,
  case when n = 6 then 'payment_retry' else 'initial_hold' end,
  case n
    when 3 then 'slot_conflict'
    when 4 then 'expired'
    when 5 then 'capture_pending'
    else 'checkout_created'
  end,
  case n when 3 then 'patient_schedule_conflict' when 4 then 'reservation_expired' end,
  case when n = 5 then now() end
from generate_series(3, 6) n;

select lives_ok(
  $$select public.apply_session_payment_state_v1('e1070000-0000-4000-8000-000000000003', 'canceled', 'evt_107_canceled', now(), null, null, 'cs_test_107_3')$$,
  'signed financial cancellation can release the losing initial booking'
);
select is((select status from public.session_payment_attempts where stripe_checkout_session_id = 'cs_test_107_3'), 'slot_conflict',
  'cancel webhook preserves the scheduling conflict');
select lives_ok(
  $$update public.session_payment_attempts set status = 'expired' where stripe_checkout_session_id = 'cs_test_107_3'$$,
  'a later Checkout expiration may be acknowledged'
);
select is((select status from public.session_payment_attempts where stripe_checkout_session_id = 'cs_test_107_3'), 'slot_conflict',
  'out-of-order Checkout expiration cannot erase a conflict');
select lives_ok(
  $$select public.apply_session_payment_state_v1('e1070000-0000-4000-8000-000000000004', 'canceled', 'evt_107_expired', now(), null, null, 'cs_test_107_4')$$,
  'financial cancellation acknowledges an expired reservation'
);
select is((select status from public.session_payment_attempts where stripe_checkout_session_id = 'cs_test_107_4'), 'expired',
  'financial cancellation does not turn reservation expiry into generic failure');
select lives_ok(
  $$select public.apply_session_payment_state_v1('e1070000-0000-4000-8000-000000000005', 'processing', 'evt_107_processing', now(), null, null, 'cs_test_107_5')$$,
  'generic processing projection remains idempotent'
);
select is((select status from public.session_payment_attempts where stripe_checkout_session_id = 'cs_test_107_5'), 'capture_pending',
  'processing cannot erase a claimed authorization patient blocker');

set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select is((public.get_patient_reservation_attempt_status_v1('a1070000-0000-4000-8000-000000000003', 'cs_test_107_3')->>'conflictKind'), 'patient_schedule',
  'patient conflict copy survives cancellation and expiration webhooks');
select is((public.get_patient_reservation_attempt_status_v1('a1070000-0000-4000-8000-000000000004', 'cs_test_107_4')->>'status'), 'expired',
  'the patient sees expiry instead of an invented payment failure');
select is((public.get_patient_reservation_attempt_status_v1('a1070000-0000-4000-8000-000000000006', 'cs_test_107_6')->>'status'), 'waiting_payment',
  'an active retry does not inherit the previous canceled financial projection');
update public.session_payment_attempts
set status = 'canceled'
where stripe_checkout_session_id = 'cs_test_107_6';
select is((public.get_patient_reservation_attempt_status_v1('a1070000-0000-4000-8000-000000000006', 'cs_test_107_6')->>'status'), 'failed',
  'a terminal retry is presented as failed after its own cancellation');
select is((public.get_patient_reservation_attempt_status_v1('a1070000-0000-4000-8000-000000000003', 'cs_test_unrelated')->>'bookingId'), null::text,
  'an unrelated Stripe Session cannot be attributed to this booking');

select * from finish();
rollback;
