begin;
\ir fixtures/attended-attempt-local.inc

select plan(60);

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
  0,
  'active policy moves directly from confirmation to settlement verification'
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
  stripe_transfers_status, operational_status, payout_status,
  payout_schedule_interval
) values (
  'b8900000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  'acct_bilateral_contract_test', 'ready', true, true, true, 'active', 'ready',
  'enabled', 'daily'
)
on conflict (therapist_profile_id) where is_current do update
set stripe_transfers_status = 'active', operational_status = 'ready',
    charges_enabled = true, payouts_enabled = true, details_submitted = true,
    payout_status = 'enabled', payout_schedule_interval = 'daily';

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
    then now() - interval '400 days' + make_interval(hours => series * 2)
    else now() - interval '360 days' + make_interval(hours => series * 2)
  end,
  case when series in (2, 5, 6, 7, 8)
    then now() - interval '400 days' + make_interval(hours => series * 2 + 1)
    else now() - interval '360 days' + make_interval(hours => series * 2 + 1)
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
  (select id from public.financial_policy_versions where version = 'tes-payments-v2-session-attendance'),
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

-- These historical payments exercise V9 compatibility only. Current attendance
-- still requires attempt-bound bilateral evidence; financial flags do not create it.
do $$ declare v_id uuid; begin
  for v_id in select id from public.bookings where id::text like 'b8000000-%'
    and status = 'confirmed'
    and id <> 'b8000000-0000-4000-8000-000000000004'
  loop perform pg_temp.prepare_attended_attempt(v_id); end loop;
end $$;

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
-- Explicit legacy financial command: modern participant finalization above
-- deliberately no longer invokes this command.
select public.confirm_session_service(
 'b8000000-0000-4000-8000-000000000001','bilateral',null,null,
 jsonb_build_object('confirmedAt',now(),'confirmationModel','pgtap-explicit-v9'));
select is(
  (select service_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  'confirmed_bilateral',
  'explicit V9 financial confirmation retains its canonical bilateral status'
);
select is(
  (select eligible_at - service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  interval '0 days',
  'explicit V9 financial command starts eligibility without an extra delay'
);
select is(
  (select transfer_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001'),
  'waiting_settlement',
  'payment waits for Stripe settlement immediately after confirmation'
);
update public.session_payments
set stripe_balance_status = 'available',
    stripe_balance_available_on = service_confirmed_at,
    stripe_balance_checked_at = service_confirmed_at
where booking_id = 'b8000000-0000-4000-8000-000000000001';
select is(
  public.refresh_session_transfer_eligibility(
    'b8100000-0000-4000-8000-000000000001',
    (select eligible_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000001')
  )::text,
  'eligible',
  'payment becomes eligible when the settlement snapshot is available'
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
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select is(
  public.get_session_quality_feedback_v1('b8000000-0000-4000-8000-000000000002')->>'status',
  'automatically_confirmed',
  'day-seven patient confirmation closes the own feedback prompt without a public review'
);
select is(
  public.get_session_attempt_attendance_batch_v1(array['b8000000-0000-4000-8000-000000000002'::uuid])
    #>> '{b8000000-0000-4000-8000-000000000002,actorRealized}',
  'true',
  'day-seven confirmation marks the patient encounter as realized'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements(public.get_patient_session_feedback_queue_v1()) item
    where item->>'bookingId' = 'b8000000-0000-4000-8000-000000000002'
  ),
  'automatic patient confirmation removes the private feedback prompt'
);
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000011',true);
select is(
  public.get_session_attempt_attendance_batch_v1(array['b8000000-0000-4000-8000-000000000002'::uuid])
    #>> '{b8000000-0000-4000-8000-000000000002,actorRealized}',
  'false',
  'patient deadline does not mark the therapist response as realized'
);
select ok(
  public.auto_confirm_sessions((select ends_at + interval '30 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002')) >= 1,
  'day thirty creates only the missing therapist confirmation'
);
select is(
  public.get_session_quality_feedback_v1('b8000000-0000-4000-8000-000000000002')->>'status',
  'automatically_confirmed',
  'day-thirty therapist confirmation closes the own feedback prompt'
);
select is(
  (select service_confirmed_at from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'automatic participant deadlines do not write financial confirmation'
);
select is(
  (select count(*)::integer from public.video_session_participations where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  2,
  'automatic confirmation fixture has bilateral trusted attempt-bound joins'
);
select is(
  (select service_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  'scheduled',
  'automatic attendance confirmation leaves financial service state unchanged'
);
select public.auto_confirm_sessions((select ends_at + interval '31 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000002'));
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000002'),
  2,
  'repeating a late scheduler run does not duplicate confirmations'
);

select is(
  public.submit_session_quality_feedback_v1(
    '90000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000003',
    public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003'),
    false, null::smallint, 'internet_problem', 'A conexão prejudicou a experiência.',
    'b8200000-0000-4000-8000-000000000003'
  )->'feedback'->>'successful',
  'false',
  'negative quality is private attempt-scoped evidence'
);
select is(
  (select transfer_status::text from public.session_payments where booking_id = 'b8000000-0000-4000-8000-000000000003'),
  'not_eligible',
  'negative quality leaves the legacy transfer state unchanged'
);
select is(
  public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003'))->>'isOpen',
  'true',
  'negative quality opens a private support review, not an attendance incident'
);
select public.auto_confirm_sessions((select ends_at + interval '40 days' from public.bookings where id = 'b8000000-0000-4000-8000-000000000003'));
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000003' and source = 'automatic'),
  2,
  'automatic confirmation remains independent from the private quality review'
);
select is(
  public.submit_session_quality_feedback_v1(
    '90000000-0000-4000-8000-000000000011',
    'b8000000-0000-4000-8000-000000000003',
    public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003'),
    true, 4::smallint, null, 'Minha avaliação privada da experiência.',
    'b8200000-0000-4000-8000-000000000004'
  )->'feedback'->>'successful',
  'true',
  'the counterpart may still submit independent private quality during review'
);
-- Historical audit remains immutable even though its writer is retired.
insert into public.session_feedback(booking_id,author_profile_id,author_role,
 outcome,rating,comment,request_id,payload_hash)
values('b8000000-0000-4000-8000-000000000003',
 '90000000-0000-4000-8000-000000000001','patient','completed',5,
 'Resposta histórica preservada.','b8200000-0000-4000-8000-000000000099','historical');
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
-- Populate the reply fixture as the test owner; do not broaden server grants.
reset role;
insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
select ticket_id,'aaaaaaaa-0000-4000-8000-000000000090','admin',
 'Resposta à análise da experiência.','requester','b8200000-0000-4000-8000-000000000008'
from public.session_quality_reviews where session_attempt_id=
 public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003');
set local role service_role;
select is(public.session_quality_review_state_v1(
 public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003'))->>'allAnswered',
 'true','audited requester-visible TES reply answers the quality review');
select is((select eligible_at - service_confirmed_at from public.session_payments
 where booking_id='b8000000-0000-4000-8000-000000000003'),
 null::interval,'TES reply does not introduce a financial eligibility clock');
select is((select transfer_status::text from public.session_payments
 where booking_id='b8000000-0000-4000-8000-000000000003'),
 'not_eligible','TES reply leaves the legacy transfer state unchanged');
select is(public.submit_session_quality_feedback_v1(
 '90000000-0000-4000-8000-000000000001',
 'b8000000-0000-4000-8000-000000000003',
 public.current_session_attempt_id_v1('b8000000-0000-4000-8000-000000000003'),
 false,null::smallint,'internet_problem','A conexão prejudicou a experiência.',
 'b8200000-0000-4000-8000-000000000003')->>'idempotentReplay',
 'true','answered quality retry does not create another report or ticket');

select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000005'),
  0,
  'automatic confirmation ignores a cancelled booking'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000006'),
  2,
  'attended session confirmation is independent of a refund-pending financial flag'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000007'),
  2,
  'attended session confirmation is independent of a disputed financial flag'
);
select is(
  (select count(*)::integer from public.session_participant_confirmations where booking_id = 'b8000000-0000-4000-8000-000000000008'),
  2,
  'attended session confirmation is independent of an administrative financial flag'
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
  null::timestamptz,
  'inverted participant response order does not write a financial confirmation instant'
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

reset role;
select pg_temp.prepare_attended_attempt('b8000000-0000-4000-8000-000000000004');
set local role service_role;
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

select is(
  public.save_patient_therapist_review_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    'hide', null, null,
    'b8200000-0000-4000-8000-000000000008'
  )->'review'->>'status',
  'hidden',
  'patient can hide the canonical public review'
);
select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_reviews_v_internal
    where therapist_slug = 'juliane-moore'
      and body = 'Texto revisado.'
  ),
  0,
  'a hidden review leaves the canonical public projection immediately'
);
select is(
  public.save_patient_therapist_review_for_actor_v1(
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    'publish', 4, 'Texto republicado.',
    'b8200000-0000-4000-8000-000000000009'
  )->'review'->>'status',
  'published',
  'patient can republish the canonical public review'
);
select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_reviews_v_internal
    where therapist_slug = 'juliane-moore'
      and body = 'Texto republicado.'
  ),
  1,
  'a republished review returns to the canonical public projection immediately'
);

rollback;
