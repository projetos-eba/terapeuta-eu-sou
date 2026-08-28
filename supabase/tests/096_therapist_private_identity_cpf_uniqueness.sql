begin;

select plan(7);

select ok(
  to_regclass('public.therapist_private_identity_cpf_unique_idx') is not null,
  'a partial unique index protects CPF only'
);

delete from public.therapist_private_identity
where therapist_profile_id in (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.save_therapist_private_identity_v1(
    'cpf', '843.719.265-09', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  ) ->> 'documentNumber',
  '84371926509',
  'a therapist can save a valid CPF'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_therapist_private_identity_v1(
    'cpf', '843.719.265-09', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  )$$,
  '23505',
  'CPF_ALREADY_IN_USE',
  'a CPF already assigned to another therapist is rejected without disclosing that account'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.save_therapist_private_identity_v1(
    'rg', '123456789', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  ) ->> 'documentType',
  'rg',
  'RG can replace the CPF for the first therapist'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.save_therapist_private_identity_v1(
    'rg', '123456789', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  ) ->> 'documentType',
  'rg',
  'the same RG is not subject to the CPF-only uniqueness rule'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.save_therapist_private_identity_v1(
    'passport', 'AB123456', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  ) ->> 'documentType',
  'passport',
  'passport can replace the RG for the first therapist'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.save_therapist_private_identity_v1(
    'passport', 'AB123456', '05409-000', 'Rua dos Pinheiros', '100',
    '', 'Pinheiros', 'São Paulo', 'SP', 'BR'
  ) ->> 'documentType',
  'passport',
  'passport remains outside the CPF-only uniqueness rule'
);

reset role;
select * from finish();

rollback;
