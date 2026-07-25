begin;

select plan(20);

select is(
  (
    select count(*)::integer
    from public.payments p
    where not exists (
      select 1
      from public.session_payments sp
      where sp.booking_id = p.booking_id
    )
  ),
  0,
  'every legacy payment is represented by a canonical session payment'
);

select is(
  has_table_privilege('service_role', 'public.payments', 'INSERT'),
  false,
  'service role cannot write the legacy payments projection directly'
);

select is(
  (
    select acquired
    from public.reserve_stripe_webhook_event_v1(
      'evt_f0_reservation',
      'payment_intent.processing',
      null,
      false,
      '2026-06-24.dahlia',
      'platform',
      'hash-f0',
      '2026-07-25T10:00:00Z',
      'pi_f0'
    )
  ),
  true,
  'first webhook delivery acquires the event'
);

select is(
  (
    select acquired
    from public.reserve_stripe_webhook_event_v1(
      'evt_f0_reservation',
      'payment_intent.processing',
      null,
      false,
      '2026-06-24.dahlia',
      'platform',
      'hash-f0',
      '2026-07-25T10:00:00Z',
      'pi_f0'
    )
  ),
  false,
  'concurrent duplicate does not acquire an active lease'
);

update public.stripe_webhook_events
set processing_status = 'failed'
where stripe_event_id = 'evt_f0_reservation';

select is(
  (
    select acquired
    from public.reserve_stripe_webhook_event_v1(
      'evt_f0_reservation',
      'payment_intent.processing',
      null,
      false,
      '2026-06-24.dahlia',
      'platform',
      'hash-f0',
      '2026-07-25T10:00:00Z',
      'pi_f0'
    )
  ),
  true,
  'failed webhook delivery can be retried'
);

select is(
  (
    select attempts
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_f0_reservation'
  ),
  2,
  'webhook retry increments attempts'
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
) values (
  'a4100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  now() + interval '2 days',
  now() + interval '2 days 50 minutes',
  'America/Sao_Paulo',
  'draft',
  'not_started'
);

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
  'a4000000-0000-4000-8000-000000000001',
  'a4100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id,
  17000,
  2000,
  3400,
  13600
from public.financial_policy_versions
where is_active
limit 1;

select is(
  (
    public.apply_session_payment_state_v1(
      'a4000000-0000-4000-8000-000000000001',
      'processing',
      'evt_f0_processing',
      '2026-07-25T10:01:00Z',
      'pi_f0_session',
      null,
      'cs_f0_session'
    )->>'applied'
  )::boolean,
  true,
  'processing event is applied'
);

select is(
  (
    public.apply_session_payment_state_v1(
      'a4000000-0000-4000-8000-000000000001',
      'paid',
      'evt_f0_paid',
      '2026-07-25T10:02:00Z',
      'pi_f0_session',
      'ch_f0_session',
      'cs_f0_session'
    )->>'applied'
  )::boolean,
  true,
  'paid event is applied'
);

select is(
  (
    public.apply_session_payment_state_v1(
      'a4000000-0000-4000-8000-000000000001',
      'failed',
      'evt_f0_stale_failure',
      '2026-07-25T09:59:00Z',
      'pi_f0_session',
      null,
      'cs_f0_session'
    )->>'reason'
  ),
  'stale_event',
  'older failure is ignored'
);

select is(
  (
    public.apply_session_payment_state_v1(
      'a4000000-0000-4000-8000-000000000001',
      'failed',
      'evt_f0_late_failure',
      '2026-07-25T10:03:00Z',
      'pi_f0_session',
      null,
      'cs_f0_session'
    )->>'reason'
  ),
  'transition_blocked',
  'later failure cannot regress a paid payment'
);

select is(
  (
    select financial_status::text
    from public.session_payments
    where id = 'a4000000-0000-4000-8000-000000000001'
  ),
  'paid',
  'session payment remains paid'
);

select is(
  (
    select stripe_charge_id
    from public.session_payments
    where id = 'a4000000-0000-4000-8000-000000000001'
  ),
  'ch_f0_session',
  'source charge is persisted for later transfer'
);

select is(
  (
    select count(*)::integer
    from public.financial_ledger_entries
    where session_payment_id = 'a4000000-0000-4000-8000-000000000001'
  ),
  3,
  'paid session creates exactly three canonical ledger entries'
);

select is(
  (
    select provider
    from public.booking_payment_receipts
    where booking_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  'stripe',
  'paid canonical payment derives the booking receipt projection'
);

select is(
  (
    public.apply_therapist_subscription_event_v1(
      'c1000000-0000-4000-8000-000000000002',
      'sub_f0_rafael',
      'premium',
      'active',
      'evt_f0_subscription_active',
      '2026-07-25T11:00:00Z'
    )->>'applied'
  )::boolean,
  true,
  'active subscription event is applied'
);

select is(
  (
    public.apply_therapist_subscription_event_v1(
      'c1000000-0000-4000-8000-000000000002',
      'sub_f0_rafael',
      'premium',
      'canceled',
      'evt_f0_subscription_stale',
      '2026-07-25T10:59:00Z'
    )->>'applied'
  )::boolean,
  false,
  'older subscription event is ignored'
);

select is(
  (
    select plan::text
    from public.therapist_profiles
    where id = 'c1000000-0000-4000-8000-000000000002'
  ),
  'premium',
  'stale cancellation does not downgrade the therapist'
);

select is(
  (
    public.apply_therapist_subscription_event_v1(
      'c1000000-0000-4000-8000-000000000002',
      'sub_f0_rafael',
      'premium',
      'canceled',
      'evt_f0_subscription_canceled',
      '2026-07-25T11:01:00Z'
    )->>'plan'
  ),
  'free',
  'new cancellation event returns the effective free plan'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  (
    select count(*) > 0
    from public.session_payments
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'Ana can read her canonical session payments'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.session_payments
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  0,
  'Rafael cannot read Ana canonical session payments'
);

select * from finish();

rollback;
