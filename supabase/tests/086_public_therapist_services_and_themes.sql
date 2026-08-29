begin;

select plan(9);

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  currency,
  status,
  online_only,
  is_bookable,
  archived_at
)
values (
  'd1000000-0000-4000-8000-000000000007',
  'c1000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222228',
  'Tarô e autoconhecimento',
  'Fixture para provar múltiplos serviços públicos.',
  60,
  20000,
  'BRL',
  'active',
  true,
  true,
  null
)
on conflict (id) do update
set therapist_profile_id = excluded.therapist_profile_id,
    therapy_id = excluded.therapy_id,
    title = excluded.title,
    description = excluded.description,
    duration_minutes = excluded.duration_minutes,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    status = excluded.status,
    online_only = excluded.online_only,
    is_bookable = excluded.is_bookable,
    archived_at = excluded.archived_at,
    updated_at = now();

insert into public.therapy_theme_weights (
  id,
  therapy_id,
  theme_id,
  weight,
  reason,
  source,
  is_active
)
values
  ('44444444-4444-4444-8444-444444444451', '22222222-2222-4222-8222-222222222225', '33333333-3333-4333-8333-333333333332', 12, 'Fixture local', 'journey', true),
  ('44444444-4444-4444-8444-444444444452', '22222222-2222-4222-8222-222222222225', '33333333-3333-4333-8333-333333333331', 10, 'Fixture local', 'journey', true),
  ('44444444-4444-4444-8444-444444444453', '22222222-2222-4222-8222-222222222228', '33333333-3333-4333-8333-333333333342', 11, 'Fixture local', 'journey', true),
  ('44444444-4444-4444-8444-444444444454', '22222222-2222-4222-8222-222222222228', '33333333-3333-4333-8333-333333333332', 9, 'Fixture local', 'journey', true)
on conflict (id) do update
set therapy_id = excluded.therapy_id,
    theme_id = excluded.theme_id,
    weight = excluded.weight,
    reason = excluded.reason,
    source = excluded.source,
    is_active = excluded.is_active,
    updated_at = now();

select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_services_v
    where therapist_slug = 'ana-oliveira'
  ),
  2,
  'the public profile returns every eligible Ana service'
);

select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_services_v
    where therapist_slug = 'ana-oliveira'
      and therapy_name in ('Reiki', 'Tarô')
  ),
  2,
  'each eligible public therapy keeps its own service row'
);

select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_services_v
    where therapist_slug = 'ana-oliveira'
      and therapy_name in ('Aromaterapia', 'Constelação Familiar')
  ),
  0,
  'archived or paused services are not exposed publicly'
);

select is(
  (
    select theme_names
    from public.public_therapy_details_v
    where slug = 'reiki'
  ),
  array['Energia e Equilíbrio Energético', 'Emoções e Bem-Estar']::text[],
  'public therapy details expose ordered Match theme names for Reiki'
);

select is(
  (
    select theme_names
    from public.public_therapy_details_v
    where slug = 'taro'
  ),
  array['Autoconhecimento e Transformação', 'Relacionamentos', 'Emoções e Bem-Estar']::text[],
  'public therapy details expose ordered Match theme names for Taro'
);

set role anon;

select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_services_v
    where therapist_slug = 'ana-oliveira'
  ),
  2,
  'anonymous users can read only the public service projection'
);

select is(
  (
    select count(*)::integer
    from public.public_therapy_details_v
    where slug in ('reiki', 'taro')
      and cardinality(theme_names) > 0
  ),
  2,
  'anonymous users can read public theme names without private weights'
);

select is(
  (
    select count(*)::integer
    from public.public_therapist_profile_services_v
    where therapist_slug = 'ana-oliveira'
      and therapy_name = 'Aromaterapia'
  ),
  0,
  'anonymous users cannot infer ineligible services through the public view'
);

select is(
  (
    select has_table_privilege(
      current_user,
      'public.therapy_theme_weights',
      'select'
    )
  ),
  false,
  'anonymous users do not receive direct theme-weight table access'
);

rollback;
