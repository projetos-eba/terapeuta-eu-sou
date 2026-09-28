begin;

select set_config('timezone', 'America/Sao_Paulo', true);
select plan(12);

select has_function(
  'public',
  'get_private_therapist_receipts_v6',
  array['date','date','text','uuid','text','integer','integer','text'],
  'receipts V6 is installed as an additive private read model'
);
select is(
  (
    select provolatile::text
    from pg_proc
    where oid = 'public.get_private_therapist_receipts_v6(date,date,text,uuid,text,integer,integer,text)'::regprocedure
  ),
  's',
  'receipts V6 is stable and read-only'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_receipts_v6(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'authenticated therapists can read receipts V6'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_private_therapist_receipts_v6(date,date,text,uuid,text,integer,integer,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot read receipts V6'
);
select ok(
  to_regprocedure('public.get_private_therapist_receipts_v5(date,date,text,uuid,text,integer,integer,text)') is not null,
  'receipts V5 remains available for existing consumers'
);

insert into auth.users (id, email)
values ('f1510000-0000-4000-8000-000000000001', 'receipts-v6@example.test');

insert into public.profiles (id, role, display_name, email)
values (
  'f1510000-0000-4000-8000-000000000001',
  'therapist',
  'Receipts V6 Fixture',
  'receipts-v6@example.test'
);

insert into public.therapist_profiles (
  id,
  user_id,
  plan,
  slug,
  public_name,
  status,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions
)
values (
  'f1510000-0000-4000-8000-000000000002',
  'f1510000-0000-4000-8000-000000000001',
  'premium',
  'receipts-v6-fixture',
  'Receipts V6 Fixture',
  'approved',
  false,
  false,
  true
);

insert into public.therapist_connect_accounts (
  id,
  therapist_profile_id,
  stripe_account_id,
  onboarding_status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  stripe_transfers_status,
  pending_requirements,
  operational_status,
  payout_status,
  payout_schedule_interval,
  is_current
)
values (
  'f1510000-0000-4000-8000-000000000004',
  'f1510000-0000-4000-8000-000000000002',
  'acct_test_receipts_v6',
  'ready',
  true,
  true,
  true,
  'active',
  '[]'::jsonb,
  'ready',
  'enabled',
  'daily',
  true
);

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  duration_minutes,
  price_cents,
  status,
  online_only,
  delivery_format,
  is_bookable
)
select
  'f1510000-0000-4000-8000-000000000003',
  'f1510000-0000-4000-8000-000000000002',
  therapy.id,
  'Receipts V6',
  50,
  10000,
  'active',
  true,
  'online',
  true
from public.therapies as therapy
order by therapy.id
limit 1;

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
  (
    'f1510000-0000-4000-8000-000000000011',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 1)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 1)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'f1510000-0000-4000-8000-000000000012',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 29)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 29)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'f1510000-0000-4000-8000-000000000013',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 30)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 30)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'f1510000-0000-4000-8000-000000000014',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 2)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 2)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'f1510000-0000-4000-8000-000000000015',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 3)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 3)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'f1510000-0000-4000-8000-000000000016',
    'b1000000-0000-4000-8000-000000000001',
    'f1510000-0000-4000-8000-000000000002',
    'f1510000-0000-4000-8000-000000000003',
    ((current_date + 4)::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
    ((current_date + 4)::timestamp + time '12:50') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
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
  therapist_amount_cents,
  financial_status,
  service_status,
  transfer_status,
  payment_flow_version,
  connect_account_id_snapshot,
  stripe_connect_account_id_snapshot,
  payment_due_at
)
select
  fixture.payment_id,
  fixture.booking_id,
  'b1000000-0000-4000-8000-000000000001',
  'f1510000-0000-4000-8000-000000000002',
  'f1510000-0000-4000-8000-000000000003',
  policy.id,
  fixture.gross_amount_cents,
  1500,
  fixture.gross_amount_cents - fixture.therapist_amount_cents,
  fixture.therapist_amount_cents,
  fixture.financial_status::public.session_financial_status,
  'scheduled'::public.session_service_status,
  'not_eligible'::public.session_transfer_status,
  'v10',
  'f1510000-0000-4000-8000-000000000004',
  'acct_test_receipts_v6',
  fixture.payment_due_at
from (
  values
    (
      'f1510000-0000-4000-8000-000000000021'::uuid,
      'f1510000-0000-4000-8000-000000000011'::uuid,
      10000,
      8500,
      'pending',
      (((current_date + 1)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    ),
    (
      'f1510000-0000-4000-8000-000000000022'::uuid,
      'f1510000-0000-4000-8000-000000000012'::uuid,
      12000,
      10200,
      'pending',
      (((current_date + 29)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    ),
    (
      'f1510000-0000-4000-8000-000000000023'::uuid,
      'f1510000-0000-4000-8000-000000000013'::uuid,
      9000,
      7650,
      'pending',
      (((current_date + 30)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    ),
    (
      'f1510000-0000-4000-8000-000000000024'::uuid,
      'f1510000-0000-4000-8000-000000000014'::uuid,
      8000,
      6800,
      'pending',
      (((current_date + 2)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    ),
    (
      'f1510000-0000-4000-8000-000000000025'::uuid,
      'f1510000-0000-4000-8000-000000000015'::uuid,
      11000,
      9350,
      'pending',
      (((current_date + 3)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    ),
    (
      'f1510000-0000-4000-8000-000000000026'::uuid,
      'f1510000-0000-4000-8000-000000000016'::uuid,
      13000,
      11050,
      'failed',
      (((current_date + 4)::timestamp + time '12:00') at time zone 'America/Sao_Paulo') - interval '24 hours'
    )
) as fixture(
  payment_id,
  booking_id,
  gross_amount_cents,
  therapist_amount_cents,
  financial_status,
  payment_due_at
)
cross join lateral (
  select id
  from public.financial_policy_versions
  where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
  limit 1
) as policy;

select public.register_session_payment_setup_v10(
  'f1510000-0000-4000-8000-000000000021',
  (select version from public.bookings where id = 'f1510000-0000-4000-8000-000000000011'),
  'test',
  'cus_test_receipts_v6_1',
  'seti_test_receipts_v6_1',
  'pm_test_receipts_v6_1',
  'succeeded',
  'tes-card-off-session-v1',
  now(),
  null
);
select public.register_session_payment_setup_v10(
  'f1510000-0000-4000-8000-000000000022',
  (select version from public.bookings where id = 'f1510000-0000-4000-8000-000000000012'),
  'test',
  'cus_test_receipts_v6_2',
  'seti_test_receipts_v6_2',
  'pm_test_receipts_v6_2',
  'succeeded',
  'tes-card-off-session-v1',
  now(),
  null
);
select public.register_session_payment_setup_v10(
  'f1510000-0000-4000-8000-000000000023',
  (select version from public.bookings where id = 'f1510000-0000-4000-8000-000000000013'),
  'test',
  'cus_test_receipts_v6_3',
  'seti_test_receipts_v6_3',
  'pm_test_receipts_v6_3',
  'succeeded',
  'tes-card-off-session-v1',
  now(),
  null
);
select public.register_session_payment_setup_v10(
  'f1510000-0000-4000-8000-000000000024',
  (select version from public.bookings where id = 'f1510000-0000-4000-8000-000000000014'),
  'test',
  'cus_test_receipts_v6_4',
  'seti_test_receipts_v6_4',
  'pm_test_receipts_v6_4',
  'succeeded',
  'tes-card-off-session-v1',
  now(),
  null
);

select public.schedule_session_payment_v10(
  'f1510000-0000-4000-8000-000000000021',
  (select id from public.session_payment_setups where session_payment_id = 'f1510000-0000-4000-8000-000000000021'),
  (select payment_due_at from public.session_payments where id = 'f1510000-0000-4000-8000-000000000021'),
  'tes:test:receipts-v6:1',
  'receipts-v6-1'
);
select public.schedule_session_payment_v10(
  'f1510000-0000-4000-8000-000000000022',
  (select id from public.session_payment_setups where session_payment_id = 'f1510000-0000-4000-8000-000000000022'),
  (select payment_due_at from public.session_payments where id = 'f1510000-0000-4000-8000-000000000022'),
  'tes:test:receipts-v6:2',
  'receipts-v6-2'
);
select public.schedule_session_payment_v10(
  'f1510000-0000-4000-8000-000000000023',
  (select id from public.session_payment_setups where session_payment_id = 'f1510000-0000-4000-8000-000000000023'),
  (select payment_due_at from public.session_payments where id = 'f1510000-0000-4000-8000-000000000023'),
  'tes:test:receipts-v6:3',
  'receipts-v6-3'
);
select public.schedule_session_payment_v10(
  'f1510000-0000-4000-8000-000000000024',
  (select id from public.session_payment_setups where session_payment_id = 'f1510000-0000-4000-8000-000000000024'),
  (select payment_due_at from public.session_payments where id = 'f1510000-0000-4000-8000-000000000024'),
  'tes:test:receipts-v6:4',
  'receipts-v6-4'
);

update public.session_payment_schedules
set status = 'canceled',
    canceled_at = now()
where session_payment_id = 'f1510000-0000-4000-8000-000000000024';

select set_config(
  'request.jwt.claim.sub',
  'f1510000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select ok(
  not ((public.get_private_therapist_receipts_v5(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) -> 'summary') ? 'upcomingScheduled'),
  'V5 keeps its historical summary contract unchanged'
);
select is(
  public.get_private_therapist_receipts_v6(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,upcomingScheduled,amountCents}',
  '18700',
  'V6 sums only active scheduled charges in the next 30 local days'
);
select is(
  public.get_private_therapist_receipts_v6(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,upcomingScheduled,sessionCount}',
  '2',
  'canceled, failed, unconfigured and day-30 charges are excluded'
);
select is(
  public.get_private_therapist_receipts_v6(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,upcomingScheduled,periodStart}',
  (now() at time zone 'America/Sao_Paulo')::date::text,
  'the upcoming period starts on the current Sao Paulo date'
);
select is(
  public.get_private_therapist_receipts_v6(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,upcomingScheduled,periodEnd}',
  ((now() at time zone 'America/Sao_Paulo')::date + 29)::text,
  'the upcoming period ends inclusively on the twenty-ninth following day'
);
select is(
  public.get_private_therapist_receipts_v6(
    (now() at time zone 'America/Sao_Paulo')::date,
    (now() at time zone 'America/Sao_Paulo')::date + 29,
    'scheduled',
    null,
    null,
    1,
    20,
    'America/Sao_Paulo'
  ) #>> '{pagination,totalCount}',
  '2',
  'the future scheduled table uses the same cohort as the V6 card'
);
select is(
  public.get_private_therapist_receipts_v6(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,approvedCents}',
  public.get_private_therapist_receipts_v5(
    date '2000-01-01', date '2000-01-30', null, null, null, 1, 20,
    'America/Sao_Paulo'
  ) #>> '{summary,approvedCents}',
  'V6 preserves V5 historical totals'
);

reset role;
select * from finish();
rollback;
