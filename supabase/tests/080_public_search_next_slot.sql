begin;

select plan(5);

select has_column(
  'public',
  'public_therapist_search',
  'schedule_timezone',
  'public therapist search exposes the canonical schedule timezone'
);

select is(
  (
    select schedule_timezone
    from public.public_therapist_search
    where slug = 'ana-oliveira'
  ),
  (
    select timezone
    from public.therapist_schedule_settings
    where therapist_profile_id = (
      select id from public.therapist_profiles where slug = 'ana-oliveira'
    )
  ),
  'search uses the therapist schedule timezone'
);

select is(
  (
    select next_slot_at
    from public.public_therapist_search
    where slug = 'ana-oliveira'
  ),
  (
    select min((slot.value ->> 'startsAt')::timestamptz)
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        (
          select service_id
          from public.public_therapist_search
          where slug = 'ana-oliveira'
        ),
        now(),
        now() + interval '31 days',
        1
      ) -> 'slots'
    ) as slot(value)
  ),
  'search next slot matches the authoritative public availability endpoint'
);

select is(
  (
    select next_slot_at is not null
    from public.public_therapist_search
    where slug = 'ana-oliveira'
  ),
  true,
  'the seeded public therapist keeps a real next slot'
);

select is(
  (
    select count(*)::integer
    from public.public_therapist_search
    where next_slot_at is not distinct from (
      select min((slot.value ->> 'startsAt')::timestamptz)
      from jsonb_array_elements(
        public.get_service_available_slots_v1(
          service_id,
          now(),
          now() + interval '31 days',
          1
        ) -> 'slots'
      ) as slot(value)
    )
  ),
  (
    select count(*)::integer from public.public_therapist_search
  ),
  'every public search row agrees with its service availability projection'
);

select * from finish();
rollback;
