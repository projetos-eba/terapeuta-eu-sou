begin;

select plan(13);

-- These tests isolate the overlap guards from the public slot engine. Snapshot
-- capture and both overlap triggers remain enabled.
alter table public.booking_holds disable trigger validate_booking_hold_schedule;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, status, payment_status
) values
  ('a1030000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-01 10:00:00+00', '2099-01-01 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid'),
  ('a1030000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-02 10:00:00+00', '2099-01-02 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid'),
  ('a1030000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-03 10:05:00+00', '2099-01-03 10:55:00+00', 'America/Sao_Paulo', 'confirmed', 'paid');

select throws_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1030000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-01 10:00:00+00', '2099-01-01 11:00:00+00', 'America/Sao_Paulo', 'draft', 'not_started')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'a confirmed encounter blocks a new patient attempt with another therapist'
);

select throws_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1030000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-02 10:30:00+00', '2099-01-02 11:30:00+00', 'America/Sao_Paulo', 'pending_payment', 'pending')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'a confirmed encounter blocks an overlapping pending-payment attempt'
);

select throws_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1030000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-03 10:00:00+00', '2099-01-03 11:00:00+00', 'America/Sao_Paulo', 'draft', 'not_started')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'a confirmed encounter blocks a contained patient attempt'
);

select lives_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status) values
    ('a1030000-0000-4000-8000-000000000021', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-04 10:00:00+00', '2099-01-04 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid'),
    ('a1030000-0000-4000-8000-000000000022', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-04 10:00:00+00', '2099-01-04 11:00:00+00', 'America/Sao_Paulo', 'confirmed', 'paid')$$,
  'different patients remain independent'
);

select lives_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status) values
    ('a1030000-0000-4000-8000-000000000023', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-05 10:00:00+00', '2099-01-05 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid'),
    ('a1030000-0000-4000-8000-000000000024', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-05 10:50:00+00', '2099-01-05 11:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid')$$,
  'exactly consecutive patient intervals are allowed despite therapist buffers'
);

insert into public.booking_holds (
  id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at,
  timezone, idempotency_key, expires_at
) values (
  'a1030000-0000-4000-8000-000000000031', 'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
  '2099-01-06 10:00:00+00', '2099-01-06 10:50:00+00', 'America/Sao_Paulo',
  'patient-guard-hold-0001', '2099-12-31 00:00:00+00'
);

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('a1030000-0000-4000-8000-000000000032', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-06 10:00:00+00', '2099-01-06 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0002', '2099-12-31 00:00:00+00')$$,
  'overlapping unpaid holds for the same patient are allowed'
);

insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
values ('a1030000-0000-4000-8000-000000000041', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-07 10:00:00+00', '2099-01-07 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid');

insert into public.session_payments (
  booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, financial_status,
  paid_at
)
select
  'a1030000-0000-4000-8000-000000000041',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id, 12000, 2000, 2400, 9600, 'paid', now()
from public.financial_policy_versions
where is_active
limit 1;

select throws_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('a1030000-0000-4000-8000-000000000042', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-07 10:00:00+00', '2099-01-07 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0003', '2099-12-31 00:00:00+00')$$,
  'P0001', 'PATIENT_SCHEDULE_CONFLICT',
  'a paid booking blocks a patient hold with another therapist'
);

insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
values ('a1030000-0000-4000-8000-000000000051', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-08 10:00:00+00', '2099-01-08 10:50:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0004', '2099-12-31 00:00:00+00');

select lives_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1030000-0000-4000-8000-000000000052', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-08 10:00:00+00', '2099-01-08 11:00:00+00', 'America/Sao_Paulo', 'draft', 'not_started')$$,
  'an active unpaid hold does not block a patient booking with another therapist'
);

insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, idempotency_key, expires_at)
values ('a1030000-0000-4000-8000-000000000061', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-09 10:00:00+00', '2099-01-09 10:50:00+00', 'America/Sao_Paulo', 'expired', 'patient-guard-hold-0005', '2099-12-31 00:00:00+00');

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at)
    values ('a1030000-0000-4000-8000-000000000062', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-09 10:00:00+00', '2099-01-09 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0006', '2099-12-31 00:00:00+00')$$,
  'an expired hold releases the patient interval'
);

insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status) values
  ('a1030000-0000-4000-8000-000000000071', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-10 10:00:00+00', '2099-01-10 10:50:00+00', 'America/Sao_Paulo', 'cancelled_by_patient', 'cancelled'),
  ('a1030000-0000-4000-8000-000000000072', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-11 10:00:00+00', '2099-01-11 10:50:00+00', 'America/Sao_Paulo', 'refunded', 'refunded'),
  ('a1030000-0000-4000-8000-000000000073', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-12 10:00:00+00', '2099-01-12 10:50:00+00', 'America/Sao_Paulo', 'cancelled_by_payment', 'failed');

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at) values
    ('a1030000-0000-4000-8000-000000000081', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-10 10:00:00+00', '2099-01-10 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0007', '2099-12-31 00:00:00+00')$$,
  'a cancelled booking releases the patient interval'
);

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at) values
    ('a1030000-0000-4000-8000-000000000082', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-11 10:00:00+00', '2099-01-11 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0008', '2099-12-31 00:00:00+00')$$,
  'a fully refunded booking releases the patient interval'
);

select lives_ok(
  $$insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at) values
    ('a1030000-0000-4000-8000-000000000083', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-01-12 10:00:00+00', '2099-01-12 11:00:00+00', 'America/Sao_Paulo', 'patient-guard-hold-0009', '2099-12-31 00:00:00+00')$$,
  'a payment failure releases the patient interval'
);

insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
values ('a1030000-0000-4000-8000-000000000091', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-13 10:00:00+00', '2099-01-13 10:50:00+00', 'America/Sao_Paulo', 'confirmed', 'paid');

select throws_ok(
  $$insert into public.bookings (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, status, payment_status)
    values ('a1030000-0000-4000-8000-000000000092', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-01-13 10:10:00+00', '2099-01-13 11:00:00+00', 'America/Sao_Paulo', 'confirmed', 'paid')$$,
  'P0001', 'BOOKING_CONFLICT',
  'the existing therapist-wide exclusion remains protected'
);

alter table public.booking_holds enable trigger validate_booking_hold_schedule;

select * from finish();
rollback;
