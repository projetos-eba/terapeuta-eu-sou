begin;

select plan(21);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  completed_at,
  service_title_snapshot,
  service_duration_minutes_snapshot,
  service_price_cents_snapshot,
  currency_snapshot,
  buffer_before_minutes_snapshot,
  buffer_after_minutes_snapshot,
  occupied_during,
  snapshot_captured_at
)
values
  (
    'f9370000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    now() - interval '12 days',
    now() - interval '12 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '12 days' + interval '50 minutes',
    'Fixture Reiki',
    50,
    15000,
    'BRL',
    0,
    0,
    tstzrange(now() - interval '12 days', now() - interval '12 days' + interval '50 minutes', '[)'),
    now() - interval '12 days'
  ),
  (
    'f9370000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    now() - interval '11 days',
    now() - interval '11 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '11 days' + interval '50 minutes',
    'Fixture Reiki',
    50,
    15000,
    'BRL',
    0,
    0,
    tstzrange(now() - interval '11 days', now() - interval '11 days' + interval '50 minutes', '[)'),
    now() - interval '11 days'
  ),
  (
    'f9370000-0000-4000-8000-000000000003'::uuid,
    'b1000000-0000-4000-8000-000000000003'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    now() - interval '10 days',
    now() - interval '10 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '10 days' + interval '50 minutes',
    'Fixture Reiki',
    50,
    15000,
    'BRL',
    0,
    0,
    tstzrange(now() - interval '10 days', now() - interval '10 days' + interval '50 minutes', '[)'),
    now() - interval '10 days'
  ),
  (
    'f9370000-0000-4000-8000-000000000004'::uuid,
    'b1000000-0000-4000-8000-000000000004'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    now() - interval '9 days',
    now() - interval '9 days' + interval '50 minutes',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '9 days' + interval '50 minutes',
    'Fixture Reiki',
    50,
    15000,
    'BRL',
    0,
    0,
    tstzrange(now() - interval '9 days', now() - interval '9 days' + interval '50 minutes', '[)'),
    now() - interval '9 days'
  );

insert into public.reviews (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  rating,
  comment,
  status,
  moderation_reason,
  published_at
)
values
  (
    'e9370000-0000-4000-8000-000000000001'::uuid,
    'f9370000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'Depoimento publico com cuidado e acolhimento suficiente.',
    'published',
    null,
    now() - interval '8 days'
  ),
  (
    'e9370000-0000-4000-8000-000000000002'::uuid,
    'f9370000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    5,
    'Curto',
    'published',
    null,
    now() - interval '7 days'
  ),
  (
    'e9370000-0000-4000-8000-000000000003'::uuid,
    'f9370000-0000-4000-8000-000000000003'::uuid,
    'b1000000-0000-4000-8000-000000000003'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    4,
    'Depoimento ainda em moderacao e nao publicado.',
    'pending',
    'pending_admin_review',
    null
  ),
  (
    'e9370000-0000-4000-8000-000000000004'::uuid,
    'f9370000-0000-4000-8000-000000000004'::uuid,
    'b1000000-0000-4000-8000-000000000004'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    4,
    null,
    'published',
    null,
    now() - interval '6 days'
  );

select is(
  (
    select coalesce(c.reloptions::text, '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_home_testimonials'
  ),
  '{security_invoker=true}',
  'public_home_testimonials runs as security invoker'
);

select ok(
  has_table_privilege('anon', 'public.public_home_testimonials', 'SELECT'),
  'anon can select public_home_testimonials'
);

select ok(
  has_table_privilege('authenticated', 'public.public_home_testimonials', 'SELECT'),
  'authenticated can select public_home_testimonials'
);

select ok(
  has_table_privilege('service_role', 'public.public_home_testimonials', 'SELECT'),
  'service_role can select public_home_testimonials'
);

select ok(
  not has_table_privilege('anon', 'public.public_home_testimonials', 'TRUNCATE'),
  'anon cannot truncate public_home_testimonials'
);

select ok(
  not has_table_privilege('anon', 'public.public_home_testimonials', 'REFERENCES'),
  'anon cannot reference public_home_testimonials'
);

select results_eq(
  $$
    select id, author_name, body, context_label, rating
    from public.public_home_testimonials
    where id = 'e9370000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'e9370000-0000-4000-8000-000000000001'::uuid,
    'Paciente TES'::text,
    'Depoimento publico com cuidado e acolhimento suficiente.'::text,
    'Depoimento publicado'::text,
    5
  ) $$,
  'public_home_testimonials exposes only the public testimonial DTO'
);

select is_empty(
  $$
    select 1
    from public.public_home_testimonials
    where id in (
      'e9370000-0000-4000-8000-000000000002'::uuid,
      'e9370000-0000-4000-8000-000000000003'::uuid,
      'e9370000-0000-4000-8000-000000000004'::uuid
    )
  $$,
  'public_home_testimonials hides short, pending and null-comment reviews'
);

set local role anon;

select results_eq(
  $$
    select id, comment, rating
    from public.reviews
    where id = 'e9370000-0000-4000-8000-000000000001'::uuid
  $$,
  $$ values (
    'e9370000-0000-4000-8000-000000000001'::uuid,
    'Depoimento publico com cuidado e acolhimento suficiente.'::text,
    5
  ) $$,
  'anon can directly read only granted public review columns for eligible testimonial'
);

select is_empty(
  $$
    select id
    from public.reviews
    where id in (
      'e9370000-0000-4000-8000-000000000002'::uuid,
      'e9370000-0000-4000-8000-000000000003'::uuid,
      'e9370000-0000-4000-8000-000000000004'::uuid
    )
  $$,
  'anon direct review reads are RLS-filtered to eligible testimonials'
);

select throws_ok(
  $$
    select moderation_reason
    from public.reviews
    where id = 'e9370000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501',
  null,
  'anon cannot select reviews.moderation_reason'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.reviews', 'SELECT'),
  'anon does not hold table-level SELECT on reviews'
);

select ok(
  has_column_privilege('anon', 'public.reviews', 'comment', 'SELECT'),
  'anon can select public reviews.comment column'
);

select ok(
  not has_column_privilege('anon', 'public.reviews', 'moderation_reason', 'SELECT'),
  'anon cannot select reviews.moderation_reason'
);

select ok(
  not has_column_privilege('anon', 'public.reviews', 'booking_id', 'SELECT'),
  'anon cannot select reviews.booking_id'
);

select ok(
  has_table_privilege('authenticated', 'public.reviews', 'SELECT'),
  'authenticated keeps SELECT on reviews for own review read models'
);

select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'INSERT'),
  'authenticated cannot insert reviews directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'UPDATE'),
  'authenticated cannot update reviews directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'DELETE'),
  'authenticated cannot delete reviews directly'
);

select ok(
  not has_table_privilege('anon', 'public.reviews', 'TRUNCATE'),
  'anon cannot truncate reviews'
);

select results_eq(
  $$
    select count(*) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'Public can read published testimonial reviews'
      and roles && array['anon']::name[]
      and cmd = 'SELECT'
  $$,
  $$ values (true) $$,
  'reviews has explicit public testimonial RLS policy'
);

select * from finish();

rollback;
