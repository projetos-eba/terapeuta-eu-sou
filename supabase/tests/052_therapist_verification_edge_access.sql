begin;

select plan(4);

select ok(
  has_table_privilege('service_role', 'public.therapist_verifications', 'SELECT'),
  'service_role can read private verification summaries through authorized Edge Functions'
);

select ok(
  has_table_privilege('service_role', 'public.therapist_verifications', 'INSERT'),
  'service_role can create the verification queue entry through authorized Edge Functions'
);

select ok(
  has_table_privilege('service_role', 'public.therapist_verifications', 'UPDATE'),
  'service_role can update the verification queue entry through authorized Edge Functions'
);

select is(
  has_table_privilege('authenticated', 'public.therapist_verifications', 'SELECT'),
  false,
  'authenticated browser role cannot read private verification records directly'
);

select * from finish();

rollback;
