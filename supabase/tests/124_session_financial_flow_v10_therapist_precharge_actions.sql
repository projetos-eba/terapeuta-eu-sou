begin;
select plan(30);

select ok(has_function_privilege('service_role',
  'public.open_therapist_booking_reschedule_v10(uuid,uuid,text,text,integer)',
  'EXECUTE'), 'the trusted function can open a therapist V10 reschedule');
select ok(not has_function_privilege('authenticated',
  'public.open_therapist_booking_reschedule_v10(uuid,uuid,text,text,integer)',
  'EXECUTE'), 'the browser cannot mutate a therapist V10 schedule directly');
select ok(has_function_privilege('service_role',
  'public.cancel_therapist_uncharged_session_v10(uuid,uuid,text,text)',
  'EXECUTE'), 'the trusted function can cancel a pristine therapist V10 booking');

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
) values (
  'b1240000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_124', 'ready', true, true, true,
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
  'b1240000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_v10_124', 'patient@example.test', false
) on conflict (profile_id, role, environment) do update
set patient_profile_id = excluded.patient_profile_id,
    stripe_customer_id = excluded.stripe_customer_id,
    email = excluded.email,
    livemode = excluded.livemode;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
) values
  ('b1240000-0000-4000-8000-000000000011',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-10-20 13:00:00+00', '2099-10-20 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now()),
  ('b1240000-0000-4000-8000-000000000012',
   'b1000000-0000-4000-8000-000000000010',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   '2099-10-21 13:00:00+00', '2099-10-21 13:50:00+00',
   'America/Sao_Paulo', 'draft', 'not_started', now());

select public.prepare_session_payment_v10(id,
  (select id from public.stripe_customers
   where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
     and role = 'patient' and environment = 'test'))
from public.bookings where id in (
  'b1240000-0000-4000-8000-000000000011',
  'b1240000-0000-4000-8000-000000000012'
);

select public.swap_session_payment_checkout_v10(
  payment.id, booking.version, 'test', null,
  'cs_test_v10_124_' || right(booking.id::text, 2),
  17000, 0, 17000, 'scheduled'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1240000-0000-4000-8000-000000000011',
  'b1240000-0000-4000-8000-000000000012'
);

insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key, status,
  stripe_checkout_session_id
)
select payment.id, 'initial_hold',
  'tes:v10:attempt:124:' || right(booking.id::text, 2),
  'checkout_created', 'cs_test_v10_124_' || right(booking.id::text, 2)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1240000-0000-4000-8000-000000000011',
  'b1240000-0000-4000-8000-000000000012'
);

select public.complete_session_payment_setup_v10(
  payment.id, booking.version, 'test',
  'cs_test_v10_124_' || right(booking.id::text, 2),
  'cus_test_v10_124', 'seti_test_v10_124_' || right(booking.id::text, 2),
  'pm_test_v10_124_' || right(booking.id::text, 2),
  'tes-session-off-session-consent-v1',
  'evt_test_v10_124_' || right(booking.id::text, 2),
  '2099-10-01 10:00:00+00'
)
from public.bookings booking
join public.session_payments payment on payment.booking_id = booking.id
where booking.id in (
  'b1240000-0000-4000-8000-000000000011',
  'b1240000-0000-4000-8000-000000000012'
);

create temporary table therapist_v10_target on commit drop as
select candidate.starts_at, candidate.ends_at, candidate.timezone
from public.list_booking_reschedule_candidates_v1(
  'b1240000-0000-4000-8000-000000000011',
  now() + interval '25 hours', now() + interval '60 days', now(), 5000
) candidate
where not exists (
  select 1 from public.bookings conflict
  join public.bookings source
    on source.id = 'b1240000-0000-4000-8000-000000000011'
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
    and hold.occupied_during && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
)
and not public.patient_has_schedule_conflict_v1(
  'b1000000-0000-4000-8000-000000000010',
  candidate.starts_at, candidate.ends_at,
  'b1240000-0000-4000-8000-000000000011'
)
order by candidate.starts_at
limit 1;

select ok(exists (select 1 from therapist_v10_target),
  'the agenda offers an authoritative replacement slot');

select is(public.open_therapist_booking_reschedule_v10(
  'b1240000-0000-4000-8000-000000000011',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'Preciso reorganizar minha agenda.', 'tes:v10:therapist-open:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000011')
) ->> 'status', 'pending', 'the therapist opens a V10 request before payment');
select is(
  (select expires_at from public.booking_reschedule_requests
   where request_id = 'tes:v10:therapist-open:124'),
  (select starts_at - interval '24 hours' from public.bookings
   where id = 'b1240000-0000-4000-8000-000000000011'),
  'the therapist request closes at the original payment window'
);
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000011'
    and status = 'scheduled'), 1,
  'opening the request leaves one untouched charge schedule');
select is(jsonb_array_length(public.claim_due_session_payment_schedules_v10(
  (select payment_due_at from public.session_payments
   where booking_id = 'b1240000-0000-4000-8000-000000000011'),
  'b1240000-0000-4000-8000-000000000099', 20, 5
) -> 'claims'), 0, 'a pending therapist decision fences the payment worker');

select is(public.resolve_therapist_booking_reschedule_v10(
  (select id from public.booking_reschedule_requests
   where request_id = 'tes:v10:therapist-open:124'),
  'bbbbbbbb-0000-4000-8000-000000000010', 'reschedule',
  (select starts_at from therapist_v10_target),
  (select ends_at from therapist_v10_target),
  (select timezone from therapist_v10_target),
  'tes:v10:therapist-resolve:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000011')
) ->> 'applied', 'true', 'the patient applies the therapist V10 reschedule atomically');
select is((select starts_at from public.bookings
  where id = 'b1240000-0000-4000-8000-000000000011'),
  (select starts_at from therapist_v10_target),
  'the booking uses the patient-selected authoritative slot');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000011'
    and status = 'superseded'), 1,
  'the prior charge schedule is retained only as superseded history');
select is((select count(*)::integer from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000011'
    and status = 'scheduled'), 1,
  'exactly one replacement charge schedule remains active');
select is((select stripe_payment_method_id from public.session_payment_setups
  where booking_id = 'b1240000-0000-4000-8000-000000000011'),
  'pm_test_v10_124_11', 'the same saved payment method remains bound');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id = 'b1240000-0000-4000-8000-000000000011'), 0,
  'a pre-charge therapist reschedule creates no transfer');

savepoint therapist_v10_notice_window;
update public.bookings
set status = 'cancelled_by_therapist',
    starts_at = now() + interval '36 hours',
    ends_at = now() + interval '36 hours 50 minutes'
where id = 'b1240000-0000-4000-8000-000000000012';
select throws_ok($$select public.open_therapist_booking_reschedule_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'O paciente precisa ter tempo para responder.', 'tes:v10:therapist-notice:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000012')
)$$,
  '23514', 'SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_MINIMUM_NOTICE',
  'the therapist cannot open a V10 request inside the 48-hour notice window');
rollback to savepoint therapist_v10_notice_window;

select is(public.open_therapist_booking_reschedule_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'Preciso retirar a solicitação.', 'tes:v10:therapist-withdraw:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000012')
) ->> 'status', 'pending', 'the therapist can open a second pristine V10 request');
select is(public.withdraw_therapist_booking_reschedule_v10(
  (select id from public.booking_reschedule_requests
   where request_id = 'tes:v10:therapist-withdraw:124'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'tes:v10:therapist-withdraw-resolution:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000012')
) ->> 'status', 'cancelled', 'the therapist can withdraw the pristine V10 request');
select is(public.withdraw_therapist_booking_reschedule_v10(
  (select id from public.booking_reschedule_requests
   where request_id = 'tes:v10:therapist-withdraw:124'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'tes:v10:therapist-withdraw-resolution:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000012')
) ->> 'idempotentReplay', 'true', 'the same therapist withdrawal can be retried safely');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000012'),
  'scheduled', 'withdrawing a request leaves the payment schedule intact');

select is(public.open_therapist_booking_reschedule_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'Esta solicitação vai expirar.', 'tes:v10:therapist-expiry:124',
  (select version from public.bookings where id = 'b1240000-0000-4000-8000-000000000012')
) ->> 'status', 'pending', 'another therapist V10 request can be opened after withdrawal');
select throws_ok($$select public.cancel_therapist_uncharged_session_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'tes:v10:therapist-cancel:124:pending', 'Tentativa concorrente')$$,
  '23514', 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_RESCHEDULE_PENDING',
  'a pending reschedule must be resolved before a therapist cancellation');
update public.booking_reschedule_requests
set expires_at = now() - interval '1 minute'
where request_id = 'tes:v10:therapist-expiry:124';
select lives_ok($$select public.expire_booking_reschedule_requests_v1(now())$$,
  'expiry processing remains available for a therapist V10 request');
select is((select status from public.booking_reschedule_requests
  where request_id = 'tes:v10:therapist-expiry:124'),
  'expired', 'an unchosen therapist V10 request expires rather than changing the booking');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000012'),
  'scheduled', 'expiry releases the untouched schedule for its normal future due time');

select is(public.cancel_therapist_uncharged_session_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'tes:v10:therapist-cancel:124', 'Não conseguirei conduzir a sessão.'
) ->> 'applied', 'true', 'the therapist cancels a pristine V10 reservation');
select is((select status from public.session_payment_schedules
  where booking_id = 'b1240000-0000-4000-8000-000000000012'),
  'canceled', 'therapist cancellation retires the scheduled charge');
select is((select financial_status::text from public.session_payments
  where booking_id = 'b1240000-0000-4000-8000-000000000012'),
  'canceled', 'therapist cancellation has no refund because no payment occurred');
select is((select status::text from public.bookings
  where id = 'b1240000-0000-4000-8000-000000000012'),
  'cancelled_by_therapist', 'the cancelled booking is attributed to the therapist');
select is((select count(*)::integer from public.session_transfer_jobs
  where booking_id = 'b1240000-0000-4000-8000-000000000012'), 0,
  'therapist pre-charge cancellation creates no transfer obligation');

select throws_ok($$select public.cancel_therapist_uncharged_session_v10(
  'b1240000-0000-4000-8000-000000000012',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'tes:v10:therapist-cancel:124:stale', 'Tentativa tardia')$$,
  '23514', 'SESSION_PRECHARGE_THERAPIST_CANCEL_V10_PAYMENT_CHANGED',
  'a completed cancellation cannot be replaced by another command');

select * from finish();
rollback;
