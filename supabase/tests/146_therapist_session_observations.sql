begin;

select plan(16);

select has_table(
  'public',
  'therapist_session_observations',
  'private session observation table exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.therapist_session_observations'::regclass),
  'session observations keep row-level security enabled'
);
select is(
  has_table_privilege('authenticated', 'public.therapist_session_observations', 'SELECT'),
  false,
  'authenticated clients cannot read observations directly'
);
select is(
  has_table_privilege('authenticated', 'public.therapist_session_observations', 'INSERT'),
  false,
  'authenticated clients cannot create observations directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.save_therapist_session_observation_v1(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'service role can execute the session observation command'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.save_therapist_session_observation_v1(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the session observation command'
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
values
  (
    'e9900000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '2 hours', now() - interval '1 hour', 'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'e9900000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() + interval '1 hour', now() + interval '2 hours', 'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'e9900000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '2 hours', now() - interval '1 hour', 'America/Sao_Paulo', 'cancelled_by_patient', 'paid'
  );

update public.therapist_profiles
set plan = 'premium_plus'
where id in (
  '92000000-0000-4000-8000-000000000011',
  'c1000000-0000-4000-8000-000000000001'
);

set local role service_role;
select is(
  public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000001',
    '  Retomar este assunto.  ',
    'e9910000-0000-4000-8000-000000000001'
  ) #>> '{observation,content}',
  'Retomar este assunto.',
  'the owning Premium Plus therapist saves a trimmed observation after the session'
);
select is(
  public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000001',
    'Retomar este assunto.',
    'e9910000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay',
  'true',
  'the same observation request replays without another write'
);
select is(
  public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000001',
    'Atualização da observação.',
    'e9910000-0000-4000-8000-000000000002'
  ) #>> '{observation,content}',
  'Atualização da observação.',
  'the owner can edit the single observation'
);
select is(
  (select count(*)::integer from public.therapist_session_observations where booking_id = 'e9900000-0000-4000-8000-000000000001'),
  1,
  'one observation exists per booking'
);
select throws_ok(
  $$select public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000002',
    'Não deve salvar.',
    'e9910000-0000-4000-8000-000000000003'
  )$$,
  '42501', 'SESSION_OBSERVATION_NOT_AVAILABLE',
  'a future session cannot receive an observation'
);
select throws_ok(
  $$select public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000003',
    'Não deve salvar.',
    'e9910000-0000-4000-8000-000000000004'
  )$$,
  '42501', 'SESSION_OBSERVATION_NOT_AVAILABLE',
  'a cancelled session cannot receive an observation'
);
select throws_ok(
  $$select public.save_therapist_session_observation_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'e9900000-0000-4000-8000-000000000001',
    'Não pertence a este terapeuta.',
    'e9910000-0000-4000-8000-000000000005'
  )$$,
  '42501', 'SESSION_OBSERVATION_NOT_FOUND',
  'another therapist cannot save an observation for this booking'
);

update public.therapist_profiles
set plan = 'premium'
where id = '92000000-0000-4000-8000-000000000011';
select throws_ok(
  $$select public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000001',
    'Não deve editar depois do downgrade.',
    'e9910000-0000-4000-8000-000000000006'
  )$$,
  '42501', 'SESSION_OBSERVATION_PREMIUM_PLUS_REQUIRED',
  'a downgraded therapist cannot edit an existing observation'
);
select is(
  (select content from public.therapist_session_observations where booking_id = 'e9900000-0000-4000-8000-000000000001'),
  'Atualização da observação.',
  'the existing observation remains preserved after downgrade'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_therapist_session_observation_v1(
    '90000000-0000-4000-8000-000000000011',
    'e9900000-0000-4000-8000-000000000001',
    'Tentativa direta.',
    'e9910000-0000-4000-8000-000000000007'
  )$$,
  '42501', 'permission denied for function save_therapist_session_observation_v1',
  'authenticated therapist cannot call the private command directly'
);

select * from finish();
rollback;
