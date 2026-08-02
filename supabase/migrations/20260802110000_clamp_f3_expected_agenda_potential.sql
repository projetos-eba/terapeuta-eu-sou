do $$
declare
  v_definition text;
  v_updated_definition text;
  v_injection text := $injection$
  if v_active_service_count > 0 then
    v_expected_service_price_cents :=
      least(
        greatest(
          coalesce(v_expected_service_price_cents, 0),
          coalesce(v_min_service_price_cents, 0)
        ),
        coalesce(v_max_service_price_cents, 0)
      );
  else
    v_expected_service_price_cents := 0;
  end if;

$injection$;
begin
  select pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  )
    into v_definition;

  if position(v_injection in v_definition) > 0 then
    return;
  end if;

  v_updated_definition := regexp_replace(
    v_definition,
    '(and coalesce\(payment\.paid_at, payment\.created_at\) < v_period\.ends_at;\s+)(if v_forecast_window_start <= v_forecast_window_end then)',
    '\1' || v_injection || '  \2'
  );

  if v_updated_definition = v_definition then
    raise exception 'F3_ADVANCED_DASHBOARD_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;

comment on function public.get_private_therapist_advanced_financial_dashboard_v1(
  date,
  date,
  text
) is
  'Private F3 advanced financial dashboard for Premium Plus therapists. Separates realized, contracted and estimated values; projections never affect ledger, balances or payouts. Expected agenda potential is clamped to the active-service price range.';

comment on function public.private_therapist_finance_advanced_dashboard_payload_v1(
  uuid,
  public.therapist_plan,
  date,
  date,
  text
) is
  'Private F3 advanced financial dashboard payload. Expected agenda potential is clamped to the active-service price range so conservative, expected and maximum scenarios remain ordered.';
