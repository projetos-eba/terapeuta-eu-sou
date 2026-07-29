begin;

select plan(33);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_financial_metrics_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F2 private financial metrics read model'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_financial_metrics_v1(date,date,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the F2 private financial metrics read model'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'session_payments'
      and indexname = 'session_payments_therapist_paid_metrics_idx'
  ),
  'paid financial metrics have a dedicated therapist index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'session_payments'
      and indexname = 'session_payments_therapist_service_metrics_idx'
  ),
  'service confirmation metrics have a dedicated therapist index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'bookings'
      and indexname = 'bookings_therapist_cancel_metrics_idx'
  ),
  'cancellation metrics have a dedicated therapist booking index'
);

select is(
  public.private_therapist_finance_metric_comparison_v1(
    100,
    0,
    true,
    true
  ) ->> 'comparisonStatus',
  'division_by_zero',
  'comparison helper avoids infinite growth when previous period is zero'
);

select is(
  public.private_therapist_finance_metric_comparison_v1(
    100,
    null,
    true,
    false
  ) ->> 'comparisonStatus',
  'no_previous_data',
  'comparison helper exposes missing previous period as no_previous_data'
);

insert into public.session_refunds (
  session_payment_id,
  stripe_refund_id,
  amount_cents,
  status,
  processed_at
)
select
  id,
  're_finance_f2_partial_001',
  1000,
  'succeeded',
  now()
from public.session_payments
where booking_id = 'f2000000-0000-4000-8000-000000000002';

update public.session_payments
set
  financial_status = 'disputed',
  disputed_at = now()
where booking_id = 'f2000000-0000-4000-8000-000000000007';

update public.booking_reschedule_requests
set
  status = 'applied',
  applied_at = now(),
  resolved_at = now(),
  resolved_by_profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
where id = 'e7000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) ->> 'contractVersion',
  '1',
  'F2 metrics expose a versioned contract'
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) ->> 'metricDefinitionVersion',
  '1',
  'F2 metrics expose a metric definition version'
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{plan}',
  'premium_plus',
  'Premium Plus therapist receives the F2 metrics contract'
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{therapistProfileId}',
  'c1000000-0000-4000-8000-000000000001',
  'F2 metrics derive the therapist from auth.uid()'
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{period,isPartial}',
  'true',
  'period ending today is marked as partial'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,grossPaidCents}'
  )::integer,
  (
    select coalesce(sum(payment.gross_amount_cents), 0)::integer
    from public.session_payments as payment
    where payment.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and (coalesce(payment.paid_at, payment.created_at) at time zone
        'America/Sao_Paulo')::date
        between current_date - 29 and current_date
  ),
  'gross paid revenue comes from canonical session_payments'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,therapistNetCents}'
  )::integer,
  (
    select coalesce(sum(
      payment.gross_amount_cents
      - payment.platform_gross_commission_cents
      - case
        when payment.booking_id =
          'f2000000-0000-4000-8000-000000000002'
          then 1000
        else 0
      end
    ), 0)::integer
    from public.session_payments as payment
    where payment.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and (coalesce(payment.paid_at, payment.created_at) at time zone
        'America/Sao_Paulo')::date
        between current_date - 29 and current_date
  ),
  'net revenue subtracts TES commission and succeeded customer refunds'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,paidSessionCount}'
  )::integer,
  (
    select count(*)::integer
    from public.session_payments as payment
    where payment.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and payment.financial_status in (
        'paid',
        'partially_refunded',
        'refunded',
        'disputed'
      )
      and (coalesce(payment.paid_at, payment.created_at) at time zone
        'America/Sao_Paulo')::date
        between current_date - 29 and current_date
  ),
  'paid session count includes confirmed paid financial states'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,netAverageTicketCents}'
  )::integer,
  round((
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,therapistNetCents}'
  )::numeric / (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,paidSessionCount}'
  )::numeric)::integer,
  'net average ticket is therapist net revenue divided by paid sessions'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,completedCount}'
  )::integer,
  (
    select count(distinct booking.id)::integer
    from public.bookings as booking
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and (booking.starts_at at time zone 'America/Sao_Paulo')::date
        between current_date - 29 and current_date
      and (
        booking.status = 'completed'
        or payment.service_status in (
          'confirmed_by_patient_review',
          'confirmed_by_therapist',
          'auto_confirmed'
        )
        or payment.service_confirmed_at is not null
      )
  ),
  'completed sessions use canonical booking and service confirmation states'
);

select ok(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,completedCount}'
  )::integer
  <
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,paidSessionCount}'
  )::integer,
  'paid but not performed sessions do not inflate completed sessions'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,cancelledCount}'
  )::integer,
  (
    select count(distinct booking.id)::integer
    from public.bookings as booking
    where booking.therapist_profile_id =
      'c1000000-0000-4000-8000-000000000001'
      and booking.status in (
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'refunded'
      )
      and (booking.starts_at at time zone 'America/Sao_Paulo')::date
        between current_date - 29 and current_date
  ),
  'cancelled sessions use explicit cancellation states'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,rescheduledCount}'
  )::integer,
  1,
  'only applied reschedule requests count as rescheduled sessions'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,cancellationRate}'
  )::numeric,
  round((
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,cancelledCount}'
  )::numeric * 100 / (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,eligibleScheduledCount}'
  )::numeric, 1),
  'cancellation rate uses the documented eligible scheduled denominator'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,rescheduleRate}'
  )::numeric,
  round((
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,rescheduledCount}'
  )::numeric * 100 / (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{sessions,eligibleScheduledCount}'
  )::numeric, 1),
  'reschedule rate uses the documented eligible scheduled denominator'
);

select is(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{retention,minimumEligiblePatients}'
  )::integer,
  10,
  'retention keeps the canonical minimum sample of ten eligible patients'
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{retention,status}',
  'insufficient_data',
  'retention with incomplete observation windows stays unavailable'
);

select ok(
  jsonb_array_length(
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) -> 'revenueByTherapy'
  ) > 0,
  'revenue by therapy returns real grouped rows when payments exist'
);

select ok(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenueByTherapy,0,therapistNetAmountCents}'
  )::integer
  >=
  coalesce((
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenueByTherapy,1,therapistNetAmountCents}'
  )::integer, 0),
  'revenue by therapy is ordered by net revenue'
);

select ok(
  position(
    'patientProfileId'
    in public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    )::text
  ) = 0
  and position(
    'patient_profile_id'
    in public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    )::text
  ) = 0,
  'F2 metrics expose no patient identifier'
);

select ok(
  jsonb_array_length(
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) -> 'financialEvolution'
  ) > 0,
  'financial evolution returns realized current and previous buckets'
);

select ok(
  (
    public.get_private_therapist_financial_metrics_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{revenue,comparison,therapistNet,comparisonStatus}'
  ) in (
    'available',
    'division_by_zero',
    'no_previous_data',
    'insufficient_data'
  ),
  'revenue comparison returns a discriminated status'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{plan}',
  'premium',
  'Premium therapist can access F2 metrics'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    ''America/Sao_Paulo''
  )',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapist cannot access F2 metrics'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_private_therapist_financial_metrics_v1(
    current_date - 29,
    current_date,
    ''America/Sao_Paulo''
  )',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot access private therapist financial metrics'
);

reset role;

select is(
  (
    public.private_therapist_finance_metric_comparison_v1(
      0,
      100,
      false,
      true
    ) ->> 'comparisonStatus'
  ),
  'insufficient_data',
  'empty current period exposes insufficient_data instead of fake growth'
);

select * from finish();

rollback;
