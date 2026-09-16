begin;
select plan(34);

select ok(has_function_privilege('service_role',
  'public.reschedule_uncharged_session_v10(uuid,uuid,timestamptz,timestamptz,text,text,text,integer)',
  'EXECUTE'), 'the trusted command can move an untouched V10 charge');
select ok(not has_function_privilege('authenticated',
  'public.reschedule_uncharged_session_v10(uuid,uuid,timestamptz,timestamptz,text,text,text,integer)',
  'EXECUTE'), 'the browser cannot move the private charge schedule directly');

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
) values (
  'b1170000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_117', 'ready', true, true, true,
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
  'b1170000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_v10_117', 'patient@example.test', false
) on conflict (profile_id, role, environment) do update
set stripe_customer_id = excluded.stripe_customer_id,
    email = excluded.email,
    livemode = excluded.livemode;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
) values
  ('b1170000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-09-20 13:00:00+00', '2099-09-20 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now()),
  ('b1170000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-09-22 13:00:00+00', '2099-09-22 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now());

select public.prepare_session_payment_v10(id,
  (select id from public.stripe_customers
   where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
     and role = 'patient' and environment = 'test'))
from public.bookings where id in (
  'b1170000-0000-4000-8000-000000000011',
  'b1170000-0000-4000-8000-000000000012');

select public.swap_session_payment_checkout_v10(
  payment.id, booking.version, 'test', null,
  'cs_test_v10_117_' || right(booking.id::text, 2),
  17000, 0, 17000, 'scheduled'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1170000-0000-4000-8000-000000000011',
  'b1170000-0000-4000-8000-000000000012');

insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key, status,
  stripe_checkout_session_id
)
select payment.id, 'initial_hold',
  'tes:v10:attempt:117:' || right(booking.id::text, 2),
  'checkout_created', 'cs_test_v10_117_' || right(booking.id::text, 2)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1170000-0000-4000-8000-000000000011',
  'b1170000-0000-4000-8000-000000000012');

select public.complete_session_payment_setup_v10(
  payment.id, booking.version, 'test',
  'cs_test_v10_117_' || right(booking.id::text, 2),
  'cus_test_v10_117',
  'seti_test_v10_117_' || right(booking.id::text, 2),
  'pm_test_v10_117_' || right(booking.id::text, 2),
  'tes-session-off-session-consent-v1',
  'evt_test_v10_117_' || right(booking.id::text, 2),
  '2099-09-01 10:00:00+00'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1170000-0000-4000-8000-000000000011',
  'b1170000-0000-4000-8000-000000000012');

create temporary table v10_reschedule_target on commit drop as
select candidate.starts_at, candidate.ends_at, candidate.timezone
from public.list_booking_reschedule_candidates_v1(
  'b1170000-0000-4000-8000-000000000011',
  now() + interval '25 hours',
  now() + interval '60 days',
  now(),
  5000
) candidate
where not exists (
  select 1 from public.bookings conflict
  join public.bookings source
    on source.id = 'b1170000-0000-4000-8000-000000000011'
  where conflict.therapist_profile_id = source.therapist_profile_id
    and conflict.id <> source.id
    and conflict.status in ('draft', 'pending_payment', 'confirmed')
    and conflict.occupied_during && tstzrange(
      candidate.starts_at
        - source.buffer_before_minutes_snapshot * interval '1 minute',
      candidate.ends_at
        + source.buffer_after_minutes_snapshot * interval '1 minute',
      '[)'
    )
)
and not exists (
  select 1 from public.booking_holds hold
  where hold.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
    and hold.status = 'active'
    and hold.expires_at > now()
    and hold.occupied_during &&
      tstzrange(candidate.starts_at, candidate.ends_at, '[)')
)
and not public.patient_has_schedule_conflict_v1(
  'b1000000-0000-4000-8000-000000000010',
  candidate.starts_at,
  candidate.ends_at,
  'b1170000-0000-4000-8000-000000000011'
)
order by candidate.starts_at
limit 1;

select ok(exists (select 1 from v10_reschedule_target),
  'the authoritative agenda exposes a valid reschedule target');

select is((select expected_booking_version from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  (select version::bigint from public.bookings
   where id = 'b1170000-0000-4000-8000-000000000011'),
  'initial checkout freezes the version expected by its charge schedule');

select is(public.reschedule_uncharged_session_v10(
  'b1170000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  (select starts_at from v10_reschedule_target),
  (select ends_at from v10_reschedule_target),
  (select timezone from v10_reschedule_target), 'Mudança de agenda',
  'tes:v10:reschedule:117:first',
  (select version from public.bookings
   where id = 'b1170000-0000-4000-8000-000000000011')
) ->> 'applied', 'true',
  'patient reschedule and charge replacement commit atomically');

select is((select starts_at from public.bookings
  where id = 'b1170000-0000-4000-8000-000000000011'),
  (select starts_at from v10_reschedule_target),
  'the booking moves to the requested slot');
select is((select payment_due_at from public.session_payments
  where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  (select starts_at - interval '24 hours' from v10_reschedule_target),
  'the authoritative due time follows T-24 of the new slot');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'superseded'), 1,
  'the stale charge schedule is superseded');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'scheduled'), 1,
  'exactly one replacement charge schedule remains active');
select is((select expected_booking_version from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'scheduled'),
  (select version::bigint from public.bookings
   where id = 'b1170000-0000-4000-8000-000000000011'),
  'the replacement rejects any later booking mutation');
select is((select count(*)::integer from public.session_payment_setups
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 1,
  'rescheduling does not duplicate the SetupIntent binding');
select is((select stripe_setup_intent_id from public.session_payment_setups
  where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  'seti_test_v10_117_11',
  'the original SetupIntent remains the immutable authorization record');
select is((select stripe_payment_method_id from public.session_payment_setups
  where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  'pm_test_v10_117_11',
  'the reservation keeps the same saved PaymentMethod');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 0,
  'rescheduling before charge does not create a Transfer');
select is((select count(*)::integer from public.stripe_transfers
  where session_payment_id = (select id from public.session_payments
    where booking_id = 'b1170000-0000-4000-8000-000000000011')), 0,
  'rescheduling does not fabricate a Stripe Transfer');

select is(public.reschedule_uncharged_session_v10(
  'b1170000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  (select starts_at from v10_reschedule_target),
  (select ends_at from v10_reschedule_target),
  (select timezone from v10_reschedule_target), 'Mudança de agenda',
  'tes:v10:reschedule:117:first', null
) ->> 'applied', 'false', 'the same request is idempotent');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 2,
  'idempotent replay creates no third schedule');

select is(jsonb_array_length(public.claim_due_session_payment_schedules_v10(
  (select starts_at - interval '24 hours' from v10_reschedule_target),
  'b1170000-0000-4000-8000-000000000099', 20, 5
) -> 'claims'), 1,
  'only the replacement schedule becomes claimable at the new T-24');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'claimed'), 'claimed',
  'the worker accepts the replacement booking-version binding');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'superseded'), 1,
  'the superseded schedule can never be reclaimed');

select is(public.record_session_payment_intent_v10(
  (select id from public.session_payment_schedules
    where booking_id = 'b1170000-0000-4000-8000-000000000011'
      and status = 'claimed'),
  (select id from public.session_payments
    where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  'b1170000-0000-4000-8000-000000000011',
  (select booking_version from public.session_payment_schedules
    where booking_id = 'b1170000-0000-4000-8000-000000000011'
      and status = 'claimed'),
  'test', 'pi_test_v10_117_rescheduled', 'succeeded', 17000, 'brl',
  'cus_test_v10_117', 'pm_test_v10_117_11', 'ch_test_v10_117_rescheduled',
  'evt_test_v10_117_rescheduled', '2099-09-01 11:00:00+00'
) ->> 'scheduleStatus', 'paid',
  'a succeeded replacement charge records payment after a pre-charge reschedule');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'superseded'), 1,
  'successful reconciliation preserves the superseded schedule as history');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and stripe_payment_intent_id = 'pi_test_v10_117_rescheduled'), 'paid',
  'only the replacement schedule receives the provider payment identity');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 1,
  'the approved replacement charge enqueues exactly one direct Transfer job');

insert into public.stripe_transfers (
  id, session_payment_id, therapist_profile_id, connect_account_id,
  stripe_transfer_id, idempotency_key, request_fingerprint,
  amount_cents, status, stripe_source_charge_id, transfer_origin,
  therapist_gross_amount_cents, debt_offset_amount_cents
)
select
  'b1170000-0000-4000-8000-000000000031', payment.id,
  payment.therapist_profile_id, payment.connect_account_id_snapshot,
  'tr_test_v10_117_rescheduled', 'tes:v10:transfer:117',
  'fingerprint:117', payment.therapist_amount_cents, 'transferred',
  payment.stripe_charge_id, 'session_direct', payment.therapist_amount_cents, 0
from public.session_payments payment
where payment.booking_id = 'b1170000-0000-4000-8000-000000000011';

update public.session_payments
set transfer_status = 'transferred'
where booking_id = 'b1170000-0000-4000-8000-000000000011';

select is(public.record_session_payment_intent_v10(
  (select id from public.session_payment_schedules
    where booking_id = 'b1170000-0000-4000-8000-000000000011'
      and status = 'paid'),
  (select id from public.session_payments
    where booking_id = 'b1170000-0000-4000-8000-000000000011'),
  'b1170000-0000-4000-8000-000000000011',
  (select booking_version from public.session_payment_schedules
    where booking_id = 'b1170000-0000-4000-8000-000000000011'
      and status = 'paid'),
  'test', 'pi_test_v10_117_rescheduled', 'succeeded', 17000, 'brl',
  'cus_test_v10_117', 'pm_test_v10_117_11', 'ch_test_v10_117_rescheduled',
  'evt_test_v10_117_rescheduled', '2099-09-01 11:00:00+00'
) ->> 'transferStatus', 'transferred',
  'a replay reports the completed direct Transfer state');
select is((select transfer_status::text from public.session_payments
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 'transferred',
  'a replay cannot regress a completed direct Transfer to pending');
select is((select count(*)::integer from public.stripe_transfers
  where session_payment_id = (select id from public.session_payments
    where booking_id = 'b1170000-0000-4000-8000-000000000011')), 1,
  'a replay cannot create a second direct Transfer record');
select is((select status from public.session_transfer_jobs
  where booking_id = 'b1170000-0000-4000-8000-000000000011'), 'queued',
  'a replay leaves the existing outbox job unchanged');

update public.session_payment_schedules
set status = 'claimed', attempt_count = 1,
    lease_owner = 'b1170000-0000-4000-8000-000000000098',
    lease_expires_at = now() + interval '5 minutes'
where booking_id = 'b1170000-0000-4000-8000-000000000012';

select throws_ok($$select public.reschedule_uncharged_session_v10(
  'b1170000-0000-4000-8000-000000000012',
  'bbbbbbbb-0000-4000-8000-000000000010',
  '2099-09-23 15:00:00+00', '2099-09-23 15:50:00+00',
  'America/Sao_Paulo', 'Mudança de agenda',
  'tes:v10:reschedule:117:claimed', null)$$,
  '23514', 'SESSION_PRECHARGE_RESCHEDULE_V10_REQUIRES_SUPPORT',
  'a claimed charge can never be rescheduled blindly');
select is((select starts_at from public.bookings
  where id = 'b1170000-0000-4000-8000-000000000012'),
  '2099-09-22 13:00:00+00'::timestamptz,
  'rejected rescheduling leaves the booking unchanged');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1170000-0000-4000-8000-000000000012'),
  'claimed', 'rejected rescheduling preserves the worker lease');

select throws_ok($$select public.reschedule_uncharged_session_v10(
  'b1170000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000002',
  '2099-09-24 15:00:00+00', '2099-09-24 15:50:00+00',
  'America/Sao_Paulo', 'Mudança de agenda',
  'tes:v10:reschedule:117:wrong-user', null)$$,
  '42501', 'SESSION_PRECHARGE_RESCHEDULE_V10_FORBIDDEN',
  'another patient cannot move the reservation');

select is((select count(*)::integer from public.booking_reschedule_requests
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and status = 'applied'), 1,
  'the canonical reschedule audit remains present');
select is((select count(*)::integer from public.booking_events
  where booking_id = 'b1170000-0000-4000-8000-000000000011'
    and event_type = 'booking_reschedule_resolved'
    and request_id = 'tes:v10:reschedule:117:first'), 1,
  'the canonical booking event remains deduplicated');

select * from finish();
rollback;
