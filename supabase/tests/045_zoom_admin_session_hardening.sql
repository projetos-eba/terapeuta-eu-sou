begin;

select plan(26);

select ok(
  to_regprocedure(
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)'
  ) is not null,
  'legacy zoom session event RPC signature remains available'
);

select ok(
  to_regprocedure(
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)'
  ) is not null,
  'environment-aware zoom session event RPC signature exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'service_role keeps execute on legacy zoom session event RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'service_role gains execute on environment-aware zoom session event RPC'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-zoom-admin-hardening-unique'
);

update public.video_sessions
set provider_session_id = 'provider-session-unique-pgtap',
    scheduled_starts_at = now() - interval '30 minutes',
    scheduled_ends_at = now() + interval '30 minutes',
    status = 'ready',
    actual_started_at = null,
    actual_ended_at = null,
    hard_ends_at = null,
    therapist_first_joined_at = null,
    therapist_last_joined_at = null,
    therapist_last_left_at = null,
    therapist_present = false,
    participant_count = 0,
    last_participant_left_at = null,
    last_provider_event_at = null,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select public.apply_zoom_video_session_event_v1(
  null::text,
  'provider-session-unique-pgtap',
  'session.user_joined',
  now() - interval '20 minutes',
  'provider-user-therapist-unique',
  'tes-v1-t-hardening-unique-000000001',
  null,
  45,
  30
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'true',
  'unique provider_session_id can resolve event without session_name'
);

select isnt(
  (
    select actual_started_at::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'provider-only resolution still starts the authoritative video session'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000002',
  'development',
  'pgtap-zoom-admin-hardening-cross-dev'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000003',
  'production',
  'pgtap-zoom-admin-hardening-cross-prod'
);

update public.video_sessions
set provider_session_id = 'provider-session-shared-cross-env',
    scheduled_starts_at = now() - interval '30 minutes',
    scheduled_ends_at = now() + interval '30 minutes',
    status = 'ready',
    actual_started_at = null,
    actual_ended_at = null,
    hard_ends_at = null,
    therapist_first_joined_at = null,
    therapist_last_joined_at = null,
    therapist_last_left_at = null,
    therapist_present = false,
    participant_count = 0,
    last_participant_left_at = null,
    last_provider_event_at = null,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
where booking_id in (
  'f2000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000003'
);

select public.apply_zoom_video_session_event_v1(
  null::text,
  'provider-session-shared-cross-env',
  'session.user_joined',
  now() - interval '18 minutes',
  'provider-user-therapist-shared',
  'tes-v1-t-hardening-shared-00000001',
  null,
  45,
  30
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
  ),
  'false',
  'ambiguous provider_session_id does not update development row without environment'
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
  ),
  'false',
  'ambiguous provider_session_id does not update production row without environment'
);

select is(
  (
    select count(*)::text
    from public.video_session_participations
    where booking_id in (
      'f2000000-0000-4000-8000-000000000002',
      'f2000000-0000-4000-8000-000000000003'
    )
      and participant_correlation_key = 'tes-v1-t-hardening-shared-00000001'
  ),
  '0',
  'ambiguous cross-environment event does not create participation audit rows'
);

select public.apply_zoom_video_session_event_v1(
  null::text,
  'provider-session-shared-cross-env',
  'session.user_joined',
  now() - interval '17 minutes',
  'production',
  'provider-user-therapist-shared',
  'tes-v1-t-hardening-shared-00000001',
  null,
  45,
  30
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
  ),
  'false',
  'explicit production environment does not mutate development row'
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
  ),
  'true',
  'explicit production environment resolves provider-only event safely'
);

select is(
  (
    select count(*)::text
    from public.video_session_participations
    where booking_id = 'f2000000-0000-4000-8000-000000000003'
      and participant_correlation_key = 'tes-v1-t-hardening-shared-00000001'
  ),
  '1',
  'explicit environment inserts a single participation audit row'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000004',
  'development',
  'pgtap-zoom-admin-hardening-order'
);

update public.video_sessions
set provider_session_id = 'provider-session-order-pgtap',
    status = 'ready',
    actual_started_at = null,
    actual_ended_at = null,
    hard_ends_at = null,
    therapist_first_joined_at = null,
    therapist_last_joined_at = null,
    therapist_last_left_at = null,
    therapist_present = false,
    participant_count = 0,
    last_participant_left_at = null,
    last_provider_event_at = null,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
where booking_id = 'f2000000-0000-4000-8000-000000000004';

select public.apply_zoom_video_session_event_v1(
  null::text,
  'provider-session-order-pgtap',
  'session.user_left',
  now() - interval '5 minutes',
  'development',
  'provider-user-therapist-order',
  'tes-v1-t-hardening-order-000000001',
  null,
  45,
  30
);

select public.apply_zoom_video_session_event_v1(
  null::text,
  'provider-session-order-pgtap',
  'session.user_joined',
  now() - interval '12 minutes',
  'development',
  'provider-user-therapist-order',
  'tes-v1-t-hardening-order-000000001',
  null,
  45,
  30
);

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000004'
  ),
  'false',
  'late out-of-order join does not reopen therapist presence after a newer leave'
);

select is(
  (
    select participant_count::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000004'
  ),
  '0',
  'late out-of-order join does not inflate participant count'
);

select is(
  (
    select count(*)::text
    from public.video_session_participations
    where booking_id = 'f2000000-0000-4000-8000-000000000004'
      and participant_correlation_key = 'tes-v1-t-hardening-order-000000001'
  ),
  '2',
  'out-of-order lifecycle still preserves audit history for join and leave'
);

select public.enqueue_video_session_control_job_v1(
  (
    select id
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'end_therapist_absent',
  'pgtap-zoom-admin-hardening-job-001',
  now(),
  '{"provider_session_id":"secret-provider-id","payload":{"debug":"no-leak"}}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  'select public.admin_get_operation_detail_v1(''sessions'', ''f2000000-0000-4000-8000-000000000001''::uuid)',
  '42501',
  'admin permission required',
  'non-admin authenticated actor cannot read admin zoom session detail'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000090","role":"authenticated"}',
  true
);

select ok(
  (
    public.admin_get_operation_detail_v1(
      'sessions',
      'f2000000-0000-4000-8000-000000000001'::uuid
    ) -> 'record'
  ) ? 'video_session',
  'admin session detail includes sanitized video session aggregate'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session'
    ) ? 'session_name',
    false
  ),
  false,
  'admin session detail does not expose session_name'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session'
    ) ? 'provider_session_id',
    false
  ),
  false,
  'admin session detail does not expose provider_session_id'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session'
    ) ? 'session_key',
    false
  ),
  false,
  'admin session detail does not expose session_key'
);

select ok(
  jsonb_array_length(
    public.admin_get_operation_detail_v1(
      'sessions',
      'f2000000-0000-4000-8000-000000000001'::uuid
    ) -> 'record' -> 'video_session' -> 'participations'
  ) > 0,
  'admin session detail returns sanitized participations'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session' -> 'participations' -> 0
    ) ? 'provider_user_id',
    false
  ),
  false,
  'admin session detail omits provider_user_id from participations'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session' -> 'participations' -> 0
    ) ? 'participant_correlation_key',
    false
  ),
  false,
  'admin session detail omits participant_correlation_key from participations'
);

select ok(
  jsonb_array_length(
    public.admin_get_operation_detail_v1(
      'sessions',
      'f2000000-0000-4000-8000-000000000001'::uuid
    ) -> 'record' -> 'video_session' -> 'control_jobs'
  ) > 0,
  'admin session detail returns sanitized control jobs'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session' -> 'control_jobs' -> 0
    ) ? 'id',
    false
  ),
  false,
  'admin session detail omits control job ids'
);

select is(
  coalesce(
    (
      public.admin_get_operation_detail_v1(
        'sessions',
        'f2000000-0000-4000-8000-000000000001'::uuid
      ) -> 'record' -> 'video_session' -> 'control_jobs' -> 0
    ) ? 'metadata',
    false
  ),
  false,
  'admin session detail omits control job metadata payloads'
);

select * from finish();

rollback;
