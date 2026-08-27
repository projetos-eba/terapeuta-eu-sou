begin;

select plan(51);

select is(
  (select patient_auto_confirmation_days from public.financial_policy_versions where is_active),
  7,
  'active policy snapshots the patient seven-day deadline'
);
select is(
  (select therapist_auto_confirmation_days from public.financial_policy_versions where is_active),
  30,
  'active policy snapshots the therapist thirty-day deadline'
);
select is(
  (select transfer_safety_period_days from public.financial_policy_versions where is_active),
  1,
  'active policy keeps twenty-four complete hours of safety'
);
select is(
  (select count(*)::integer from pg_trigger where tgrelid = 'public.reviews'::regclass and tgname = 'confirm_session_from_review_trigger'),
  0,
  'public reviews have no financial confirmation trigger'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'tes-session-confirmation-hourly-v1'),
  1,
  'hourly bilateral confirmation job is registered once'
);
select is(
  (select active from cron.job where jobname = 'tes-session-confirmation-hourly-v1'),
  false,
  'hourly job remains inactive until financial homologation'
);

create temporary table review_revision_baseline as
select count(*)::integer as total
from public.review_revisions revision
join public.reviews review on review.id = revision.review_id
where review.patient_profile_id = '91000000-0000-4000-8000-000000000001'
  and review.therapist_profile_id = '92000000-0000-4000-8000-000000000011';
grant select on review_revision_baseline to service_role;

insert into public.therapist_connect_accounts (
  id, therapist_profile_id, stripe_account_id, onboarding_status,
  details_submitted, charges_enabled, payouts_enabled,
  stripe_transfers_status, operational_status
) values (
  'b8900000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  'acct_bilateral_contract_test', 'ready', true, true, true, 'active', 'ready'
)
on conflict (therapist_profile_id) do update
set stripe_transfers_status = 'active', operational_status = 'ready',
    charges_enabled = true, payouts_enabled = true, details_submitted = true;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
select
  ('b8000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  case when series in (2, 5, 6, 7, 8)
    then now() - interval '32 days' + make_interval(hours => series * 2)
    else now() - make_interval(days => series + 1, hours => 1)
  end,
  case when series in (2, 5, 6, 7, 8)
    then now() - interval '32 days' + make_interval(hours => series * 2 + 1)
    else now() - make_interval(days => series + 1)
  end,
  'America/Sao_Paulo', 'confirmed', 'paid'
from generate_series(1, 9) series;

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, currency,
  financial_status, stripe_charge_id, stripe_balance_transaction_id
)
select
  ('b8100000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  ('b8000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  (select id from public.financial_policy_versions where is_active),
  17000, 2000, 3400, 13600, 'BRL', 'paid',
  'ch_bilateral_' || series, 'txn_bilateral_' || series
from generate_series(1, 9) series;

update public.session_payments
set admin_blocked_at = now(), transfer_blocked_reason = 'test_hold'
where booking_id = 'b8000000-0000-4000-8000-000000000004';
update public.bookings
set status = 'cancelled_by_patient'
where id = 'b8000000-0000-4000-8000-000000000005';
update public.session_payments
set refund_pending = true
where booking_id = 'b8000000-0000-4000-8000-000000000006';
update public.session_payments
set disputed_at = now()
where booking_id = 'b8000000-0000-4000-8000-000000000007';
update public.session_payments
set admin_blocked_at = now(), transfer_blocked_reason = 'manual_admin_hold'
where booking_id = 'b8000000-0000-4000-8000-000000000008';

set local role service_role;

select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'completed', 'b8200000-0000-4000-8000-000000000001', 'manual', now() - interval '1 minute'
  )->'confirmation'->>'outcome',
  'completed',
  'patient can confirm manually first'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  null,
  'one participant confirmation is not a financial confirmation'
);
select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000011',
    'b8000000-0000-4000-8000-000000000001',
    'completed', 'b8200000-0000-4000-8000-000000000002', 'manual', now()
  )->'confirmation'->>'outcome',
  'completed',
  'therapist can confirm manually second'
);
select is(
  public.finalize_bilateral_session_confirmation_v1('b8000000-0000-4000-8000-000000000001'),
  'confirmed',
  'two performed responses finalize the bilateral service'
);
select is(
  (select service_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  'confirmed_bilateral',
  'bilateral status is explicit and canonical'
);
select is(
  (select eligible_at - service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  interval '1 day',
  'eligible_at is exactly twenty-four hours after the second confirmation'
);
select is(
  (select transfer_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  'waiting_safety_period',
  'payment is not eligible before the safety period completes'
);
select is(
  public.refresh_session_transfer_eligibility(
    'b8100000-0000-4000-8000-000000000001',
    (select eligible_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001')
  )::text,
  'eligible',
  'payment becomes eligible exactly at the twenty-four-hour boundary'
);

select public.create_weekly_payout_batch(
  date '2098-01-01', date '2098-01-07',
  (select eligible_at - interval '1 second' from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  null
);
select is(
  (select count(*)::integer from public.payout_batch_items item where item.booking_id = 'b8000000-0000-4000-8000-000000000001'),
  0,
  'batch cutoff before eligible_at cannot reserve the payment'
);
select public.create_weekly_payout_batch(
  date '2098-01-08', date '2098-01-14',
  (select eligible_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  null
);
select is(
  (select count(*)::integer from public.payout_batch_items item where item.booking_id = 'b8000000-0000-4000-8000-000000000001'),
  1,
  'next batch at or after eligible_at reserves the payment once'
);

select ok(
  public.auto_confirm_sessions((select ends_at + interval '7 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002')) >= 1,
  'day seven creates only the missing patient confirmation'
);
select is(
  (select confirmed_at from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002' and participant_role = 'patient'),
  (select due_at from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002' and participant_role = 'patient'),
  'automatic patient confirmed_at records the contractual due_at'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002' and participant_role = 'therapist'),
  0,
  'therapist remains unanswered before day thirty'
);
select ok(
  public.auto_confirm_sessions((select ends_at + interval '30 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002')) >= 1,
  'day thirty creates only the missing therapist confirmation'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  (select due_at from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002' and participant_role = 'therapist'),
  'final financial confirmation uses the second contractual deadline'
);
select is(
  (select count(*)::integer from public.video_session_participations where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  0,
  'fixture has no Zoom presence telemetry'
);
select is(
  (select service_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  'confirmed_bilateral',
  'absence of Zoom telemetry does not block automatic confirmation'
);
select public.auto_confirm_sessions((select ends_at + interval '31 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002'));
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  2,
  'repeating a late scheduler run does not duplicate confirmations'
);

select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000003',
    'not_performed', null, 'therapist_absent', 'O terapeuta não entrou.',
    'b8200000-0000-4000-8000-000000000003'
  )->'feedback'->>'outcome',
  'not_performed',
  'negative feedback remains immutable evidence'
);
select is(
  (select transfer_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000003'),
  'blocked',
  'negative feedback blocks transfer immediately'
);
select is(
  (select status from public.session_confirmation_incidents where booking_id = 'b8000000-0000-4000-8000-000000000003'),
  'open',
  'negative feedback opens an administrative incident'
);
select public.auto_confirm_sessions((select ends_at + interval '40 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000003'));
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000003' and source = 'automatic'),
  0,
  'automatic confirmation never overwrites an open negative incident'
);
select is(
  public.submit_session_feedback_for_actor_v1(
    '90000000-0000-4000-8000-000000000011',
    'b8000000-0000-4000-8000-000000000003',
    'completed', 4::smallint, null, 'Minha confirmação operacional.',
    'b8200000-0000-4000-8000-000000000004'
  )->'feedback'->>'outcome',
  'completed',
  'the counterpart may still submit a manual response during review'
);
select throws_ok(
  $$update public.session_feedback set comment = 'alterado' where booking_id = 'b8000000-0000-4000-8000-000000000003'$$,
  '55000',
  'SESSION_FEEDBACK_IMMUTABLE',
  'private feedback cannot be edited in place'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000090',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"service_role"}',
  true
);
select is(
  public.admin_resolve_session_confirmation_incident_v1(
    'b8000000-0000-4000-8000-000000000003',
    'performed_confirmed',
    'Evidencias administrativas confirmaram a realizacao.',
    'b8200000-0000-4000-8000-000000000008'
  )->>'status',
  'performed_confirmed',
  'an audited admin decision can confirm a disputed session as performed'
);
select is(
  (select eligible_at - service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000003'),
  interval '1 day',
  'admin performed resolution starts a fresh twenty-four-hour safety period'
);
select is(
  (select transfer_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000003'),
  'waiting_safety_period',
  'admin performed resolution does not release the transfer immediately'
);
select is(
  public.admin_resolve_session_confirmation_incident_v1(
    'b8000000-0000-4000-8000-000000000003',
    'performed_confirmed',
    'Evidencias administrativas confirmaram a realizacao.',
    'b8200000-0000-4000-8000-000000000008'
  )->>'idempotentReplay',
  'true',
  'admin incident resolution is idempotent for the same request id'
);

select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000005'),
  0,
  'automatic confirmation ignores a cancelled booking'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000006'),
  0,
  'automatic confirmation ignores a refund-pending payment'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000007'),
  0,
  'automatic confirmation ignores a disputed payment'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000008'),
  0,
  'automatic confirmation ignores an administratively blocked payment'
);

delete from public.session_participant_confirmations
where booking_id = 'b8000000-0000-4000-8000-000000000009';
update public.session_payments
set service_status = 'occurred_pending_confirmation',
    service_confirmed_at = null,
    service_confirmation_source = null,
    eligible_at = null,
    transfer_status = 'waiting_confirmation',
    transfer_blocked_reason = null
where booking_id = 'b8000000-0000-4000-8000-000000000009';
select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000011',
    'b8000000-0000-4000-8000-000000000009',
    'completed', 'b8200000-0000-4000-8000-000000000009', 'manual', now() - interval '1 minute'
  )->'confirmation'->>'outcome',
  'completed',
  'therapist can confirm manually before the patient'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000009'),
  null,
  'therapist-first confirmation alone does not confirm the service financially'
);
select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000009',
    'completed', 'b8200000-0000-4000-8000-000000000010', 'manual', now()
  )->'confirmation'->>'outcome',
  'completed',
  'patient can confirm manually after the therapist'
);
select is(
  public.finalize_bilateral_session_confirmation_v1('b8000000-0000-4000-8000-000000000009'),
  'confirmed',
  'manual confirmations finalize correctly in the inverted order'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000009'),
  (select confirmed_at from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000009' and participant_role = 'patient'),
  'the later patient response is the financial confirmation instant'
);
select public.auto_confirm_sessions(
  (select ends_at + interval '31 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002')
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000009'),
  2,
  'a late scheduler run cannot duplicate prior manual confirmations'
);
select is(
  (
    select status
    from public.session_confirmation_scheduler_runs
    where scheduled_for = date_trunc(
      'hour',
      (select ends_at + interval '31 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002')
    )
  ),
  'completed',
  'each scheduler execution leaves a completed audit record'
);

select is(
  (select public.refresh_session_transfer_eligibility(id, now())::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000004'),
  'blocked',
  'administrative hold prevents automatic processing before the review test'
);
update public.session_payments
set admin_blocked_at = null, transfer_blocked_reason = null
where booking_id = 'b8000000-0000-4000-8000-000000000004';

select is(
  public.record_session_participant_confirmation_v1(
    '90000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000004',
    'completed', 'b8200000-0000-4000-8000-000000000005', 'manual', now()
  )->'confirmation'->>'outcome',
  'completed',
  'a performed patient confirmation qualifies the relationship review'
);
select is(
  public.save_patient_therapist_review_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    'save', 5, 'Atendimento acolhedor.',
    'b8200000-0000-4000-8000-000000000006'
  )->'review'->>'status',
  'published',
  'qualified relationship review publishes immediately'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000004'),
  null,
  'creating a public review has no financial effect'
);
select is(
  public.save_patient_therapist_review_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    'save', 4, 'Texto revisado.',
    'b8200000-0000-4000-8000-000000000007'
  )->'review'->>'rating',
  '4',
  'patient can edit the canonical relationship review'
);
select ok(
  (select count(*)::integer from public.review_revisions revision join public.reviews review on review.id = revision.review_id where review.patient_profile_id = '91000000-0000-4000-8000-000000000001' and review.therapist_profile_id = '92000000-0000-4000-8000-000000000011')
    > (select total from review_revision_baseline),
  'review edit stores the previous revision in append-only history'
);

rollback;
