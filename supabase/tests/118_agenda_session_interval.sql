begin;

select plan(18);

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public'
     and table_name = 'therapist_service_booking_settings'
     and column_name = 'buffer_after_minutes'),
  '0',
  'new services default to no post-session interval'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.therapist_service_booking_settings'::regclass
            and conname = 'therapist_service_booking_settings_no_pre_session_buffer'),
  'current service settings cannot restore a hidden pre-session buffer'
);

create temporary table interval_day on commit drop as
select (
  (now() at time zone 'America/Sao_Paulo')::date
  + ((1 - extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::integer + 7) % 7)
  + 42
)::date as local_day;

update public.therapist_profiles
set status = 'approved', is_public = true, is_accepting_bookings = true
where id = 'c1000000-0000-4000-8000-000000000001';

update public.therapist_services
set duration_minutes = 40, status = 'active', is_bookable = true,
    online_only = true
where id = 'd1000000-0000-4000-8000-000000000001';

update public.therapies
set status = 'published', is_public_visible = true,
    is_available_for_services = true
where id = (select therapy_id from public.therapist_services
            where id = 'd1000000-0000-4000-8000-000000000001');

update public.therapist_service_booking_settings
set buffer_before_minutes = 0, buffer_after_minutes = 0,
    min_notice_minutes = 0, max_days_ahead = 90, interval_minutes = 15
where service_id = 'd1000000-0000-4000-8000-000000000001';

delete from public.availability_rules
where service_id = 'd1000000-0000-4000-8000-000000000001';

insert into public.availability_rules (
  therapist_profile_id, service_id, day_of_week,
  start_time, end_time, timezone, is_active
) values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  1, time '10:00', time '12:00', 'America/Sao_Paulo', true
);

update public.booking_holds
set status = 'expired', expires_at = now() - interval '1 minute'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and occupied_during && tstzrange(
    ((select local_day from interval_day) + time '09:00') at time zone 'America/Sao_Paulo',
    ((select local_day from interval_day) + time '13:00') at time zone 'America/Sao_Paulo', '[)');

update public.availability_exceptions
set status = 'cancelled'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status = 'active'
  and tstzrange(starts_at, ends_at, '[)') && tstzrange(
    ((select local_day from interval_day) + time '09:00') at time zone 'America/Sao_Paulo',
    ((select local_day from interval_day) + time '13:00') at time zone 'America/Sao_Paulo', '[)');

create temporary table interval_results (
  rest_minutes integer primary key,
  first_start time not null,
  earliest_before_session time
) on commit drop;

do $$
declare
  v_booking_id uuid;
  v_rest integer;
  v_slots jsonb;
begin
  for v_rest in select rest from (values (0), (5), (10), (15)) as choice(rest) loop
    insert into public.bookings (
      patient_profile_id, therapist_profile_id, service_id,
      starts_at, ends_at, timezone, status, payment_status,
      buffer_before_minutes_snapshot, buffer_after_minutes_snapshot,
      legal_acceptance_recorded_at
    ) values (
      'b1000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
      ((select local_day from interval_day) + time '10:40') at time zone 'America/Sao_Paulo',
      'America/Sao_Paulo', 'draft', 'not_started', 0, v_rest, now()
    ) returning id into v_booking_id;

    v_slots := public.get_service_available_slots_v1(
      'd1000000-0000-4000-8000-000000000001',
      ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
      ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo',
      100
    );

    if v_slots is null then
      raise exception 'INTERVAL_PUBLIC_SERVICE_NOT_ELIGIBLE';
    end if;

    insert into interval_results (rest_minutes, first_start, earliest_before_session)
    select v_rest,
           min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time,
           min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')
             filter (where (slot.value ->> 'startsAt')::timestamptz
               < ((select local_day from interval_day) + time '10:40') at time zone 'America/Sao_Paulo')::time
    from jsonb_array_elements(v_slots -> 'slots') as slot(value);

    update public.bookings set status = 'cancelled_by_patient'
    where id = v_booking_id;
  end loop;
end;
$$;

select is((select first_start from interval_results where rest_minutes = 0), time '10:45', 'no rest offers 10:45');
select is((select first_start from interval_results where rest_minutes = 5), time '10:45', 'five minutes of rest offers 10:45');
select is((select first_start from interval_results where rest_minutes = 10), time '11:00', 'ten minutes of rest offers 11:00');
select is((select first_start from interval_results where rest_minutes = 15), time '11:00', 'fifteen minutes of rest offers 11:00');
select is((select count(*) from interval_results where earliest_before_session is not null), 0::bigint, 'starts inside the reserved session are removed');

update public.therapist_service_booking_settings set interval_minutes = 60
where service_id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select array_agg(candidate.starts_at at time zone 'America/Sao_Paulo' order by candidate.starts_at)
   from public.list_service_schedule_candidates_v1(
     'd1000000-0000-4000-8000-000000000001',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', now(), 100
   ) as candidate),
  array[(select local_day from interval_day) + time '10:00',
        (select local_day from interval_day) + time '11:00']::timestamp[],
  'hourly cadence offers fixed 10:00 and 11:00 starts'
);

update public.therapist_service_booking_settings
set interval_minutes = 15, buffer_after_minutes = 10
where service_id = 'd1000000-0000-4000-8000-000000000001';
update public.availability_rules set start_time = time '10:20', end_time = time '11:00'
where service_id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select min(candidate.starts_at at time zone 'America/Sao_Paulo')::time
   from public.list_service_schedule_candidates_v1(
     'd1000000-0000-4000-8000-000000000001',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', now(), 100
   ) as candidate),
  time '10:20',
  'the final session may end at the range boundary despite later rest'
);

update public.availability_rules set start_time = time '10:10', end_time = time '12:00'
where service_id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select array_agg((candidate.starts_at at time zone 'America/Sao_Paulo')::time order by candidate.starts_at)
   from (select starts_at from public.list_service_schedule_candidates_v1(
     'd1000000-0000-4000-8000-000000000001',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', now(), 100
   ) order by starts_at limit 2) as candidate),
  array[time '10:10', time '10:25'],
  'a fifteen-minute grid stays anchored at the range start'
);

select throws_ok(
  $$update public.therapist_service_booking_settings
    set buffer_before_minutes = 10
    where service_id = 'd1000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'hidden pre-session rest cannot be reactivated'
);

select is(
  (select buffer_after_minutes from public.therapist_service_booking_settings
   where service_id = 'd1000000-0000-4000-8000-000000000001'),
  10,
  'the existing post-session value remains visible and unchanged until edited'
);

select is(
  (select count(*) from public.bookings
   where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
     and starts_at = ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo'
     and buffer_after_minutes_snapshot in (0, 5, 10, 15)),
  4::bigint,
  'each existing booking keeps its own interval snapshot'
);

update public.therapist_service_booking_settings
set buffer_after_minutes = 0, interval_minutes = 15
where service_id = 'd1000000-0000-4000-8000-000000000001';
update public.availability_rules set start_time = time '10:00', end_time = time '12:00'
where service_id = 'd1000000-0000-4000-8000-000000000001';

insert into public.bookings (
  patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status,
  buffer_before_minutes_snapshot, buffer_after_minutes_snapshot,
  legal_acceptance_recorded_at
) values (
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
  ((select local_day from interval_day) + time '10:40') at time zone 'America/Sao_Paulo',
  'America/Sao_Paulo', 'draft', 'not_started', 0, 0, now()
);

select is(
  (public.reserve_booking_hold_v1(
    'b1000000-0000-4000-8000-000000000005',
    'd1000000-0000-4000-8000-000000000001',
    ((select local_day from interval_day) + time '10:45') at time zone 'America/Sao_Paulo',
    ((select local_day from interval_day) + time '11:25') at time zone 'America/Sao_Paulo',
    'America/Sao_Paulo', 'agenda-interval-1045-valid', 600
  )).status::text,
  'active',
  'the transactional hold accepts 10:45 after a 40-minute session with no rest'
);

select throws_ok(
  $$select public.reserve_booking_hold_v1(
      'b1000000-0000-4000-8000-000000000006',
      'd1000000-0000-4000-8000-000000000001',
      ((select local_day from interval_day) + time '10:30') at time zone 'America/Sao_Paulo',
      ((select local_day from interval_day) + time '11:10') at time zone 'America/Sao_Paulo',
      'America/Sao_Paulo', 'agenda-interval-1030-invalid', 600
    )$$,
  'P0001', null, 'the transactional hold rejects a start inside the reserved session'
);

update public.booking_holds
set status = 'cancelled'
where idempotency_key = 'agenda-interval-1045-valid';

update public.therapist_services
set duration_minutes = 40, status = 'active', is_bookable = true, online_only = true
where id = 'd1000000-0000-4000-8000-000000000006';
update public.therapies
set status = 'published', is_public_visible = true, is_available_for_services = true
where id = (select therapy_id from public.therapist_services
            where id = 'd1000000-0000-4000-8000-000000000006');
update public.matching_themes as theme
set is_active = true
where exists (
  select 1 from public.therapy_matching_themes as link
  join public.therapist_services as service on service.therapy_id = link.therapy_id
  where link.theme_id = theme.id
    and service.id = 'd1000000-0000-4000-8000-000000000006'
);
insert into public.therapy_matching_themes (therapy_id, theme_id, sort_order)
select service.therapy_id, theme.id, 1
from public.therapist_services as service
cross join lateral (
  select id from public.matching_themes where is_active order by sort_order, name limit 1
) as theme
where service.id = 'd1000000-0000-4000-8000-000000000006'
  and not exists (
    select 1 from public.therapy_matching_themes as existing
    join public.matching_themes as existing_theme
      on existing_theme.id = existing.theme_id and existing_theme.is_active
    where existing.therapy_id = service.therapy_id
  );
update public.therapist_service_booking_settings
set buffer_before_minutes = 0, buffer_after_minutes = 0,
    min_notice_minutes = 0, interval_minutes = 15
where service_id = 'd1000000-0000-4000-8000-000000000006';
delete from public.availability_rules
where service_id = 'd1000000-0000-4000-8000-000000000006';
insert into public.availability_rules (
  therapist_profile_id, service_id, day_of_week,
  start_time, end_time, timezone, is_active
) values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000006',
  1, time '10:00', time '12:00', 'America/Sao_Paulo', true
);

select is(
  (select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
   from jsonb_array_elements(public.get_service_available_slots_v1(
     'd1000000-0000-4000-8000-000000000006',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', 100
   ) -> 'slots') as slot(value)),
  time '10:45',
  'a booking for one therapy blocks the same therapist across other therapies'
);

insert into public.availability_exceptions (
  therapist_profile_id, service_id, starts_at, ends_at, is_available, reason
) values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select local_day from interval_day) + time '10:45') at time zone 'America/Sao_Paulo',
  ((select local_day from interval_day) + time '11:00') at time zone 'America/Sao_Paulo',
  false, 'agenda interval test block'
);

select is(
  (select min((slot.value ->> 'startsAt')::timestamptz at time zone 'America/Sao_Paulo')::time
   from jsonb_array_elements(public.get_service_available_slots_v1(
     'd1000000-0000-4000-8000-000000000001',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', 100
   ) -> 'slots') as slot(value)),
  time '11:00',
  'an unavailable exception removes a conflicting start without moving the grade'
);

update public.availability_exceptions set status = 'cancelled'
where reason = 'agenda interval test block';
update public.bookings set status = 'cancelled_by_patient'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and service_id = 'd1000000-0000-4000-8000-000000000001'
  and starts_at = ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo'
  and status = 'draft';

update public.therapist_service_booking_settings
set buffer_after_minutes = 10
where service_id = 'd1000000-0000-4000-8000-000000000001';
update public.availability_rules set start_time = time '10:20', end_time = time '11:00'
where service_id = 'd1000000-0000-4000-8000-000000000001';
insert into public.availability_exceptions (
  therapist_profile_id, service_id, starts_at, ends_at, is_available, reason
) values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  ((select local_day from interval_day) + time '11:00') at time zone 'America/Sao_Paulo',
  ((select local_day from interval_day) + time '11:10') at time zone 'America/Sao_Paulo',
  false, 'agenda interval rest after range'
);
select is(
  (select min(candidate.starts_at at time zone 'America/Sao_Paulo')::time
   from public.list_service_schedule_candidates_v1(
     'd1000000-0000-4000-8000-000000000001',
     ((select local_day from interval_day) + time '10:00') at time zone 'America/Sao_Paulo',
     ((select local_day from interval_day) + time '12:00') at time zone 'America/Sao_Paulo', now(), 100
   ) as candidate),
  time '10:20',
  'an exception during post-session rest does not erase the final session'
);

rollback;
