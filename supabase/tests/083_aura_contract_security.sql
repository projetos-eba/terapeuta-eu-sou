begin;

select plan(34);

insert into public.aura_recommendations (
  id,
  therapist_profile_id,
  source_rule_key,
  title,
  body,
  plan_required,
  context,
  priority,
  expires_at,
  is_active,
  status,
  rule_version,
  evidence,
  action_route_key,
  generated_at
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Janela de dez dias',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    90,
    now() + interval '7 days',
    true,
    'active',
    1,
    jsonb_build_object('source', 'runtime', 'periodDays', 30),
    'reviews',
    now() - interval '10 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Janela de sessenta dias',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    89,
    now() + interval '7 days',
    true,
    'active',
    1,
    jsonb_build_object('source', 'runtime', 'periodDays', 90),
    'reviews',
    now() - interval '60 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Janela de um ano',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    88,
    now() + interval '7 days',
    true,
    'active',
    1,
    jsonb_build_object('source', 'runtime'),
    'reviews',
    now() - interval '365 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Recomendação expirada',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    87,
    now() - interval '1 hour',
    true,
    'active',
    1,
    jsonb_build_object('source', 'runtime'),
    'reviews',
    now() - interval '5 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Recomendação inativa',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    86,
    now() + interval '7 days',
    false,
    'active',
    1,
    jsonb_build_object('source', 'runtime'),
    'reviews',
    now() - interval '5 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    'aura.reviews.pending_reply.v1',
    'Recomendação descartada',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    85,
    now() + interval '7 days',
    false,
    'dismissed',
    1,
    jsonb_build_object('source', 'runtime'),
    'reviews',
    now() - interval '5 days'
  ),
  (
    'e1000000-0000-4000-8000-000000000007',
    'c1000000-0000-4000-8000-000000000002',
    'aura.reviews.pending_reply.v1',
    'Recomendação de outro terapeuta',
    'Recomendação agregada de teste',
    'premium_plus',
    jsonb_build_object('source', 'runtime'),
    84,
    now() + interval '7 days',
    true,
    'active',
    1,
    jsonb_build_object('source', 'runtime'),
    'reviews',
    now() - interval '10 days'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select ok(
  (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
    jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000001')),
  'generated_at 10 days ago appears in the 30-day window'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000002'))
  ),
  'generated_at 60 days ago does not appear in the 30-day window'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000003'))
  ),
  'generated_at 365 days ago does not appear in the 30-day window'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000004'))
  ),
  'expired persisted recommendation does not appear'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000005'))
  ),
  'inactive persisted recommendation does not appear'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000006'))
  ),
  'dismissed persisted recommendation does not appear'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(30)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000007'))
  ),
  'recommendation belonging to another therapist never appears'
);

select ok(
  (public.get_therapist_aura_signals_v2(90)->'recommendations') @>
    jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000001')),
  'generated_at 10 days ago appears in the 90-day window'
);

select ok(
  (public.get_therapist_aura_signals_v2(90)->'recommendations') @>
    jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000002')),
  'generated_at 60 days ago appears in the 90-day window'
);

select ok(
  not (
    (public.get_therapist_aura_signals_v2(90)->'recommendations') @>
      jsonb_build_array(jsonb_build_object('id', 'e1000000-0000-4000-8000-000000000003'))
  ),
  'generated_at 365 days ago does not appear in the 90-day window'
);

select is(
  (public.get_therapist_aura_signals_v2(30)#>>'{signals,reviews,pendingReplyCount}')::integer,
  5,
  'pending reviews in the 30-day window are period-scoped'
);

select is(
  (public.get_therapist_aura_signals_v2(90)#>>'{signals,reviews,pendingReplyCount}')::integer,
  6,
  'pending reviews in the 90-day window include the older pending review'
);

select is(
  (public.get_therapist_aura_signals_v2(30)#>>'{signals,reviews,windowDays}')::integer,
  30,
  '30-day response declares the same review window'
);

select is(
  (public.get_therapist_aura_signals_v2(90)#>>'{signals,reviews,windowDays}')::integer,
  90,
  '90-day response declares the same review window'
);

select throws_ok(
  format(
    'select public.dismiss_therapist_aura_signal_v2(%L, %L, %L, %L)',
    'aura.fake.rule.v1:' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz,
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz,
    'd1000000-0000-4000-8000-000000000001'
  ),
  'P0002',
  'RECOMMENDATION_NOT_FOUND',
  'invented rule key is rejected'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendation_dismissals
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  0,
  'invented dismiss payload creates no row'
);

select lives_ok(
  format(
    'select public.dismiss_therapist_aura_signal_v2(%L, %L, %L, %L)',
    'aura.reviews.pending_reply.v1:' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz,
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz,
    'd1000000-0000-4000-8000-000000000002'
  ),
  'Premium Plus can dismiss an actually emitted live rule'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendation_dismissals
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and recommendation_key like 'aura.reviews.pending_reply.v1:%'
  ),
  1,
  'valid dismiss persists exactly one own dismissal row'
);

select lives_ok(
  format(
    'select public.dismiss_therapist_aura_signal_v2(%L, %L, %L, %L)',
    'aura.reviews.pending_reply.v1:' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' || to_char(((public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz,
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz,
    'd1000000-0000-4000-8000-000000000003'
  ),
  'replayed dismiss is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendation_dismissals
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and recommendation_key like 'aura.reviews.pending_reply.v1:%'
  ),
  1,
  'replayed dismiss does not create a second row'
);

select throws_ok(
  format(
    'select public.dismiss_therapist_aura_signal_v2(%L, %L, %L, %L)',
    'aura.reviews.pending_reply.v1:tampered-period',
    now() - interval '31 days',
    now(),
    'd1000000-0000-4000-8000-000000000004'
  ),
  '22023',
  'PERIOD_NOT_CURRENT',
  'tampered period is rejected'
);

select throws_ok(
  format(
    'select public.dismiss_therapist_aura_signal_v2(%L, %L, %L, %L)',
    'persisted:e1000000-0000-4000-8000-000000000099',
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodStart}')::timestamptz,
    (public.get_therapist_aura_signals_v2(30)#>>'{meta,periodEnd}')::timestamptz,
    'd1000000-0000-4000-8000-000000000005'
  ),
  'P0002',
  'RECOMMENDATION_NOT_FOUND',
  'never-emitted persisted recommendation is rejected'
);

select throws_ok(
  'select public.dismiss_therapist_aura_signal_v2(''persisted:e1000000-0000-4000-8000-000000000007'', (public.get_therapist_aura_signals_v2(30)#>>''{meta,periodStart}'')::timestamptz, (public.get_therapist_aura_signals_v2(30)#>>''{meta,periodEnd}'')::timestamptz, ''d1000000-0000-4000-8000-000000000006''::uuid)',
  'P0002',
  'RECOMMENDATION_NOT_FOUND',
  'cross-tenant persisted recommendation is rejected'
);

select is(
  (
    select count(*)::integer
    from public.aura_recommendation_dismissals
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'
  ),
  0,
  'cross-tenant dismiss does not modify the other therapist'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  'select public.get_therapist_aura_signals_v2(30)',
  'P0002',
  'PROFILE_NOT_FOUND',
  'patient cannot read Aura'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000004', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  'select public.dismiss_therapist_aura_signal_v2(''aura.reviews.pending_reply.v1:blocked'', now() - interval ''30 days'', now(), ''d1000000-0000-4000-8000-000000000007''::uuid)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Free therapist cannot dismiss Aura'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000002', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  'select public.get_therapist_aura_signals_v2(30)',
  '42501',
  'CAPABILITY_NOT_ALLOWED',
  'Premium therapist cannot read Aura'
);

reset role;

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_aura_signals_v2(integer)',
    'execute'
  ),
  false,
  'anonymous role cannot execute Aura read RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.dismiss_therapist_aura_signal_v2(text,timestamptz,timestamptz,uuid)',
    'execute'
  ),
  false,
  'anonymous role cannot execute Aura dismiss RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_therapist_aura_signals_v1(integer)',
    'execute'
  ),
  false,
  'anonymous role cannot bypass Aura v2 through the historical read RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.dismiss_therapist_aura_signal_v1(text,text,integer,timestamptz,timestamptz,uuid)',
    'execute'
  ),
  false,
  'authenticated clients cannot bypass the hardened dismiss RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.dismiss_therapist_aura_signal_v2(text,timestamptz,timestamptz,uuid)',
    'execute'
  ),
  true,
  'authenticated Premium Plus clients can reach only the hardened dismiss RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select ok(
  not (
    public.get_therapist_aura_signals_v2(30)::text like '%patient_profile_id%'
  ),
  'Aura response does not expose patient identifiers'
);

select ok(
  pg_get_functiondef('public.get_therapist_aura_signals_v1(integer)'::regprocedure)
    not like '%cancelled_by_payment%',
  'cancelled_by_payment remains outside behavioral cancellation metrics'
);

select * from finish();

rollback;
