begin;

select plan(29);

select ok(
  to_regprocedure(
    'public.recover_failed_session_payment_authorization_v10(uuid,text,text,timestamp with time zone,text)'
  ) is not null,
  'the failed Checkout success recovery command exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.recover_failed_session_payment_authorization_v10(uuid,text,text,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'the trusted payment worker can execute the recovery command'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.recover_failed_session_payment_authorization_v10(uuid,text,text,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'the browser cannot execute the recovery command'
);

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
)
values (
  'a1640000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_recovery_164', 'ready', true, true, true,
  'active', 'ready', 'enabled', 'daily', true
)
on conflict (therapist_profile_id) where is_current
do update set
  stripe_account_id = excluded.stripe_account_id,
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
)
values (
  'a1640000-0000-4000-8000-000000000002',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000010',
  'patient', 'test', 'cus_test_recovery_164',
  'recovery-164@example.test', false
)
on conflict (profile_id, role, environment) do update
set patient_profile_id = excluded.patient_profile_id,
    stripe_customer_id = excluded.stripe_customer_id,
    email = excluded.email,
    livemode = excluded.livemode;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
)
values
  (
    'a1640000-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-11-21 13:00:00+00', '2099-11-21 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'a1640000-0000-4000-8000-000000000020',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-11-22 13:00:00+00', '2099-11-22 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'a1640000-0000-4000-8000-000000000030',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-11-23 13:00:00+00', '2099-11-23 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  );

select lives_ok(
  $$select public.prepare_session_payment_v10(
    'a1640000-0000-4000-8000-000000000010',
    (
      select id from public.stripe_customers
      where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
        and role = 'patient' and environment = 'test'
    )
  )$$,
  'the recoverable booking uses the canonical V10 preparation flow'
);
select lives_ok(
  $$select public.prepare_session_payment_v10(
    'a1640000-0000-4000-8000-000000000020',
    (
      select id from public.stripe_customers
      where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
        and role = 'patient' and environment = 'test'
    )
  )$$,
  'the expired-event booking uses the canonical V10 preparation flow'
);
select lives_ok(
  $$select public.prepare_session_payment_v10(
    'a1640000-0000-4000-8000-000000000030',
    (
      select id from public.stripe_customers
      where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
        and role = 'patient' and environment = 'test'
    )
  )$$,
  'the conflict booking uses the canonical V10 preparation flow'
);

select is(
  public.swap_session_payment_checkout_v10(
    payment.id, booking.version, 'test', null,
    'cs_test_recovery_164_ok', 17000, 0, 17000, 'immediate'
  ) ->> 'applied',
  'true',
  'the recoverable fixture has one current Checkout'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'a1640000-0000-4000-8000-000000000010';

select is(
  public.swap_session_payment_checkout_v10(
    payment.id, booking.version, 'test', null,
    'cs_test_recovery_164_expired', 17000, 0, 17000, 'immediate'
  ) ->> 'applied',
  'true',
  'the expired-event fixture has one current Checkout'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'a1640000-0000-4000-8000-000000000020';

select is(
  public.swap_session_payment_checkout_v10(
    payment.id, booking.version, 'test', null,
    'cs_test_recovery_164_conflict', 17000, 0, 17000, 'immediate'
  ) ->> 'applied',
  'true',
  'the conflict fixture has one current Checkout'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'a1640000-0000-4000-8000-000000000030';

insert into public.session_payment_attempts (
  session_payment_id, attempt_kind, idempotency_key,
  reservation_expires_at, status, stripe_checkout_session_id
)
select payment.id, 'initial_hold', 'tes:v10:recovery:164:ok',
  now() + interval '5 minutes', 'checkout_created',
  'cs_test_recovery_164_ok'
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010'
union all
select payment.id, 'initial_hold', 'tes:v10:recovery:164:expired',
  now() - interval '30 seconds', 'checkout_created',
  'cs_test_recovery_164_expired'
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000020'
union all
select payment.id, 'initial_hold', 'tes:v10:recovery:164:conflict',
  now() + interval '5 minutes', 'checkout_created',
  'cs_test_recovery_164_conflict'
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000030';

select is(
  public.apply_session_payment_state_v1(
    payment.id, 'failed', 'evt_test_recovery_164_failed',
    now() - interval '1 minute', 'pi_test_recovery_164_ok', null,
    'cs_test_recovery_164_ok'
  ) ->> 'applied',
  'true',
  'the first failed attempt is persisted canonically'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select is(
  public.apply_session_payment_state_v1(
    payment.id, 'failed', 'evt_test_recovery_164_expired_failed',
    now() - interval '1 minute', 'pi_test_recovery_164_expired', null,
    'cs_test_recovery_164_expired'
  ) ->> 'applied',
  'true',
  'the expired-event failure is persisted canonically'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000020';

select is(
  public.apply_session_payment_state_v1(
    payment.id, 'failed', 'evt_test_recovery_164_conflict_failed',
    now() - interval '1 minute', 'pi_test_recovery_164_conflict', null,
    'cs_test_recovery_164_conflict'
  ) ->> 'applied',
  'true',
  'the conflict fixture releases its booking after the failed charge'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000030';

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
)
values (
  'a1640000-0000-4000-8000-000000000031',
  'b1000000-0000-4000-8000-000000000009',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-11-23 13:00:00+00', '2099-11-23 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid', now()
);

select is(
  (select status::text from public.bookings
   where id = 'a1640000-0000-4000-8000-000000000010'),
  'cancelled_by_payment',
  'the failed charge releases the booking before recovery'
);
select is(
  (select financial_status::text from public.session_payments
   where booking_id = 'a1640000-0000-4000-8000-000000000010'),
  'failed',
  'the canonical payment remains failed before the signed success'
);

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_ok', 'pi_test_recovery_164_ok',
    payment.stripe_event_created_at, 'evt_test_recovery_164_same_time'
  ) ->> 'reason',
  'payment_not_recoverable',
  'a success without a newer provider timestamp cannot supersede the failure'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_ok', 'pi_test_recovery_164_wrong',
    now(), 'evt_test_recovery_164_wrong'
  ) ->> 'reason',
  'payment_not_recoverable',
  'a different PaymentIntent cannot reclaim the booking'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_ok', 'pi_test_recovery_164_ok',
    now(), 'evt_test_recovery_164_succeeded'
  ) ->> 'reason',
  'recovered',
  'the same Checkout and PaymentIntent can reclaim the available booking'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select is(
  (select status::text from public.bookings
   where id = 'a1640000-0000-4000-8000-000000000010'),
  'pending_payment',
  'recovery reopens only the payment-owned booking state'
);
select is(
  (select financial_status::text from public.session_payments
   where booking_id = 'a1640000-0000-4000-8000-000000000010'),
  'processing',
  'recovery moves the canonical payment to processing before confirmation'
);
select is(
  (select status from public.session_payment_attempts
   where idempotency_key = 'tes:v10:recovery:164:ok'),
  'processing',
  'recovery records the slot claim on the same attempt'
);

select is(
  public.confirm_session_payment_and_enqueue_transfer_v10(
    payment.id, 'test', 'pi_test_recovery_164_ok',
    'ch_test_recovery_164_ok', now(),
    'evt_test_recovery_164_succeeded', now()
  ) ->> 'financialStatus',
  'paid',
  'the canonical confirmation completes after safe slot recovery'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select results_eq(
  $$select status::text, payment_status::text
    from public.bookings
    where id = 'a1640000-0000-4000-8000-000000000010'$$,
  $$values ('confirmed'::text, 'paid'::text)$$,
  'booking and payment projections are confirmed consistently'
);
select is(
  (select count(*)::integer from public.session_transfer_jobs as job
   join public.session_payments as payment
     on payment.id = job.session_payment_id
   where payment.booking_id = 'a1640000-0000-4000-8000-000000000010'),
  1,
  'confirmation enqueues exactly one transfer job'
);

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_ok', 'pi_test_recovery_164_ok',
    now(), 'evt_test_recovery_164_succeeded_replay'
  ) ->> 'reason',
  'already_paid',
  'a signed replay with the same binding is idempotent'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000010';

select is(
  (select count(*)::integer from public.session_transfer_jobs as job
   join public.session_payments as payment
     on payment.id = job.session_payment_id
   where payment.booking_id = 'a1640000-0000-4000-8000-000000000010'),
  1,
  'the recovery replay does not duplicate the transfer job'
);

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_expired',
    'pi_test_recovery_164_expired', now(),
    'evt_test_recovery_164_expired_succeeded'
  ) ->> 'reason',
  'payment_not_recoverable',
  'an initial success created after the original hold fails closed'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000020';

select results_eq(
  $$select booking.status::text, payment.financial_status::text
    from public.bookings as booking
    join public.session_payments as payment on payment.booking_id = booking.id
    where booking.id = 'a1640000-0000-4000-8000-000000000020'$$,
  $$values ('cancelled_by_payment'::text, 'failed'::text)$$,
  'an expired success leaves the released booking and failed payment unchanged'
);

select is(
  public.recover_failed_session_payment_authorization_v10(
    payment.id, 'cs_test_recovery_164_conflict',
    'pi_test_recovery_164_conflict', now(),
    'evt_test_recovery_164_conflict_succeeded'
  ) ->> 'reason',
  'slot_conflict',
  'a paid event cannot reopen a therapist interval occupied after failure'
)
from public.session_payments as payment
where payment.booking_id = 'a1640000-0000-4000-8000-000000000030';

select results_eq(
  $$select booking.status::text, payment.financial_status::text
    from public.bookings as booking
    join public.session_payments as payment on payment.booking_id = booking.id
    where booking.id = 'a1640000-0000-4000-8000-000000000030'$$,
  $$values ('cancelled_by_payment'::text, 'failed'::text)$$,
  'a slot conflict leaves the booking released without creating finance state'
);

select * from finish();
rollback;
