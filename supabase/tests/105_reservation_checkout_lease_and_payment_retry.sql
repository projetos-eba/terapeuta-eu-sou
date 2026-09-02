begin;

select plan(15);

select has_column(
  'public', 'session_payment_attempts', 'attempt_kind',
  'attempts classify initial holds and payment retries'
);
select has_column(
  'public', 'session_payment_attempts', 'reservation_expires_at',
  'attempts persist the authoritative reservation deadline'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values (
  'a1050000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-02-01 10:00:00+00', '2099-02-01 10:50:00+00',
  'America/Sao_Paulo', 'cancelled_by_payment', 'failed'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, stripe_checkout_session_id
)
select
  'e1050000-0000-4000-8000-000000000001',
  'a1050000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 12000, 2000, 2400, 9600, 'failed', 'cs_test_retry_105_1'
from public.financial_policy_versions where is_active limit 1;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  attempt_kind, status
) values (
  'e1050000-0000-4000-8000-000000000001',
  'reservation-retry-105-0001', 'cs_test_retry_105_1',
  'payment_retry', 'checkout_created'
);

select throws_ok(
  $$update public.bookings set status = 'pending_payment'
    where id = 'a1050000-0000-4000-8000-000000000001'$$,
  'P0001', 'PAYMENT_RETRY_CLAIM_REQUIRED',
  'direct SQL cannot reopen a payment-cancelled booking'
);

select is(
  (public.preflight_session_payment_retry_v1(
    'a1050000-0000-4000-8000-000000000001'
  )->>'reason'),
  'available',
  'retry preflight does not occupy an available slot'
);

select is(
  (public.claim_session_payment_authorization_v1(
    'e1050000-0000-4000-8000-000000000001',
    'cs_test_retry_105_1', 'pi_test_retry_105_1', now(), 'evt_retry_105_1'
  )->>'claimed')::boolean,
  true,
  'authorization atomically claims an available retry slot'
);

select is(
  (select status::text from public.bookings
   where id = 'a1050000-0000-4000-8000-000000000001'),
  'pending_payment',
  'successful claim reopens the booking through the protected command'
);

select is(
  (public.claim_session_payment_authorization_v1(
    'e1050000-0000-4000-8000-000000000001',
    'cs_test_retry_105_1', 'pi_test_retry_105_1', now(), 'evt_retry_105_1_dup'
  )->>'reason'),
  'already_claimed',
  'duplicate authorization is idempotent'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  (
    'a1050000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    '2099-02-02 10:00:00+00', '2099-02-02 11:00:00+00',
    'America/Sao_Paulo', 'cancelled_by_payment', 'failed'
  ),
  (
    'a1050000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    '2099-02-02 10:00:00+00', '2099-02-02 11:00:00+00',
    'America/Sao_Paulo', 'confirmed', 'paid'
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, stripe_checkout_session_id
)
select
  'e1050000-0000-4000-8000-000000000002',
  'a1050000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000002',
  id, 10000, 2000, 2000, 8000, 'failed', 'cs_test_retry_105_2'
from public.financial_policy_versions where is_active limit 1;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  attempt_kind, status
) values (
  'e1050000-0000-4000-8000-000000000002',
  'reservation-retry-105-0002', 'cs_test_retry_105_2',
  'payment_retry', 'checkout_created'
);

select is(
  (public.preflight_session_payment_retry_v1(
    'a1050000-0000-4000-8000-000000000002'
  )->>'reason'),
  'slot_conflict',
  'retry is denied before Checkout when the slot is already occupied'
);

select is(
  (public.claim_session_payment_authorization_v1(
    'e1050000-0000-4000-8000-000000000002',
    'cs_test_retry_105_2', 'pi_test_retry_105_2', now(), 'evt_retry_105_2'
  )->>'reason'),
  'slot_conflict',
  'authorization race loser is terminally marked as a slot conflict'
);

select is(
  (select status from public.session_payment_attempts
   where stripe_checkout_session_id = 'cs_test_retry_105_2'),
  'slot_conflict',
  'slot-conflict attempt remains auditable and non-occupying'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values (
  'a1050000-0000-4000-8000-000000000004',
  'b1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-02-03 10:00:00+00', '2099-02-03 10:50:00+00',
  'America/Sao_Paulo', 'draft', 'not_started'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, stripe_checkout_session_id
)
select
  'e1050000-0000-4000-8000-000000000004',
  'a1050000-0000-4000-8000-000000000004',
  'b1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 12000, 2000, 2400, 9600, 'pending', 'cs_test_initial_105_4'
from public.financial_policy_versions where is_active limit 1;

insert into public.session_payment_attempts (
  session_payment_id, idempotency_key, stripe_checkout_session_id,
  attempt_kind, reservation_expires_at, status
) values (
  'e1050000-0000-4000-8000-000000000004',
  'reservation-initial-105-0004', 'cs_test_initial_105_4',
  'initial_hold', now() - interval '1 second', 'checkout_created'
);

select is(
  (public.claim_session_payment_authorization_v1(
    'e1050000-0000-4000-8000-000000000004',
    'cs_test_initial_105_4', 'pi_test_initial_105_4', now(), 'evt_initial_105_4'
  )->>'reason'),
  'expired',
  'late authorization cannot revive an expired initial reservation'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  (
    'a1050000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-04 10:00:00+00', '2099-02-04 10:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started'
  ),
  (
    'a1050000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-05 10:00:00+00', '2099-02-05 10:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started'
  );

insert into public.booking_holds (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, idempotency_key, expires_at, service_title_snapshot,
  service_duration_minutes_snapshot, service_price_cents_snapshot,
  currency_snapshot, buffer_before_minutes_snapshot,
  buffer_after_minutes_snapshot, snapshot_captured_at, consumed_booking_id,
  consumed_at, created_at, updated_at
) values
  (
    'b1050000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-04 10:00:00+00', '2099-02-04 10:50:00+00',
    'America/Sao_Paulo', 'consumed', 'bootstrap-orphan-105-0005',
    now() + interval '5 minutes', 'Reiki online', 50, 17000, 'BRL', 10, 10,
    now(), 'a1050000-0000-4000-8000-000000000005', now(), now(), now()
  ),
  (
    'b1050000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-02-05 10:00:00+00', '2099-02-05 10:50:00+00',
    'America/Sao_Paulo', 'consumed', 'bootstrap-orphan-105-0006',
    now() - interval '1 second', 'Reiki online', 50, 17000, 'BRL', 10, 10,
    now() - interval '10 minutes',
    'a1050000-0000-4000-8000-000000000006',
    now() - interval '10 minutes', now() - interval '10 minutes',
    now() - interval '10 minutes'
  );

select is(
  (public.cancel_unstarted_initial_checkout_v1(
    'a1050000-0000-4000-8000-000000000005',
    'b1050000-0000-4000-8000-000000000005',
    'checkout_bootstrap_failed'
  )->>'released')::boolean,
  true,
  'failed initial checkout bootstrap is compensated immediately'
);

select is(
  (select status::text from public.bookings
   where id = 'a1050000-0000-4000-8000-000000000005'),
  'cancelled_by_payment',
  'bootstrap compensation releases the therapist slot'
);

select is(
  (select booking_id::text
   from public.expire_due_initial_checkout_orphans_v1(now(), 10)
   where booking_id = 'a1050000-0000-4000-8000-000000000006'),
  'a1050000-0000-4000-8000-000000000006',
  'maintenance finds an expired checkout bootstrap orphan'
);

select is(
  (select status::text from public.bookings
   where id = 'a1050000-0000-4000-8000-000000000006'),
  'cancelled_by_payment',
  'maintenance releases an expired checkout bootstrap orphan'
);

select * from finish();
rollback;
