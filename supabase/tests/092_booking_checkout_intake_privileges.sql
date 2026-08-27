begin;

select plan(4);

select ok(
  has_table_privilege(
    'service_role',
    'public.booking_intake_responses',
    'INSERT'
  ),
  'service role can create the private intake during checkout'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.booking_intake_responses',
    'UPDATE'
  ),
  'service role can replay the checkout intake idempotently'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.booking_intake_responses',
    'INSERT'
  ),
  false,
  'authenticated clients cannot create intake rows directly'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.booking_intake_responses',
    'UPDATE'
  ),
  false,
  'authenticated clients cannot edit intake rows directly'
);

select * from finish();

rollback;
