-- A frequência agregada de dia/horário pertence ao histórico privado do
-- terapeuta. Ela não expõe pessoas, percentuais ou comparações e, por isso,
-- passa a ficar disponível a partir da primeira sessão concluída.
do $$
declare
  v_definition text := pg_get_functiondef(
    'public.get_therapist_session_metrics_v1(integer)'::regprocedure
  );
  v_heatmap_status_before text := $contract$
      'status', case
        when v_current_completed = 0 then 'empty'
        when v_current_completed < 10 then 'insufficient_sample'
        else 'ready'
      end,
      'minimumSample', 10,$contract$;
  v_heatmap_status_after text := $contract$
      'status', case
        when v_current_completed = 0 then 'empty'
        else 'ready'
      end,$contract$;
  v_heatmap_items_before text := $contract$
        when v_current_completed < 10 then '[]'::jsonb
        else ($contract$;
  v_heatmap_items_after text := $contract$
        when v_current_completed = 0 then '[]'::jsonb
        else ($contract$;
begin
  if position(v_heatmap_status_before in v_definition) = 0
    or position(v_heatmap_items_before in v_definition) = 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_HEATMAP_CONTRACT_NOT_FOUND';
  end if;

  if position($contract$'metricDefinitionVersion', 1,$contract$ in v_definition) = 0 then
    raise exception 'THERAPIST_SESSION_METRICS_V1_DEFINITION_VERSION_NOT_FOUND';
  end if;

  v_definition := replace(
    v_definition,
    $contract$'metricDefinitionVersion', 1,$contract$,
    $contract$'metricDefinitionVersion', 2,$contract$
  );
  v_definition := replace(
    v_definition,
    v_heatmap_status_before,
    v_heatmap_status_after
  );
  v_definition := replace(
    v_definition,
    v_heatmap_items_before,
    v_heatmap_items_after
  );

  -- PostgreSQL DOW uses the canonical UI convention: Sunday = 0, Saturday = 6.
  v_definition := replace(
    v_definition,
    'isodow from booking.starts_at at time zone v_timezone',
    'dow from booking.starts_at at time zone v_timezone'
  );

  execute v_definition;
end;
$$;

comment on function public.get_therapist_session_metrics_v1(integer) is
  'MTR-4: métricas privadas de sessões. A frequência agregada por dia/horário usa a definição 2 e aparece desde a primeira sessão concluída; percentuais e distribuições continuam protegidos por amostra mínima de 10.';
