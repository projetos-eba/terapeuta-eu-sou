begin;

select plan(5);

select is(
  (
    select context->>'source'
    from public.aura_recommendations
    where id = 'ea000000-0000-4000-8000-000000000001'
  ),
  'demo_seed',
  'Aura demo rows carry an explicit demo origin marker'
);

select is(
  (
    select evidence->>'source'
    from public.aura_recommendations
    where id = 'ea000000-0000-4000-8000-000000000001'
  ),
  'seed',
  'Aura demo rows carry seed evidence'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendations
    where context->>'source' = 'demo_seed'
  ),
  5,
  'all five local Aura demo rows are marked and can be filtered'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendations
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and context->>'source' = 'demo_seed'
      and patient_profile_id is null
      and booking_id is null
  ),
  5,
  'demo Aura rows remain therapist-agnostic seed fixtures'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendations
    where context->>'source' is null
  ),
  0,
  'Aura seed contract does not leave originless demo rows'
);

select * from finish();
rollback;
