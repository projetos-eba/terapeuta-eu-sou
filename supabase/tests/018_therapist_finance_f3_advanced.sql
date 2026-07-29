begin;

select plan(30);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_advanced_financial_dashboard_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 advanced dashboard RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_private_therapist_advanced_financial_dashboard_v1(date,date,text)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot invoke the F3 advanced dashboard RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_financial_forecast_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 forecast RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_agenda_revenue_potential_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 agenda potential RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_financial_opportunities_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 opportunities RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_retention_analytics_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 retention RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_private_therapist_financial_benchmark_v1(date,date,text)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the F3 benchmark RPC'
);

create temporary table finance_f3_ledger_count as
select count(*)::integer as value
from public.financial_ledger_entries;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) ->> 'contractVersion',
  '1',
  'F3 advanced dashboard exposes a versioned contract'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{plan}',
  'premium_plus',
  'Premium Plus therapist receives the advanced dashboard contract'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{therapistProfileId}',
  'c1000000-0000-4000-8000-000000000001',
  'F3 dashboard derives the therapist from auth.uid()'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{forecast,methodologyVersion}',
  'tes-financial-forecast-v1',
  'forecast returns an explicit methodology version'
);

select is(
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{forecast,totalEstimatedPotentialCents}'
  )::integer,
  (
    (
      public.get_private_therapist_advanced_financial_dashboard_v1(
        current_date - 29,
        current_date,
        'America/Sao_Paulo'
      ) #>> '{forecast,contractedMonthNetCents}'
    )::integer
    +
    (
      public.get_private_therapist_advanced_financial_dashboard_v1(
        current_date - 29,
        current_date,
        'America/Sao_Paulo'
      ) #>> '{forecast,estimatedOpenAgendaPotentialCents}'
    )::integer
  ),
  'forecast keeps contracted revenue and estimated agenda potential separate'
);

select ok(
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{agendaPotential,maximumPotentialCents}'
  )::integer
  >=
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{agendaPotential,expectedPotentialCents}'
  )::integer
  and
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{agendaPotential,expectedPotentialCents}'
  )::integer
  >=
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{agendaPotential,conservativePotentialCents}'
  )::integer,
  'agenda potential keeps conservative, expected and maximum scenarios ordered'
);

select ok(
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{agendaPotential,availableMinutes}'
  )::integer >= 0,
  'agenda potential never returns negative available minutes'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{agendaPotential,methodologyVersion}',
  'tes-agenda-potential-v1',
  'agenda potential returns an explicit methodology version'
);

select ok(
  jsonb_array_length(
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #> '{opportunities,items}'
  ) > 0,
  'opportunities return at least one discriminated item or explicit no-action item'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{opportunities,primary,methodologyVersion}',
  'tes-financial-opportunities-v1',
  'primary opportunity includes methodology version'
);

select ok(
  jsonb_array_length(
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #> '{insights,items}'
  ) > 0,
  'Insight TES is rule-based and backed by returned items'
);

select is(
  public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{retention,methodologyVersion}',
  'tes-retention-v1',
  'retention analytics returns an explicit methodology version'
);

select ok(
  position(
    'patientProfileId'
    in public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    )::text
  ) = 0
  and position(
    'patient_profile_id'
    in public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    )::text
  ) = 0,
  'advanced dashboard exposes no patient identifiers'
);

select ok(
  position(
    'c1000000-0000-4000-8000-000000000002'
    in public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    )::text
  ) = 0,
  'advanced dashboard exposes no other therapist identifiers'
);

select ok(
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{benchmark,status}'
  ) in (
    'available',
    'disabled',
    'insufficient_sample',
    'not_comparable'
  ),
  'benchmark returns a discriminated privacy status'
);

select ok(
  (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{benchmark,status}'
  ) <> 'available'
  or (
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) #>> '{benchmark,sampleSize}'
  )::integer >= 20,
  'benchmark is suppressed unless the therapist sample is large enough'
);

select is(
  public.get_private_therapist_financial_forecast_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{forecast,methodologyVersion}',
  'tes-financial-forecast-v1',
  'segmented forecast RPC delegates to the F3 forecast contract'
);

select is(
  public.get_private_therapist_financial_benchmark_v1(
    current_date - 29,
    current_date,
    'America/Sao_Paulo'
  ) #>> '{benchmark,minimumTherapists}',
  '20',
  'benchmark RPC declares the minimum therapist privacy threshold'
);

select ok(
  jsonb_array_length(
    public.get_private_therapist_advanced_financial_dashboard_v1(
      current_date - 29,
      current_date,
      'America/Sao_Paulo'
    ) -> 'financialEvolution'
  ) > 0,
  'advanced evolution returns realized, contracted, projected and previous series'
);

reset role;

select is(
  (select count(*)::integer from public.financial_ledger_entries),
  (select value from finance_f3_ledger_count),
  'advanced read models do not write ledger entries'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    ''America/Sao_Paulo''
  )',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Premium therapist cannot access F3 advanced financial dashboard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    ''America/Sao_Paulo''
  )',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapist cannot access F3 advanced financial dashboard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_private_therapist_advanced_financial_dashboard_v1(
    current_date - 29,
    current_date,
    ''America/Sao_Paulo''
  )',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patients cannot access private advanced therapist financial analytics'
);

reset role;

select * from finish();

rollback;
