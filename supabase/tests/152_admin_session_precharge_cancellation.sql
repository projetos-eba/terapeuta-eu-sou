begin;
select plan(19);

select ok(to_regprocedure('public.admin_cancel_uncharged_session_v10(uuid,text,uuid)') is not null,
  'the dedicated administrative pre-charge cancellation command exists');
select ok(has_function_privilege('authenticated',
  'public.admin_cancel_uncharged_session_v10(uuid,text,uuid)', 'EXECUTE'),
  'authenticated administrative requests can reach the guarded command');
select ok(not has_function_privilege('anon',
  'public.admin_cancel_uncharged_session_v10(uuid,text,uuid)', 'EXECUTE'),
  'anonymous users cannot reach the cancellation command');
select ok(enum_has_labels('public.booking_status', array['cancelled_by_admin']),
  'the administrative terminal cancellation status is registered');

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
) values (
  'b1520000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_152', 'ready', true, true, true,
  'active', 'ready', 'enabled', 'daily', true
) on conflict (therapist_profile_id) where is_current do update
set stripe_account_id = excluded.stripe_account_id,
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
  'b1520000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_v10_152', 'patient@example.test', false
) on conflict (profile_id, role, environment) do update
set patient_profile_id = excluded.patient_profile_id,
    stripe_customer_id = excluded.stripe_customer_id,
    email = excluded.email,
    livemode = excluded.livemode;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
) values (
  'b1520000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000010',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-12-20 13:00:00+00', '2099-12-20 13:50:00+00',
  'America/Sao_Paulo', 'draft', 'not_started', now()
);

select public.prepare_session_payment_v10(
  'b1520000-0000-4000-8000-000000000011',
  'b1520000-0000-4000-8000-000000000002'
);
select public.swap_session_payment_checkout_v10(
  payment.id, booking.version, 'test', null, 'cs_test_v10_152',
  17000, 0, 17000, 'scheduled'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'b1520000-0000-4000-8000-000000000011';
insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key, status, stripe_checkout_session_id
)
select payment.id, 'initial_hold', 'tes:v10:attempt:152', 'checkout_created', 'cs_test_v10_152'
from public.session_payments as payment
where payment.booking_id = 'b1520000-0000-4000-8000-000000000011';
select public.complete_session_payment_setup_v10(
  payment.id, booking.version, 'test', 'cs_test_v10_152', 'cus_test_v10_152',
  'seti_test_v10_152', 'pm_test_v10_152', 'tes-session-off-session-consent-v1',
  'evt_test_v10_152', '2099-12-01 10:00:00+00'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'b1520000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000010', true);
select throws_ok(
  $$select public.admin_cancel_uncharged_session_v10(
    'b1520000-0000-4000-8000-000000000011',
    'Reserva duplicada confirmada pela equipe.',
    'b1520000-0000-4000-8000-000000000098'
  )$$,
  '42501', 'ADMIN_SESSION_PRECHARGE_CANCEL_FORBIDDEN',
  'a non-administrative authenticated profile cannot cancel a reservation'
);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000090', true);
select throws_ok(
  $$select public.admin_cancel_uncharged_session_v10(
    'b1520000-0000-4000-8000-000000000011',
    'curta',
    'b1520000-0000-4000-8000-000000000097'
  )$$,
  '22023', 'ADMIN_SESSION_PRECHARGE_CANCEL_INVALID',
  'the database enforces the administrative justification length'
);
select is(
  public.admin_get_operation_detail_v1('sessions', 'b1520000-0000-4000-8000-000000000011')
    #>> '{record,financial_status}',
  'pending',
  'the detail read model exposes only the canonical local financial state'
);
select is(
  public.admin_get_operation_detail_v1('sessions', 'b1520000-0000-4000-8000-000000000011')
    #>> '{record,can_cancel_before_charge}',
  'true',
  'a pristine future V10 reservation is marked eligible before charging'
);
select is(
  public.admin_cancel_uncharged_session_v10(
    'b1520000-0000-4000-8000-000000000011',
    'Reserva duplicada confirmada pela equipe.',
    'b1520000-0000-4000-8000-000000000099'
  ) ->> 'applied',
  'true',
  'an authorized admin cancels the untouched V10 reservation atomically'
);
select is((select status::text from public.bookings
  where id = 'b1520000-0000-4000-8000-000000000011'),
  'cancelled_by_admin', 'the booking retains an administrative cancellation attribution');
select is((select financial_status::text from public.session_payments
  where booking_id = 'b1520000-0000-4000-8000-000000000011'),
  'canceled', 'the local payment is closed before any charge exists');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1520000-0000-4000-8000-000000000011'),
  'canceled', 'the scheduled charge is no longer claimable');
select is((select status from public.session_payment_setups
  where booking_id = 'b1520000-0000-4000-8000-000000000011'
    and superseded_at is null),
  'canceled', 'the linked setup configuration is closed with the reservation');
select is((select stripe_payment_intent_id is null and stripe_charge_id is null
  from public.session_payments
  where booking_id = 'b1520000-0000-4000-8000-000000000011'),
  true, 'the local cancellation preserves the absence of a PaymentIntent and charge');
select is((select cancellation_reason is null from public.bookings
  where id = 'b1520000-0000-4000-8000-000000000011'),
  true, 'the administrative justification remains in the restricted audit log');
select is((select count(*)::integer from public.session_refunds as refund
  join public.session_payments as payment on payment.id = refund.session_payment_id
  where payment.booking_id = 'b1520000-0000-4000-8000-000000000011'),
  0, 'the pre-charge cancellation creates no refund');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id = 'b1520000-0000-4000-8000-000000000011'),
  0, 'the pre-charge cancellation creates no transfer obligation');
select is(public.admin_cancel_uncharged_session_v10(
  'b1520000-0000-4000-8000-000000000011',
  'Reserva duplicada confirmada pela equipe.',
  'b1520000-0000-4000-8000-000000000099'
) ->> 'applied', 'false', 'the same administrative request is idempotent');
select is((select count(*)::integer from public.admin_audit_events
  where action = 'session.cancel_before_charge'
    and entity_id = 'b1520000-0000-4000-8000-000000000011'),
  1, 'the administrative cancellation is recorded once in the append-only audit');

select * from finish();
rollback;
