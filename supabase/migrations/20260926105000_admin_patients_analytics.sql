-- The Admin Clients page keeps the existing paginated list and command
-- contracts. This layer adds global, allowlisted aggregates for its charts.
-- The timestamp originally collided with an unrelated webhook migration.
-- A remote project may therefore already contain this exact wrapper. In that
-- case, do not redefine it or replay the predecessor rename.
do $migration$
begin
  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_module_v2_before_patient_analytics(text,jsonb)'
  ) is not null then
    return;
  end if;

  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_module_v2(text,jsonb)'
  ) is null then
    raise exception 'ADMIN_PATIENT_ANALYTICS_SCHEMA_DRIFT: missing %',
      'public.admin_get_operation_module_v2(text,jsonb)' using errcode = 'P0001';
  end if;

  execute
    'alter function public.admin_get_operation_module_v2(text, jsonb) '
    'rename to admin_get_operation_module_v2_before_patient_analytics';

  execute $definition$
create function public.admin_get_operation_module_v2(
  p_module text,
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_period_days integer := case
    when p_query ->> 'analyticsPeriod' = '90' then 90
    else 30
  end;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_start_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_total_before integer;
  v_series jsonb;
  v_activity_age jsonb;
  v_rows jsonb;
begin
  v_base := public.admin_get_operation_module_v2_before_patient_analytics(
    p_module,
    p_query
  );

  if p_module is distinct from 'patients' then
    return v_base;
  end if;

  v_start_date := v_today - (v_period_days - 1);
  v_start_at := v_start_date::timestamp at time zone 'America/Sao_Paulo';
  v_end_at := (v_today + 1)::timestamp at time zone 'America/Sao_Paulo';

  select count(*)::integer
  into v_total_before
  from public.patient_profiles
  where created_at < v_start_at;

  with days as (
    select generate_series(
      v_start_date,
      v_today,
      interval '1 day'
    )::date as day
  ), registrations as (
    select
      (created_at at time zone 'America/Sao_Paulo')::date as day,
      count(*)::integer as new_registrations
    from public.patient_profiles
    where created_at >= v_start_at
      and created_at < v_end_at
    group by 1
  ), cumulative as (
    select
      days.day,
      coalesce(registrations.new_registrations, 0) as new_registrations,
      (
        v_total_before + sum(coalesce(registrations.new_registrations, 0))
          over (order by days.day)
      )::integer as total_clients
    from days
    left join registrations on registrations.day = days.day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(day, 'DD/MM'),
        'newRegistrations', new_registrations,
        'totalClients', total_clients
      )
      order by day
    ),
    '[]'::jsonb
  )
  into v_series
  from cumulative;

  with activity as (
    select greatest(
      patient.updated_at,
      coalesce(bookings.last_activity_at, patient.updated_at),
      coalesce(tickets.last_activity_at, patient.updated_at)
    ) as last_activity_at
    from public.patient_profiles as patient
    left join lateral (
      select max(booking.updated_at) as last_activity_at
      from public.bookings as booking
      where booking.patient_profile_id = patient.id
    ) as bookings on true
    left join lateral (
      select max(ticket.updated_at) as last_activity_at
      from public.support_tickets as ticket
      where ticket.requester_profile_id = patient.user_id
    ) as tickets on true
  ), ages as (
    select greatest(
      0,
      v_today - (last_activity_at at time zone 'America/Sao_Paulo')::date
    ) as days_since_activity
    from activity
  )
  select jsonb_build_array(
    jsonb_build_object(
      'label', 'Até 7 dias',
      'value', count(*) filter (where days_since_activity <= 7)::integer
    ),
    jsonb_build_object(
      'label', '8 a 30 dias',
      'value', count(*) filter (
        where days_since_activity between 8 and 30
      )::integer
    ),
    jsonb_build_object(
      'label', '31 a 60 dias',
      'value', count(*) filter (
        where days_since_activity between 31 and 60
      )::integer
    ),
    jsonb_build_object(
      'label', '61 a 90 dias',
      'value', count(*) filter (
        where days_since_activity between 61 and 90
      )::integer
    ),
    jsonb_build_object(
      'label', 'Mais de 90 dias',
      'value', count(*) filter (where days_since_activity > 90)::integer
    )
  )
  into v_activity_age
  from ages;

  select coalesce(
    jsonb_agg(
      row_payload
      order by rows.ordinality
    ),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(v_base -> 'rows') with ordinality as rows(row, ordinality)
  left join public.profiles as profile
    on profile.id = (rows.row ->> 'user_id')::uuid
  left join public.patient_profiles as patient
    on patient.id = (rows.row ->> 'id')::uuid
  cross join lateral (
    select rows.row || jsonb_build_object(
      'email', profile.email,
      'phone', patient.phone,
      'phone_country_code', patient.phone_country_code
    ) as row_payload
  ) as enriched;

  v_base := jsonb_set(v_base, '{rows}', v_rows);

  return jsonb_set(
    v_base,
    '{patientAnalytics}',
    jsonb_build_object(
      'activityAge', v_activity_age,
      'periodDays', v_period_days,
      'series', v_series,
      'status', 'available'
    )
  );
end;
$$;
$definition$;
end;
$migration$;

revoke all on function public.admin_get_operation_module_v2_before_patient_analytics(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_module_v2(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_operation_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_operation_module_v2(text, jsonb) is
  'Paginated Admin operation read model with global, allowlisted analytics for Clients. The predecessor retains authorization, list filters, pagination and every non-Clients module.';
