begin;

select plan(11);

select ok(
  to_regclass('public.profiles_therapist_phone_lookup_idx') is not null,
  'therapist phone lookup index exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'reject_new_duplicate_therapist_phone_v1'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'the therapist-only phone guard is enabled on profiles'
);

select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.reject_new_duplicate_therapist_phone_v1()'::regprocedure
    )
  ) > 0,
  'the phone guard serializes concurrent writes for the same normalized value'
);

update public.profiles
set phone = null,
    phone_country_code = null
where id in (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'bbbbbbbb-0000-4000-8000-000000000001'
);

select lives_ok(
  $$update public.profiles
    set phone = '11999999999', phone_country_code = '55'
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'a therapist can save an unused phone'
);

select throws_ok(
  $$update public.profiles
    set phone = '(11) 99999-9999', phone_country_code = '+55'
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  '23505',
  'PHONE_ALREADY_IN_USE',
  'a normalized duplicate is rejected for another therapist'
);

select lives_ok(
  $$update public.profiles
    set phone = '11999999999', phone_country_code = '351'
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  'the same national digits under a different DDI are allowed'
);

select lives_ok(
  $$update public.profiles
    set phone = '11999999999', phone_country_code = '55'
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'a patient remains outside the therapist-only uniqueness scope'
);

select lives_ok(
  $$update public.profiles
    set phone = '', phone_country_code = '55'
    where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'an empty therapist phone remains allowed'
);

alter table public.profiles
  disable trigger reject_new_duplicate_therapist_phone_v1;

update public.profiles
set phone = '19326864625', phone_country_code = null
where id in (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000002'
);

alter table public.profiles
  enable trigger reject_new_duplicate_therapist_phone_v1;

select lives_ok(
  $$update public.profiles
    set phone = phone, display_name = 'Ana Oliveira'
    where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  'a legacy duplicate holder can preserve the same phone'
);

select throws_ok(
  $$update public.profiles
    set phone = '19326864625', phone_country_code = '55'
    where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  '23505',
  'PHONE_ALREADY_IN_USE',
  'a new collision against legacy duplicates is rejected'
);

select lives_ok(
  $$update public.profiles
    set phone = '19326864625', phone_country_code = null
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'a therapist can re-save its own legacy-Brazil phone'
);

select * from finish();

rollback;
