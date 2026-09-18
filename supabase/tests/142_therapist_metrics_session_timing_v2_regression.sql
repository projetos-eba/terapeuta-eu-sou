begin;

select plan(8);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_session_metrics_v1(30)
    ->> 'metricDefinitionVersion',
  '2',
  'session metrics keep the private timing definition v2'
);

select is(
  public.get_therapist_session_metrics_v1(30) -> 'heatmap'
    ? 'minimumSample',
  false,
  'private day/hour frequency has no minimum-sample gate'
);

select is(
  public.get_therapist_session_metrics_v1(30)
    #>> '{heatmap,status}',
  case
    when (
      public.get_therapist_session_metrics_v1(30)
        #>> '{heatmap,observedSample}'
    )::integer = 0 then 'empty'
    else 'ready'
  end,
  'private day/hour frequency is ready from the first completed session'
);

select is(
  public.get_therapist_session_metrics_v1(30)
    #>> '{therapyDistribution,minimumSample}',
  '10',
  'therapy distribution retains the ten-session privacy threshold'
);

select is(
  public.get_therapist_session_metrics_v1(30)
    #>> '{therapyDistribution,status}',
  case
    when (
      public.get_therapist_session_metrics_v1(30)
        #>> '{therapyDistribution,observedSample}'
    )::integer = 0 then 'empty'
    when (
      public.get_therapist_session_metrics_v1(30)
        #>> '{therapyDistribution,observedSample}'
    )::integer < 10 then 'insufficient_sample'
    else 'ready'
  end,
  'therapy distribution status follows the protected collection contract'
);

select ok(
  (
    public.get_therapist_session_metrics_v1(30)
      #>> '{therapyDistribution,observedSample}'
  )::integer < 10,
  'the regression fixture exercises the protected below-threshold state'
);

select is(
  jsonb_array_length(
    public.get_therapist_session_metrics_v1(30)
      #> '{therapyDistribution,items}'
  ),
  0,
  'therapy distribution exposes no items below the privacy threshold'
);

select ok(
  jsonb_array_length(
    public.get_therapist_session_metrics_v1(30) -> 'heatmap' -> 'items'
  ) > 0,
  'private frequency remains available for the same below-threshold fixture'
);

select * from finish();

rollback;
