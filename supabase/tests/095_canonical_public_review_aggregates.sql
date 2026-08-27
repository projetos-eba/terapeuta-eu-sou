begin;

select plan(3);

select like(
  pg_get_viewdef('public.public_home_therapists_internal'::regclass, true),
  '%public_therapist_profile_reviews_v_internal%',
  'home rating aggregate reads canonical published relationship reviews'
);
select like(
  pg_get_viewdef('public.public_therapist_search_internal'::regclass, true),
  '%public_therapist_profile_reviews_v_internal%',
  'catalog rating aggregate reads canonical published relationship reviews'
);
select like(
  pg_get_viewdef('public.public_therapist_profiles_v_internal'::regclass, true),
  '%public_therapist_profile_reviews_v_internal%',
  'public profile rating aggregate reads canonical published relationship reviews'
);

rollback;
