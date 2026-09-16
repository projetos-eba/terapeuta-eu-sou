begin;

select plan(111);

select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_session_payment_v10(uuid,uuid)',
    'EXECUTE'
  ),
  'only the trusted checkout local worker can prepare a V10 session payment'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_session_payment_v10(uuid,uuid)',
    'EXECUTE'
  ),
  'the browser cannot prepare a V10 payment directly'
);

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval, is_current
)
values (
  'b1150000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_test_v10_115', 'ready', true, true, true,
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
values
  (
    'b1150000-0000-4000-8000-000000000002',
    'bbbbbbbb-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000010',
    'patient', 'test', 'cus_test_v10_115_1', 'patient-1@example.test', false
  ),
  (
    'b1150000-0000-4000-8000-000000000003',
    'bbbbbbbb-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'patient', 'test', 'cus_test_v10_115_2', 'patient-2@example.test', false
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
    'b1150000-0000-4000-8000-000000000011',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-20 13:00:00+00', '2099-09-20 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'b1150000-0000-4000-8000-000000000012',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-21 13:00:00+00', '2099-09-21 13:50:00+00',
    'America/Sao_Paulo', 'pending_payment', 'pending', now()
  ),
  (
    'b1150000-0000-4000-8000-000000000013',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-22 13:00:00+00', '2099-09-22 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'b1150000-0000-4000-8000-000000000014',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-23 13:00:00+00', '2099-09-23 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'b1150000-0000-4000-8000-000000000015',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-24 13:00:00+00', '2099-09-24 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  ),
  (
    'b1150000-0000-4000-8000-000000000016',
    'b1000000-0000-4000-8000-000000000010',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2099-09-25 13:00:00+00', '2099-09-25 13:50:00+00',
    'America/Sao_Paulo', 'draft', 'not_started', now()
  );

select is(
  public.prepare_session_payment_v10(
    'b1150000-0000-4000-8000-000000000011',
    (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
  ) ->> 'paymentFlowVersion',
  'v10',
  'a future reservation is prepared under the frozen V10 policy'
);
select is(
  (
    public.prepare_session_payment_v10(
      'b1150000-0000-4000-8000-000000000011',
      (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
    ) ->> 'bookingVersion'
  )::bigint,
  (
    select version::bigint from public.bookings
    where id = 'b1150000-0000-4000-8000-000000000011'
  ),
  'preparation returns the persisted booking version after the payment projection trigger'
);
select is(
  public.prepare_session_payment_v10(
    'b1150000-0000-4000-8000-000000000011',
    (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
  ) ->> 'sessionPaymentId',
  (
    select id::text from public.session_payments
    where booking_id = 'b1150000-0000-4000-8000-000000000011'
  ),
  'preparation is idempotent for the same reservation and customer'
);

select lives_ok(
  $$
    select public.prepare_session_payment_v10(
      'b1150000-0000-4000-8000-000000000012',
      (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002' and role = 'patient' and environment = 'test')
    )
  $$,
  'a second reservation creates its own V10 payment snapshot'
);
select is(
  (
    select count(*)::integer from public.session_payments
    where booking_id in (
      'b1150000-0000-4000-8000-000000000011',
      'b1150000-0000-4000-8000-000000000012'
    )
  ),
  2,
  'two reservations retain two independent payment records'
);
select is(
  (
    select count(distinct stripe_customer_id)::integer
    from public.session_payments
    where booking_id in (
      'b1150000-0000-4000-8000-000000000011',
      'b1150000-0000-4000-8000-000000000012'
    )
  ),
  2,
  'each reservation retains its own patient customer binding'
);

select lives_ok(
  $$
    select public.register_session_payment_setup_v10(
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000012'),
      (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000012'),
      'test', 'cus_test_v10_115_2', 'seti_test_v10_115_2',
      null, 'requires_setup', 'tes-session-off-session-consent-v1', now(), null
    )
  $$,
  'the second reservation can bind its own SetupIntent independently'
);
select throws_ok(
  $$
    select public.register_session_payment_setup_v10(
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000012'),
      (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000012'),
      'test', 'cus_test_v10_115_2', 'seti_test_v10_115_other',
      null, 'requires_setup', 'tes-session-off-session-consent-v1', now(), null
    )
  $$,
  '23505',
  'SESSION_PAYMENT_SETUP_V10_IDEMPOTENCY_CONFLICT',
  'a different SetupIntent cannot replace the frozen reservation binding'
);

select is(
  public.swap_session_payment_checkout_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000011'),
    'test', null, 'cs_test_v10_115_1',
    17000, 1700, 15300, 'scheduled',
    'DEZOFF', 'promo_test_v10_115', 'coupon_test_v10_115',
    'percent', 1000, 'tes:v10:promo:115:1'
  ) ->> 'totalAmountCents',
  '15300',
  'the server freezes a validated promotional total before saving the card'
);
select is(
  (select gross_amount_cents from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  15300,
  'the charged amount snapshot matches the promotion reservation'
);
select is(
  (select platform_gross_commission_cents from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  2295,
  'the 15 percent platform snapshot is recalculated over the frozen total'
);
select is(
  (select therapist_amount_cents from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  13005,
  'the therapist snapshot remains the exact remainder in cents'
);
select is(
  (select status from public.session_promotion_reservations where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  'reserved',
  'the promotion remains reserved until SetupIntent completion'
);

select lives_ok(
  $$
    insert into public.session_payment_attempts (
      session_payment_id, attempt_kind, idempotency_key, status,
      stripe_checkout_session_id
    ) values (
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
      'initial_hold', 'tes:v10:attempt:115:1', 'checkout_created',
      'cs_test_v10_115_1'
    )
  $$,
  'the reservation attempt is stored before the signed Setup completion'
);

select is(
  public.complete_session_payment_setup_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000011'),
    'test', 'cs_test_v10_115_1', 'cus_test_v10_115_1',
    'seti_test_v10_115_1', 'pm_test_v10_115_1',
    'tes-session-off-session-consent-v1',
    'evt_test_v10_115_setup_1', '2099-09-01 10:00:00+00'
  ) ->> 'status',
  'scheduled',
  'a succeeded off-session setup schedules the T-24 charge'
);
select is(
  (select status from public.session_payment_attempts where idempotency_key = 'tes:v10:attempt:115:1'),
  'setup_succeeded',
  'the checkout attempt records Setup success'
);
select is(
  (select status from public.session_promotion_reservations where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  'consumed',
  'the promotion is consumed only after the card setup succeeds'
);
select is(
  (select status::text from public.bookings where id = 'b1150000-0000-4000-8000-000000000011'),
  'confirmed',
  'the reserved session keeps its operational slot status without pretending it is paid'
);
select is(
  (select payment_status::text from public.bookings where id = 'b1150000-0000-4000-8000-000000000011'),
  'pending',
  'the future session remains financially pending until the T-24 charge'
);
select is(
  (select status from public.session_payment_schedules where session_payment_id = (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011')),
  'scheduled',
  'exactly one active charge schedule is bound to the matching setup'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'booking_reserved_patient'
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'saving the card queues one reservation email for the patient'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'booking_reserved_therapist'
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'saving the card queues one reservation email for the therapist'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key in ('booking_confirmed_patient', 'booking_confirmed_therapist')
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  0,
  'a future unpaid reservation does not send encounter confirmation emails'
);
select is(
  (select payload from public.email_outbox
   where action_key = 'booking_reserved_patient'
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  '{}'::jsonb,
  'reservation email work contains no payment or card payload'
);

select lives_ok(
  $$
    select public.complete_session_payment_setup_v10(
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
      (select booking_version from public.session_payment_setups where booking_id = 'b1150000-0000-4000-8000-000000000011'),
      'test', 'cs_test_v10_115_1', 'cus_test_v10_115_1',
      'seti_test_v10_115_1', 'pm_test_v10_115_1',
      'tes-session-off-session-consent-v1',
      'evt_test_v10_115_setup_1', '2099-09-01 10:00:00+00'
    )
  $$,
  'replaying the same signed setup event is idempotent'
);
select is(
  (select count(*)::integer from public.session_payment_setups where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'the replay never duplicates the reservation SetupIntent binding'
);
select is(
  (select count(*)::integer from public.session_payment_schedules where session_payment_id = (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011')),
  1,
  'the replay never duplicates the T-24 schedule'
);
select throws_ok(
  $$
    update public.session_payments
    set gross_amount_cents = 17000,
        platform_gross_commission_cents = 2550,
        therapist_amount_cents = 14450
    where booking_id = 'b1150000-0000-4000-8000-000000000011'
  $$,
  '23514',
  'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE',
  'the amount snapshot becomes immutable after SetupIntent success'
);
select throws_ok(
  $$
    select public.register_session_payment_setup_v10(
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
      1,
      'test', 'cus_test_v10_115_1', 'seti_test_v10_115_other',
      'pm_test_v10_115_other', 'succeeded',
      'tes-session-off-session-consent-v1', now(), null
    )
  $$,
  '23514',
  'SESSION_PAYMENT_BOOKING_VERSION_MISMATCH',
  'an old setup event cannot mutate the reservation after its version advances'
);

select lives_ok(
  $$
    select public.prepare_session_payment_v10(
      'b1150000-0000-4000-8000-000000000013',
      (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
    )
  $$,
  'a zero-total promotional reservation still starts from the canonical V10 snapshot'
);
select is(
  public.swap_session_payment_checkout_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000013'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000013'),
    'test', null, 'cs_test_v10_115_zero',
    17000, 17000, 0, 'immediate',
    'FREE100', 'promo_test_v10_115_zero', 'coupon_test_v10_115_zero',
    'percent', 10000, 'tes:v10:promo:115:zero'
  ) ->> 'totalAmountCents',
  '0',
  'a server-validated full discount freezes an exact zero total'
);
select lives_ok(
  $$
    insert into public.session_payment_attempts (
      session_payment_id, attempt_kind, idempotency_key, status,
      stripe_checkout_session_id
    ) values (
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000013'),
      'initial_hold', 'tes:v10:attempt:115:zero', 'checkout_created',
      'cs_test_v10_115_zero'
    )
  $$,
  'the signed zero-total checkout attempt is recorded before completion'
);
select is(
  public.confirm_zero_total_session_payment_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000013'),
    'cs_test_v10_115_zero', 'evt_test_v10_115_zero', '2099-09-01 10:00:00+00'
  ) ->> 'financialStatus',
  'paid',
  'a signed zero-total completion confirms the reservation without a card charge'
);
select is(
  (select transfer_status from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000013'),
  'not_eligible',
  'a zero-total reservation never creates a therapist Transfer obligation'
);
select is(
  (
    select count(*)::integer
    from public.session_transfer_jobs
    where session_payment_id = (
      select id from public.session_payments
      where booking_id = 'b1150000-0000-4000-8000-000000000013'
    )
  ),
  0,
  'a zero-total reservation has no Transfer job'
);
select is(
  (select status from public.session_promotion_reservations where booking_id = 'b1150000-0000-4000-8000-000000000013'),
  'consumed',
  'the full discount is consumed exactly once after signed completion'
);
select is(
  (select status::text from public.bookings where id = 'b1150000-0000-4000-8000-000000000013'),
  'confirmed',
  'the zero-total reservation is confirmed without a false Transfer state'
);

select lives_ok(
  $$
    select public.prepare_session_payment_v10(
      'b1150000-0000-4000-8000-000000000016',
      (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
    )
  $$,
  'an immediate V10 checkout starts from the same frozen payment contract'
);
select is(
  public.swap_session_payment_checkout_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000016'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000016'),
    'test', null, 'cs_test_v10_115_immediate',
    17000, 0, 17000, 'immediate',
    null, null, null, null, null, 'tes:v10:immediate:115'
  ) ->> 'applied',
  'true',
  'the immediate checkout keeps the exact server-calculated amount'
);
select lives_ok(
  $$
    insert into public.session_payment_attempts (
      session_payment_id, attempt_kind, idempotency_key, status,
      stripe_checkout_session_id
    ) values (
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000016'),
      'initial_hold', 'tes:v10:attempt:115:immediate', 'checkout_created',
      'cs_test_v10_115_immediate'
    )
  $$,
  'the immediate checkout attempt is persisted before its signed completion'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_test_v10_115_immediate',
  'checkout.session.completed',
  null,
  false,
  '2026-09-15',
  'platform',
  'test-hash-v10-115-immediate',
  '2099-09-24 13:02:00+00',
  'cs_test_v10_115_immediate'
);

select is(
  public.confirm_session_payment_and_enqueue_transfer_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000016'),
    'test', 'pi_test_v10_115_immediate', 'ch_test_v10_115_immediate',
    '2099-09-24 13:02:00+00', 'evt_test_v10_115_immediate',
    '2099-09-24 13:02:00+00'
  ) ->> 'transferStatus',
  'transfer_pending',
  'an immediate paid checkout creates its single direct Transfer obligation'
);
select is(
  (select status::text from public.bookings where id = 'b1150000-0000-4000-8000-000000000016'),
  'confirmed',
  'the immediate paid checkout confirms the encounter operationally'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'session_payment_approved'
     and related_entity_id = (
       select id from public.session_payments
       where booking_id = 'b1150000-0000-4000-8000-000000000016'
     )),
  1,
  'the immediate paid checkout queues one payment approval email for the patient'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key in ('booking_confirmed_patient', 'booking_confirmed_therapist')
     and related_entity_id = 'b1150000-0000-4000-8000-000000000016'),
  2,
  'the immediate paid checkout queues one encounter confirmation per participant'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key in ('booking_reserved_patient', 'booking_reserved_therapist')
     and related_entity_id = 'b1150000-0000-4000-8000-000000000016'),
  0,
  'an immediate paid checkout never queues a future-reservation message'
);
select lives_ok(
  $$
    select public.confirm_session_payment_and_enqueue_transfer_v10(
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000016'),
      'test', 'pi_test_v10_115_immediate', 'ch_test_v10_115_immediate',
      '2099-09-24 13:02:00+00', 'evt_test_v10_115_immediate',
      '2099-09-24 13:02:00+00'
    )
  $$,
  'replaying the immediate paid event is idempotent'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key in (
     'session_payment_approved',
     'booking_confirmed_patient',
     'booking_confirmed_therapist',
     'booking_reserved_patient',
     'booking_reserved_therapist'
   )
     and related_entity_id in (
       'b1150000-0000-4000-8000-000000000016',
       (select id from public.session_payments
        where booking_id = 'b1150000-0000-4000-8000-000000000016')
     )),
  3,
  'the immediate paid replay cannot duplicate any participant communication'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'bbbbbbbb-0000-4000-8000-000000000010',
    'role', 'authenticated'
  )::text,
  true
);
select is(
  public.get_patient_reservation_attempt_status_v1(
    'b1150000-0000-4000-8000-000000000011',
    'cs_test_v10_115_1'
  ) ->> 'status',
  'scheduled',
  'the authenticated patient sees the future reservation without a false paid state'
);
reset role;

select ok(
  has_function_privilege(
    'service_role',
    'public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  'only the trusted worker and signed webhook can record the T-24 intent'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  'the patient cannot mark their own T-24 charge as paid'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 12:59:00+00',
    'b1150000-0000-4000-8000-000000000091', 10, 5
  )) -> 'claims'),
  0,
  'T-24 claim refuses a charge before the due instant'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 13:01:00+00',
    'b1150000-0000-4000-8000-000000000091', 10, 5
  )) -> 'claims'),
  1,
  'the confirmed booking is claimable one minute after T-24 despite the confirmation version increment'
);
select is(
  (select status from public.session_payment_schedules
   where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  'claimed',
  'the first worker owns the charge schedule lease'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 13:01:00+00',
    'b1150000-0000-4000-8000-000000000092', 10, 5
  )) -> 'claims'),
  0,
  'a concurrent worker cannot claim the same charge'
);
select throws_ok(
  $$select public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'b1150000-0000-4000-8000-000000000011',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'test', 'pi_test_v10_115', 'succeeded', 15300, 'brl',
    'cus_test_v10_115_1', 'pm_wrong', 'ch_test_v10_115',
    'evt_test_v10_115_charge', now()
  )$$,
  '23514', 'SESSION_PAYMENT_INTENT_V10_BINDING_MISMATCH',
  'a PaymentIntent using another card cannot pay the booking'
);
select is(
  public.fail_session_payment_schedule_attempt_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'b1150000-0000-4000-8000-000000000091',
    'stripe_state_unknown', '2099-09-19 13:01:00+00'
  ) ->> 'status',
  'retry_scheduled',
  'an ambiguous Stripe result schedules a controlled retry'
);
select is(
  (select next_retry_at from public.session_payment_schedules
   where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  '2099-09-19 13:16:00+00'::timestamptz,
  'the first retry waits 15 minutes'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 13:15:59+00',
    'b1150000-0000-4000-8000-000000000092', 10, 5
  )) -> 'claims'),
  0,
  'a worker cannot bypass the retry backoff'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 13:16:00+00',
    'b1150000-0000-4000-8000-000000000092', 10, 5
  )) -> 'claims'),
  1,
  'the same schedule becomes claimable after backoff without a new charge key'
);
select is(
  public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'b1150000-0000-4000-8000-000000000011',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'test', 'pi_test_v10_115', 'succeeded', 15300, 'brl',
    'cus_test_v10_115_1', 'pm_test_v10_115_1', 'ch_test_v10_115',
    'evt_test_v10_115_charge', now()
  ) ->> 'scheduleStatus',
  'paid',
  'the exact authorized card and amount mark the schedule paid atomically'
);
select is(
  (select financial_status::text from public.session_payments
   where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  'paid',
  'the T-24 charge is reflected in the canonical payment'
);
select is(
  (select count(*)::integer from public.session_transfer_jobs
   where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'one paid charge creates exactly one therapist Transfer obligation'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'session_payment_approved'
     and related_entity_id = (
       select id from public.session_payments
       where booking_id = 'b1150000-0000-4000-8000-000000000011'
     )),
  1,
  'worker-confirmed payment queues one approval email for the patient'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'booking_confirmed_patient'
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'payment approval queues the final encounter confirmation for the patient'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'booking_confirmed_therapist'
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'payment approval queues the final session confirmation for the therapist'
);
select is(
  public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'b1150000-0000-4000-8000-000000000011',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'test', 'pi_test_v10_115', 'succeeded', 15300, 'brl',
    'cus_test_v10_115_1', 'pm_test_v10_115_1', 'ch_test_v10_115',
    'evt_test_v10_115_charge', now()
  ) ->> 'scheduleStatus',
  'paid',
  'replaying the same charge event is idempotent'
);
select is(
  (select count(*)::integer from public.session_transfer_jobs
   where booking_id = 'b1150000-0000-4000-8000-000000000011'),
  1,
  'replayed charge cannot duplicate the Transfer obligation'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'session_payment_approved'
     and related_entity_id = (
       select id from public.session_payments
       where booking_id = 'b1150000-0000-4000-8000-000000000011'
     )),
  1,
  'replayed charge cannot duplicate the payment approval email'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key in ('booking_confirmed_patient', 'booking_confirmed_therapist')
     and related_entity_id = 'b1150000-0000-4000-8000-000000000011'),
  2,
  'replayed charge cannot duplicate either final encounter confirmation'
);
select throws_ok(
  $$select public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'b1150000-0000-4000-8000-000000000011',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000011'),
    'test', 'pi_test_other', 'succeeded', 15300, 'brl',
    'cus_test_v10_115_1', 'pm_test_v10_115_1', 'ch_test_other',
    'evt_test_other', now()
  )$$,
  '23514', 'SESSION_PAYMENT_INTENT_V10_BINDING_MISMATCH',
  'a second PaymentIntent cannot replace the original paid charge'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-19 13:02:00+00',
    'b1150000-0000-4000-8000-000000000092', 10, 5
  )) -> 'claims'),
  0,
  'a paid schedule never re-enters the charge queue'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_patient_session_charge_status_v10(uuid)',
    'EXECUTE'
  ),
  'an authenticated patient can read only the recovery projection guarded by auth.uid'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_session_charge_recovery_v10(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'the browser cannot authorize a recovery without trusted Stripe validation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.close_unpaid_session_payment_v10(uuid,uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'the browser cannot close a booking through the payment workflow'
);
select lives_ok(
  $$select public.prepare_session_payment_v10(
    'b1150000-0000-4000-8000-000000000014',
    (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
  )$$,
  'a recovery fixture starts with its own immutable V10 payment'
);
select is(
  public.swap_session_payment_checkout_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000014'),
    'test', null, 'cs_test_v10_115_recovery',
    17000, 0, 17000, 'scheduled',
    null, null, null, null, null, 'tes:v10:promo:115:recovery'
  ) ->> 'totalAmountCents',
  '17000',
  'the recovery fixture preserves its exact amount before card setup'
);
select lives_ok(
  $$insert into public.session_payment_attempts(
    session_payment_id, attempt_kind, idempotency_key, status,
    stripe_checkout_session_id
  ) values (
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'initial_hold', 'tes:v10:attempt:115:recovery', 'checkout_created',
    'cs_test_v10_115_recovery'
  )$$,
  'the recovery fixture records the signed checkout attempt'
);
select is(
  public.complete_session_payment_setup_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000014'),
    'test', 'cs_test_v10_115_recovery', 'cus_test_v10_115_1',
    'seti_test_v10_115_recovery', 'pm_test_v10_115_recovery',
    'tes-session-off-session-consent-v1',
    'evt_test_v10_115_recovery_setup', '2099-09-01 10:00:00+00'
  ) ->> 'status',
  'scheduled',
  'a bound SetupIntent creates the recovery fixture schedule'
);
select is(
  jsonb_array_length((public.claim_due_session_payment_schedules_v10(
    '2099-09-22 13:01:00+00',
    'b1150000-0000-4000-8000-000000000093', 10, 5
  )) -> 'claims'),
  1,
  'the recovery fixture is claimed only at its T-24 due time'
);
select is(
  public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'b1150000-0000-4000-8000-000000000014',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'test', 'pi_test_v10_115_recovery', 'requires_action', 17000, 'brl',
    'cus_test_v10_115_1', 'pm_test_v10_115_recovery', null, null, null
  ) ->> 'scheduleStatus',
  'requires_customer_action',
  'an off-session authentication request pauses automatic retries'
);
select is(
  (select count(*)::integer from public.notifications
   where event_key = 'session-charge-recovery:' || (
     select id::text from public.session_payment_schedules
     where booking_id = 'b1150000-0000-4000-8000-000000000014'
   )),
  1,
  'customer action creates one clear in-app notification'
);
select is(
  (select count(*)::integer from public.email_outbox
   where action_key = 'session_payment_declined'
     and domain_event_id = (
       select id from public.session_payment_schedules
       where booking_id = 'b1150000-0000-4000-8000-000000000014'
     )),
  1,
  'customer action queues one idempotent recovery email'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'bbbbbbbb-0000-4000-8000-000000000010',
    'role', 'authenticated'
  )::text,
  true
);
select is(
  public.get_patient_session_charge_status_v10(
    'b1150000-0000-4000-8000-000000000014'
  ) ->> 'recoveryAvailable',
  'true',
  'the owning patient sees an actionable recovery before the session'
);
reset role;

select is(
  public.begin_session_charge_recovery_v10(
    'b1150000-0000-4000-8000-000000000014',
    'b1000000-0000-4000-8000-000000000010',
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'pi_test_v10_115_recovery'
  ) ->> 'allowed',
  'true',
  'trusted Stripe validation opens recovery for the same PaymentIntent'
);
select is(
  public.record_session_payment_intent_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'b1150000-0000-4000-8000-000000000014',
    (select booking_version from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'test', 'pi_test_v10_115_recovery', 'requires_payment_method', 17000, 'brl',
    'cus_test_v10_115_1', 'pm_test_v10_115_replacement', null, null, null
  ) ->> 'scheduleStatus',
  'requires_customer_action',
  'recovery may replace the card only on the already bound PaymentIntent'
);
select is(
  public.close_unpaid_session_payment_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'b1150000-0000-4000-8000-000000000014',
    'requires_payment_method', '2099-09-23 13:00:00+00'
  ) ->> 'applied',
  'true',
  'an incomplete payment closes atomically when the session starts'
);
select is(
  (select status::text from public.bookings where id = 'b1150000-0000-4000-8000-000000000014'),
  'cancelled_by_payment',
  'the unpaid confirmed booking releases its occupied interval'
);
select is(
  (select status from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
  'canceled',
  'the closed booking cannot re-enter the T-24 queue'
);
select is(
  (select financial_status::text from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000014'),
  'failed',
  'the canonical payment records that confirmation was not completed'
);
select is(
  (select count(*)::integer from public.session_transfer_jobs where booking_id = 'b1150000-0000-4000-8000-000000000014'),
  0,
  'an incomplete payment never creates a therapist Transfer obligation'
);
select is(
  (select count(*)::integer from public.notifications where event_key like 'session-payment-closure:%' and href like '%b1150000-0000-4000-8000-000000000014'),
  2,
  'patient and therapist receive one clear operational notification each'
);
select is(
  public.close_unpaid_session_payment_v10(
    (select id from public.session_payment_schedules where booking_id = 'b1150000-0000-4000-8000-000000000014'),
    'b1150000-0000-4000-8000-000000000014',
    'requires_payment_method', '2099-09-23 13:01:00+00'
  ) ->> 'applied',
  'false',
  'replaying the closure is an idempotent no-op'
);
select is(
  (select count(*)::integer from public.notifications where event_key like 'session-payment-closure:%' and href like '%b1150000-0000-4000-8000-000000000014'),
  2,
  'closure replay cannot duplicate notifications'
);
select is(
  (select status from public.session_charge_recoveries_v10 where booking_id = 'b1150000-0000-4000-8000-000000000014'),
  'canceled',
  'a closed session also closes its pending payment recovery'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'bbbbbbbb-0000-4000-8000-000000000010',
    'role', 'authenticated'
  )::text,
  true
);
select is(
  public.get_patient_session_charge_status_v10(
    'b1150000-0000-4000-8000-000000000014'
  ) ->> 'recoveryAvailable',
  'false',
  'a canceled booking never exposes payment recovery again'
);
reset role;

select is(
  public.begin_session_payment_retry_v10(
    'b1150000-0000-4000-8000-000000000014'
  ) ->> 'allowed',
  'true',
  'a V10 payment retry atomically reopens an expired checkout booking'
);
select is(
  (select status::text from public.bookings
   where id = 'b1150000-0000-4000-8000-000000000014'),
  'pending_payment',
  'the retry restores the booking payment state without confirming the session'
);
select is(
  (select financial_status::text from public.session_payments
   where booking_id = 'b1150000-0000-4000-8000-000000000014'),
  'pending',
  'the retry restores only the canonical pending financial state'
);
select is(
  public.prepare_session_payment_v10(
    'b1150000-0000-4000-8000-000000000014',
    (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
  ) ->> 'paymentFlowVersion',
  'v10',
  'the reopened booking can create a replacement V10 Checkout session'
);

select lives_ok(
  $$
    select public.prepare_session_payment_v10(
      'b1150000-0000-4000-8000-000000000015',
      (select id from public.stripe_customers where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010' and role = 'patient' and environment = 'test')
    )
  $$,
  'an initial V10 attempt can be prepared for the expiry-retry regression'
);
select is(
  public.swap_session_payment_checkout_v10(
    (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000015'),
    (select version from public.bookings where id = 'b1150000-0000-4000-8000-000000000015'),
    'test', null, 'cs_test_v10_115_expired',
    17000, 0, 17000, 'scheduled',
    null, null, null, null, null, 'tes:v10:expired:115'
  ) ->> 'applied',
  'true',
  'the original Checkout remains the current V10 attempt before expiry'
);
select lives_ok(
  $$
    insert into public.session_payment_attempts (
      session_payment_id, attempt_kind, idempotency_key, status,
      stripe_checkout_session_id, reservation_expires_at
    ) values (
      (select id from public.session_payments where booking_id = 'b1150000-0000-4000-8000-000000000015'),
      'initial_hold', 'tes:v10:attempt:115:expired', 'checkout_created',
      'cs_test_v10_115_expired', now() - interval '1 second'
    )
  $$,
  'the expired initial attempt remains auditable before release'
);
select is(
  public.cancel_reservation_checkout_attempt_v1(
    'b1150000-0000-4000-8000-000000000015',
    'cs_test_v10_115_expired',
    'reservation_expired'
  ) ->> 'released',
  'true',
  'the expired initial attempt is authoritatively released'
);
select is(
  (select status::text from public.bookings
   where id = 'b1150000-0000-4000-8000-000000000015'),
  'cancelled_by_payment',
  'releasing the expired attempt also releases its occupied interval'
);
select is(
  public.begin_session_payment_retry_v10(
    'b1150000-0000-4000-8000-000000000015'
  ) ->> 'allowed',
  'true',
  'the same V10 booking can start a replacement payment attempt'
);
select is(
  public.begin_session_payment_retry_v10(
    'b1150000-0000-4000-8000-000000000015'
  ) ->> 'reason',
  'retry_already_started',
  'a failure before persisting the replacement remains safely retryable'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'bbbbbbbb-0000-4000-8000-000000000010',
    'role', 'authenticated'
  )::text,
  true
);
select is(
  public.get_patient_reservation_retry_context_v1(
    'b1150000-0000-4000-8000-000000000015'
  ) ->> 'canRetry',
  'true',
  'the patient can resume after a failure before the replacement is persisted'
);
reset role;
select is(
  (select status::text from public.bookings
   where id = 'b1150000-0000-4000-8000-000000000015'),
  'pending_payment',
  'the replacement attempt restores the booking without a new initial hold'
);
select is(
  (select financial_status::text from public.session_payments
   where booking_id = 'b1150000-0000-4000-8000-000000000015'),
  'pending',
  'the replacement attempt restores only the pending financial state'
);

select * from finish();
rollback;
