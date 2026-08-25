begin;

select plan(7);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  (public.get_therapist_sessions_v1() ? 'summary'),
  'sessions read model exposes an aggregate summary'
);

select is(
  (public.get_therapist_sessions_v1() #>> '{summary,total}')::integer,
  (
    select count(*)::integer
    from public.therapist_session_read_model_v1
    where "_therapistProfileId" = 'c1000000-0000-4000-8000-000000000001'
  ),
  'summary total covers the complete therapist scope, not only the current page'
);

select is(
  (public.get_therapist_sessions_v1(
    p_period_start => now() - interval '30 days',
    p_period_end => now()
  ) #>> '{summary,total}')::integer,
  (
    select count(*)::integer
    from public.therapist_session_read_model_v1
    where "_therapistProfileId" = 'c1000000-0000-4000-8000-000000000001'
      and "endsAt" > now() - interval '30 days'
      and "startsAt" < now()
  ),
  'summary applies both sides of the selected historical period'
);

select is(
  (public.get_therapist_sessions_v1(
    p_booking_status => 'completed'
  ) #>> '{summary,completed}')::integer,
  (
    select count(*)::integer
    from public.therapist_session_read_model_v1
    where "_therapistProfileId" = 'c1000000-0000-4000-8000-000000000001'
      and "bookingStatus" = 'completed'
  ),
  'completed summary respects the booking status filter'
);

select ok(
  (
    public.get_therapist_sessions_v1(
      p_limit => 1
    ) #>> '{summary,total}'
  )::integer >= jsonb_array_length(
    public.get_therapist_sessions_v1(p_limit => 1) -> 'items'
  ),
  'summary totals do not shrink with cursor page size'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (public.get_therapist_sessions_v1() #>> '{therapistProfileId}'),
  'c1000000-0000-4000-8000-000000000002',
  'summary remains scoped to the authenticated therapist'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_therapist_sessions_v1() -> 'items') as item
    where item ->> 'patientProfileId' in (
      'b1000000-0000-4000-8000-000000000004',
      'b1000000-0000-4000-8000-000000000005'
    )
  ),
  'another therapist cannot infer Ana session identities through the summary read'
);

select * from finish();

rollback;
