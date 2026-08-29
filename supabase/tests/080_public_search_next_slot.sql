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
    from public.therapist_services candidate
    join public.therapies candidate_therapy on candidate_therapy.id = candidate.therapy_id
    cross join lateral pg_catalog.generate_series(
      now(),
      now() + interval '30 days',
      interval '5 days'
    ) as slot_window(range_start)
    cross join lateral jsonb_array_elements(
      coalesce(
        public.get_service_available_slots_v1(
          candidate.id,
          slot_window.range_start,
          least(slot_window.range_start + interval '5 days', now() + interval '31 days'),
          500
        ) -> 'slots',
        '[]'::jsonb
      )
    ) as slot(value)
    where candidate.therapist_profile_id = (
      select therapist_profile_id
      from public.public_therapist_search
      where slug = 'ana-oliveira'
    )
      and candidate.status = 'active'
      and candidate.is_bookable
      and candidate.online_only
      and candidate_therapy.status = 'published'
      and candidate_therapy.is_public_visible
      and public.therapy_has_active_matching_theme_v1(candidate_therapy.id)
      and public.is_public_service_booking_eligible_v1(candidate.id)
  ),
  'search next slot is the first usable slot across every eligible public service'
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
  0,
  (
    select count(*)::integer
    from public.public_therapist_search as search
    where next_slot_at is distinct from (
      select min((slot.value ->> 'startsAt')::timestamptz)
      from public.therapist_services candidate
      join public.therapies candidate_therapy on candidate_therapy.id = candidate.therapy_id
      cross join lateral pg_catalog.generate_series(
        now(),
        now() + interval '30 days',
        interval '5 days'
      ) as slot_window(range_start)
      cross join lateral jsonb_array_elements(
        coalesce(
          public.get_service_available_slots_v1(
            candidate.id,
            slot_window.range_start,
            least(slot_window.range_start + interval '5 days', now() + interval '31 days'),
            500
          ) -> 'slots',
          '[]'::jsonb
        )
      ) as slot(value)
      where candidate.therapist_profile_id = search.therapist_profile_id
        and candidate.status = 'active'
        and candidate.is_bookable
        and candidate.online_only
        and candidate_therapy.status = 'published'
        and candidate_therapy.is_public_visible
        and public.therapy_has_active_matching_theme_v1(candidate_therapy.id)
        and public.is_public_service_booking_eligible_v1(candidate.id)
    )
  ),
  'every public search row uses the earliest usable slot across eligible services'
);

select * from finish();
rollback;
