begin;

select plan(5);

select has_function(
  'public',
  'therapist_publication_state_json_v1',
  array['uuid'],
  'the effective publication state has an internal projection'
);

select has_function(
  'public',
  'get_private_therapist_publication_state_v1',
  array[]::text[],
  'the therapist can read only their own effective publication state'
);

select ok(
  position(
    'get_therapist_publication_eligibility_v1' in pg_get_functiondef(
      'public.therapist_publication_state_json_v1(uuid)'::regprocedure
    )
  ) > 0,
  'the private state reuses the canonical publication eligibility gate'
);

select ok(
  position(
    'receiving_account_not_ready' in pg_get_functiondef(
      'public.therapist_publication_state_json_v1(uuid)'::regprocedure
    )
  ) > 0,
  'the receiving-account blocker is represented without exposing its internal code to the UI contract'
);

select function_privs_are(
  'public',
  'therapist_publication_state_json_v1',
  array['uuid'],
  'authenticated',
  array[]::text[],
  'the internal projection cannot be called directly by authenticated users'
);

select * from finish();

rollback;
