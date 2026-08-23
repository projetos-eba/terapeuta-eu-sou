begin;

select plan(7);

select lives_ok(
  $$
  do $do$
  declare
    v_theme text;
  begin
    foreach v_theme in array ARRAY[
      'ancestral', 'aurora', 'botanico', 'celestial', 'cristalino',
      'energia', 'essencial_editorial', 'essential', 'frequencia',
      'geometria', 'lunar', 'natural', 'oraculo', 'profundo', 'sagrado',
      'sereno_horizonte', 'serene', 'vinculos', 'warm'
    ] loop
      update public.therapist_profiles
      set public_profile_theme = v_theme
      where id = 'c1000000-0000-4000-8000-000000000001';
    end loop;
  end
  $do$
  $$,
  'all nineteen theme IDs satisfy the published profile check'
);

select lives_ok(
  $$
  do $do$
  declare
    v_theme text;
  begin
    foreach v_theme in array ARRAY[
      'ancestral', 'aurora', 'botanico', 'celestial', 'cristalino',
      'energia', 'essencial_editorial', 'essential', 'frequencia',
      'geometria', 'lunar', 'natural', 'oraculo', 'profundo', 'sagrado',
      'sereno_horizonte', 'serene', 'vinculos', 'warm'
    ] loop
      update public.therapist_profile_content_versions
      set public_profile_theme = v_theme
      where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
        and status = 'draft';
    end loop;
  end
  $do$
  $$,
  'all nineteen theme IDs satisfy the draft content check'
);

update public.therapist_profiles
set plan = 'free', public_profile_theme = 'serene'
where id = 'c1000000-0000-4000-8000-000000000001';
update public.therapist_profile_content_versions
set public_profile_theme = 'serene'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status = 'draft';

select throws_ok(
  format(
    $$select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '77000000-0000-4000-8000-000000000001',
      %s,
      '{"publicName":"Ana Oliveira","shortIntro":"Escuta.","essenceBody":"Cuidado.","publicProfileTheme":"celestial"}'::jsonb
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'P0001',
  'CAPABILITY_NOT_ALLOWED: premium_profile_themes',
  'Free cannot apply a Premium theme through the RPC'
);

update public.therapist_profiles
set plan = 'premium'
where id = 'c1000000-0000-4000-8000-000000000001';

select lives_ok(
  format(
    $$select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '77000000-0000-4000-8000-000000000002',
      %s,
      '{"publicName":"Ana Oliveira","shortIntro":"Escuta.","essenceBody":"Cuidado.","publicProfileTheme":"geometria"}'::jsonb
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'Premium can save a new theme through the existing draft RPC'
);
select is(
  (
    select public_profile_theme
    from public.therapist_profile_content_versions
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and status = 'draft'
  ),
  'geometria',
  'Premium draft stores the selected theme'
);

update public.therapist_profiles
set plan = 'free'
where id = 'c1000000-0000-4000-8000-000000000001';

select lives_ok(
  format(
    $$select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '77000000-0000-4000-8000-000000000003',
      %s,
      '{"publicName":"Ana Oliveira","shortIntro":"Escuta.","essenceBody":"Cuidado.","publicProfileTheme":"geometria"}'::jsonb
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'a Free downgrade saves a legacy Premium draft as Sereno'
);
select is(
  (
    select public_profile_theme
    from public.therapist_profile_content_versions
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
      and status = 'draft'
  ),
  'serene',
  'downgrade normalization is visible in the saved draft'
);

select * from finish();
rollback;
