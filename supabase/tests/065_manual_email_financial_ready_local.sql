begin;

select plan(22);

delete from public.email_outbox
where action_key in (
  'session_payment_approved',
  'session_payment_declined',
  'session_payment_pending',
  'session_refund_approved',
  'therapist_payout_completed'
);

select has_trigger(
  'public',
  'session_payments',
  'enqueue_session_payment_email',
  'persisted session payment transitions enqueue financial e-mail work'
);
select has_trigger(
  'public',
  'session_refunds',
  'enqueue_session_refund_email',
  'persisted successful refund events enqueue financial e-mail work'
);
select has_trigger(
  'public',
  'stripe_payouts',
  'enqueue_stripe_payout_emails',
  'authoritative Stripe Payout transitions enqueue therapist payout e-mail work'
);
select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key in (
      'session_payment_approved',
      'session_payment_declined',
      'session_payment_pending',
      'session_refund_approved',
      'therapist_payout_completed'
    )
  ),
  5,
  'all ready financial action definitions are provisioned'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.enqueue_transactional_email_v1(text,uuid,text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot enqueue financial e-mails directly'
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
)
values
  ('f9200000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2046-03-01T13:00:00Z', '2046-03-01T13:50:00Z', 'America/Sao_Paulo', 'pending_payment', 'pending'),
  ('f9200000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2046-03-02T13:00:00Z', '2046-03-02T13:50:00Z', 'America/Sao_Paulo', 'pending_payment', 'pending'),
  ('f9200000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2046-03-03T13:00:00Z', '2046-03-03T13:50:00Z', 'America/Sao_Paulo', 'pending_payment', 'pending'),
  ('f9200000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2046-03-04T13:00:00Z', '2046-03-04T13:50:00Z', 'America/Sao_Paulo', 'pending_payment', 'pending'),
  ('f9200000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2046-03-05T13:00:00Z', '2046-03-05T13:50:00Z', 'America/Sao_Paulo', 'pending_payment', 'pending');

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents
)
select
  payment.id,
  payment.booking_id,
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  17000,
  2000,
  3400,
  13600
from (
  values
    ('f9300000-0000-4000-8000-000000000001'::uuid, 'f9200000-0000-4000-8000-000000000001'::uuid),
    ('f9300000-0000-4000-8000-000000000002'::uuid, 'f9200000-0000-4000-8000-000000000002'::uuid),
    ('f9300000-0000-4000-8000-000000000003'::uuid, 'f9200000-0000-4000-8000-000000000003'::uuid),
    ('f9300000-0000-4000-8000-000000000004'::uuid, 'f9200000-0000-4000-8000-000000000004'::uuid),
    ('f9300000-0000-4000-8000-000000000005'::uuid, 'f9200000-0000-4000-8000-000000000005'::uuid)
) as payment(id, booking_id)
cross join lateral (
  select id
  from public.financial_policy_versions
  where is_active
  limit 1
) policy;

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_payment_pending',
  'payment_intent.processing',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-payment-pending',
  '2046-02-01T10:00:00Z',
  'pi_manual_email_pending'
);
select is(
  (public.apply_session_payment_state_v1(
    'f9300000-0000-4000-8000-000000000001',
    'processing',
    'evt_manual_email_payment_pending',
    '2046-02-01T10:00:00Z'
  )->>'applied')::boolean,
  true,
  'a reserved processing webhook persists the pending payment state'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_payment_pending'
      and related_entity_id = 'f9300000-0000-4000-8000-000000000001'
  ),
  1,
  'a persisted processing payment queues one pending payment delivery'
);
select is(
  public.enqueue_transactional_email_v1(
    'session_payment_pending',
    (
      select domain_event_id
      from public.email_outbox
      where action_key = 'session_payment_pending'
        and related_entity_id = 'f9300000-0000-4000-8000-000000000001'
    ),
    'session_payment',
    'f9300000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000005',
    'profile:bbbbbbbb-0000-4000-8000-000000000005',
    '{}'::jsonb
  ),
  (
    select id
    from public.email_outbox
    where action_key = 'session_payment_pending'
      and related_entity_id = 'f9300000-0000-4000-8000-000000000001'
  ),
  'a replay of one logical payment event resolves to the original delivery'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_payment_declined',
  'payment_intent.payment_failed',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-payment-declined',
  '2046-02-01T10:01:00Z',
  'pi_manual_email_declined'
);
select public.apply_session_payment_state_v1(
  'f9300000-0000-4000-8000-000000000002',
  'failed',
  'evt_manual_email_payment_declined',
  '2046-02-01T10:01:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_payment_declined'
      and related_entity_id = 'f9300000-0000-4000-8000-000000000002'
  ),
  1,
  'a persisted failed payment queues one declined payment delivery'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_payment_approved',
  'payment_intent.succeeded',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-payment-approved',
  '2046-02-01T10:02:00Z',
  'pi_manual_email_approved'
);
select public.apply_session_payment_state_v1(
  'f9300000-0000-4000-8000-000000000003',
  'paid',
  'evt_manual_email_payment_approved',
  '2046-02-01T10:02:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_payment_approved'
      and related_entity_id = 'f9300000-0000-4000-8000-000000000003'
  ),
  1,
  'a persisted paid payment queues one approved payment delivery'
);
select is(
  (
    select payload
    from public.email_outbox
    where action_key = 'session_payment_approved'
      and related_entity_id = 'f9300000-0000-4000-8000-000000000003'
  ),
  '{}'::jsonb,
  'payment e-mail outbox payload does not persist financial or Stripe data'
);

insert into public.email_action_settings (action_key, enabled, automatic_dispatch_enabled)
values ('session_payment_pending', false, true);
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_payment_disabled',
  'payment_intent.processing',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-payment-disabled',
  '2046-02-01T10:03:00Z',
  'pi_manual_email_disabled'
);
select public.apply_session_payment_state_v1(
  'f9300000-0000-4000-8000-000000000004',
  'processing',
  'evt_manual_email_payment_disabled',
  '2046-02-01T10:03:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'f9300000-0000-4000-8000-000000000004'
  ),
  0,
  'a disabled financial action does not queue an automatic delivery'
);

update public.email_action_settings
set enabled = true,
    automatic_dispatch_enabled = false
where action_key = 'session_payment_pending';
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_payment_automatic_disabled',
  'payment_intent.processing',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-payment-automatic-disabled',
  '2046-02-01T10:04:00Z',
  'pi_manual_email-automatic-disabled'
);
select public.apply_session_payment_state_v1(
  'f9300000-0000-4000-8000-000000000005',
  'processing',
  'evt_manual_email_payment_automatic_disabled',
  '2046-02-01T10:04:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'f9300000-0000-4000-8000-000000000005'
  ),
  0,
  'automatic dispatch disabled does not queue a later financial delivery'
);

insert into public.session_refunds (
  id,
  session_payment_id,
  stripe_refund_id,
  amount_cents,
  status
)
values (
  'f9400000-0000-4000-8000-000000000001',
  'f9300000-0000-4000-8000-000000000003',
  're_manual_email_approved',
  17000,
  'succeeded'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_refund_approved'
      and related_entity_id = 'f9400000-0000-4000-8000-000000000001'
  ),
  0,
  'a refund state without a persisted refund webhook is not communicated'
);
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_refund_approved',
  'refund.updated',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-refund-approved',
  '2046-02-01T10:05:00Z',
  're_manual_email_approved'
);
update public.session_refunds
set status = status
where id = 'f9400000-0000-4000-8000-000000000001';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_refund_approved'
      and related_entity_id = 'f9400000-0000-4000-8000-000000000001'
  ),
  1,
  'a successful refund with its persisted Stripe webhook queues one delivery'
);
update public.session_refunds
set status = status
where id = 'f9400000-0000-4000-8000-000000000001';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'session_refund_approved'
      and related_entity_id = 'f9400000-0000-4000-8000-000000000001'
  ),
  1,
  'a replayed successful refund does not duplicate its delivery'
);
select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key = 'session_refund_rejected'
  ),
  0,
  'a technical Stripe refund failure is not misrepresented as a policy rejection'
);

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  operational_status
)
values (
  'f9500000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'acct_manual_email_payout',
  'ready',
  true,
  true,
  'active',
  'ready'
)
on conflict (therapist_profile_id) where is_current do nothing;

insert into public.payout_batches (
  id,
  reference_period_start,
  reference_period_end,
  cutoff_at,
  status
)
values (
  'f9600000-0000-4000-8000-000000000001',
  '2046-01-01',
  '2046-01-07',
  '2046-02-01T10:06:00Z',
  'processing'
);
insert into public.payout_batch_therapists (
  id,
  payout_batch_id,
  therapist_profile_id,
  connect_account_id,
  total_amount_cents
)
select
  'f9700000-0000-4000-8000-000000000001',
  'f9600000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  id,
  13600
from public.therapist_connect_accounts
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
insert into public.payout_batch_items (
  id,
  payout_batch_id,
  payout_batch_therapist_id,
  session_payment_id,
  booking_id,
  therapist_profile_id,
  amount_cents
)
values (
  'f9800000-0000-4000-8000-000000000001',
  'f9600000-0000-4000-8000-000000000001',
  'f9700000-0000-4000-8000-000000000001',
  'f9300000-0000-4000-8000-000000000003',
  'f9200000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  13600
);
insert into public.stripe_transfers (
  id,
  payout_batch_item_id,
  session_payment_id,
  therapist_profile_id,
  connect_account_id,
  stripe_transfer_id,
  idempotency_key,
  amount_cents,
  status,
  transferred_at
)
select
  'f9900000-0000-4000-8000-000000000001',
  'f9800000-0000-4000-8000-000000000001',
  'f9300000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  id,
  'tr_manual_email_payout',
  'tes:test:manual-email:payout',
  13600,
  'transferred',
  '2046-02-01T10:06:00Z'
from public.therapist_connect_accounts
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_type = 'stripe_transfer'
  ),
  0,
  'an accepted Transfer does not prematurely queue a bank payout delivery'
);

insert into public.stripe_payouts (
  id,
  payout_batch_therapist_id,
  payout_batch_id,
  therapist_profile_id,
  connect_account_id,
  stripe_payout_id,
  idempotency_key,
  request_fingerprint,
  amount_cents,
  status,
  provider_status,
  paid_at
) select
  'f9a00000-0000-4000-8000-000000000001',
  'f9700000-0000-4000-8000-000000000001',
  'f9600000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  id,
  'po_manual_email_payout',
  'tes:test:payout:f9700000-0000-4000-8000-000000000001:v1',
  'manual-email-payout-fingerprint',
  13600,
  'paid',
  'paid',
  '2046-02-01T10:07:00Z'
from public.therapist_connect_accounts
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_id = 'f9a00000-0000-4000-8000-000000000001'
  ),
  1,
  'an authoritative paid Payout queues one therapist delivery'
);

update public.stripe_payouts
set status = 'paid'
where id = 'f9a00000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_id = 'f9a00000-0000-4000-8000-000000000001'
  ),
  1,
  'a replayed paid Payout does not duplicate its delivery'
);
select is(
  (
    select payload
    from public.email_outbox
    where action_key = 'therapist_payout_completed'
      and related_entity_id = 'f9a00000-0000-4000-8000-000000000001'
  ),
  '{}'::jsonb,
  'payout delivery payload does not persist financial account data'
);
select ok(
  (
    select count(*) = count(distinct (action_key, domain_event_id, recipient_key))
    from public.email_outbox
    where related_entity_type in ('session_payment', 'session_refund', 'stripe_transfer', 'stripe_payout')
  ),
  'financial deliveries preserve the action, logical-event, recipient dedupe contract'
);

select * from finish();
rollback;
