begin;

select plan(9);

select ok(
  to_regclass('public.therapist_private_identity_cpf_unique_idx') is not null
    or to_regclass('public.therapist_private_identity_cpf_lookup_idx') is not null,
  'CPF has a production unique index or the transitional lookup index'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.therapist_private_identity'::regclass
      and tgname = 'reject_new_duplicate_therapist_cpf_v1'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'the transitional trigger rejects new duplicate CPF writes'
);

-- Exercise the HML transition path even when the local database already has
-- the production unique index from an earlier application of the migration.
drop index if exists public.therapist_private_identity_cpf_unique_idx;

delete from public.therapist_private_identity
where therapist_profile_id in (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002'
);

alter table public.therapist_private_identity
  disable trigger reject_new_duplicate_therapist_cpf_v1;

insert into public.therapist_private_identity (
  therapist_profile_id, document_type, document_number, postal_code,
  street, street_number, neighborhood, city, state, country
) values
  (
    'c1000000-0000-4000-8000-000000000001', 'cpf', '84371926509',
    '05409000', 'Rua dos Pinheiros', '100', 'Pinheiros', 'Sao Paulo', 'SP', 'BR'
  ),
  (
    'c1000000-0000-4000-8000-000000000002', 'cpf', '84371926509',
    '05409000', 'Rua dos Pinheiros', '200', 'Pinheiros', 'Sao Paulo', 'SP', 'BR'
  );

alter table public.therapist_private_identity
  enable trigger reject_new_duplicate_therapist_cpf_v1;

select lives_ok(
  $$update public.therapist_private_identity
    set document_number = document_number,
        street_number = '201'
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000002'$$,
  'legacy duplicate holders can update unrelated private fields'
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
