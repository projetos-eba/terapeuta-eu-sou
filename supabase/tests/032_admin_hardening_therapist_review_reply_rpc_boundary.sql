begin;

select plan(11);

select is(
  has_function_privilege(
    'anon',
    'public.upsert_therapist_review_reply_v1(uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute legacy therapist review reply mutation directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_therapist_review_reply_v1(uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute legacy therapist review reply mutation directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.upsert_therapist_review_reply_v1(uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'service_role cannot execute legacy therapist review reply mutation directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.upsert_therapist_review_reply_for_actor_v1(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute therapist review reply actor wrapper'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_therapist_review_reply_for_actor_v1(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute therapist review reply actor wrapper'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.upsert_therapist_review_reply_for_actor_v1(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'service_role can execute therapist review reply actor wrapper'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_v1(
      '00000000-0000-4000-8000-000000000001'::uuid,
      'Resposta valida de teste.',
      'a6000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'authenticated direct legacy review reply mutation is denied before business logic'
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_for_actor_v1(
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000001'::uuid,
      'Resposta valida de teste.',
      'a6000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'authenticated direct actor wrapper is denied before business logic'
);

reset role;

set local role service_role;

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_v1(
      '00000000-0000-4000-8000-000000000001'::uuid,
      'Resposta valida de teste.',
      'a6000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'service_role direct legacy review reply mutation is denied'
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_for_actor_v1(
      null::uuid,
      '00000000-0000-4000-8000-000000000001'::uuid,
      'Resposta valida de teste.',
      'a6000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'P0001',
  'PROFILE_NOT_FOUND',
  'service_role wrapper requires an actor resolved from a JWT'
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_for_actor_v1(
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000001'::uuid,
      'Resposta valida de teste.',
      'a6000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'P0001',
  null,
  'service_role wrapper reaches business logic with actor claim set'
);

reset role;

select * from finish();

rollback;
