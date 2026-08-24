begin;

select plan(8);

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
  'a7900000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((current_date + 22)::date + time '19:10') at time zone 'America/Sao_Paulo',
  ((current_date + 22)::date + time '20:00') at time zone 'America/Sao_Paulo',
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
  'a7800000-0000-4000-8000-000000000001',
  'a7900000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id,
  12000,
  2000,
  2400,
  9600
from public.financial_policy_versions
where is_active
limit 1;

select is(
  (
    public.apply_session_payment_state_v1(
      'a7800000-0000-4000-8000-000000000001',
      'failed',
      'evt_f2_payment_failed',
      '2026-08-24T10:00:00Z',
      'pi_f2_payment_failed',
      null,
      'cs_f2_payment_failed'
    )->>'applied'
  )::boolean,
  true,
  'definitive payment failure is applied once'
);

select is(
  (
    select status::text
    from public.bookings
    where id = 'a7900000-0000-4000-8000-000000000001'
  ),
  'cancelled_by_payment',
  'failed payment closes the unpaid booking'
);

select is(
  (
    select payment_status::text
    from public.bookings
    where id = 'a7900000-0000-4000-8000-000000000001'
  ),
  'failed',
  'failed payment projects the legacy payment status'
);

select is(
  (
    select cancellation_reason
    from public.bookings
    where id = 'a7900000-0000-4000-8000-000000000001'
  ),
  'stripe_payment_failed',
  'failure reason is retained for audit'
);

select is(
  (
    public.apply_session_payment_state_v1(
      'a7800000-0000-4000-8000-000000000001',
      'failed',
      'evt_f2_payment_failed',
      '2026-08-24T10:00:00Z',
      'pi_f2_payment_failed',
      null,
      'cs_f2_payment_failed'
    )->>'applied'
  ),
  'true',
  'duplicate failure webhook is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.bookings
    where id = 'a7900000-0000-4000-8000-000000000001'
  ),
  1,
  'retry does not create a second booking'
);

select is(
  (
    (
      public.reserve_booking_hold_v1(
        'b1000000-0000-4000-8000-000000000006',
        'd1000000-0000-4000-8000-000000000001',
        ((current_date + 22)::date + time '19:10') at time zone 'America/Sao_Paulo',
        ((current_date + 22)::date + time '20:00') at time zone 'America/Sao_Paulo',
        'America/Sao_Paulo',
        'f2-release-hold-available',
        600
      )
    ).status
  )::text,
  'active',
  'the failed booking releases the slot for a fresh hold'
);

select is(
  (
    select count(*)::integer
    from public.bookings
    where id = 'a7900000-0000-4000-8000-000000000001'
      and status in ('draft', 'pending_payment', 'confirmed')
  ),
  0,
  'released booking is absent from active slot conflicts'
);

select * from finish();

rollback;
