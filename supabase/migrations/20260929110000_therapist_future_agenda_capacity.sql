-- Agenda futura compartilhada entre Métricas e Financeiro.
--
-- A agenda é uma capacidade do terapeuta, não a soma das agendas de cada
-- serviço. Esta versão une todos os intervalos antes de contabilizá-los e
-- mantém uma reserva já protegida no denominador mesmo se a disponibilidade
-- posterior for removida.

create or replace function public.private_therapist_agenda_capacity_v2(
  p_therapist_profile_id uuid,
  p_window_starts_at timestamptz,
  p_window_ends_at timestamptz,
  p_timezone text
)
returns table (
  offered_minutes integer,
  reserved_minutes integer,
  available_minutes integer,
  capacity_minutes integer,
  reserved_session_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window tstzrange;
  v_local_start date;
  v_local_end date;
  v_offered tstzmultirange := '{}'::tstzmultirange;
  v_reserved tstzmultirange := '{}'::tstzmultirange;
  v_available tstzmultirange := '{}'::tstzmultirange;
  v_capacity tstzmultirange := '{}'::tstzmultirange;
  v_service_offered tstzmultirange;
  v_service_blocked tstzmultirange;
  v_service record;
begin
  if p_therapist_profile_id is null
    or p_window_starts_at is null
    or p_window_ends_at is null
    or p_window_ends_at <= p_window_starts_at
    or p_window_ends_at - p_window_starts_at > interval '32 days'
    or not public.is_valid_timezone_v1(p_timezone)
  then
    raise exception 'invalid_future_agenda_capacity_range' using errcode = '22023';
  end if;

  v_window := pg_catalog.tstzrange(
    p_window_starts_at,
    p_window_ends_at,
    '[)'
  );
  v_local_start := (p_window_starts_at at time zone p_timezone)::date;
  v_local_end := ((p_window_ends_at - interval '1 microsecond') at time zone p_timezone)::date;

  for v_service in
    select service.id
    from public.therapist_services as service
    join public.therapies as therapy
      on therapy.id = service.therapy_id
    where service.therapist_profile_id = p_therapist_profile_id
      and service.status = 'active'
      and service.is_bookable = true
      and service.delivery_format = 'online'
      and service.online_only = true
      and therapy.status in ('published', 'active')
      and therapy.is_available_for_services = true
  loop
    with days as (
      select day_value::date as day_value
      from pg_catalog.generate_series(
        v_local_start,
        v_local_end,
        interval '1 day'
      ) as generated(day_value)
    ), source_windows as (
      select pg_catalog.tstzrange(
        (days.day_value + rule.start_time) at time zone p_timezone,
        (days.day_value + rule.end_time) at time zone p_timezone,
        '[)'
      ) as range_value
      from days
      join public.availability_rules as rule
        on rule.therapist_profile_id = p_therapist_profile_id
       and (rule.service_id is null or rule.service_id = v_service.id)
       and rule.is_active
       and rule.day_of_week = extract(dow from days.day_value)::integer

      union all

      select pg_catalog.tstzrange(
        exception.starts_at,
        exception.ends_at,
        '[)'
      ) as range_value
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = p_therapist_profile_id
        and exception.is_available
        and coalesce(exception.status, 'active') = 'active'
        and (exception.service_id is null or exception.service_id = v_service.id)
        and exception.starts_at < upper(v_window)
        and exception.ends_at > lower(v_window)
    )
    select coalesce(
      range_agg(source.range_value * v_window),
      '{}'::tstzmultirange
    )
      into v_service_offered
    from source_windows as source
    where source.range_value && v_window;

    select coalesce(
      range_agg(
        pg_catalog.tstzrange(
          exception.starts_at,
          exception.ends_at,
          '[)'
        ) * v_window
      ),
      '{}'::tstzmultirange
    )
      into v_service_blocked
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = p_therapist_profile_id
      and not exception.is_available
      and coalesce(exception.status, 'active') = 'active'
      and (exception.service_id is null or exception.service_id = v_service.id)
      and exception.starts_at < upper(v_window)
      and exception.ends_at > lower(v_window);

    -- Range addition keeps partially and fully overlapping service windows as
    -- one therapist capacity. A scoped exception only removes its own service
    -- contribution, so coverage from another service remains available.
    v_offered := v_offered + (v_service_offered - v_service_blocked);
  end loop;

  -- booking.occupied_during is the immutable scheduling snapshot and includes
  -- the buffers that continue to protect the therapist's agenda. The booking
  -- state is the canonical schedule block: raw holds never reach bookings and
  -- terminal/rebooked states are deliberately absent from this list.
  select coalesce(
    range_agg(booking.occupied_during * v_window),
    '{}'::tstzmultirange
  ), count(distinct booking.id)::integer
    into v_reserved, reserved_session_count
  from public.bookings as booking
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.status in ('pending_payment', 'confirmed', 'completed')
    and booking.occupied_during && v_window;

  v_available := v_offered - v_reserved;
  -- A later availability edit must not erase a booking that was already
  -- accepted. Including protected reservations makes the denominator truthful
  -- and prevents occupancy from exceeding 100%.
  v_capacity := v_offered + v_reserved;

  select coalesce(sum(
    extract(epoch from (upper(segment.range_value) - lower(segment.range_value))) / 60
  ), 0)::integer
    into offered_minutes
  from unnest(v_offered) as segment(range_value);

  select coalesce(sum(
    extract(epoch from (upper(segment.range_value) - lower(segment.range_value))) / 60
  ), 0)::integer
    into reserved_minutes
  from unnest(v_reserved) as segment(range_value);

  select coalesce(sum(
    extract(epoch from (upper(segment.range_value) - lower(segment.range_value))) / 60
  ), 0)::integer
    into available_minutes
  from unnest(v_available) as segment(range_value);

  select coalesce(sum(
    extract(epoch from (upper(segment.range_value) - lower(segment.range_value))) / 60
  ), 0)::integer
    into capacity_minutes
  from unnest(v_capacity) as segment(range_value);

  reserved_session_count := coalesce(reserved_session_count, 0);
  return next;
end;
$$;

revoke all on function public.private_therapist_agenda_capacity_v2(
  uuid, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.private_therapist_agenda_capacity_v2(
  uuid, timestamptz, timestamptz, text
) to service_role;

comment on function public.private_therapist_agenda_capacity_v2(
  uuid, timestamptz, timestamptz, text
) is
  'Service-only operational agenda capacity. Unions active online-service availability, applies scoped exceptions, and counts future schedule-blocking booking snapshots including immutable buffers.';

create or replace function public.private_therapist_future_agenda_summary_v1(
  p_therapist_profile_id uuid,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_local_start date;
  v_local_end date;
  v_window_ends_at timestamptz;
  v_capacity record;
  v_active_service_count integer := 0;
begin
  if p_therapist_profile_id is null or not public.is_valid_timezone_v1(p_timezone) then
    raise exception 'invalid_future_agenda_summary' using errcode = '22023';
  end if;

  -- The current local date plus the following 29 dates: exactly 30 local
  -- calendar days. The first day starts now, while the final one ends at its
  -- local midnight boundary.
  v_local_start := (v_now at time zone p_timezone)::date;
  v_local_end := v_local_start + 29;
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
    v_now,
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

revoke all on function public.private_therapist_future_agenda_summary_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.private_therapist_future_agenda_summary_v1(uuid, text)
  to service_role;

comment on function public.private_therapist_future_agenda_summary_v1(uuid, text) is
  'Service-only 30-local-day aggregate shared by therapist finance and metrics. It exposes no booking or patient details.';

-- Keep v2's existing 90-day callers compatible and correct the narrower
-- dashboard route that already promises 30 or 60 complete historical days.
do $migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.get_therapist_occupancy_metrics_v2(uuid,text,integer)'::regprocedure
  ) into v_definition;

  v_updated_definition := pg_catalog.regexp_replace(
    v_definition,
    'p_period_days[[:space:]]+not[[:space:]]+in[[:space:]]+[(]30,[[:space:]]*90[)]',
    'p_period_days not in (30, 60, 90)',
    'g'
  );

  if v_updated_definition = v_definition then
    raise exception 'THERAPIST_METRICS_OCCUPANCY_V2_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$migration$;

-- Dashboard v3 delegates to dashboard v2 before replacing only its discovery
-- metadata. Keep v2 backward-compatible at 90 days while accepting the 60-day
-- period already promised by the v3/v4 route.
do $migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.get_therapist_metrics_dashboard_v2(integer)'::regprocedure
  ) into v_definition;

  v_updated_definition := pg_catalog.regexp_replace(
    v_definition,
    'p_period_days[[:space:]]+not[[:space:]]+in[[:space:]]+[(]30,[[:space:]]*90[)]',
    'p_period_days not in (30, 60, 90)',
    'g'
  );

  if v_updated_definition = v_definition then
    raise exception 'THERAPIST_METRICS_DASHBOARD_V2_DEFINITION_DRIFT'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$migration$;

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

  v_agenda := public.private_therapist_future_agenda_summary_v1(
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
    -- committedMinutes remains for clients of v1/v2 that label this value
    -- differently; reservedMinutes is the explicit v3 vocabulary.
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

revoke all on function public.get_private_therapist_advanced_financial_dashboard_v3(
  date, date, text
) from public, anon;
grant execute on function public.get_private_therapist_advanced_financial_dashboard_v3(
  date, date, text
) to authenticated;

comment on function public.get_private_therapist_advanced_financial_dashboard_v3(date, date, text) is
  'Premium Plus financial dashboard v3. Preserves v2 realized/contracted financial readings and replaces agenda potential with the shared future 30-local-day operational aggregate.';

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
  v_future_agenda := public.private_therapist_future_agenda_summary_v1(
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

revoke all on function public.get_therapist_metrics_dashboard_v4(integer)
  from public, anon;
grant execute on function public.get_therapist_metrics_dashboard_v4(integer)
  to authenticated;

comment on function public.get_therapist_metrics_dashboard_v4(integer) is
  'Authenticated therapist metrics dashboard v4. Historical indicators retain the selected 30/60 complete-day period; futureAgenda is a separate 30-local-day operational capacity aggregate.';
