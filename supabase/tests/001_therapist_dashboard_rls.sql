begin;

select plan(6);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select isnt(
  public.get_therapist_dashboard_v1(),
  null,
  'Ana can read her Premium Plus dashboard'
);

select is(
  (
    select count(*)::integer
    from public.therapist_patient_relationships
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  10,
  'Ana reads only her seeded relationships'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.therapist_patient_relationships
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  0,
  'Rafael cannot read Ana relationships'
);

select throws_ok(
  'select public.get_therapist_dashboard_v1()',
  '42501',
  'premium_plus_access_required',
  'Premium therapist cannot invoke the Plus dashboard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_dashboard_v1()',
  '42501',
  'therapist_access_required',
  'Patient cannot invoke the therapist dashboard'
);

reset role;
update public.therapist_profiles
set status = 'suspended'
where id = 'c1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_dashboard_v1()',
  '42501',
  'premium_plus_access_required',
  'Suspended therapist cannot invoke the dashboard'
);

select * from finish();

rollback;
