create index if not exists session_payments_therapist_paid_metrics_idx
on public.session_payments (
  therapist_profile_id,
  financial_status,
  (coalesce(paid_at, created_at)) desc,
  patient_profile_id
);

create index if not exists session_payments_therapist_service_metrics_idx
on public.session_payments (
  therapist_profile_id,
  service_status,
  service_confirmed_at
);

create index if not exists bookings_therapist_cancel_metrics_idx
on public.bookings (
  therapist_profile_id,
  starts_at,
  status
)
where status in (
  'confirmed',
  'completed',
  'cancelled_by_patient',
  'cancelled_by_therapist',
  'no_show_patient',
  'no_show_therapist',
  'refunded'
);

create or replace function public.private_therapist_finance_metric_comparison_v1(
  p_current_value numeric,
  p_previous_value numeric,
  p_current_has_data boolean,
  p_previous_has_data boolean
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_current numeric := coalesce(p_current_value, 0);
  v_previous numeric := p_previous_value;
begin
  if not coalesce(p_current_has_data, false) then
    return jsonb_build_object(
      'currentValue', v_current,
      'previousValue', case when p_previous_has_data then v_previous else null end,
      'absoluteDelta', null,
      'percentageDelta', null,
      'comparisonStatus', 'insufficient_data'
    );
  end if;

  if not coalesce(p_previous_has_data, false) then
    return jsonb_build_object(
      'currentValue', v_current,
      'previousValue', null,
      'absoluteDelta', null,
      'percentageDelta', null,
      'comparisonStatus', 'no_previous_data'
    );
  end if;

  if coalesce(v_previous, 0) = 0 then
    return jsonb_build_object(
      'currentValue', v_current,
      'previousValue', coalesce(v_previous, 0),
      'absoluteDelta', v_current - coalesce(v_previous, 0),
      'percentageDelta', null,
      'comparisonStatus', 'division_by_zero'
    );
  end if;

  return jsonb_build_object(
    'currentValue', v_current,
    'previousValue', v_previous,
    'absoluteDelta', v_current - v_previous,
    'percentageDelta', round(((v_current - v_previous) * 100 / v_previous), 1),
    'comparisonStatus', 'available'
  );
end;
$$;

revoke all on function public.private_therapist_finance_metric_comparison_v1(
  numeric,
  numeric,
  boolean,
  boolean
) from public, anon, authenticated;

create or replace function public.get_private_therapist_financial_metrics_v1(
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
  v_period record;
  v_period_days integer;
  v_previous_period_start date;
  v_previous_period_end date;
  v_previous_starts_at timestamptz;
  v_today date;
  v_gross_paid_cents integer := 0;
  v_previous_gross_paid_cents integer := 0;
  v_therapist_net_cents integer := 0;
  v_previous_therapist_net_cents integer := 0;
  v_paid_session_count integer := 0;
  v_previous_paid_session_count integer := 0;
  v_gross_average_ticket_cents integer;
  v_net_average_ticket_cents integer;
  v_previous_net_average_ticket_cents integer;
  v_completed_count integer := 0;
  v_cancelled_count integer := 0;
  v_rescheduled_count integer := 0;
  v_eligible_scheduled_count integer := 0;
  v_cancellation_rate numeric;
  v_reschedule_rate numeric;
  v_eligible_patients integer := 0;
  v_returning_patients integer := 0;
  v_return_rate numeric;
  v_revenue_by_therapy jsonb := '[]'::jsonb;
  v_financial_evolution jsonb := '[]'::jsonb;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  if v_therapist.plan = 'free' then
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
  v_previous_starts_at := v_previous_period_start::timestamp at time zone v_period.timezone;
  v_today := (now() at time zone v_period.timezone)::date;

  with paid_rows as (
    select
      case
        when coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
          then 'current'
        else 'previous'
      end as period_key,
      payment.id,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id)
        as refunded_cents
    from public.session_payments as payment
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and coalesce(payment.paid_at, payment.created_at) >= v_previous_starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  )
  select
    coalesce(sum(gross_amount_cents) filter (where period_key = 'current'), 0)::integer,
    coalesce(sum(gross_amount_cents) filter (where period_key = 'previous'), 0)::integer,
    coalesce(sum(
      gross_amount_cents - platform_gross_commission_cents - refunded_cents
    ) filter (where period_key = 'current'), 0)::integer,
    coalesce(sum(
      gross_amount_cents - platform_gross_commission_cents - refunded_cents
    ) filter (where period_key = 'previous'), 0)::integer,
    count(*) filter (where period_key = 'current')::integer,
    count(*) filter (where period_key = 'previous')::integer
    into
      v_gross_paid_cents,
      v_previous_gross_paid_cents,
      v_therapist_net_cents,
      v_previous_therapist_net_cents,
      v_paid_session_count,
      v_previous_paid_session_count
  from paid_rows;

  v_gross_average_ticket_cents := case
    when v_paid_session_count = 0 then null
    else round(v_gross_paid_cents::numeric / v_paid_session_count)::integer
  end;
  v_net_average_ticket_cents := case
    when v_paid_session_count = 0 then null
    else round(v_therapist_net_cents::numeric / v_paid_session_count)::integer
  end;
  v_previous_net_average_ticket_cents := case
    when v_previous_paid_session_count = 0 then null
    else round(v_previous_therapist_net_cents::numeric / v_previous_paid_session_count)::integer
  end;

  select
    count(distinct booking.id) filter (
      where booking.status = 'completed'
        or payment.service_status in (
          'confirmed_by_patient_review',
          'confirmed_by_therapist',
          'auto_confirmed'
        )
        or payment.service_confirmed_at is not null
    )::integer,
    count(distinct booking.id) filter (
      where booking.status in (
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'refunded'
      )
    )::integer,
    count(distinct booking.id) filter (
      where booking.status in (
        'confirmed',
        'completed',
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'no_show_patient',
        'no_show_therapist',
        'refunded'
      )
    )::integer
    into v_completed_count, v_cancelled_count, v_eligible_scheduled_count
  from public.bookings as booking
  left join public.session_payments as payment
    on payment.booking_id = booking.id
  where booking.therapist_profile_id = v_therapist.id
    and booking.starts_at >= v_period.starts_at
    and booking.starts_at < v_period.ends_at;

  select count(distinct request.booking_id)::integer
    into v_rescheduled_count
  from public.booking_reschedule_requests as request
  join public.bookings as booking
    on booking.id = request.booking_id
  where booking.therapist_profile_id = v_therapist.id
    and request.status = 'applied'
    and request.applied_at >= v_period.starts_at
    and request.applied_at < v_period.ends_at;

  v_cancellation_rate := case
    when v_eligible_scheduled_count = 0 then null
    else round(v_cancelled_count::numeric * 100 / v_eligible_scheduled_count, 1)
  end;
  v_reschedule_rate := case
    when v_eligible_scheduled_count = 0 then null
    else round(v_rescheduled_count::numeric * 100 / v_eligible_scheduled_count, 1)
  end;

  with first_completed as (
    select
      booking.patient_profile_id,
      min(booking.starts_at) as first_completed_at
    from public.bookings as booking
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    where booking.therapist_profile_id = v_therapist.id
      and booking.starts_at >= v_period.starts_at
      and booking.starts_at < v_period.ends_at
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
    where first_completed_at + interval '90 days' <= v_period.ends_at
  ),
  returned as (
    select distinct eligible.patient_profile_id
    from eligible
    join public.session_payments as payment
      on payment.therapist_profile_id = v_therapist.id
      and payment.patient_profile_id = eligible.patient_profile_id
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and coalesce(payment.paid_at, payment.created_at) > eligible.first_completed_at
      and coalesce(payment.paid_at, payment.created_at)
        <= eligible.first_completed_at + interval '90 days'
  )
  select
    (select count(*)::integer from eligible),
    (select count(*)::integer from returned)
    into v_eligible_patients, v_returning_patients;

  v_return_rate := case
    when v_eligible_patients < 10 then null
    else round(v_returning_patients::numeric * 100 / v_eligible_patients, 1)
  end;

  with paid_rows as (
    select
      therapy.id as therapy_id,
      coalesce(therapy.name, booking.service_title_snapshot) as therapy_name_snapshot,
      payment.id,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id)
        as refunded_cents
    from public.session_payments as payment
    join public.bookings as booking
      on booking.id = payment.booking_id
    join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy
      on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
  ),
  grouped as (
    select
      therapy_id,
      max(therapy_name_snapshot) as therapy_name_snapshot,
      count(*)::integer as paid_session_count,
      sum(gross_amount_cents)::integer as gross_amount_cents,
      sum(gross_amount_cents - platform_gross_commission_cents - refunded_cents)::integer
        as therapist_net_amount_cents
    from paid_rows
    group by therapy_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'therapyId', therapy_id,
        'therapyNameSnapshot', therapy_name_snapshot,
        'paidSessionCount', paid_session_count,
        'grossAmountCents', gross_amount_cents,
        'therapistNetAmountCents', therapist_net_amount_cents,
        'averageTicketCents', case
          when paid_session_count = 0 then null
          else round(gross_amount_cents::numeric / paid_session_count)::integer
        end
      )
      order by therapist_net_amount_cents desc, therapy_name_snapshot
    ),
    '[]'::jsonb
  )
    into v_revenue_by_therapy
  from (
    select *
    from grouped
    order by therapist_net_amount_cents desc, therapy_name_snapshot
    limit 6
  ) as limited;

  with buckets as (
    select
      bucket_start::date as period_start,
      least(
        (bucket_start::date + 6),
        v_period.period_end
      )::date as period_end
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
        'grossAmountCents', coalesce((
          select sum(payment.gross_amount_cents)::integer
          from public.session_payments as payment
          where payment.therapist_profile_id = v_therapist.id
            and payment.financial_status in (
              'paid',
              'partially_refunded',
              'refunded',
              'disputed'
            )
            and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
              between bucket.period_start and bucket.period_end
        ), 0),
        'therapistNetAmountCents', coalesce((
          select sum(
            payment.gross_amount_cents
            - payment.platform_gross_commission_cents
            - public.private_therapist_finance_refunded_cents_v1(payment.id)
          )::integer
          from public.session_payments as payment
          where payment.therapist_profile_id = v_therapist.id
            and payment.financial_status in (
              'paid',
              'partially_refunded',
              'refunded',
              'disputed'
            )
            and (coalesce(payment.paid_at, payment.created_at) at time zone v_period.timezone)::date
              between bucket.period_start and bucket.period_end
        ), 0),
        'previousPeriodNetAmountCents', (
          select coalesce(sum(
            payment.gross_amount_cents
            - payment.platform_gross_commission_cents
            - public.private_therapist_finance_refunded_cents_v1(payment.id)
          ), 0)::integer
          from public.session_payments as payment
          where payment.therapist_profile_id = v_therapist.id
            and payment.financial_status in (
              'paid',
              'partially_refunded',
              'refunded',
              'disputed'
            )
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
    into v_financial_evolution
  from buckets as bucket;

  return jsonb_build_object(
    'contractVersion', 1,
    'metricDefinitionVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'period', jsonb_build_object(
      'start', v_period.period_start,
      'end', v_period.period_end,
      'previousStart', v_previous_period_start,
      'previousEnd', v_previous_period_end,
      'timezone', v_period.timezone,
      'generatedAt', now(),
      'isPartial', v_period.period_end = v_today
    ),
    'revenue', jsonb_build_object(
      'grossPaidCents', v_gross_paid_cents,
      'therapistNetCents', v_therapist_net_cents,
      'paidSessionCount', v_paid_session_count,
      'grossAverageTicketCents', v_gross_average_ticket_cents,
      'netAverageTicketCents', v_net_average_ticket_cents,
      'comparison', jsonb_build_object(
        'grossPaid', public.private_therapist_finance_metric_comparison_v1(
          v_gross_paid_cents,
          v_previous_gross_paid_cents,
          v_paid_session_count > 0,
          v_previous_paid_session_count > 0
        ),
        'therapistNet', public.private_therapist_finance_metric_comparison_v1(
          v_therapist_net_cents,
          v_previous_therapist_net_cents,
          v_paid_session_count > 0,
          v_previous_paid_session_count > 0
        ),
        'paidSessions', public.private_therapist_finance_metric_comparison_v1(
          v_paid_session_count,
          v_previous_paid_session_count,
          v_paid_session_count > 0,
          v_previous_paid_session_count > 0
        ),
        'averageTicket', public.private_therapist_finance_metric_comparison_v1(
          coalesce(v_net_average_ticket_cents, 0),
          v_previous_net_average_ticket_cents,
          v_paid_session_count > 0,
          v_previous_paid_session_count > 0
        )
      )
    ),
    'sessions', jsonb_build_object(
      'completedCount', v_completed_count,
      'cancelledCount', v_cancelled_count,
      'rescheduledCount', v_rescheduled_count,
      'eligibleScheduledCount', v_eligible_scheduled_count,
      'cancellationRate', v_cancellation_rate,
      'rescheduleRate', v_reschedule_rate
    ),
    'retention', jsonb_build_object(
      'observationWindowDays', 90,
      'minimumEligiblePatients', 10,
      'eligiblePatients', v_eligible_patients,
      'returningPatients', v_returning_patients,
      'returnRate', v_return_rate,
      'status', case
        when v_eligible_patients < 10 then 'insufficient_data'
        else 'available'
      end
    ),
    'revenueByTherapy', v_revenue_by_therapy,
    'financialEvolution', v_financial_evolution
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_metrics_v1(
  date,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.get_private_therapist_financial_metrics_v1(
  date,
  date,
  text
) to authenticated;

comment on function public.get_private_therapist_financial_metrics_v1(
  date,
  date,
  text
) is
  'Private F2 financial metrics read model for Premium and Premium Plus therapists. Uses session_payments as financial authority, derives therapist from auth.uid(), and returns deterministic aggregates only.';
