begin;

select plan(12);

select has_table(
  'public',
  'zoom_video_access_issue_limits',
  'Zoom Video SDK access issuance has a distributed limiter table'
);

select ok(
  to_regprocedure(
    'public.reserve_zoom_video_access_issue_v1(text,uuid,uuid,text,integer,integer)'
  ) is not null,
  'the distributed limiter RPC exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_zoom_video_access_issue_v1(text,uuid,uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke the limiter directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_zoom_video_access_issue_v1(text,uuid,uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'trusted Edge Functions can reserve access issuance'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'allowed'
  ),
  'true',
  'first issuance in the window is allowed'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'issuedCount'
  ),
  '2',
  'second issuance increments the shared counter'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'allowed'
  ),
  'true',
  'third issuance remains inside the limit'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'allowed'
  ),
  'true',
  'fourth issuance remains inside the limit'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'allowed'
  ),
  'false',
  'fifth issuance in the same window is blocked'
);

select is(
  (
    select blocked_count::text
    from public.zoom_video_access_issue_limits
    where booking_id = '94000000-0000-4000-8000-000000000021'
      and profile_id = '92000000-0000-4000-8000-000000000014'
      and actor_role = 'patient'
  ),
  '1',
  'blocked attempts are audited without secrets'
);

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '93000000-0000-4000-8000-000000000014',
      'therapist',
      60,
      4
    ) ->> 'allowed'
  ),
  'true',
  'therapist and patient have independent buckets'
);

update public.zoom_video_access_issue_limits
set window_started_at = now() - interval '10 minutes'
where booking_id = '94000000-0000-4000-8000-000000000021'
  and profile_id = '92000000-0000-4000-8000-000000000014'
  and actor_role = 'patient';

select is(
  (
    public.reserve_zoom_video_access_issue_v1(
      'development',
      '94000000-0000-4000-8000-000000000021',
      '92000000-0000-4000-8000-000000000014',
      'patient',
      60,
      4
    ) ->> 'issuedCount'
  ),
  '1',
  'expired windows reset before issuing a new token'
);

select * from finish();

rollback;
