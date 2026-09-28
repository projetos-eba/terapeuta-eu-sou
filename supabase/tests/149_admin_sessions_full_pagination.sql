begin;

select plan(16);

select ok(
  to_regprocedure('public.admin_get_sessions_module_v1(jsonb)') is not null,
  'dedicated Admin sessions read model exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.admin_get_sessions_module_v1(jsonb)',
    'EXECUTE'
  ),
  false,
  'anonymous visitors cannot execute the sessions read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_sessions_module_v1(jsonb)',
    'EXECUTE'
  ),
  'authenticated actors can invoke the contract after its Admin guard'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_get_sessions_module_v1(jsonb)',
    'EXECUTE'
  ),
  'service role retains server-side access'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_sessions_module_v1(''{}''::jsonb)',
  '42501',
  'admin permission required',
  'a non-Admin actor cannot read the sessions list'
);

reset role;

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
)
select
  ('14900000-0000-4000-8000-' || lpad(series.value::text, 12, '0'))::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'd1000000-0000-4000-8000-000000000001'::uuid,
  '2090-01-01 12:00:00+00'::timestamptz + (series.value * interval '1 day'),
  '2090-01-01 12:20:00+00'::timestamptz + (series.value * interval '1 day'),
  'America/Sao_Paulo',
  'confirmed'::public.booking_status,
  'paid'::public.payment_status
from generate_series(1, 60) as series(value);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
) values (
  '14900000-0000-4000-8000-000000000999',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2089-12-01 12:00:00+00',
  '2089-12-01 12:20:00+00',
  'America/Sao_Paulo',
  'refunded',
  'refunded'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select is(
  public.admin_get_sessions_module_v1('{"search":"14900000"}'::jsonb)
    #>> '{page,total}',
  '61',
  'search totals cover matching sessions beyond the legacy fifty-row window'
);

select is(
  jsonb_array_length(
    public.admin_get_sessions_module_v1(
      '{"search":"14900000","page":5,"pageSize":12}'::jsonb
    ) -> 'rows'
  ),
  12,
  'the fifth page remains full when more than fifty sessions match'
);

select is(
  jsonb_array_length(
    public.admin_get_sessions_module_v1(
      '{"search":"14900000","page":6,"pageSize":12}'::jsonb
    ) -> 'rows'
  ),
  1,
  'pagination reaches the record after the first sixty matches'
);

select is(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000-0000-4000-8000-000000000999","status":"refunded"}'::jsonb
  ) #>> '{rows,0,id}',
  '14900000-0000-4000-8000-000000000999',
  'status and search find an older refunded session outside the former window'
);

select is(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","sort":"oldest"}'::jsonb
  ) #>> '{rows,0,id}',
  '14900000-0000-4000-8000-000000000999',
  'oldest ordering is deterministic over the full filtered base'
);

select is(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","sort":"unsupported"}'::jsonb
  ) #>> '{filtersApplied,sort}',
  'recent',
  'unsupported sort values fail closed to the canonical recent order'
);

select is(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","pageSize":500}'::jsonb
  ) #>> '{page,pageSize}',
  '50',
  'page size remains capped at fifty records'
);

select is(
  (
    public.admin_get_sessions_module_v1('{}'::jsonb)
      #>> '{metrics,total-sessions}'
  )::integer,
  (select count(*)::integer from public.bookings),
  'global session count uses the complete canonical table'
);

select ok(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","pageSize":50}'::jsonb
  )::text not like '%meeting_url%',
  'the list does not expose meeting URLs'
);

select ok(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","pageSize":50}'::jsonb
  )::text not like '%cancellation_reason%',
  'the list does not expose cancellation reasons'
);

select is(
  public.admin_get_sessions_module_v1(
    '{"search":"14900000","page":5,"pageSize":12}'::jsonb
  ) #>> '{page,hasNext}',
  'true',
  'page metadata reports the final matching page without truncation'
);

select * from finish();

rollback;
