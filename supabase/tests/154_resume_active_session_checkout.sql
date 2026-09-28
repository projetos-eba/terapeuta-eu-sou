begin;

select plan(12);

select ok(
  to_regprocedure('public.get_session_payment_checkout_resume_v1(uuid)') is not null,
  'the server-only active Checkout continuation command exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_session_payment_checkout_resume_v1(uuid)',
    'EXECUTE'
  ),
  'only the trusted payment worker can resume an active Checkout'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_session_payment_checkout_resume_v1(uuid)',
    'EXECUTE'
  ),
  'the browser cannot call the active Checkout continuation command'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  legal_acceptance_recorded_at
)
values (
  'a1540000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000010',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2099-11-20 13:00:00+00', '2099-11-20 13:50:00+00',
  'America/Sao_Paulo', 'draft', 'not_started', now()
);

select lives_ok(
  $$select public.prepare_session_payment_v10(
    'a1540000-0000-4000-8000-000000000001',
    (
      select id
      from public.stripe_customers
      where profile_id = 'bbbbbbbb-0000-4000-8000-000000000010'
        and role = 'patient'
        and environment = 'test'
    )
  )$$,
  'the active Checkout fixture uses the canonical V10 preparation flow'
);
select is(
  public.swap_session_payment_checkout_v10(
    payment.id,
    booking.version,
    'test',
    null,
    'cs_test_resume_154',
    17000,
    0,
    17000,
    'scheduled'
  ) ->> 'applied',
  'true',
  'the fixture has exactly one current Checkout'
)
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
where booking.id = 'a1540000-0000-4000-8000-000000000001';

insert into public.session_payment_attempts (
  session_payment_id,
  attempt_kind,
  idempotency_key,
  reservation_expires_at,
  status,
  stripe_checkout_session_id
)
select
  payment.id,
  'initial_hold',
  'tes:v10:resume:154',
  now() + interval '5 minutes',
  'checkout_created',
  'cs_test_resume_154'
from public.session_payments as payment
where payment.booking_id = 'a1540000-0000-4000-8000-000000000001';

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
    'a1540000-0000-4000-8000-000000000001'
  ) ->> 'canRetry',
  'true',
  'the owner can continue an untouched initial Checkout during its active hold'
);
select is(
  public.get_patient_reservation_retry_context_v1(
    'a1540000-0000-4000-8000-000000000001'
  ) ->> 'continuationMode',
  'resume_existing_checkout',
  'the patient read model distinguishes continuation from a terminal retry'
);
select is(
  public.get_patient_reservation_retry_contexts_v1(
    array['a1540000-0000-4000-8000-000000000001'::uuid]
  ) #>> '{a1540000-0000-4000-8000-000000000001,continuationMode}',
  'resume_existing_checkout',
  'the batch patient read model preserves the active continuation state'
);
select ok(
  not (
    public.get_patient_reservation_retry_context_v1(
      'a1540000-0000-4000-8000-000000000001'
    ) ? 'stripeCheckoutSessionId'
  ),
  'the patient read model never exposes the Checkout identifier'
);
reset role;

select is(
  public.get_session_payment_checkout_resume_v1(
    'a1540000-0000-4000-8000-000000000001'
  ) ->> 'allowed',
  'true',
  'the server can revalidate the same current Checkout without changing data'
);

update public.session_payment_attempts
set reservation_expires_at = now() - interval '1 second'
where idempotency_key = 'tes:v10:resume:154';

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
    'a1540000-0000-4000-8000-000000000001'
  ) ->> 'canRetry',
  'false',
  'the patient cannot continue once the five-minute reservation window ended'
);
reset role;

select is(
  public.get_session_payment_checkout_resume_v1(
    'a1540000-0000-4000-8000-000000000001'
  ) ->> 'allowed',
  'false',
  'the server fails closed after the reservation deadline'
);

select * from finish();
rollback;
