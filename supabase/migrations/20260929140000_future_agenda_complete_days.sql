-- A agenda futura é uma visão de planejamento: ela sempre começa no próximo
-- dia local completo, sem misturar as poucas horas restantes do dia corrente.
-- V1 permanece disponível para consumidores internos legados.

create or replace function public.private_therapist_future_agenda_summary_v2(
  p_therapist_profile_id uuid,
  p_timezone text,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_as_of timestamptz := coalesce(p_as_of, now());
  v_local_start date;
  v_local_end date;
  v_window_starts_at timestamptz;
  v_window_ends_at timestamptz;
  v_capacity record;
  v_active_service_count integer := 0;
begin
  if p_therapist_profile_id is null or not public.is_valid_timezone_v1(p_timezone) then
    raise exception 'invalid_future_agenda_summary' using errcode = '22023';
  end if;

  -- Tomorrow plus the following 29 local dates: exactly 30 complete local
  -- calendar days. The explicit local-midnight boundaries keep the aggregate
  -- stable throughout the current day and remain timezone-safe.
  v_local_start := (v_as_of at time zone p_timezone)::date + 1;
  v_local_end := v_local_start + 29;
  v_window_starts_at := v_local_start::timestamp at time zone p_timezone;
  v_window_ends_at := (v_local_end + 1)::timestamp at time zone p_timezone;

  select count(*)::integer
    into v_active_service_count
  from public.therapist_services as service
  join public.therapies as therapy on therapy.id = service.therapy_id
  where service.therapist_profile_id = p_therapist_profile_id
    and service.status = 'active'
    and service.is_bookable = true
    and service.delivery_format = 'online'
    and service.online_only = true
    and therapy.status in ('published', 'active')
    and therapy.is_available_for_services = true;

  select * into v_capacity
  from public.private_therapist_agenda_capacity_v2(
    p_therapist_profile_id,
    v_window_starts_at,
    v_window_ends_at,
    p_timezone
  );

  return jsonb_build_object(
    'status', case
      when v_active_service_count = 0 then 'unavailable'
      when v_capacity.capacity_minutes = 0 then 'insufficient_data'
      else 'available'
    end,
    'reason', case
      when v_active_service_count = 0 then 'no_active_services'
      when v_capacity.capacity_minutes = 0 then 'no_availability'
      else null
    end,
    'windowStart', v_local_start,
    'windowEnd', v_local_end,
    'capacityMinutes', v_capacity.capacity_minutes,
    'reservedMinutes', v_capacity.reserved_minutes,
    'availableMinutes', v_capacity.available_minutes,
    'reservedSessionCount', v_capacity.reserved_session_count,
    'occupancyRate', case
      when v_capacity.capacity_minutes = 0 then null
      else round(
        least(v_capacity.reserved_minutes, v_capacity.capacity_minutes)::numeric
        * 100 / v_capacity.capacity_minutes,
        1
      )
    end
  );
end;
$$;

revoke all on function public.private_therapist_future_agenda_summary_v2(
  uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.private_therapist_future_agenda_summary_v2(
  uuid, text, timestamptz
) to service_role;

comment on function public.private_therapist_future_agenda_summary_v2(
  uuid, text, timestamptz
) is
  'Service-only aggregate shared by therapist finance and metrics. It covers 30 complete local days beginning at the next local midnight and exposes no booking or patient details.';

create or replace function public.get_private_therapist_advanced_financial_dashboard_v3(
  p_period_start date default null,
  p_period_end date default null,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_agenda jsonb;
  v_active_service_count integer := 0;
  v_min_service_price_cents integer := 0;
  v_max_service_price_cents integer := 0;
  v_expected_service_price_cents integer := 0;
  v_average_duration_minutes integer := 60;
  v_paid_history_count integer := 0;
  v_slots integer := 0;
  v_confidence text := 'low';
begin
  v_payload := public.get_private_therapist_advanced_financial_dashboard_v2(
    p_period_start, p_period_end, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();
  select * into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start, p_period_end, p_timezone
  );

  v_agenda := public.private_therapist_future_agenda_summary_v2(
    v_therapist.id,
    v_period.timezone
  );

  select
    count(*)::integer,
    coalesce(min(service.price_cents), 0)::integer,
    coalesce(max(service.price_cents), 0)::integer,
    coalesce(round(avg(service.price_cents)), 0)::integer,
    greatest(coalesce(round(avg(service.duration_minutes)), 60)::integer, 15)
    into
      v_active_service_count,
      v_min_service_price_cents,
      v_max_service_price_cents,
      v_expected_service_price_cents,
      v_average_duration_minutes
  from public.therapist_services as service
  join public.therapies as therapy on therapy.id = service.therapy_id
  where service.therapist_profile_id = v_therapist.id
    and service.status = 'active'
    and service.is_bookable = true
    and service.delivery_format = 'online'
    and service.online_only = true
    and therapy.status in ('published', 'active')
    and therapy.is_available_for_services = true;

  select count(*)::integer,
    coalesce(
      round(sum(payment.gross_amount_cents)::numeric / nullif(count(*), 0)),
      v_expected_service_price_cents
    )::integer
    into v_paid_history_count, v_expected_service_price_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at - interval '90 days'
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

  v_slots := floor(
    coalesce((v_agenda ->> 'availableMinutes')::integer, 0)::numeric
    / v_average_duration_minutes
  )::integer;
  v_confidence := case
    when v_active_service_count = 0
      or coalesce((v_agenda ->> 'capacityMinutes')::integer, 0) = 0 then 'low'
    when v_paid_history_count >= 10 then 'high'
    when v_paid_history_count >= 5 then 'medium'
    else 'low'
  end;

  v_agenda := v_agenda || jsonb_build_object(
    'committedMinutes', coalesce((v_agenda ->> 'reservedMinutes')::integer, 0),
    'estimatedBookableSlots', v_slots,
    'conservativePotentialCents', v_slots * v_min_service_price_cents,
    'expectedPotentialCents', v_slots * v_expected_service_price_cents,
    'maximumPotentialCents', v_slots * v_max_service_price_cents,
    'confidence', v_confidence,
    'methodologyVersion', 'tes-agenda-potential-v2'
  );

  return jsonb_set(
    v_payload || jsonb_build_object('contractVersion', 3),
    '{agendaPotential}',
    v_agenda,
    true
  );
end;
$$;

comment on function public.get_private_therapist_advanced_financial_dashboard_v3(date, date, text) is
  'Premium Plus financial dashboard v3. It preserves v2 realized and contracted readings and uses the shared 30-complete-local-day agenda aggregate beginning tomorrow for its operational potential.';

create or replace function public.get_therapist_metrics_dashboard_v4(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dashboard jsonb;
  v_profile_id uuid;
  v_timezone text;
  v_future_agenda jsonb;
begin
  if p_period_days not in (30, 60) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_dashboard := public.get_therapist_metrics_dashboard_v3(p_period_days);
  v_profile_id := (v_dashboard #>> '{therapist,profileId}')::uuid;
  v_timezone := v_dashboard #>> '{meta,timezone}';
  v_future_agenda := public.private_therapist_future_agenda_summary_v2(
    v_profile_id,
    v_timezone
  );

  return v_dashboard || jsonb_build_object(
    'contractVersion', 4,
    'metricDefinitionVersion', 4,
    'futureAgenda', v_future_agenda
  );
end;
$$;

comment on function public.get_therapist_metrics_dashboard_v4(integer) is
  'Authenticated therapist metrics dashboard v4. Historical indicators retain the selected 30/60 complete-day period; futureAgenda is a separate 30-complete-local-day operational aggregate beginning tomorrow.';
