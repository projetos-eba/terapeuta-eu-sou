begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.therapist_services'::regclass
      and conname = 'therapist_services_duration_range'
      and pg_get_constraintdef(oid) ilike '%duration_minutes >= 20%'
      and pg_get_constraintdef(oid) ilike '%duration_minutes <= 120%'
  ),
  'service duration is constrained to 20 through 120 minutes'
);

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
  delivery_format
)
values (
  'd1000000-0000-4000-8000-000000000189',
  'c1000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222225',
  'Duração mínima',
  'Serviço de teste para a duração mínima aceita.',
  20,
  12000,
  'BRL',
  'draft',
  true,
  false,
  'online'
);

select is(
  (select duration_minutes from public.therapist_services
   where id = 'd1000000-0000-4000-8000-000000000189'),
  20,
  '20 minutes can be saved'
);

update public.therapist_services
set duration_minutes = 120
where id = 'd1000000-0000-4000-8000-000000000189';

select is(
  (select duration_minutes from public.therapist_services
   where id = 'd1000000-0000-4000-8000-000000000189'),
  120,
  '120 minutes can be saved'
);

select throws_ok(
  $$
    insert into public.therapist_services (
      id, therapist_profile_id, therapy_id, title, duration_minutes,
      price_cents, currency, status, online_only, is_bookable, delivery_format
    )
    values (
      'd1000000-0000-4000-8000-000000000190',
      'c1000000-0000-4000-8000-000000000001',
      '22222222-2222-4222-8222-222222222225',
      'Abaixo do limite', 19, 12000, 'BRL', 'draft', true, false, 'online'
    )
  $$,
  '23514',
  null,
  'durations below 20 minutes are rejected'
);

select throws_ok(
  $$
    update public.therapist_services
    set duration_minutes = 121
    where id = 'd1000000-0000-4000-8000-000000000189'
  $$,
  '23514',
  null,
  'durations above 120 minutes are rejected'
);

rollback;
