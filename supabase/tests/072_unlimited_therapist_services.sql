begin;

select plan(5);

select is(
  public.therapist_service_limit_for_plan_v1('free'::public.therapist_plan),
  null::integer,
  'Free therapists have no service count limit'
);

select is(
  public.therapist_service_limit_for_plan_v1('premium'::public.therapist_plan),
  null::integer,
  'Premium therapists have no service count limit'
);

select is(
  public.therapist_service_limit_for_plan_v1('premium_plus'::public.therapist_plan),
  null::integer,
  'Premium Plus therapists have no service count limit'
);

select has_trigger(
  'public',
  'therapist_services',
  'therapist_services_description_length_v1',
  'Therapist service descriptions have a 550-character database guard'
);

select ok(
  position(
    'length(new.description) > 550' in pg_get_functiondef(
      'public.enforce_therapist_service_description_length_v1()'::regprocedure
    )
  ) > 0,
  'Description guard enforces the 550-character contract'
);

select * from finish();
rollback;
