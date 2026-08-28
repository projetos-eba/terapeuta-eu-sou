begin;

select plan(16);

select has_table(
  'public',
  'therapist_private_identity',
  'private identity and address data has a dedicated table'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.therapist_private_identity'::regclass),
  'private identity table has row-level security enabled'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.queue_therapist_profile_review_v1(uuid)',
    'EXECUTE'
  ),
  'profile review queue is callable only by the server authority'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.queue_therapist_profile_review_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'therapists cannot queue their own review through the RPC boundary'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_private_identity_v1()',
    'EXECUTE'
  ),
  'therapists can read their own private identity through the authenticated getter'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_therapist_private_identity_v1(text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'therapists can save private identity through the authenticated command'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_private_identity_v1()',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot read private identity'
);

delete from public.therapist_private_identity
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
   or (
     document_type = 'cpf'
     and document_number = '52998224725'
   );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (public.save_therapist_private_identity_v1(
    'cpf', '529.982.247-25', '05409-000', 'Rua dos Pinheiros', '100',
    'Apto 42', 'Pinheiros', 'São Paulo', 'sp', 'BR'
  ) ->> 'documentNumber'),
  '52998224725',
  'private identity command normalizes document numbers server-side'
);

select is(
  (public.get_therapist_private_identity_v1() ->> 'postalCode'),
  '05409000',
  'private identity getter returns normalized postal code'
);

select is(
  (select count(*)::integer from public.therapist_private_identity where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  1,
  'therapist identity is persisted once for the owner profile'
);

reset role;
update public.profiles
set role = 'admin'::public.user_role
where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (public.admin_get_therapist_profile_review_v1('c1000000-0000-4000-8000-000000000001')->'privateIdentity'->>'documentNumber'),
  '52998224725',
  'authorized Admin can review the private identity without using a public projection'
);

reset role;
update public.profiles
set role = 'therapist'::public.user_role
where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_therapist_private_identity_v1(
    'cpf', '111.111.111-11', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  )$$,
  '22023',
  'invalid cpf',
  'repeated CPF digits are rejected server-side'
);

select throws_ok(
  $$select public.save_therapist_private_identity_v1(
    'cpf', '529.982.247-26', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  )$$,
  '22023',
  'invalid cpf',
  'CPF checksum is validated server-side'
);

select throws_ok(
  $$select public.save_therapist_private_identity_v1(
    'passport', 'AB12', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  )$$,
  '22023',
  'invalid document number',
  'short passport values are rejected server-side'
);

select is(
  (select count(*)::integer from public.therapist_private_identity where therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'),
  0,
  'a therapist cannot create identity data for another therapist'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.therapist_private_identity where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'),
  0,
  'a different therapist cannot read the first therapist identity'
);

reset role;
select * from finish();

rollback;
