begin;

select plan(5);

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
