begin;

select plan(9);

-- The persistent seed was created on a different day. Establish today's
-- fixtures transactionally, rather than assuming the seed date is current.
update public.bookings
set starts_at = ((now() at time zone 'America/Sao_Paulo')::date + time '09:00') at time zone 'America/Sao_Paulo',
    ends_at = ((now() at time zone 'America/Sao_Paulo')::date + time '09:50') at time zone 'America/Sao_Paulo',
    status = 'confirmed', payment_status = 'paid'
where id = 'f2000000-0000-4000-8000-000000000001';
update public.session_payments set financial_status = 'paid'
where booking_id = 'f2000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table agenda_calendar_payload
on commit drop
as
select public.get_therapist_calendar_v1(
  (now() at time zone 'America/Sao_Paulo')::date,
  'month'
) as payload;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'bookings'
    ) as booking(item)
    where item ->> 'bookingId' = 'f2000000-0000-4000-8000-000000000005'
      and item ->> 'bookingStatus' = 'pending_payment'
  ),
  'a pending-payment booking remains visible in the calendar grid read model'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'todayBookings'
    ) as booking(item)
    where item ->> 'bookingId' = 'f2000000-0000-4000-8000-000000000001'
      and item ->> 'bookingStatus' = 'confirmed'
      and item ->> 'financialStatus' = 'paid'
  ),
  'todayBookings contains today confirmed paid sessions'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'todayBookings'
    ) as booking(item)
    where item ->> 'bookingId' = 'f2000000-0000-4000-8000-000000000005'
  ),
  'todayBookings excludes pending-payment reservations'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_calendar_v1(
        (now() at time zone 'America/Sao_Paulo')::date + 7,
        'week'
      ) -> 'todayBookings'
    ) as booking(item)
    where item ->> 'bookingId' = 'f2000000-0000-4000-8000-000000000001'
  ),
  'todayBookings remains populated after moving the visible calendar to next week'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_calendar_v1(
        (now() at time zone 'America/Sao_Paulo')::date + 7,
        'week'
      ) -> 'bookings'
    ) as booking(item)
    where item ->> 'bookingId' = 'f2000000-0000-4000-8000-000000000001'
  ),
  'the next-week grid remains scoped to its selected range'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'attentionItems'
    ) as attention(item)
    where item ->> 'booking_id' = 'f2000000-0000-4000-8000-000000000004'
      and item ->> 'kind' = 'reschedule'
  ),
  'a pending reschedule request remains in the operational attention rail'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'attentionItems'
    ) as attention(item)
    where item ->> 'kind' <> 'reschedule'
  ),
  'the operational attention rail excludes payment and block-impact items'
);

select is(
  (select payload #>> '{summary,pendingAttention}' from agenda_calendar_payload),
  (
    select jsonb_array_length(payload -> 'attentionItems')::text
    from agenda_calendar_payload
  ),
  'the pending-attention summary matches the reschedule-only rail'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      (select payload from agenda_calendar_payload) -> 'attentionItems'
    ) as attention(item)
    where item ->> 'booking_id' = 'f2000000-0000-4000-8000-000000000005'
  ),
  0,
  'the pending-payment booking is not treated as an agenda attention item'
);

select * from finish();

rollback;
