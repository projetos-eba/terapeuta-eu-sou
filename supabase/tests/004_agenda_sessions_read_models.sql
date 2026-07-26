begin;

select plan(18);

-- Deliberately diverge the compatibility projection from the financial authority.
update public.bookings
set payment_status = 'paid'
where id = 'f2000000-0000-4000-8000-000000000005';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_sessions_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'Ana sessions identity is derived from auth.uid()'
);

select ok(
  jsonb_array_length(public.get_therapist_sessions_v1() -> 'items') > 0,
  'Ana reads her own session summaries'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v1() -> 'items'
    ) as item
    where item ? '_therapistProfileId'
      or item ? '_videoSessionReady'
      or item ? 'videoSessionSecret'
  ),
  'session summaries exclude internal ownership and Video SDK secrets'
);

select isnt(
  public.get_therapist_session_detail_v1(
    'f2000000-0000-4000-8000-000000000004'
  ),
  null,
  'Ana reads an owned session detail'
);

select is(
  public.get_therapist_session_detail_v1(
    'f2000000-0000-4000-8000-000000000005'
  ) ->> 'financialStatus',
  'processing',
  'session detail reads canonical session_payments instead of legacy booking payment'
);

select is(
  public.get_therapist_session_detail_v1(
    'f2000000-0000-4000-8000-000000000005'
  ) #>> '{zoomAccess,reason}',
  'PAYMENT_NOT_CONFIRMED',
  'canonical pending payment blocks video access even when the legacy field says paid'
);

select is(
  public.get_therapist_session_detail_v1(
    'f2000000-0000-4000-8000-000000000006'
  ) #>> '{zoomAccess,reason}',
  'BOOKING_CANCELLED',
  'a cancelled booking has no video access'
);

select is(
  public.build_video_session_access_state_v1(
    'confirmed',
    'paid',
    '2026-07-26T13:00:00Z',
    '2026-07-26T14:00:00Z',
    null,
    false,
    '2026-07-26T13:00:00Z'
  ) ->> 'reason',
  'VIDEO_SESSION_NOT_READY',
  'a missing video session is represented explicitly'
);

select ok(
  (public.get_therapist_sessions_v1(p_limit => 1) #>> '{page,hasMore}')::boolean,
  'cursor pagination reports another page'
);

with first_page as (
  select public.get_therapist_sessions_v1(p_limit => 1) as payload
),
second_page as (
  select public.get_therapist_sessions_v1(
    p_limit => 1,
    p_cursor_starts_at =>
      (payload #>> '{page,nextCursor,startsAt}')::timestamptz,
    p_cursor_booking_id =>
      (payload #>> '{page,nextCursor,bookingId}')::uuid
  ) as payload
  from first_page
)
select isnt(
  (select payload #>> '{items,0,bookingId}' from first_page),
  (select payload #>> '{items,0,bookingId}' from second_page),
  'the next cursor page does not repeat the previous booking'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_therapist_sessions_v1(
        p_financial_status => 'processing'
      ) -> 'items'
    ) as item
    where item ->> 'financialStatus' <> 'processing'
  ),
  'financial filters are applied by the read model'
);

select is(
  jsonb_array_length(
    public.get_therapist_sessions_v1(
      p_period_start => (
        select starts_at - interval '1 day'
        from public.bookings
        where id = 'f2000000-0000-4000-8000-000000000004'
      ),
      p_period_end => (
        select starts_at
        from public.bookings
        where id = 'f2000000-0000-4000-8000-000000000004'
      ),
      p_patient_profile_id => 'b1000000-0000-4000-8000-000000000004'
    ) -> 'items'
  ),
  0,
  'session periods use a semi-open end boundary'
);

select is(
  public.get_therapist_agenda_v1(
    now() - interval '7 days',
    now() + interval '35 days'
  ) #>> '{range,endExclusive}',
  'true',
  'Agenda publishes its semi-open range contract'
);

select is(
  public.get_therapist_shell_counters_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'the lightweight shell counters work for Ana'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_session_detail_v1(
    'f2000000-0000-4000-8000-000000000004'
  ),
  null,
  'Rafael cannot read an Ana session detail'
);

select is(
  public.get_therapist_shell_counters_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000002',
  'shell counters are available to a non-Plus therapist'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_sessions_v1()',
  '42501',
  'therapist_access_required',
  'a patient cannot invoke therapist Sessions'
);

reset role;
update public.therapist_profiles
set status = 'suspended'
where id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.get_therapist_agenda_v1()',
  '42501',
  'therapist_access_blocked',
  'a suspended therapist cannot invoke Agenda'
);

select * from finish();

rollback;
