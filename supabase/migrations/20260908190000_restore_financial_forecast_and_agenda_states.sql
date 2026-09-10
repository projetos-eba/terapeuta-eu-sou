-- Restore the F3 input queries that were inadvertently removed when the
-- service-aware agenda capacity helper was introduced. Revenue already paid
-- or scheduled is independent from whether there is availability left to
-- estimate; each remains explicit in the private dashboard contract.

do $$
declare
  v_definition text;
  v_restored_definition text;
  v_updated_definition text;
  v_start_marker text := '  v_forecast_window_end := v_forecast_month_end;';
  v_end_marker text := '  v_primary_duration_minutes := greatest(v_primary_duration_minutes, 15);';
  v_start integer;
  v_end integer;
  v_forecast_state_before text := $forecast_before$
    'forecast', jsonb_build_object(
      'status', case
        when v_active_service_count = 0 then 'unavailable'
        else 'available'
      end,
      'reason', case
        when v_active_service_count = 0 then 'no_active_services'
        else null
      end,
$forecast_before$;
  v_forecast_state_after text := $forecast_after$
    'forecast', jsonb_build_object(
      'status', 'available',
      'reason', null,
$forecast_after$;
begin
  select pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, chr(13), '');
  v_start := strpos(v_definition, v_start_marker);
  v_end := strpos(v_definition, v_end_marker);

  if v_start = 0 or v_end = 0 or v_end <= v_start then
    raise exception 'THERAPIST_FINANCE_F3_RESTORE_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  v_restored_definition :=
    substr(v_definition, 1, v_start - 1)
    || $restored_block$
  v_forecast_window_end := v_forecast_month_end;

  select
    count(*)::integer,
    coalesce(min(service.price_cents), 0)::integer,
    coalesce(max(service.price_cents), 0)::integer,
    coalesce(round(avg(service.price_cents)), 0)::integer,
    coalesce(round(avg(service.duration_minutes)), 60)::integer
    into
      v_active_service_count,
      v_min_service_price_cents,
      v_max_service_price_cents,
      v_expected_service_price_cents,
      v_primary_duration_minutes
  from public.therapist_services as service
  join public.therapies as therapy
    on therapy.id = service.therapy_id
  where service.therapist_profile_id = p_therapist_profile_id
    and service.status = 'active'
    and service.is_bookable = true
    and service.delivery_format = 'online'
    and service.online_only = true
    and therapy.status in ('published', 'active')
    and therapy.is_available_for_services = true;

  select count(*)::integer
    into v_paid_history_count
  from public.session_payments as payment
  where payment.therapist_profile_id = p_therapist_profile_id
    and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

  select coalesce(
    round(sum(payment.gross_amount_cents)::numeric / nullif(count(*), 0)),
    v_expected_service_price_cents
  )::integer
    into v_expected_service_price_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = p_therapist_profile_id
    and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(payment.paid_at, payment.created_at) >= (v_period.starts_at - interval '90 days')
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

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

  if v_forecast_window_start <= v_forecast_window_end then
    select
      capacity.scheduled_minutes,
      capacity.committed_minutes,
      capacity.available_minutes
      into
        v_scheduled_minutes,
        v_committed_minutes,
        v_available_minutes
    from public.private_therapist_agenda_capacity_v1(
      p_therapist_profile_id,
      v_forecast_window_start,
      v_forecast_window_end,
      v_period.timezone
    ) as capacity;
  end if;
$restored_block$
    || substr(v_definition, v_end, length(v_end_marker))
    || substr(v_definition, v_end + length(v_end_marker));

  if v_restored_definition = v_definition
    or v_restored_definition not like '%from public.therapist_services as service%'
    or v_restored_definition not like '%from public.session_payments as payment%'
    or v_restored_definition not like '%private_therapist_agenda_capacity_v1%'
  then
    raise exception 'THERAPIST_FINANCE_F3_RESTORE_FAILED'
      using errcode = 'P0001';
  end if;

  v_updated_definition := replace(
    v_restored_definition,
    v_forecast_state_before,
    v_forecast_state_after
  );

  if v_updated_definition = v_restored_definition then
    raise exception 'THERAPIST_FINANCE_F3_FORECAST_STATE_PATCH_FAILED'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;

comment on function public.private_therapist_finance_advanced_dashboard_payload_v1(
  uuid,
  public.therapist_plan,
  date,
  date,
  text
) is
  'Private F3 advanced dashboard payload. Revenue already realized and sessions already paid for the month remain visible independently from agenda-potential availability; estimated potential stays separate from guaranteed revenue.';
