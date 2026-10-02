begin;

select plan(9);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_session_metrics_v2(integer)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the additive MTR-4 V2 read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_session_metrics_v2(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke MTR-4 V2'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_session_metrics_v1(30) ->> 'contractVersion',
  '1',
  'V1 remains available unchanged for existing consumers'
);

select is(
  public.get_therapist_session_metrics_v2(30) ->> 'contractVersion',
  '2',
  'V2 advertises its additive contract version'
);

select is(
  public.get_therapist_session_metrics_v2(60) #>> '{meta,periodDays}',
  '60',
  'V2 retains the approved 60-day historical period'
);

select is(
  jsonb_array_length(
    public.get_therapist_session_metrics_v2(30) #> '{evolution,points}'
  ),
  30,
  'V2 keeps one daily point for every complete historical day'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_session_metrics_v2(30) #> '{evolution,points}'
    ) as point
    where (point ->> 'sessionsScheduled')::integer < 0
      or (point ->> 'sessionsCompleted')::integer < 0
      or not point ? 'sessionsScheduled'
  ),
  'V2 exposes non-negative scheduled and completed aggregates for every day'
);

select is(
  (
    select coalesce(sum((point ->> 'sessionsScheduled')::integer), 0)
    from jsonb_array_elements(
      public.get_therapist_session_metrics_v2(30) #> '{evolution,points}'
    ) as point
  ),
  (
    select count(*)::integer
    from public.bookings as booking
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and booking.starts_at >= (
        public.get_therapist_session_metrics_v2(30)
          #>> '{meta,periodStart}'
      )::timestamptz
      and booking.starts_at < (
        public.get_therapist_session_metrics_v2(30)
          #>> '{meta,periodEnd}'
      )::timestamptz
      and booking.status in (
        'confirmed',
        'completed',
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'cancelled_by_admin',
        'cancelled_by_payment',
        'no_show_patient',
        'no_show_therapist',
        'no_show_both',
        'refunded'
      )
  ),
  'scheduled series counts only bookings that reached the therapist schedule'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_session_metrics_v2(30) #> '{evolution,points}'
    ) as point
    where (point ->> 'sessionsCompleted')::integer
      > (point ->> 'sessionsScheduled')::integer
  ),
  'a completed session is always represented in the scheduled series'
);

select * from finish();

rollback;
