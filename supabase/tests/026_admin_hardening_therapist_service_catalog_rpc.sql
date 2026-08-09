begin;

select plan(8);

select is(
  has_function_privilege(
    'anon',
    'public.list_therapist_service_catalog_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot invoke therapist service catalog RPC directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.list_therapist_service_catalog_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke therapist service catalog RPC directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.list_therapist_service_catalog_v1(uuid)',
    'EXECUTE'
  ),
  'service role can invoke therapist service catalog through the Edge Function boundary'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_for_service_actor_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke therapist actor helper directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_for_service_actor_v1(uuid)',
    'EXECUTE'
  ),
  false,
  'anon cannot invoke therapist actor helper directly'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.list_therapist_service_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'authenticated direct RPC call cannot pass another actor id'
);

reset role;

set local role service_role;

select ok(
  (
    public.list_therapist_service_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid
    ) ->> 'therapistProfileId'
  ) = 'c1000000-0000-4000-8000-000000000001',
  'service role can load the catalog for the authenticated Edge Function actor'
);

select ok(
  jsonb_typeof(
    public.list_therapist_service_catalog_v1(
      'aaaaaaaa-0000-4000-8000-000000000001'::uuid
    ) -> 'items'
  ) = 'array',
  'service role catalog response keeps the expected item array contract'
);

select * from finish();

rollback;
