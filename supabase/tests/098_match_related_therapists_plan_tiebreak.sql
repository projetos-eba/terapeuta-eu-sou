begin;

select plan(7);

insert into public.profiles (id, role, display_name)
values
  ('f9800000-0000-4000-8000-000000000001', 'therapist', 'Match Free'),
  ('f9800000-0000-4000-8000-000000000002', 'therapist', 'Match Premium'),
  ('f9800000-0000-4000-8000-000000000003', 'therapist', 'Match Premium Plus'),
  ('f9800000-0000-4000-8000-000000000004', 'therapist', 'Match Free Interesse');

insert into public.therapist_profiles (
  id,
  user_id,
  slug,
  public_name,
  free_public_slug,
  plan,
  status,
  public_status,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions
)
values
  ('f9810000-0000-4000-8000-000000000001', 'f9800000-0000-4000-8000-000000000001', 'match-free', 'Match Free', '9800001', 'free', 'approved', 'published', true, true, true),
  ('f9810000-0000-4000-8000-000000000002', 'f9800000-0000-4000-8000-000000000002', 'match-premium', 'Match Premium', '9800002', 'premium', 'approved', 'published', true, true, true),
  ('f9810000-0000-4000-8000-000000000003', 'f9800000-0000-4000-8000-000000000003', 'match-premium-plus', 'Match Premium Plus', '9800003', 'premium_plus', 'approved', 'published', true, true, true),
  ('f9810000-0000-4000-8000-000000000004', 'f9800000-0000-4000-8000-000000000004', 'match-free-interesse', 'Match Free Interesse', '9800004', 'free', 'approved', 'published', true, true, true);

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  duration_minutes,
  price_cents,
  status,
  online_only,
  delivery_format,
  is_bookable,
  position
)
select
  service_id,
  therapist_profile_id,
  therapy.id,
  title,
  50,
  price_cents,
  'active',
  true,
  'online',
  true,
  10
from (
  values
    ('f9820000-0000-4000-8000-000000000001'::uuid, 'f9810000-0000-4000-8000-000000000001'::uuid, 'Reiki Free', 12000),
    ('f9820000-0000-4000-8000-000000000002'::uuid, 'f9810000-0000-4000-8000-000000000002'::uuid, 'Reiki Premium', 12000),
    ('f9820000-0000-4000-8000-000000000003'::uuid, 'f9810000-0000-4000-8000-000000000003'::uuid, 'Reiki Premium Plus', 12000),
    ('f9820000-0000-4000-8000-000000000004'::uuid, 'f9810000-0000-4000-8000-000000000004'::uuid, 'Reiki Free Interesse', 12000)
) as fixtures(service_id, therapist_profile_id, title, price_cents)
join public.therapies therapy on therapy.slug = 'reiki';

-- This lower-priced service makes Reiki an additional service for the Free
-- therapist. The related-professionals RPC must still discover their Reiki.
insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  duration_minutes,
  price_cents,
  status,
  online_only,
  delivery_format,
  is_bookable,
  position
)
select
  'f9820000-0000-4000-8000-000000000005',
  'f9810000-0000-4000-8000-000000000001',
  therapy.id,
  'Serviço principal alternativo',
  50,
  10000,
  'active',
  true,
  'online',
  true,
  1
from public.therapies therapy
join public.therapy_categories category on category.id = therapy.category_id
where therapy.slug <> 'reiki'
  and therapy.status = 'published'
  and therapy.is_public_visible
  and category.is_active
order by therapy.slug
limit 1;

insert into public.therapist_service_matching_themes (therapist_service_id, theme_id)
select
  service_id,
  (
    select matching_theme.theme_id
    from public.therapy_matching_themes matching_theme
    join public.matching_themes theme on theme.id = matching_theme.theme_id
    where matching_theme.therapy_id = therapy.id
      and theme.is_active
    order by matching_theme.sort_order
    limit 1
  )
from (
  values
    ('f9820000-0000-4000-8000-000000000001'::uuid),
    ('f9820000-0000-4000-8000-000000000002'::uuid),
    ('f9820000-0000-4000-8000-000000000003'::uuid),
    ('f9820000-0000-4000-8000-000000000004'::uuid)
) as fixtures(service_id)
join public.therapies therapy on therapy.slug = 'reiki';

insert into public.therapist_service_matching_interests (therapist_service_id, interest_id)
select
  'f9820000-0000-4000-8000-000000000004',
  interest.id
from public.matching_interests interest
where interest.is_active
  and interest.theme_id = (
    select matching_theme.theme_id
    from public.therapy_matching_themes matching_theme
    join public.therapies therapy on therapy.id = matching_theme.therapy_id
    where therapy.slug = 'reiki'
    order by matching_theme.sort_order
    limit 1
  )
order by interest.sort_order
limit 1;

select is(
  public.get_public_therapy_therapists_v1(
    'reiki',
    array[(
      select matching_theme.theme_id
      from public.therapy_matching_themes matching_theme
      join public.therapies therapy on therapy.id = matching_theme.therapy_id
      where therapy.slug = 'reiki'
      order by matching_theme.sort_order
      limit 1
    )]::uuid[],
    '{}'::uuid[],
    6
  ) -> 0 ->> 'slug',
  'match-premium-plus',
  'Premium Plus wins the plan tiebreak when Match compatibility is equal'
);

select is(
  public.get_public_therapy_therapists_v1(
    'reiki',
    array[(
      select matching_theme.theme_id
      from public.therapy_matching_themes matching_theme
      join public.therapies therapy on therapy.id = matching_theme.therapy_id
      where therapy.slug = 'reiki'
      order by matching_theme.sort_order
      limit 1
    )]::uuid[],
    array[(
      select interest.id
      from public.therapist_service_matching_interests service_interest
      join public.matching_interests interest on interest.id = service_interest.interest_id
      where service_interest.therapist_service_id = 'f9820000-0000-4000-8000-000000000004'
    )]::uuid[],
    6
  ) -> 0 ->> 'slug',
  '9800004',
  'a higher interest compatibility remains ahead of the plan tiebreak'
);

select ok(
  public.get_public_therapy_therapists_v1(
    'reiki',
    array[(
      select matching_theme.theme_id
      from public.therapy_matching_themes matching_theme
      join public.therapies therapy on therapy.id = matching_theme.therapy_id
      where therapy.slug = 'reiki'
      order by matching_theme.sort_order
      limit 1
    )]::uuid[],
    '{}'::uuid[],
    6
  ) @> '[{"slug":"9800001"}]'::jsonb,
  'a therapist is included when the chosen therapy is an additional service'
);

select is(
  (
    select therapist_count
    from public.public_matching_therapist_counts counts
    join public.therapies therapy on therapy.id = counts.therapy_id
    where therapy.slug = 'reiki'
  ),
  (
    select count(distinct service.therapist_profile_id)::integer
    from public.therapist_services service
    join public.therapies therapy on therapy.id = service.therapy_id
    join public.therapy_categories category on category.id = therapy.category_id
    where therapy.slug = 'reiki'
      and service.archived_at is null
      and service.status = 'active'
      and service.is_bookable
      and service.online_only
      and therapy.status = 'published'
      and therapy.is_public_visible
      and category.is_active
      and public.is_public_service_booking_eligible_v1(service.id)
  ),
  'public Match count and RPC candidate eligibility use the same service rules'
);

select is(
  jsonb_array_length(public.get_public_therapy_therapists_v1('reiki', '{}'::uuid[], '{}'::uuid[], 2)),
  2,
  'the public RPC keeps its defensive result limit'
);

select ok(
  not (
    public.get_public_therapy_therapists_v1('reiki', '{}'::uuid[], '{}'::uuid[], 1) -> 0
    ?| array['plan', 'therapist_profile_id', 'price_cents']
  ),
  'the public related-professionals contract does not expose plan or private identifiers'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_public_therapy_therapists_v1(text,uuid[],uuid[],integer)',
    'EXECUTE'
  ),
  'anonymous visitors retain access to the safe public related-professionals RPC'
);

select * from finish();

rollback;
