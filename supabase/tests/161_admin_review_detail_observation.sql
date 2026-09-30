begin;
select plan(5);

select ok(
  to_regprocedure('public.admin_get_operation_detail_v1(text,uuid)') is not null,
  'the administrative review detail reader exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_operation_detail_v1(text,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot read review details'
);

select ok(
  exists(
    select 1 from public.reviews
    where id = '90000000-0000-4000-8000-000000000001'
  ),
  'the review fixture exists'
);

update public.profiles
set role = 'admin'::public.user_role
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-0000-4000-8000-000000000001',
  true
);

select is(
  public.admin_get_operation_detail_v1(
    'reviews',
    '90000000-0000-4000-8000-000000000001'
  ) #>> '{record,comment}',
  'Me senti acolhida desde a primeira sessão.',
  'the authorized review detail exposes its nonblank observation'
);

select is(
  public.admin_get_operation_detail_v1(
    'reviews',
    '90000000-0000-4000-8000-000000000001'
  ) #>> '{record,patient_name}',
  (
    select patient.display_name
    from public.reviews as review
    join public.patient_profiles as patient
      on patient.id = review.patient_profile_id
    where review.id = '90000000-0000-4000-8000-000000000001'
  ),
  'the authorized review detail exposes the correct client display name'
);

reset role;
select * from finish();
rollback;
