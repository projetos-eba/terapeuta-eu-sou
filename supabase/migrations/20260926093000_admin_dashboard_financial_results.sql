begin;

-- Preserve the existing dashboard contract and add only aggregated, admin-only
-- history for the visual dashboard. The original authorization guard remains
-- the first call made by the public wrapper below.
alter function public.admin_get_dashboard_v1()
  rename to private_admin_get_dashboard_v1_before_financial_results_v1;

revoke all on function public.private_admin_get_dashboard_v1_before_financial_results_v1()
  from public, anon, authenticated, service_role;

create function public.admin_get_dashboard_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_timezone text := 'America/Sao_Paulo';
  v_current_start date := ((now() at time zone 'America/Sao_Paulo')::date - 29);
  v_current_end date := (now() at time zone 'America/Sao_Paulo')::date;
  v_current_starts_at timestamptz;
  v_current_ends_at timestamptz;
  v_previous_starts_at timestamptz;
  v_previous_ends_at timestamptz;
  v_activity_series jsonb := '[]'::jsonb;
  v_financial_series jsonb := '[]'::jsonb;
  v_current_patients integer := 0;
  v_current_professionals integer := 0;
  v_current_sessions integer := 0;
  v_previous_patients integer := 0;
  v_previous_professionals integer := 0;
  v_previous_sessions integer := 0;
  v_current_payment_count integer := 0;
  v_current_gross_commission_cents integer := 0;
  v_current_stripe_fee_cents integer := 0;
  v_previous_gross_commission_cents integer := 0;
  v_previous_stripe_fee_cents integer := 0;
  v_fees_pending boolean := false;
begin
  v_payload := public.private_admin_get_dashboard_v1_before_financial_results_v1();

  v_current_starts_at := v_current_start::timestamp at time zone v_timezone;
  v_current_ends_at := (v_current_end + 1)::timestamp at time zone v_timezone;
  v_previous_starts_at := (v_current_start - 30)::timestamp at time zone v_timezone;
  v_previous_ends_at := v_current_starts_at;

  select
    (select count(*)::integer from public.patient_profiles
      where created_at >= v_current_starts_at and created_at < v_current_ends_at),
    (select count(*)::integer from public.therapist_profiles
      where created_at >= v_current_starts_at and created_at < v_current_ends_at),
    (select count(*)::integer from public.bookings
      where created_at >= v_current_starts_at and created_at < v_current_ends_at),
    (select count(*)::integer from public.patient_profiles
      where created_at >= v_previous_starts_at and created_at < v_previous_ends_at),
    (select count(*)::integer from public.therapist_profiles
      where created_at >= v_previous_starts_at and created_at < v_previous_ends_at),
    (select count(*)::integer from public.bookings
      where created_at >= v_previous_starts_at and created_at < v_previous_ends_at)
  into
    v_current_patients,
    v_current_professionals,
    v_current_sessions,
    v_previous_patients,
    v_previous_professionals,
    v_previous_sessions;

  with days as (
    select generate_series(v_current_start, v_current_end, interval '1 day')::date as day
  ),
  buckets as (
    select day, ntile(7) over (order by day) as bucket
    from days
  ),
  activity_rows as (
    select (patient.created_at at time zone v_timezone)::date as day, 'patients'::text as kind
    from public.patient_profiles as patient
    where patient.created_at >= v_current_starts_at
      and patient.created_at < v_current_ends_at
    union all
    select (therapist.created_at at time zone v_timezone)::date as day, 'professionals'::text
    from public.therapist_profiles as therapist
    where therapist.created_at >= v_current_starts_at
      and therapist.created_at < v_current_ends_at
    union all
    select (booking.created_at at time zone v_timezone)::date as day, 'sessions'::text
    from public.bookings as booking
    where booking.created_at >= v_current_starts_at
      and booking.created_at < v_current_ends_at
  ),
  grouped as (
    select
      bucket.bucket,
      min(bucket.day) as period_start,
      count(activity.kind) filter (where activity.kind = 'patients')::integer as patients,
      count(activity.kind) filter (where activity.kind = 'professionals')::integer as professionals,
      count(activity.kind) filter (where activity.kind = 'sessions')::integer as sessions
    from buckets as bucket
    left join activity_rows as activity on activity.day = bucket.day
    group by bucket.bucket
    order by bucket.bucket
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(period_start, 'DD/MM'),
        'patients', patients,
        'professionals', professionals,
        'sessions', sessions
      )
      order by bucket
    ),
    '[]'::jsonb
  )
  into v_activity_series
  from grouped;

  select
    count(*)::integer,
    coalesce(sum(payment.platform_gross_commission_cents), 0)::integer,
    coalesce(sum(coalesce(payment.stripe_fee_amount_cents, 0)), 0)::integer,
    coalesce(bool_or(payment.stripe_fee_amount_cents is null), false)
  into
    v_current_payment_count,
    v_current_gross_commission_cents,
    v_current_stripe_fee_cents,
    v_fees_pending
  from public.session_payments as payment
  where payment.financial_status in ('paid', 'partially_refunded')
    and coalesce(payment.paid_at, payment.created_at) >= v_current_starts_at
    and coalesce(payment.paid_at, payment.created_at) < v_current_ends_at;

  select
    coalesce(sum(payment.platform_gross_commission_cents), 0)::integer,
    coalesce(sum(coalesce(payment.stripe_fee_amount_cents, 0)), 0)::integer
  into
    v_previous_gross_commission_cents,
    v_previous_stripe_fee_cents
  from public.session_payments as payment
  where payment.financial_status in ('paid', 'partially_refunded')
    and coalesce(payment.paid_at, payment.created_at) >= v_previous_starts_at
    and coalesce(payment.paid_at, payment.created_at) < v_previous_ends_at;

  with days as (
    select generate_series(v_current_start, v_current_end, interval '1 day')::date as day
  ),
  buckets as (
    select day, ntile(7) over (order by day) as bucket
    from days
  ),
  financial_rows as (
    select
      (coalesce(payment.paid_at, payment.created_at) at time zone v_timezone)::date as day,
      payment.platform_gross_commission_cents,
      coalesce(payment.stripe_fee_amount_cents, 0) as stripe_fee_amount_cents
    from public.session_payments as payment
    where payment.financial_status in ('paid', 'partially_refunded')
      and coalesce(payment.paid_at, payment.created_at) >= v_current_starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_current_ends_at
  ),
  grouped as (
    select
      bucket.bucket,
      min(bucket.day) as period_start,
      coalesce(sum(financial.platform_gross_commission_cents), 0)::integer as gross_commission_cents,
      coalesce(sum(financial.stripe_fee_amount_cents), 0)::integer as stripe_fees_cents
    from buckets as bucket
    left join financial_rows as financial on financial.day = bucket.day
    group by bucket.bucket
    order by bucket.bucket
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(period_start, 'DD/MM'),
        'grossCommissionCents', gross_commission_cents,
        'netRevenueCents', gross_commission_cents - stripe_fees_cents,
        'stripeFeesCents', stripe_fees_cents
      )
      order by bucket
    ),
    '[]'::jsonb
  )
  into v_financial_series
  from grouped;

  return v_payload || jsonb_build_object(
    'activity', jsonb_build_object(
      'periodLabel', 'Últimos 30 dias',
      'status', case
        when v_current_patients + v_current_professionals + v_current_sessions > 0
          then 'available'
        else 'unavailable'
      end,
      'metrics', jsonb_build_object(
        'patients', jsonb_build_object(
          'current', v_current_patients,
          'previous', v_previous_patients
        ),
        'professionals', jsonb_build_object(
          'current', v_current_professionals,
          'previous', v_previous_professionals
        ),
        'sessions', jsonb_build_object(
          'current', v_current_sessions,
          'previous', v_previous_sessions
        )
      ),
      'series', v_activity_series
    ),
    'financial', jsonb_build_object(
      'currency', 'BRL',
      'periodLabel', 'Últimos 30 dias',
      'status', case
        when v_current_payment_count > 0 then 'available'
        else 'unavailable'
      end,
      'feesStatus', case when v_fees_pending then 'pending' else 'available' end,
      'metrics', jsonb_build_object(
        'netRevenue', jsonb_build_object(
          'currentCents', v_current_gross_commission_cents - v_current_stripe_fee_cents,
          'previousCents', v_previous_gross_commission_cents - v_previous_stripe_fee_cents
        ),
        'grossCommission', jsonb_build_object(
          'currentCents', v_current_gross_commission_cents,
          'previousCents', v_previous_gross_commission_cents
        ),
        'stripeFees', jsonb_build_object(
          'currentCents', v_current_stripe_fee_cents,
          'previousCents', v_previous_stripe_fee_cents
        )
      ),
      'series', v_financial_series
    )
  );
end;
$$;

revoke all on function public.admin_get_dashboard_v1()
  from public, anon, authenticated, service_role;

grant execute on function public.admin_get_dashboard_v1()
  to authenticated, service_role;

comment on function public.admin_get_dashboard_v1() is
  'Sanitized admin-only dashboard read model. Returns operational counts, seven aggregate activity buckets and 30-day session-finance aggregates without exposing person, payment or provider identifiers.';

comment on function public.private_admin_get_dashboard_v1_before_financial_results_v1() is
  'Private preserved implementation used by admin_get_dashboard_v1 after adding aggregate activity and financial dashboard results.';

commit;
