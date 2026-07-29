begin;

select plan(12);

select has_table(
  'public',
  'therapist_review_reply_mutation_requests',
  'review replies have an idempotency ledger'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_reviews_v1()',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the private reviews read model'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.upsert_therapist_review_reply_v1(uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the reply authority'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  jsonb_array_length(public.get_therapist_reviews_v1() -> 'reviews') >= 3,
  'Ana reads her own paid completed published reviews'
);

select is(
  public.upsert_therapist_review_reply_v1(
    'e8000000-0000-4000-8000-000000000001',
    'Obrigada por compartilhar sua experiência com a plataforma.',
    'a8120000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay',
  'false',
  'therapist can publish a reply to an own eligible review'
);

select is(
  public.upsert_therapist_review_reply_v1(
    'e8000000-0000-4000-8000-000000000001',
    'Obrigada por compartilhar sua experiência com a plataforma.',
    'a8120000-0000-4000-8000-000000000001'
  ) ->> 'idempotentReplay',
  'true',
  'same request id and payload replays safely'
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_v1(
      'e8000000-0000-4000-8000-000000000001',
      'Resposta diferente usando a mesma chave.',
      'a8120000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'REQUEST_CONFLICT',
  'same request id with a different payload conflicts'
);

select throws_ok(
  $$
    insert into public.review_replies (
      review_id,
      therapist_profile_id,
      body,
      status,
      published_at
    )
    values (
      'e8000000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000001',
      'Tentativa direta pelo cliente.',
      'published',
      now()
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot insert review replies directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.upsert_therapist_review_reply_v1(
      'e8000000-0000-4000-8000-000000000001',
      'Tentativa de responder avaliação de outro terapeuta.',
      'a8120000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'REVIEW_NOT_FOUND',
  'therapist cannot reply to another therapist review'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_reviews_v1()',
  'P0001',
  'CAPABILITY_NOT_ALLOWED',
  'free therapist cannot invoke the Premium reviews read model directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_reviews_v1()',
  'P0001',
  'PROFILE_NOT_FOUND',
  'patient cannot invoke the private therapist reviews read model'
);

reset role;

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_therapist_profile_reviews_v'
      and column_name in ('patient_profile_id', 'therapist_profile_id')
  ),
  'public profile reviews view does not expose internal profile ids'
);

select * from finish();

rollback;
