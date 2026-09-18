begin;
\ir fixtures/attended-attempt-local.inc
select plan(20);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1200000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2024-01-01 13:00:00+00', '2024-01-01 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1200000-0000-4000-8000-000000000021',
  'b1200000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transfer_pending', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_feedback_120', 'pi_test_v10_feedback_120',
  '2024-01-01 12:00:00+00', '2023-12-31 13:00:00+00'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1200000-0000-4000-8000-000000000012',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2024-01-02 13:00:00+00', '2024-01-02 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1200000-0000-4000-8000-000000000022',
  'b1200000-0000-4000-8000-000000000012',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transfer_pending', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_review_120', 'pi_test_v10_review_120',
  '2024-01-02 12:00:00+00', '2024-01-01 13:00:00+00'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

do $$ begin
  perform pg_temp.prepare_attended_attempt('b1200000-0000-4000-8000-000000000011');
  perform pg_temp.prepare_attended_attempt('b1200000-0000-4000-8000-000000000012');
end $$;

select is(
  public.refresh_session_transfer_eligibility(
    'b1200000-0000-4000-8000-000000000021'
  )::text,
  'transfer_pending',
  'weekly eligibility cannot recalculate a V10 direct transfer'
);
select is(
  (select transfer_status::text from public.session_payments
    where id = 'b1200000-0000-4000-8000-000000000021'),
  'transfer_pending',
  'V10 transfer state remains unchanged after a weekly eligibility request'
);
select ok(
  not has_function_privilege('authenticated',
    'public.private_refresh_session_transfer_eligibility_v9_legacy(uuid,timestamptz)',
    'EXECUTE'),
  'browser cannot call the private V9 eligibility implementation'
);

update public.session_payments
set transfer_status = 'transferred'
where id = 'b1200000-0000-4000-8000-000000000021';

select set_config('request.jwt.claim.sub',
  (select user_id::text from public.patient_profiles
   where id = 'b1000000-0000-4000-8000-000000000001'), true);

select is(
  public.get_session_feedback_v2('b1200000-0000-4000-8000-000000000011')
    ->> 'confirmationState',
  'awaiting_both',
  'a transferred V10 payment does not complete participant confirmation'
);
select is(
  (select item ->> 'confirmationState'
   from jsonb_array_elements(public.get_patient_session_feedback_queue_v1()) item
   where item ->> 'bookingId' = 'b1200000-0000-4000-8000-000000000011'),
  'awaiting_both',
  'the patient queue uses confirmations instead of V10 transfer progress'
);
select is(
  public.get_session_feedback_v2('b1200000-0000-4000-8000-000000000011')
    #> '{financial,nextBatchAt}',
  'null'::jsonb,
  'V10 feedback does not promise a weekly batch'
);

select is(
  public.record_session_participant_confirmation_v1(
    (select user_id from public.patient_profiles
     where id = 'b1000000-0000-4000-8000-000000000001'),
    'b1200000-0000-4000-8000-000000000011',
    'completed', 'b1200000-0000-4000-8000-000000000031', 'manual', now()
  ) -> 'confirmation' ->> 'outcome',
  'completed', 'patient confirmation is recorded independently'
);
select is(
  public.get_session_feedback_v2('b1200000-0000-4000-8000-000000000011')
    ->> 'confirmationState',
  'awaiting_therapist',
  'a single V10 response still awaits the other participant'
);
select is(
  public.record_session_participant_confirmation_v1(
    (select user_id from public.therapist_profiles
     where id = 'c1000000-0000-4000-8000-000000000001'),
    'b1200000-0000-4000-8000-000000000011',
    'completed', 'b1200000-0000-4000-8000-000000000032', 'manual', now()
  ) -> 'confirmation' ->> 'outcome',
  'completed', 'therapist confirmation is recorded independently'
);
select is(
  public.finalize_bilateral_session_confirmation_v1(
    'b1200000-0000-4000-8000-000000000011'
  ),
  'confirmed', 'bilateral confirmation can complete without a V10 payout gate'
);
select is(
  (select transfer_status::text from public.session_payments
   where id = 'b1200000-0000-4000-8000-000000000021'),
  'transferred',
  'bilateral confirmation does not rewrite the V10 transfer state'
);

create temporary table v10_payment_before_quality as
select to_jsonb(payment) as snapshot from public.session_payments payment
where payment.id = 'b1200000-0000-4000-8000-000000000022';
select is(
  public.submit_session_quality_feedback_v1(
    (select user_id from public.patient_profiles
     where id = 'b1000000-0000-4000-8000-000000000001'),
    'b1200000-0000-4000-8000-000000000012',
    public.current_session_attempt_id_v1('b1200000-0000-4000-8000-000000000012'),
    false, null::smallint, 'internet_problem',
    'A conexão prejudicou a experiência da sessão realizada.',
    'b1200000-0000-4000-8000-000000000041'
  ) -> 'feedback' ->> 'successful',
  'false',
  'a V10 participant report remains auditable support evidence'
);
select is(
  public.session_quality_review_state_v1(
    public.current_session_attempt_id_v1('b1200000-0000-4000-8000-000000000012')) ->> 'isOpen',
  'true',
  'a V10 negative report opens an administrative review'
);
select is(
  (select transfer_status::text from public.session_payments
   where id = 'b1200000-0000-4000-8000-000000000022'),
  'transfer_pending',
  'a V10 review does not rewrite the direct transfer lifecycle'
);
select ok(
  (select internal_contested_at is null from public.session_payments
   where id = 'b1200000-0000-4000-8000-000000000022'),
  'a private quality review never introduces a V10 financial hold'
);
select is(
  public.get_session_feedback_v2('b1200000-0000-4000-8000-000000000012')
    ->> 'confirmationState',
  'awaiting_both',
  'a private quality review does not alter the separate confirmation state'
);

select is(
  (select to_jsonb(payment) from public.session_payments payment
   where payment.id = 'b1200000-0000-4000-8000-000000000022'),
  (select snapshot from v10_payment_before_quality),
  'negative quality leaves the entire canonical V10 payment unchanged'
);
select set_config('request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000090', true);
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"service_role"}',
  true);
insert into public.support_ticket_messages (
  ticket_id, author_profile_id, author_role, body, visibility, request_id
)
select ticket_id, 'aaaaaaaa-0000-4000-8000-000000000090', 'admin',
       'A análise da experiência foi respondida.', 'requester',
       'b1200000-0000-4000-8000-000000000042'
from public.session_quality_reviews
where session_attempt_id = public.current_session_attempt_id_v1(
  'b1200000-0000-4000-8000-000000000012');
select is(
  public.session_quality_review_state_v1(
    public.current_session_attempt_id_v1('b1200000-0000-4000-8000-000000000012')) ->> 'allAnswered',
  'true',
  'an audited requester-visible admin reply answers the private review'
);
select is(
  (select transfer_status::text from public.session_payments
   where id = 'b1200000-0000-4000-8000-000000000022'),
  'transfer_pending',
  'admin resolution preserves the V10 provider transfer state'
);

select is(
  (select to_jsonb(payment) from public.session_payments payment
   where payment.id = 'b1200000-0000-4000-8000-000000000022'),
  (select snapshot from v10_payment_before_quality),
  'TES support reply leaves all financial fields, hold flags and metadata unchanged'
);
select * from finish();
rollback;
