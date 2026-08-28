begin;

select plan(18);

select col_not_null(
  'public',
  'availability_rules',
  'service_id',
  'availability rules require one therapy'
);

select is(
  (select count(*) from public.availability_rules where service_id is null),
  0::bigint,
  'retired general availability rules do not remain after backfill'
);

create temporary table multi_service_day
on commit drop
as
select (
  (now() at time zone 'America/Sao_Paulo')::date
  + ((1 - extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::integer + 7) % 7)
  + 14
)::date as local_day;

update public.booking_holds
set status = 'expired',
    expires_at = now() - interval '1 minute'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and occupied_during && tstzrange(
    ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
    ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.bookings
set status = 'cancelled_by_therapist'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status in ('draft', 'pending_payment', 'confirmed')
  and occupied_during && tstzrange(
    ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
    ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.availability_exceptions
set status = 'cancelled'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status = 'active'
  and tstzrange(starts_at, ends_at, '[)') && tstzrange(
    ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
    ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
    '[)'
  );

update public.therapist_services
set duration_minutes = case id
  when 'd1000000-0000-4000-8000-000000000001' then 20
  when 'd1000000-0000-4000-8000-000000000006' then 30
  when 'd1000000-0000-4000-8000-000000000021' then 45
  else duration_minutes
end,
status = 'active',
is_bookable = true,
online_only = true
where id in (
  'd1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000006',
  'd1000000-0000-4000-8000-000000000021'
);

update public.therapist_profiles
set status = 'approved',
    is_public = true,
    is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapies
set status = 'published',
    is_public_visible = true
where id in (
  select therapy_id
  from public.therapist_services
  where id in (
    'd1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000006',
    'd1000000-0000-4000-8000-000000000021'
  )
);

update public.therapy_categories
set is_active = true
where id in (
  select category_id
  from public.therapies
  where id in (
    select therapy_id
    from public.therapist_services
    where id in (
      'd1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000021'
    )
  )
);

insert into public.therapist_service_booking_settings (
  service_id,
  buffer_before_minutes,
  buffer_after_minutes,
  min_notice_minutes,
  max_days_ahead,
  interval_minutes
)
values
  ('d1000000-0000-4000-8000-000000000001', 5, 0, 0, 90, 15),
  ('d1000000-0000-4000-8000-000000000006', 10, 10, 0, 90, 15),
  ('d1000000-0000-4000-8000-000000000021', 15, 15, 0, 90, 15)
on conflict (service_id) do update
set buffer_before_minutes = excluded.buffer_before_minutes,
    buffer_after_minutes = excluded.buffer_after_minutes,
    min_notice_minutes = excluded.min_notice_minutes,
    max_days_ahead = excluded.max_days_ahead,
    interval_minutes = excluded.interval_minutes;

delete from public.availability_rules
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001';

insert into public.availability_rules (
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
select
  'c1000000-0000-4000-8000-000000000001',
  service_id,
  1,
  time '09:00',
  time '17:00',
  'America/Sao_Paulo',
  true
from unnest(array[
  'd1000000-0000-4000-8000-000000000001'::uuid,
  'd1000000-0000-4000-8000-000000000006'::uuid,
  'd1000000-0000-4000-8000-000000000021'::uuid
]) as service_id;

select is(
  (
    select count(distinct service_id)
    from public.availability_rules
    where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'three therapies keep independent ranges for the same therapist'
);

create temporary table multi_service_candidates
on commit drop
as
select service.id as service_id, candidate.starts_at, candidate.ends_at
from unnest(array[
  'd1000000-0000-4000-8000-000000000001'::uuid,
  'd1000000-0000-4000-8000-000000000006'::uuid,
  'd1000000-0000-4000-8000-000000000021'::uuid
]) as service(id)
cross join lateral public.list_service_schedule_candidates_v1(
  service.id,
  ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
  ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
  (((select local_day from multi_service_day) - 1) + time '00:00') at time zone 'America/Sao_Paulo',
  100
) as candidate;

select is((select min(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000001'), time '09:00', '20-minute therapy starts at the configured 09:00 boundary');
select is((select min(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000006'), time '09:00', '30-minute therapy starts at 09:00 despite a before buffer');
select is((select min(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000021'), time '09:00', '45-minute therapy starts at 09:00 despite a different before buffer');

select is((select max(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000001'), time '16:30', '20-minute therapy last start keeps the session inside the range');
select is((select max(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000006'), time '16:15', '30-minute therapy last start also fits its after buffer');
select is((select max(starts_at at time zone 'America/Sao_Paulo')::time from multi_service_candidates where service_id = 'd1000000-0000-4000-8000-000000000021'), time '16:00', '45-minute therapy last start also fits its after buffer');

select is(
  (
    public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000005',
      'd1000000-0000-4000-8000-000000000001',
      ((select local_day from multi_service_day) + time '09:00') at time zone 'America/Sao_Paulo',
      ((select local_day from multi_service_day) + time '09:20') at time zone 'America/Sao_Paulo',
      'America/Sao_Paulo',
      'multi-service-global-hold-0001',
      600
    )
  ).status::text,
  'active',
  'the first therapy slot can be held'
);

select is(
  (
    select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000006',
        ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
        ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
        100
      ) -> 'slots'
    ) as slot(value)
  ),
  time '09:30',
  'an active hold in one therapy removes overlapping starts from another'
);

select throws_ok(
  $$
    select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000021',
      ((select local_day from multi_service_day) + time '09:00') at time zone 'America/Sao_Paulo',
      ((select local_day from multi_service_day) + time '09:45') at time zone 'America/Sao_Paulo',
      'America/Sao_Paulo',
      'multi-service-conflicting-hold-0001',
      600
    )
  $$,
  'P0001',
  'SLOT_HELD_BY_ANOTHER_USER',
  'a second therapy cannot hold the therapist in an overlapping interval'
);

do $$
begin
  perform public.expire_booking_holds_v1(
    now() + interval '20 minutes',
    'c1000000-0000-4000-8000-000000000001'
  );
end;
$$;

select is(
  (
    select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000006',
        ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
        ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
        100
      ) -> 'slots'
    ) as slot(value)
  ),
  time '09:00',
  'an expired hold releases the therapist for every therapy'
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status
)
values (
  'a5100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select local_day from multi_service_day) + time '09:00') at time zone 'America/Sao_Paulo',
  ((select local_day from multi_service_day) + time '09:20') at time zone 'America/Sao_Paulo',
  'America/Sao_Paulo',
  'confirmed',
  'paid'
);

select is(
  (
    select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000006',
        ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
        ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
        100
      ) -> 'slots'
    ) as slot(value)
  ),
  time '09:30',
  'a confirmed booking blocks overlapping slots across therapies'
);

update public.bookings
set status = 'cancelled_by_therapist'
where id = 'a5100000-0000-4000-8000-000000000001';

select is(
  (
    select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
    from jsonb_array_elements(
      public.get_service_available_slots_v1(
        'd1000000-0000-4000-8000-000000000006',
        ((select local_day from multi_service_day) + time '08:00') at time zone 'America/Sao_Paulo',
        ((select local_day from multi_service_day) + time '18:00') at time zone 'America/Sao_Paulo',
        100
      ) -> 'slots'
    ) as slot(value)
  ),
  time '09:00',
  'a cancelled booking releases the therapist for every therapy'
);

select ok(
  (
    select pg_get_constraintdef(oid) ~* 'therapist_profile_id WITH =.*occupied_during WITH &&'
      and pg_get_constraintdef(oid) !~* 'service_id'
    from pg_constraint
    where conname = 'bookings_no_active_therapist_overlap'
  ),
  'booking overlap exclusion is therapist-global rather than service-scoped'
);

select ok(
  (
    select pg_get_constraintdef(oid) ~* 'therapist_profile_id WITH =.*occupied_during WITH &&'
      and pg_get_constraintdef(oid) !~* 'service_id'
    from pg_constraint
    where conname = 'booking_holds_no_active_therapist_overlap'
  ),
  'hold overlap exclusion is therapist-global rather than service-scoped'
);

select throws_ok(
  format(
    $sql$
      select public.save_therapist_schedule_v1(
        'aaaaaaaa-0000-4000-8000-000000000001',
        %s,
        'America/Sao_Paulo',
        '[{"id":null,"serviceId":null,"dayOfWeek":1,"startTime":"09:00","endTime":"17:00","isActive":true}]'::jsonb,
        '[]'::jsonb,
        'a5100000-0000-4000-8000-000000000099'
      )
    $sql$,
    (
      select version
      from public.therapist_schedule_settings
      where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    )
  ),
  '42501',
  'schedule_service_forbidden',
  'database schedule command rejects a retired general rule'
);

select * from finish();

rollback;
