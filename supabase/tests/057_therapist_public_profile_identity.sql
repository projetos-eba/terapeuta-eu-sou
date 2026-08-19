begin;

select plan(39);

select has_column('public', 'therapist_profiles', 'public_profile_theme', 'published theme column exists');
select has_column('public', 'therapist_profiles', 'free_public_slug', 'stable Free slug column exists');
select has_column('public', 'therapist_profile_content_versions', 'public_profile_theme', 'draft theme column exists');
select has_column('public', 'therapist_profile_content_versions', 'bio_illustration_id', 'draft bio illustration column exists');
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_therapist_profile_content_v'
      and column_name = 'therapist_profile_id'
  ),
  0,
  'the public content projection does not expose the internal therapist profile identifier'
);

select is(
  (select count(*)::integer from public.therapist_profiles where free_public_slug is null),
  0,
  'all therapist profiles have a stable Free slug'
);
select is(
  (select count(*)::integer from public.therapist_profiles where free_public_slug !~ '^[1-9][0-9]{6}$'),
  0,
  'all stable Free slugs use seven non-zero-leading digits'
);
select is(
  (select count(*)::integer from public.therapist_profiles),
  (select count(distinct free_public_slug)::integer from public.therapist_profiles),
  'stable Free slugs are unique'
);
select is(
  (select count(*)::integer from public.therapist_profiles where plan = 'free' and slug <> free_public_slug),
  0,
  'Free profiles use the stable numeric slug'
);
select is(
  (
    select pg_get_expr(d.adbin, d.adrelid)
    from pg_attrdef d
    join pg_attribute a
      on a.attrelid = d.adrelid
      and a.attnum = d.adnum
    where d.adrelid = 'public.therapist_profiles'::regclass
      and a.attname = 'public_profile_theme'
  ),
  '''serene''::text',
  'new profiles default to the serene theme without overriding a therapist choice'
);

select is(
  public.normalize_therapist_public_slug_v1('  João da Silva & Luz  '),
  'joao-da-silva-luz',
  'custom slugs are normalized centrally'
);
select is(
  public.therapist_public_slug_status_v1('c1000000-0000-4000-8000-000000000001', 'a')->>'status',
  'invalid',
  'short slugs are invalid'
);
select is(
  public.therapist_public_slug_status_v1('c1000000-0000-4000-8000-000000000001', 'admin')->>'status',
  'reserved',
  'application routes are reserved'
);
select is(
  (public.therapist_profile_capabilities_json_m1('free')->>'canCustomizePublicSlug')::boolean,
  false,
  'Free cannot customize the public slug'
);
select is(
  (public.therapist_profile_capabilities_json_m1('premium')->>'canCustomizePublicSlug')::boolean,
  true,
  'Premium can customize the public slug'
);
select is(
  (public.therapist_profile_capabilities_json_m1('premium_plus')->>'canCustomizePublicSlug')::boolean,
  true,
  'Premium Plus can customize the public slug'
);

select ok(
  not has_function_privilege('anon', 'public.update_therapist_public_slug_v1(uuid,uuid,bigint,text)', 'EXECUTE'),
  'anon cannot execute the slug mutation RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.update_therapist_public_slug_v1(uuid,uuid,bigint,text)', 'EXECUTE'),
  'authenticated cannot execute the slug mutation RPC directly'
);
select ok(
  has_function_privilege('service_role', 'public.update_therapist_public_slug_v1(uuid,uuid,bigint,text)', 'EXECUTE'),
  'service_role can execute the slug mutation RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.check_therapist_public_slug_availability_v1(uuid,text)', 'EXECUTE'),
  'availability remains behind the authenticated Edge Function'
);
select ok(
  not has_table_privilege('anon', 'public.therapist_profile_slug_history', 'select')
    and has_function_privilege('anon', 'public.public_therapist_slug_redirect_rows_v1()', 'execute'),
  'the public redirect projection resolves eligibility without exposing its base table'
);

select throws_ok(
  $$ update public.therapist_profiles set public_profile_theme = 'unknown' where id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'unknown themes are rejected'
);
select throws_ok(
  $$ update public.therapist_profile_content_versions set bio_illustration_id = 'unknown' where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'unknown bio illustrations are rejected'
);

select is(
  public.check_therapist_public_slug_availability_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'Perfil Identidade Teste'
  )->>'status',
  'available',
  'a normalized unused slug is available'
);

select is(
  public.update_therapist_public_slug_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    '57000000-0000-4000-8000-000000000001',
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
    'Perfil Identidade Teste'
  ) #>> '{editor,publicProfileSlug}',
  'perfil-identidade-teste',
  'Premium Plus updates its slug immediately'
);
select is(
  (select current_slug from public.therapist_profile_slug_history where old_slug = 'ana-oliveira'),
  'perfil-identidade-teste',
  'the previous slug redirects directly to the current slug'
);
select is(
  public.update_therapist_public_slug_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    '57000000-0000-4000-8000-000000000001',
    (select profile_version - 1 from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
    'Perfil Identidade Teste'
  )->>'idempotentReplay',
  'true',
  'repeating a slug request replays the stored response'
);
select is(
  public.check_therapist_public_slug_availability_v1(
    'aaaaaaaa-0000-4000-8000-000000000002',
    'ana-oliveira'
  )->>'status',
  'taken',
  'another therapist cannot claim a historical slug'
);

select lives_ok(
  format(
    $$select public.update_therapist_public_slug_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '57000000-0000-4000-8000-000000000002',
      %s,
      'ana-oliveira'
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'a therapist can recover its own historical slug'
);
select is(
  (select current_slug from public.therapist_profile_slug_history where old_slug = 'perfil-identidade-teste'),
  'ana-oliveira',
  'history is flattened when an old slug is recovered'
);

update public.therapist_profiles
set plan = 'free'
where id = 'c1000000-0000-4000-8000-000000000001';
select is(
  (select slug from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  (select free_public_slug from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'downgrade restores the stable Free slug'
);
select is(
  (select current_slug from public.therapist_profile_slug_history where old_slug = 'ana-oliveira'),
  (select free_public_slug from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'downgrade records a redirect from the personalized slug to the stable Free slug'
);

update public.therapist_profiles
set plan = 'premium_plus'
where id = 'c1000000-0000-4000-8000-000000000001';
select is(
  (select slug from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  (select free_public_slug from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'upgrade initially keeps the numeric slug'
);

select throws_ok(
  format(
    $$select public.update_therapist_public_slug_v1(
      'aaaaaaaa-0000-4000-8000-000000000004',
      '57000000-0000-4000-8000-000000000003',
      %s,
      'juliana-personalizado'
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000004')
  ),
  'P0001',
  'CAPABILITY_NOT_ALLOWED: custom_profile_slug',
  'Free slug mutation is blocked in the database'
);

select lives_ok(
  format(
    $$select public.save_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '57000000-0000-4000-8000-000000000004',
      %s,
      '{"publicName":"Ana Oliveira","shortIntro":"Escuta integrativa.","essenceBody":"Cuidado com presença.","publicProfileTheme":"warm","bioIllustrationId":"warm_layers"}'::jsonb
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'theme and illustration are saved in the existing draft flow'
);
select results_eq(
  $$ select public_profile_theme, bio_illustration_id
     from public.therapist_profile_content_versions
     where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001' and status = 'draft' $$,
  $$ values ('warm'::text, 'warm_layers'::text) $$,
  'draft stores the selected theme and illustration'
);
select lives_ok(
  format(
    $$select public.publish_therapist_profile_draft_v1(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '57000000-0000-4000-8000-000000000005',
      %s
    )$$,
    (select profile_version from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001')
  ),
  'theme and illustration publish through the existing command'
);
select is(
  (select public_profile_theme from public.therapist_profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'warm',
  'publishing applies the selected theme to the canonical profile'
);
select results_eq(
  $$ select public_profile_theme, bio_illustration_id
     from public.public_therapist_profile_content_v
     where slug = (
       select slug
       from public.therapist_profiles
       where id = 'c1000000-0000-4000-8000-000000000001'
     ) $$,
  $$ values ('warm'::text, 'warm_layers'::text) $$,
  'the public projection exposes only published personalization values'
);

select * from finish();
rollback;
