begin;
select plan(17);

select ok(has_function_privilege('service_role',
  'public.cancel_uncharged_session_v10(uuid,uuid,text,text)', 'EXECUTE'),
  'the trusted worker can cancel an untouched future V10 charge');
select ok(not has_function_privilege('authenticated',
  'public.cancel_uncharged_session_v10(uuid,uuid,text,text)', 'EXECUTE'),
  'the browser cannot mutate a V10 schedule directly');

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
) values (
  'b1160000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_116', 'ready', true, true, true,
  'active', 'ready', 'enabled', 'daily', true
) on conflict (therapist_profile_id) where is_current
do update set stripe_account_id = excluded.stripe_account_id,
  onboarding_status = excluded.onboarding_status,
  details_submitted = excluded.details_submitted,
  charges_enabled = excluded.charges_enabled,
  payouts_enabled = excluded.payouts_enabled,
  stripe_transfers_status = excluded.stripe_transfers_status,
  operational_status = excluded.operational_status,
  payout_status = excluded.payout_status,
  payout_schedule_interval = excluded.payout_schedule_interval;

insert into public.stripe_customers (
  id, profile_id, patient_profile_id, role, environment,
  stripe_customer_id, email, livemode
) values (
  'b1160000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_v10_116', 'patient@example.test', false
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
) values
  ('b1160000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-09-20 13:00:00+00', '2099-09-20 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now()),
  ('b1160000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-09-21 13:00:00+00', '2099-09-21 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now());

select public.prepare_session_payment_v10(id,
  'b1160000-0000-4000-8000-000000000002')
from public.bookings where id in (
  'b1160000-0000-4000-8000-000000000011',
  'b1160000-0000-4000-8000-000000000012');

select public.swap_session_payment_checkout_v10(
  p.id, b.version, 'test', null,
  'cs_test_v10_116_' || right(b.id::text, 2),
  17000, 0, 17000, 'scheduled'
)
from public.bookings b join public.session_payments p on p.booking_id=b.id
where b.id in (
  'b1160000-0000-4000-8000-000000000011',
  'b1160000-0000-4000-8000-000000000012');

insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key, status,
  stripe_checkout_session_id
)
select p.id, 'initial_hold', 'tes:v10:attempt:116:' || right(b.id::text, 2),
  'checkout_created', 'cs_test_v10_116_' || right(b.id::text, 2)
from public.bookings b join public.session_payments p on p.booking_id=b.id
where b.id in (
  'b1160000-0000-4000-8000-000000000011',
  'b1160000-0000-4000-8000-000000000012');

select public.complete_session_payment_setup_v10(
  p.id, b.version, 'test', 'cs_test_v10_116_' || right(b.id::text, 2),
  'cus_test_v10_116', 'seti_test_v10_116_' || right(b.id::text, 2),
  'pm_test_v10_116_' || right(b.id::text, 2),
  'tes-session-off-session-consent-v1',
  'evt_test_v10_116_' || right(b.id::text, 2),
  '2099-09-01 10:00:00+00'
)
from public.bookings b join public.session_payments p on p.booking_id=b.id
where b.id in (
  'b1160000-0000-4000-8000-000000000011',
  'b1160000-0000-4000-8000-000000000012');

select is((select status from public.session_payment_schedules
  where booking_id='b1160000-0000-4000-8000-000000000011'),
  'scheduled', 'the first booking has an untouched T-24 schedule');
select throws_ok($$select public.cancel_uncharged_session_v10(
  'b1160000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000002',
  'tes:v10:cancel:116:wrong', 'Não poderei comparecer')$$,
  '42501', 'SESSION_PRECHARGE_CANCEL_V10_FORBIDDEN',
  'another patient cannot cancel the reservation');
select is(public.cancel_uncharged_session_v10(
  'b1160000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'tes:v10:cancel:116:first', 'Não poderei comparecer') ->> 'applied',
  'true', 'the patient cancels an untouched future charge atomically');
select is((select status from public.session_payment_schedules
  where booking_id='b1160000-0000-4000-8000-000000000011'),
  'canceled', 'the charge schedule is no longer claimable');
select is((select status from public.session_payment_setups
  where booking_id='b1160000-0000-4000-8000-000000000011'),
  'canceled', 'the reservation-specific card setup is retired');
select is((select financial_status::text from public.session_payments
  where booking_id='b1160000-0000-4000-8000-000000000011'),
  'canceled', 'payment is canceled without a Refund');
select is((select status::text from public.bookings
  where id='b1160000-0000-4000-8000-000000000011'),
  'cancelled_by_patient', 'the appointment is canceled and the slot released');
select is((select payment_status::text from public.bookings
  where id='b1160000-0000-4000-8000-000000000011'),
  'cancelled', 'booking payment presentation does not claim that it was paid');
select is((select count(*)::integer from public.session_refunds r
  join public.session_payments p on p.id=r.session_payment_id
  where p.booking_id='b1160000-0000-4000-8000-000000000011'),
  0, 'no Stripe refund object is fabricated');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id='b1160000-0000-4000-8000-000000000011'),
  0, 'an uncharged cancellation never creates a Transfer obligation');
select is(public.cancel_uncharged_session_v10(
  'b1160000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'tes:v10:cancel:116:first', 'Não poderei comparecer') ->> 'applied',
  'false', 'replay of the same request is idempotent');
select throws_ok($$select public.cancel_uncharged_session_v10(
  'b1160000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'tes:v10:cancel:116:other', 'Outro motivo')$$,
  '23514', 'SESSION_PRECHARGE_CANCEL_V10_REQUIRES_SUPPORT',
  'a different request cannot claim the finished cancellation');

update public.session_payment_schedules
set status='claimed', attempt_count=1, lease_owner=gen_random_uuid(),
  lease_expires_at=now()+interval '5 minutes'
where booking_id='b1160000-0000-4000-8000-000000000012';
select throws_ok($$select public.cancel_uncharged_session_v10(
  'b1160000-0000-4000-8000-000000000012',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'tes:v10:cancel:116:claimed', 'Não poderei comparecer')$$,
  '23514', 'SESSION_PRECHARGE_CANCEL_V10_REQUIRES_SUPPORT',
  'an already claimed charge is never canceled blindly');
select is((select status from public.session_payment_schedules
  where booking_id='b1160000-0000-4000-8000-000000000012'),
  'claimed', 'a rejected cancellation preserves the worker lease');
select is((select status::text from public.bookings
  where id='b1160000-0000-4000-8000-000000000012'),
  'confirmed', 'a rejected cancellation keeps the appointment intact');

select * from finish();
rollback;
