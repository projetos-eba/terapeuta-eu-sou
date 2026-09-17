begin;
select plan(9);

select ok(has_function_privilege('service_role',
  'public.cancel_uncharged_session_v10(uuid,uuid,text,text)', 'EXECUTE'),
  'the trusted worker can cancel a rescheduled V10 charge');

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
) values (
  'b1340000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_134', 'ready', true, true, true,
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
  'b1340000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_v10_134', 'patient@example.test', false
) on conflict (profile_id, role, environment) do update
set stripe_customer_id = excluded.stripe_customer_id,
    email = excluded.email,
    livemode = excluded.livemode;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
) values (
  'b1340000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000010',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-10-20 13:00:00+00', '2099-10-20 13:50:00+00',
  'America/Sao_Paulo', 'draft', 'not_started', now()
);

select public.prepare_session_payment_v10(
  'b1340000-0000-4000-8000-000000000011',
  (select id from public.stripe_customers
   where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
     and role = 'patient' and environment = 'test')
);

select public.swap_session_payment_checkout_v10(
  payment.id, booking.version, 'test', null, 'cs_test_v10_134',
  17000, 0, 17000, 'scheduled'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id = 'b1340000-0000-4000-8000-000000000011';

insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key, status,
  stripe_checkout_session_id
)
select payment.id, 'initial_hold', 'tes:v10:attempt:134', 'checkout_created',
  'cs_test_v10_134'
from public.session_payments payment
where payment.booking_id = 'b1340000-0000-4000-8000-000000000011';

select public.complete_session_payment_setup_v10(
  payment.id, booking.version, 'test', 'cs_test_v10_134',
  'cus_test_v10_134', 'seti_test_v10_134', 'pm_test_v10_134',
  'tes-session-off-session-consent-v1', 'evt_test_v10_134',
  '2099-09-01 10:00:00+00'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id = 'b1340000-0000-4000-8000-000000000011';

create temporary table v10_reschedule_then_cancel_target on commit drop as
select candidate.starts_at, candidate.ends_at, candidate.timezone
from public.list_booking_reschedule_candidates_v1(
  'b1340000-0000-4000-8000-000000000011',
  now() + interval '25 hours', now() + interval '60 days', now(), 5000
) candidate
where not exists (
  select 1 from public.bookings conflict
  join public.bookings source
    on source.id = 'b1340000-0000-4000-8000-000000000011'
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
  candidate.starts_at, candidate.ends_at,
  'b1340000-0000-4000-8000-000000000011'
)
order by candidate.starts_at
limit 1;

select ok(exists (select 1 from v10_reschedule_then_cancel_target),
  'the authoritative agenda exposes a valid target before cancellation');
select is(public.reschedule_uncharged_session_v10(
  'b1340000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  (select starts_at from v10_reschedule_then_cancel_target),
  (select ends_at from v10_reschedule_then_cancel_target),
  (select timezone from v10_reschedule_then_cancel_target),
  'Mudança de agenda', 'tes:v10:reschedule:134',
  (select version from public.bookings
   where id = 'b1340000-0000-4000-8000-000000000011')
) ->> 'applied', 'true',
  'pre-charge rescheduling creates a replacement charge schedule');
select is((select expected_booking_version from public.session_payment_schedules
  where booking_id = 'b1340000-0000-4000-8000-000000000011'
    and status = 'scheduled'),
  (select version::bigint from public.bookings
   where id = 'b1340000-0000-4000-8000-000000000011'),
  'the active replacement schedule freezes the current booking version');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1340000-0000-4000-8000-000000000011'
    and status = 'superseded'), 1,
  'the original schedule stays immutable historical evidence');
select is(public.cancel_uncharged_session_v10(
  'b1340000-0000-4000-8000-000000000011',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'tes:v10:cancel:134', 'Não poderei comparecer'
) ->> 'applied', 'true',
  'the patient can cancel the active replacement before it is charged');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1340000-0000-4000-8000-000000000011'
    and status = 'canceled'), 'canceled',
  'the replacement charge schedule is no longer claimable');
select is((select financial_status::text from public.session_payments
  where booking_id = 'b1340000-0000-4000-8000-000000000011'), 'canceled',
  'the payment remains canceled without a Refund');
select is((select status::text from public.bookings
  where id = 'b1340000-0000-4000-8000-000000000011'), 'cancelled_by_patient',
  'the rescheduled appointment is canceled and its new slot is released');

select * from finish();
rollback;
