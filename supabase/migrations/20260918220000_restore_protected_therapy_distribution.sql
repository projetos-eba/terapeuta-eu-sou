-- The session-timing v2 migration intentionally removed the minimum-sample
-- gate from the therapist-owned day/hour heatmap. Its textual replacement was
-- broader than the heatmap block and also changed therapyDistribution, which
-- must remain protected until ten completed sessions are available.
--
-- This forward-only repair scopes the replacement to therapyDistribution and
-- leaves the v2 heatmap, weekday convention and every other read-model field
-- unchanged.
do $$
declare
  v_definition text := pg_get_functiondef(
    'public.get_therapist_session_metrics_v1(integer)'::regprocedure
  );
  v_segment text;
  v_segment_start integer;
  v_segment_end_relative integer;
  v_segment_length integer;
  v_unprotected_status text := $contract$
      'status', case
        when v_current_completed = 0 then 'empty'
        else 'ready'
      end,
      'observedSample', v_current_completed,$contract$;
  v_protected_status text := $contract$
      'status', case
        when v_current_completed = 0 then 'empty'
        when v_current_completed < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,
      'observedSample', v_current_completed,$contract$;
  v_unprotected_items text := $contract$
        when v_current_completed = 0 then '[]'::jsonb
        else ($contract$;
  v_protected_items text := $contract$
        when v_current_completed < 10 then '[]'::jsonb
        else ($contract$;
begin
  v_segment_start := position(
    $contract$    'therapyDistribution', jsonb_build_object($contract$
    in v_definition
  );

  if v_segment_start = 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_THERAPY_DISTRIBUTION_NOT_FOUND';
  end if;

  v_segment_end_relative := position(
    $contract$    'cancellationReasons', jsonb_build_object($contract$
    in substring(v_definition from v_segment_start)
  );

  if v_segment_end_relative = 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_THERAPY_DISTRIBUTION_END_NOT_FOUND';
  end if;

  v_segment_length := v_segment_end_relative - 1;
  v_segment := substring(
    v_definition
    from v_segment_start
    for v_segment_length
  );

  if position(v_unprotected_status in v_segment) = 0
    or position(v_unprotected_items in v_segment) = 0
    or position($contract$'minimumSample', 10,$contract$ in v_segment) > 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_UNEXPECTED_THERAPY_DISTRIBUTION_CONTRACT';
  end if;

  v_segment := replace(
    v_segment,
    v_unprotected_status,
    v_protected_status
  );
  v_segment := replace(
    v_segment,
    v_unprotected_items,
    v_protected_items
  );

  if position(v_protected_status in v_segment) = 0
    or position(v_protected_items in v_segment) = 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_THERAPY_DISTRIBUTION_REPAIR_FAILED';
  end if;

  v_definition := overlay(
    v_definition
    placing v_segment
    from v_segment_start
    for v_segment_length
  );

  execute v_definition;
end;
$$;

comment on function public.get_therapist_session_metrics_v1(integer) is
  'MTR-4: frequency by day/hour is private own-history from the first completed session; percentages and therapy distribution remain protected by the ten-observation minimum.';
