create or replace function public.private_therapist_finance_net_cents_v1(
  p_payment public.session_payments
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    p_payment.gross_amount_cents
    - p_payment.platform_gross_commission_cents
    - public.private_therapist_finance_refunded_cents_v1(p_payment.id)
  )::integer;
$$;

revoke all on function public.private_therapist_finance_net_cents_v1(
  public.session_payments
) from public, anon, authenticated;

create or replace function public.private_therapist_finance_advanced_comparison_v1(
  p_current integer,
  p_previous integer
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'currentValue', p_current,
    'previousValue', case when p_previous is null then null else p_previous end,
    'absoluteDelta', case when p_previous is null then null else p_current - p_previous end,
    'percentageDelta', case
      when p_previous is null then null
      when p_previous = 0 then null
      else round((p_current - p_previous)::numeric * 100 / p_previous, 1)
    end,
    'comparisonStatus', case
      when p_previous is null then 'no_previous_data'
      when p_previous = 0 then 'division_by_zero'
      else 'available'
    end
  );
$$;

revoke all on function public.private_therapist_finance_advanced_comparison_v1(
  integer,
  integer
) from public, anon, authenticated;

create or replace function public.private_therapist_finance_advanced_dashboard_payload_v1(
  p_therapist_profile_id uuid,
  p_plan public.therapist_plan,
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
  v_period record;
  v_period_days integer;
  v_previous_period_start date;
  v_previous_period_end date;
  v_today date;
  v_now timestamptz := now();
  v_forecast_month_start date;
  v_forecast_month_end date;
  v_forecast_window_start date;
  v_forecast_window_end date;
  v_window_starts_at timestamptz;
  v_window_ends_at timestamptz;
  v_realized_net_cents integer := 0;
  v_contracted_future_net_cents integer := 0;
  v_contracted_month_net_cents integer := 0;
  v_active_service_count integer := 0;
  v_min_service_price_cents integer := 0;
  v_max_service_price_cents integer := 0;
  v_expected_service_price_cents integer := 0;
  v_primary_duration_minutes integer := 60;
  v_scheduled_minutes integer := 0;
  v_exception_minutes integer := 0;
  v_committed_minutes integer := 0;
  v_available_minutes integer := 0;
  v_estimated_bookable_slots integer := 0;
  v_conservative_potential_cents integer := 0;
  v_expected_potential_cents integer := 0;
  v_maximum_potential_cents integer := 0;
  v_agenda_confidence text := 'low';
  v_forecast_confidence text := 'low';
  v_paid_history_count integer := 0;
  v_cancelled_count integer := 0;
  v_eligible_patients_90 integer := 0;
  v_returning_patients_90 integer := 0;
  v_patients_without_return integer := 0;
  v_return_rate_90 numeric;
  v_median_days_to_return numeric;
  v_retention_cohorts jsonb := '[]'::jsonb;
  v_revenue_by_therapy jsonb := '[]'::jsonb;
  v_evolution jsonb := '[]'::jsonb;
  v_opportunities jsonb := '[]'::jsonb;
  v_insights jsonb := '[]'::jsonb;
  v_benchmark jsonb;
  v_benchmark_therapists integer := 0;
  v_benchmark_sessions integer := 0;
  v_benchmark_average_ticket_median numeric;
  v_benchmark_return_rate_median numeric;
  v_benchmark_occupancy_median numeric;
  v_therapist_average_ticket integer;
  v_therapist_occupancy_rate numeric;
begin
  if p_plan <> 'premium_plus' then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select *
    into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  v_period_days := (v_period.period_end - v_period.period_start) + 1;
  v_previous_period_end := v_period.period_start - 1;
  v_previous_period_start := v_previous_period_end - (v_period_days - 1);
  v_today := (v_now at time zone v_period.timezone)::date;
  v_forecast_month_start :=
    date_trunc('month', v_period.period_end::timestamp)::date;
  v_forecast_month_end :=
    (date_trunc('month', v_period.period_end::timestamp) + interval '1 month - 1 day')::date;
  v_forecast_window_start := greatest(v_today, v_forecast_month_start);
  v_forecast_window_end := v_forecast_month_end;

  if v_forecast_window_start <= v_forecast_window_end then
    v_window_starts_at :=
      v_forecast_window_start::timestamp at time zone v_period.timezone;
    v_window_ends_at :=
      (v_forecast_window_end + 1)::timestamp at time zone v_period.timezone;
  else
    v_window_starts_at := v_forecast_month_end::timestamp at time zone v_period.timezone;
    v_window_ends_at := v_window_starts_at;
  end if;

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

  select coalesce(round(sum(payment.gross_amount_cents)::numeric / nullif(count(*), 0)), v_expected_service_price_cents)::integer
    into v_expected_service_price_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = p_therapist_profile_id
    and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(payment.paid_at, payment.created_at) >= (v_period.starts_at - interval '90 days')
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

  if v_forecast_window_start <= v_forecast_window_end then
    with days as (
      select day_value::date as day_value
      from generate_series(
        v_forecast_window_start,
        v_forecast_window_end,
        interval '1 day'
      ) as series(day_value)
    ),
    rule_windows as (
      select distinct
        days.day_value,
        rule.start_time,
        rule.end_time
      from days
      join public.availability_rules as rule
        on rule.therapist_profile_id = p_therapist_profile_id
       and rule.is_active = true
       and rule.day_of_week = extract(dow from days.day_value)::integer
      where rule.service_id is null
         or exists (
          select 1
          from public.therapist_services as service
          where service.id = rule.service_id
            and service.therapist_profile_id = p_therapist_profile_id
            and service.status = 'active'
            and service.is_bookable = true
         )
    )
    select coalesce(sum(
      extract(epoch from ((day_value + end_time) - (day_value + start_time))) / 60
    ), 0)::integer
      into v_scheduled_minutes
    from rule_windows;

    select coalesce(sum(
      extract(epoch from (
        least(exception.ends_at, v_window_ends_at)
        - greatest(exception.starts_at, v_window_starts_at)
      )) / 60
    ), 0)::integer
      into v_exception_minutes
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = p_therapist_profile_id
      and exception.is_available = false
      and exception.status <> 'cancelled'
      and exception.starts_at < v_window_ends_at
      and exception.ends_at > v_window_starts_at;

    select coalesce(sum(
      extract(epoch from (
        least(booking.ends_at, v_window_ends_at)
        - greatest(booking.starts_at, v_window_starts_at)
      )) / 60
    ), 0)::integer
      into v_committed_minutes
    from public.bookings as booking
    where booking.therapist_profile_id = p_therapist_profile_id
      and booking.status in ('confirmed', 'completed')
      and booking.starts_at < v_window_ends_at
      and booking.ends_at > v_window_starts_at
      and exists (
        select 1
        from public.session_payments as payment
        where payment.booking_id = booking.id
          and payment.therapist_profile_id = p_therapist_profile_id
          and payment.financial_status in ('paid', 'partially_refunded')
      );
  end if;

  v_available_minutes :=
    greatest(v_scheduled_minutes - v_exception_minutes - v_committed_minutes, 0);
  v_primary_duration_minutes := greatest(v_primary_duration_minutes, 15);
  v_estimated_bookable_slots :=
    floor(v_available_minutes::numeric / v_primary_duration_minutes)::integer;
  v_conservative_potential_cents :=
    v_estimated_bookable_slots * coalesce(v_min_service_price_cents, 0);
  v_expected_potential_cents :=
    v_estimated_bookable_slots * coalesce(v_expected_service_price_cents, 0);
  v_maximum_potential_cents :=
    v_estimated_bookable_slots * coalesce(v_max_service_price_cents, 0);

  v_agenda_confidence := case
    when v_active_service_count = 0 or v_scheduled_minutes = 0 then 'low'
    when v_paid_history_count >= 10 then 'high'
    when v_paid_history_count >= 5 then 'medium'
    else 'low'
  end;
  v_forecast_confidence := case
    when v_agenda_confidence = 'high' and v_paid_history_count >= 10 then 'high'
    when v_active_service_count > 0 and v_scheduled_minutes > 0 then 'medium'
    else 'low'
  end;

  select coalesce(sum(public.private_therapist_finance_net_cents_v1(payment)), 0)::integer
    into v_realized_net_cents
  from public.session_payments as payment
  join public.bookings as booking
    on booking.id = payment.booking_id
  where payment.therapist_profile_id = p_therapist_profile_id
    and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and booking.status not in (
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'refunded'
    )
    and coalesce(payment.paid_at, payment.created_at) >=
      (v_forecast_month_start::timestamp at time zone v_period.timezone)
    and coalesce(payment.paid_at, payment.created_at) < least(
      v_now,
      (v_forecast_month_end + 1)::timestamp at time zone v_period.timezone
    );

  select coalesce(sum(public.private_therapist_finance_net_cents_v1(payment)), 0)::integer
    into v_contracted_future_net_cents
  from public.session_payments as payment
  join public.bookings as booking
    on booking.id = payment.booking_id
  where payment.therapist_profile_id = p_therapist_profile_id
    and payment.financial_status in ('paid', 'partially_refunded')
    and booking.status in ('confirmed', 'completed')
    and booking.starts_at >= v_now
    and booking.starts_at <
      ((v_forecast_month_end + 1)::timestamp at time zone v_period.timezone);

  v_contracted_month_net_cents :=
    v_realized_net_cents + v_contracted_future_net_cents;

  select count(distinct booking.id)::integer
    into v_cancelled_count
  from public.bookings as booking
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.status in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
    and booking.starts_at >= v_period.starts_at
    and booking.starts_at < v_period.ends_at;

  with first_completed as (
    select
      booking.patient_profile_id,
      min(booking.starts_at) as first_completed_at
    from public.bookings as booking
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    where booking.therapist_profile_id = p_therapist_profile_id
      and (
        booking.status = 'completed'
        or payment.service_status in (
          'confirmed_by_patient_review',
          'confirmed_by_therapist',
          'auto_confirmed'
        )
        or payment.service_confirmed_at is not null
      )
    group by booking.patient_profile_id
  ),
  eligible as (
    select *
    from first_completed
    where first_completed_at >= v_period.starts_at
      and first_completed_at < v_period.ends_at
      and first_completed_at + interval '90 days' <= v_now
  ),
  returns as (
    select
      eligible.patient_profile_id,
      min(coalesce(payment.paid_at, payment.created_at)) as returned_at
    from eligible
    join public.session_payments as payment
      on payment.therapist_profile_id = p_therapist_profile_id
     and payment.patient_profile_id = eligible.patient_profile_id
     and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
     and coalesce(payment.paid_at, payment.created_at) > eligible.first_completed_at
     and coalesce(payment.paid_at, payment.created_at)
       <= eligible.first_completed_at + interval '90 days'
    group by eligible.patient_profile_id
  )
  select
    (select count(*)::integer from eligible),
    (select count(*)::integer from returns),
    (select count(*)::integer from eligible left join returns using (patient_profile_id) where returns.patient_profile_id is null),
    (select percentile_cont(0.5) within group (
      order by extract(epoch from (returned_at - first_completed_at)) / 86400
    ) from eligible join returns using (patient_profile_id))
    into
      v_eligible_patients_90,
      v_returning_patients_90,
      v_patients_without_return,
      v_median_days_to_return;

  v_return_rate_90 := case
    when v_eligible_patients_90 < 10 then null
    else round(v_returning_patients_90::numeric * 100 / v_eligible_patients_90, 1)
  end;

  with first_completed as (
    select
      booking.patient_profile_id,
      date_trunc('month', min(booking.starts_at) at time zone v_period.timezone)::date
        as cohort_month,
      min(booking.starts_at) as first_completed_at
    from public.bookings as booking
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    where booking.therapist_profile_id = p_therapist_profile_id
      and (
        booking.status = 'completed'
        or payment.service_status in (
          'confirmed_by_patient_review',
          'confirmed_by_therapist',
          'auto_confirmed'
        )
        or payment.service_confirmed_at is not null
      )
    group by booking.patient_profile_id
  ),
  cohort_rows as (
    select
      first_completed.patient_profile_id,
      first_completed.cohort_month,
      first_completed.first_completed_at,
      first_completed.first_completed_at + interval '90 days' <= v_now as is_eligible,
      exists (
        select 1
        from public.session_payments as payment
        where payment.therapist_profile_id = p_therapist_profile_id
          and payment.patient_profile_id = first_completed.patient_profile_id
          and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
          and coalesce(payment.paid_at, payment.created_at) > first_completed.first_completed_at
          and coalesce(payment.paid_at, payment.created_at)
            <= first_completed.first_completed_at + interval '90 days'
      ) as has_returned
    from first_completed
    where first_completed.cohort_month between
      date_trunc('month', v_period.starts_at at time zone v_period.timezone)::date
      and date_trunc('month', v_period.ends_at at time zone v_period.timezone)::date
  ),
  grouped as (
    select
      cohort_month,
      count(*)::integer as new_patients,
      count(*) filter (where is_eligible and has_returned)::integer as returning_patients,
      count(*) filter (where is_eligible and not has_returned)::integer as without_return_patients,
      count(*) filter (where not is_eligible)::integer as censored_patients
    from cohort_rows
    group by cohort_month
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cohortMonth', cohort_month,
        'newPatients', new_patients,
        'returningPatients', returning_patients,
        'withoutReturnPatients', without_return_patients,
        'censoredPatients', censored_patients,
        'returnRate', case
          when new_patients - censored_patients <= 0 then null
          else round(returning_patients::numeric * 100 / (new_patients - censored_patients), 1)
        end
      )
      order by cohort_month
    ),
    '[]'::jsonb
  )
    into v_retention_cohorts
  from grouped;

  with current_paid as (
    select
      service.therapy_id,
      coalesce(therapy.name, booking.service_title_snapshot) as therapy_name_snapshot,
      payment.id,
      payment.gross_amount_cents,
      public.private_therapist_finance_net_cents_v1(payment) as net_cents
    from public.session_payments as payment
    join public.bookings as booking
      on booking.id = payment.booking_id
    join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy
      on therapy.id = service.therapy_id
    where payment.therapist_profile_id = p_therapist_profile_id
      and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  ),
  previous_paid as (
    select
      service.therapy_id,
      public.private_therapist_finance_net_cents_v1(payment) as net_cents
    from public.session_payments as payment
    join public.therapist_services as service
      on service.id = payment.service_id
    where payment.therapist_profile_id = p_therapist_profile_id
      and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
      and coalesce(payment.paid_at, payment.created_at) >=
        (v_previous_period_start::timestamp at time zone v_period.timezone)
      and coalesce(payment.paid_at, payment.created_at) <
        ((v_previous_period_end + 1)::timestamp at time zone v_period.timezone)
  ),
  current_grouped as (
    select
      therapy_id,
      max(therapy_name_snapshot) as therapy_name_snapshot,
      count(*)::integer as paid_session_count,
      sum(gross_amount_cents)::integer as gross_amount_cents,
      sum(net_cents)::integer as therapist_net_amount_cents
    from current_paid
    group by therapy_id
  ),
  previous_grouped as (
    select therapy_id, sum(net_cents)::integer as previous_net_cents
    from previous_paid
    group by therapy_id
  ),
  total_current as (
    select greatest(coalesce(sum(therapist_net_amount_cents), 0), 0)::numeric as total_net
    from current_grouped
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'therapyId', current_grouped.therapy_id,
        'therapyNameSnapshot', current_grouped.therapy_name_snapshot,
        'paidSessionCount', current_grouped.paid_session_count,
        'grossAmountCents', current_grouped.gross_amount_cents,
        'therapistNetAmountCents', current_grouped.therapist_net_amount_cents,
        'averageTicketCents', case
          when current_grouped.paid_session_count = 0 then null
          else round(current_grouped.gross_amount_cents::numeric / current_grouped.paid_session_count)::integer
        end,
        'revenueSharePercent', case
          when total_current.total_net <= 0 then null
          else round(current_grouped.therapist_net_amount_cents::numeric * 100 / total_current.total_net, 1)
        end,
        'trend', public.private_therapist_finance_advanced_comparison_v1(
          current_grouped.therapist_net_amount_cents,
          coalesce(previous_grouped.previous_net_cents, 0)
        )
      )
      order by current_grouped.therapist_net_amount_cents desc,
        current_grouped.therapy_name_snapshot
    ),
    '[]'::jsonb
  )
    into v_revenue_by_therapy
  from (
    select *
    from current_grouped
    order by therapist_net_amount_cents desc, therapy_name_snapshot
    limit 8
  ) as current_grouped
  cross join total_current
  left join previous_grouped
    on previous_grouped.therapy_id is not distinct from current_grouped.therapy_id;

  with buckets as (
    select
      bucket_start::date as period_start,
      least((bucket_start::date + 6), v_period.period_end)::date as period_end
    from generate_series(
      v_period.period_start,
      v_period.period_end,
      interval '7 days'
    ) as bucket(bucket_start)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'periodStart', bucket.period_start,
        'periodEnd', bucket.period_end,
        'realizedNetCents', coalesce((
          select sum(public.private_therapist_finance_net_cents_v1(payment))::integer
          from public.session_payments as payment
          where payment.therapist_profile_id = p_therapist_profile_id
            and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
            and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
              between bucket.period_start and bucket.period_end
        ), 0),
        'contractedNetCents', coalesce((
          select sum(public.private_therapist_finance_net_cents_v1(payment))::integer
          from public.session_payments as payment
          join public.bookings as booking
            on booking.id = payment.booking_id
          where payment.therapist_profile_id = p_therapist_profile_id
            and payment.financial_status in ('paid', 'partially_refunded')
            and booking.status in ('confirmed', 'completed')
            and booking.starts_at >= v_now
            and (booking.starts_at at time zone v_period.timezone)::date
              between bucket.period_start and bucket.period_end
        ), 0),
        'projectedNetCents', case
          when bucket.period_end < v_today then null
          else round(
            coalesce((
              select sum(public.private_therapist_finance_net_cents_v1(payment))::integer
              from public.session_payments as payment
              where payment.therapist_profile_id = p_therapist_profile_id
                and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
                and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
                  between bucket.period_start and bucket.period_end
            ), 0)
            + case
              when v_forecast_window_start > v_forecast_window_end then 0
              else v_expected_potential_cents::numeric
                / greatest((v_forecast_window_end - v_forecast_window_start + 1), 1)
                * greatest(
                  least(bucket.period_end, v_forecast_window_end)
                  - greatest(bucket.period_start, v_forecast_window_start)
                  + 1,
                  0
                )
            end
          )::integer
        end,
        'previousPeriodNetCents', (
          select coalesce(sum(public.private_therapist_finance_net_cents_v1(payment)), 0)::integer
          from public.session_payments as payment
          where payment.therapist_profile_id = p_therapist_profile_id
            and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
            and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
              between (
                v_previous_period_start + (bucket.period_start - v_period.period_start)
              )
              and least(
                v_previous_period_start + (bucket.period_end - v_period.period_start),
                v_previous_period_end
              )
        )
      )
      order by bucket.period_start
    ),
    '[]'::jsonb
  )
    into v_evolution
  from buckets as bucket;

  v_therapist_average_ticket := case
    when v_paid_history_count = 0 then null
    else round((
      select coalesce(sum(payment.gross_amount_cents), 0)::numeric
      from public.session_payments as payment
      where payment.therapist_profile_id = p_therapist_profile_id
        and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
        and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
        and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
    ) / v_paid_history_count)::integer
  end;

  v_therapist_occupancy_rate := case
    when v_scheduled_minutes <= 0 then null
    else round(v_committed_minutes::numeric * 100 / v_scheduled_minutes, 1)
  end;

  with therapist_stats as (
    select
      payment.therapist_profile_id,
      count(*)::integer as paid_sessions,
      round(avg(payment.gross_amount_cents))::integer as average_ticket_cents
    from public.session_payments as payment
    join public.therapist_profiles as therapist
      on therapist.id = payment.therapist_profile_id
    where therapist.status = 'approved'
      and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
    group by payment.therapist_profile_id
  )
  select
    count(*)::integer,
    coalesce(sum(paid_sessions), 0)::integer,
    percentile_cont(0.5) within group (order by average_ticket_cents)
    into
      v_benchmark_therapists,
      v_benchmark_sessions,
      v_benchmark_average_ticket_median
  from therapist_stats;

  if v_benchmark_therapists < 20 or v_benchmark_sessions < 100 then
    v_benchmark := jsonb_build_object(
      'status', 'insufficient_sample',
      'cohortDescription', null,
      'sampleSize', null,
      'minimumTherapists', 20,
      'minimumSessions', 100,
      'methodologyVersion', 'tes-financial-benchmark-v1',
      'metrics', jsonb_build_object(
        'averageTicketCents', jsonb_build_object(
          'therapistValue', v_therapist_average_ticket,
          'cohortMedian', null,
          'percentile', null
        ),
        'returnRate', jsonb_build_object(
          'therapistValue', v_return_rate_90,
          'cohortMedian', null,
          'percentile', null
        ),
        'occupancyRate', jsonb_build_object(
          'therapistValue', v_therapist_occupancy_rate,
          'cohortMedian', null,
          'percentile', null
        )
      )
    );
  else
    with therapist_stats as (
      select
        payment.therapist_profile_id,
        count(*)::integer as paid_sessions,
        round(avg(payment.gross_amount_cents))::integer as average_ticket_cents
      from public.session_payments as payment
      join public.therapist_profiles as therapist
        on therapist.id = payment.therapist_profile_id
      where therapist.status = 'approved'
        and payment.financial_status in ('paid', 'partially_refunded', 'refunded')
        and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
        and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
      group by payment.therapist_profile_id
    )
    select jsonb_build_object(
      'status', 'available',
      'cohortDescription', 'Terapeutas ativos comparáveis no período selecionado.',
      'sampleSize', v_benchmark_therapists,
      'minimumTherapists', 20,
      'minimumSessions', 100,
      'methodologyVersion', 'tes-financial-benchmark-v1',
      'metrics', jsonb_build_object(
        'averageTicketCents', jsonb_build_object(
          'therapistValue', v_therapist_average_ticket,
          'cohortMedian', round(v_benchmark_average_ticket_median)::integer,
          'percentile', (
            select round(count(*) filter (
              where average_ticket_cents <= coalesce(v_therapist_average_ticket, 0)
            )::numeric * 100 / greatest(count(*), 1), 1)
            from therapist_stats
          )
        ),
        'returnRate', jsonb_build_object(
          'therapistValue', v_return_rate_90,
          'cohortMedian', v_benchmark_return_rate_median,
          'percentile', null
        ),
        'occupancyRate', jsonb_build_object(
          'therapistValue', v_therapist_occupancy_rate,
          'cohortMedian', v_benchmark_occupancy_median,
          'percentile', null
        )
      )
    )
      into v_benchmark;
  end if;

  if v_expected_potential_cents > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(
      jsonb_build_object(
        'code', 'agenda_open_potential',
        'title', 'Potencial disponível da agenda',
        'description', 'Há horários online disponíveis que podem receber novas reservas sem alterar sua política financeira.',
        'estimatedImpactCents', case
          when v_agenda_confidence in ('medium', 'high') then v_expected_potential_cents
          else null
        end,
        'confidence', v_agenda_confidence,
        'evidence', jsonb_build_array(
          jsonb_build_object(
            'metric', 'availableMinutes',
            'value', v_available_minutes,
            'periodStart', v_forecast_window_start,
            'periodEnd', v_forecast_window_end
          ),
          jsonb_build_object(
            'metric', 'estimatedBookableSlots',
            'value', v_estimated_bookable_slots,
            'periodStart', v_forecast_window_start,
            'periodEnd', v_forecast_window_end
          )
        ),
        'action', 'open_agenda',
        'generatedAt', v_now,
        'methodologyVersion', 'tes-financial-opportunities-v1'
      )
    );
  end if;

  if v_patients_without_return > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(
      jsonb_build_object(
        'code', 'patients_without_return',
        'title', 'Pacientes sem retorno na janela observada',
        'description', 'Existe uma base elegível de pacientes que ainda não teve nova sessão paga dentro da janela de retorno.',
        'estimatedImpactCents', null,
        'confidence', case when v_eligible_patients_90 >= 10 then 'medium' else 'low' end,
        'evidence', jsonb_build_array(
          jsonb_build_object(
            'metric', 'patientsWithoutReturn',
            'value', v_patients_without_return,
            'periodStart', v_period.period_start,
            'periodEnd', v_period.period_end
          )
        ),
        'action', 'view_patients_without_return',
        'generatedAt', v_now,
        'methodologyVersion', 'tes-financial-opportunities-v1'
      )
    );
  end if;

  if v_cancelled_count > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(
      jsonb_build_object(
        'code', 'review_cancellations',
        'title', 'Cancelamentos para revisar',
        'description', 'Cancelamentos no período podem indicar horários que precisam de acompanhamento operacional.',
        'estimatedImpactCents', null,
        'confidence', 'medium',
        'evidence', jsonb_build_array(
          jsonb_build_object(
            'metric', 'cancelledSessions',
            'value', v_cancelled_count,
            'periodStart', v_period.period_start,
            'periodEnd', v_period.period_end
          )
        ),
        'action', 'review_cancellations',
        'generatedAt', v_now,
        'methodologyVersion', 'tes-financial-opportunities-v1'
      )
    );
  end if;

  if jsonb_array_length(v_opportunities) = 0 then
    v_opportunities := jsonb_build_array(
      jsonb_build_object(
        'code', 'no_actionable_opportunity',
        'title', 'Sem oportunidade financeira confiável neste período',
        'description', 'Os dados atuais não sustentam uma recomendação financeira acionável. Continue acompanhando conforme novas sessões forem confirmadas.',
        'estimatedImpactCents', null,
        'confidence', 'low',
        'evidence', '[]'::jsonb,
        'action', 'none',
        'generatedAt', v_now,
        'methodologyVersion', 'tes-financial-opportunities-v1'
      )
    );
  end if;

  v_insights := (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'code', opportunity ->> 'code',
        'title', opportunity ->> 'title',
        'explanation', opportunity ->> 'description',
        'evidence', opportunity -> 'evidence',
        'action', opportunity ->> 'action',
        'generatedAt', opportunity ->> 'generatedAt',
        'methodologyVersion', 'tes-financial-opportunities-v1'
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(v_opportunities) as item(opportunity)
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', p_therapist_profile_id,
    'plan', p_plan,
    'period', jsonb_build_object(
      'start', v_period.period_start,
      'end', v_period.period_end,
      'previousStart', v_previous_period_start,
      'previousEnd', v_previous_period_end,
      'timezone', v_period.timezone,
      'generatedAt', v_now,
      'isPartial', v_period.period_end = v_today,
      'forecastMonthStart', v_forecast_month_start,
      'forecastMonthEnd', v_forecast_month_end
    ),
    'forecast', jsonb_build_object(
      'status', case
        when v_active_service_count = 0 then 'unavailable'
        else 'available'
      end,
      'reason', case
        when v_active_service_count = 0 then 'no_active_services'
        else null
      end,
      'realizedNetCents', v_realized_net_cents,
      'contractedFutureNetCents', v_contracted_future_net_cents,
      'estimatedOpenAgendaPotentialCents', v_expected_potential_cents,
      'contractedMonthNetCents', v_contracted_month_net_cents,
      'totalEstimatedPotentialCents',
        v_contracted_month_net_cents + v_expected_potential_cents,
      'confidence', v_forecast_confidence,
      'methodologyVersion', 'tes-financial-forecast-v1'
    ),
    'agendaPotential', jsonb_build_object(
      'status', case
        when v_active_service_count = 0 then 'unavailable'
        when v_scheduled_minutes = 0 then 'insufficient_data'
        else 'available'
      end,
      'reason', case
        when v_active_service_count = 0 then 'no_active_services'
        when v_scheduled_minutes = 0 then 'no_availability_rules'
        else null
      end,
      'windowStart', v_forecast_window_start,
      'windowEnd', v_forecast_window_end,
      'availableMinutes', v_available_minutes,
      'capacityMinutes', v_scheduled_minutes,
      'committedMinutes', v_committed_minutes,
      'estimatedBookableSlots', v_estimated_bookable_slots,
      'conservativePotentialCents', v_conservative_potential_cents,
      'expectedPotentialCents', v_expected_potential_cents,
      'maximumPotentialCents', v_maximum_potential_cents,
      'occupancyRate', v_therapist_occupancy_rate,
      'methodologyVersion', 'tes-agenda-potential-v1',
      'confidence', v_agenda_confidence
    ),
    'opportunities', jsonb_build_object(
      'status', case
        when jsonb_array_length(v_opportunities) = 0 then 'unavailable'
        else 'available'
      end,
      'primary', v_opportunities -> 0,
      'items', v_opportunities,
      'methodologyVersion', 'tes-financial-opportunities-v1'
    ),
    'retention', jsonb_build_object(
      'status', case
        when v_eligible_patients_90 < 10 then 'insufficient_data'
        else 'available'
      end,
      'observationWindowsDays', jsonb_build_array(30, 60, 90),
      'primaryWindowDays', 90,
      'minimumEligiblePatients', 10,
      'eligiblePatients', v_eligible_patients_90,
      'returningPatients', v_returning_patients_90,
      'withoutReturnPatients', v_patients_without_return,
      'returnRate', v_return_rate_90,
      'medianDaysToReturn', case
        when v_median_days_to_return is null then null
        else round(v_median_days_to_return, 1)
      end,
      'cohorts', v_retention_cohorts,
      'methodologyVersion', 'tes-retention-v1'
    ),
    'benchmark', v_benchmark,
    'revenueByTherapy', v_revenue_by_therapy,
    'financialEvolution', v_evolution,
    'insights', jsonb_build_object(
      'status', 'available',
      'items', v_insights,
      'methodologyVersion', 'tes-financial-opportunities-v1'
    ),
    'methodologies', jsonb_build_array(
      jsonb_build_object(
        'version', 'tes-financial-forecast-v1',
        'description', 'Separa realizado líquido, receita contratada futura e potencial estimado da agenda sem misturar valores garantidos e estimados.'
      ),
      jsonb_build_object(
        'version', 'tes-agenda-potential-v1',
        'description', 'Deduplica janelas de disponibilidade, subtrai bloqueios e reservas pagas, usa duração média dos serviços ativos e preço médio histórico quando disponível.'
      ),
      jsonb_build_object(
        'version', 'tes-retention-v1',
        'description', 'Usa primeira sessão concluída, retorno pago em até 90 dias e censura janelas incompletas.'
      ),
      jsonb_build_object(
        'version', 'tes-financial-benchmark-v1',
        'description', 'Suprime benchmark quando há menos de 20 terapeutas elegíveis ou menos de 100 sessões agregadas.'
      ),
      jsonb_build_object(
        'version', 'tes-financial-opportunities-v1',
        'description', 'Gera oportunidades determinísticas a partir de agenda, retorno e cancelamentos sem IA generativa.'
      )
    )
  );
end;
$$;

revoke all on function public.private_therapist_finance_advanced_dashboard_payload_v1(
  uuid,
  public.therapist_plan,
  date,
  date,
  text
) from public, anon, authenticated;

create or replace function public.get_private_therapist_advanced_financial_dashboard_v1(
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
  v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  return public.private_therapist_finance_advanced_dashboard_payload_v1(
    v_therapist.id,
    v_therapist.plan,
    p_period_start,
    p_period_end,
    p_timezone
  );
end;
$$;

create or replace function public.get_private_therapist_financial_forecast_v1(
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
  v_dashboard jsonb;
begin
  v_dashboard := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_dashboard ->> 'therapistProfileId',
    'period', v_dashboard -> 'period',
    'forecast', v_dashboard -> 'forecast'
  );
end;
$$;

create or replace function public.get_private_therapist_agenda_revenue_potential_v1(
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
  v_dashboard jsonb;
begin
  v_dashboard := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_dashboard ->> 'therapistProfileId',
    'period', v_dashboard -> 'period',
    'agendaPotential', v_dashboard -> 'agendaPotential'
  );
end;
$$;

create or replace function public.get_private_therapist_financial_opportunities_v1(
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
  v_dashboard jsonb;
begin
  v_dashboard := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_dashboard ->> 'therapistProfileId',
    'period', v_dashboard -> 'period',
    'opportunities', v_dashboard -> 'opportunities',
    'insights', v_dashboard -> 'insights'
  );
end;
$$;

create or replace function public.get_private_therapist_retention_analytics_v1(
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
  v_dashboard jsonb;
begin
  v_dashboard := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_dashboard ->> 'therapistProfileId',
    'period', v_dashboard -> 'period',
    'retention', v_dashboard -> 'retention'
  );
end;
$$;

create or replace function public.get_private_therapist_financial_benchmark_v1(
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
  v_dashboard jsonb;
begin
  v_dashboard := public.get_private_therapist_advanced_financial_dashboard_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_dashboard ->> 'therapistProfileId',
    'period', v_dashboard -> 'period',
    'benchmark', v_dashboard -> 'benchmark'
  );
end;
$$;

revoke all on function public.get_private_therapist_advanced_financial_dashboard_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_financial_forecast_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_agenda_revenue_potential_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_financial_opportunities_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_retention_analytics_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.get_private_therapist_advanced_financial_dashboard_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_financial_forecast_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_agenda_revenue_potential_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_financial_opportunities_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_retention_analytics_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) to authenticated;

comment on function public.get_private_therapist_advanced_financial_dashboard_v1(
  date,
  date,
  text
) is
  'Private F3 advanced financial dashboard for Premium Plus therapists. Separates realized, contracted and estimated values; projections never affect ledger, balances or payouts.';

comment on function public.get_private_therapist_financial_benchmark_v1(
  date,
  date,
  text
) is
  'Private F3 anonymized benchmark read model. Suppresses cohort metrics unless minimum privacy sample thresholds are met.';
