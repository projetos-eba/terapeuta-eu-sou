begin;

select plan(18);

select ok(
  has_function_privilege(
    'service_role',
    'public.ensure_video_session_for_paid_booking_v1(uuid,text,text)',
    'EXECUTE'
  ),
  'service_role keeps execute on ensure video session RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.ensure_video_session_for_paid_booking_v1(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute ensure video session RPC'
);

select is(
  (
    select prosecdef::text
    from pg_proc
    where oid = 'public.ensure_video_session_for_paid_booking_v1(uuid,text,text)'::regprocedure
  ),
  'true',
  'ensure video session RPC remains security definer'
);

select is(
  (
    select coalesce(
      (
        select setting
        from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg(setting)
        where setting like 'search_path=%'
        limit 1
      ),
      ''
    )
    from pg_proc p
    where p.oid = 'public.ensure_video_session_for_paid_booking_v1(uuid,text,text)'::regprocedure
  ),
  'search_path=public',
  'ensure video session RPC keeps constrained search_path'
);

select isnt(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000001',
    'development',
    'pgtap-video-session-idempotency'
  ),
  null,
  'first ensure call creates the authoritative video session'
);

select is(
  (
    select version::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  '1',
  'initial ensure call starts at version 1'
);

select is(
  (
    select metadata ->> 'source'
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'pgtap-video-session-idempotency',
  'initial ensure call stores the source metadata'
);

select is(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000001',
    'development',
    'pgtap-video-session-idempotency'
  )::text,
  (
    select id::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'identical replay returns the same video session id'
);

select is(
  (
    select version::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  '1',
  'identical replay is a no-op and does not increment version'
);

select is(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000001',
    'development',
    'pgtap-video-session-idempotency-updated'
  )::text,
  (
    select id::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'metadata-only replay keeps the same video session id'
);

select is(
  (
    select version::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  '2',
  'metadata-only change still increments version'
);

select is(
  (
    select metadata ->> 'source'
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'pgtap-video-session-idempotency-updated',
  'metadata-only change updates the stored source'
);

select isnt(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000002',
    'development',
    'pgtap-video-session-schedule'
  ),
  null,
  'schedule test creates its baseline video session'
);

update public.bookings
set starts_at = starts_at + interval '30 minutes',
    ends_at = ends_at + interval '30 minutes'
where id = 'f2000000-0000-4000-8000-000000000002';

select is(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000002',
    'development',
    'pgtap-video-session-schedule'
  )::text,
  (
    select id::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
  ),
  'schedule refresh keeps the same video session id'
);

select is(
  (
    select version::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
  ),
  '2',
  'schedule refresh increments version when booking times changed'
);

select ok(
  (
    select
      vs.scheduled_starts_at = b.starts_at
      and vs.scheduled_ends_at = b.ends_at
    from public.video_sessions vs
    join public.bookings b on b.id = vs.booking_id
    where vs.booking_id = 'f2000000-0000-4000-8000-000000000002'
  ),
  'schedule refresh updates the authoritative video session window'
);

select isnt(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000003',
    'development',
    'pgtap-video-session-status'
  ),
  null,
  'status test creates its baseline video session'
);

update public.video_sessions
set status = 'active'
where booking_id = 'f2000000-0000-4000-8000-000000000003';

select is(
  public.ensure_video_session_for_paid_booking_v1(
    'f2000000-0000-4000-8000-000000000003',
    'development',
    'pgtap-video-session-status'
  )::text,
  (
    select id::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
  ),
  'status refresh keeps the same video session id'
);

select is(
  (
    select version::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
  ),
  '2',
  'status refresh increments version when status must be normalized'
);

select is(
  (
    select status::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
  ),
  'ready',
  'status refresh preserves the ready normalization contract'
);

select * from finish();

rollback;
