begin;

select plan(12);

select has_function(
  'public',
  'is_public_therapist_profile_visible_v1',
  array['uuid'],
  'public profile visibility helper exists'
);

select has_function(
  'public',
  'is_public_therapist_profile_content_version_v1',
  array['uuid'],
  'public profile content-version visibility helper exists'
);

select function_privs_are(
  'public',
  'is_public_therapist_profile_visible_v1',
  array['uuid'],
  'anon',
  array['EXECUTE'],
  'anon receives execute only on the narrow profile visibility helper'
);

select function_privs_are(
  'public',
  'is_public_therapist_profile_content_version_v1',
  array['uuid'],
  'anon',
  array['EXECUTE'],
  'anon receives execute only on the narrow content visibility helper'
);

select ok(
  (
    select pg_get_expr(polqual, polrelid)
      like '%is_public_therapist_profile_visible_v1%'
    from pg_policy
    where polrelid = 'public.therapist_profile_content_versions'::regclass
      and polname = 'Public can read published therapist profile content'
  ),
  'published content policy uses the non-recursive visibility helper'
);

select ok(
  (
    select pg_get_expr(polqual, polrelid)
      like '%is_public_therapist_profile_content_version_v1%'
    from pg_policy
    where polrelid = 'public.therapist_profile_guide_items'::regclass
      and polname = 'Public can read active therapist profile guide items'
  ),
  'guide-item policy uses the non-recursive content helper'
);

select ok(
  (
    select pg_get_expr(polqual, polrelid)
      like '%is_public_therapist_profile_content_version_v1%'
    from pg_policy
    where polrelid = 'public.therapist_profile_reflections'::regclass
      and polname = 'Public can read public therapist profile reflections'
  ),
  'reflection policy uses the non-recursive content helper'
);

select ok(
  pg_get_functiondef(
    'public.get_service_available_days_v1(uuid,date)'::regprocedure
  ) like '%public.get_service_available_slots_v1_internal(%',
  'month availability reuses the authoritative internal slot engine'
);

select ok(
  pg_get_functiondef(
    'public.get_service_available_days_v1(uuid,date)'::regprocedure
  ) not like '%public.get_service_available_slots_v1(%',
  'month availability does not repeat the public eligibility wrapper per day'
);

select is(
  (
    select string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_therapist_profile_content_v'
  ),
  'slug,short_intro,essence_body,invitation_body,experience_years,guide_items,reflections,public_profile_theme,bio_illustration_id'::text,
  'public profile view preserves its exact public column contract'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_service_available_days_v1(uuid,date)',
    'EXECUTE'
  ),
  'anonymous visitors retain access to month availability'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_service_available_slots_v1_internal(uuid,timestamptz,timestamptz,integer)',
    'EXECUTE'
  ),
  'the internal slot engine remains unavailable to anonymous callers'
);

select * from finish();

rollback;
