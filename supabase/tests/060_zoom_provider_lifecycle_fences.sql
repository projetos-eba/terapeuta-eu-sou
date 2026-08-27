begin;
select plan(26);

-- Isolated transaction: canonical paid seed, no remote provider/API or cron.
select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001', 'development', 'pgtap-provider-fences');
update public.video_sessions
set scheduled_starts_at = now() - interval '15 minutes',
    scheduled_ends_at = now() + interval '45 minutes',
    status = 'ready', provider_session_id = null, actual_started_at = null,
    hard_ends_at = null, termination_requested_at = null,
    termination_confirmed_at = null, therapist_present = false, metadata = '{}'
where booking_id = 'f2000000-0000-4000-8000-000000000001';
delete from public.video_session_participations
where booking_id = 'f2000000-0000-4000-8000-000000000001';
create temporary view target_video as select * from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';
create function pg_temp.emit(p_provider text, p_event text, p_age_seconds integer, p_role_key text default null)
returns void language sql as $$
  select public.apply_zoom_video_session_event_v1(session_name, p_provider, p_event,
    now() - make_interval(secs => p_age_seconds), 'development', p_role_key,
    p_role_key, null, 240, 30) from target_video;
$$;

select pg_temp.emit('instance-a', 'session.user_joined', 600, 'tes-v1-t-host');
select ok((select therapist_present from target_video), 'trusted host join unlocks presence');
select is((select hard_ends_at from target_video), now() - interval '600 seconds' + interval '240 minutes', 'watchdog is independent of scheduled end');
-- Provider end may precede/miss user_left: old joined rows must not stay present.
select pg_temp.emit('instance-a', 'session.ended', 300);
select is((select status::text from target_video), 'active', 'early provider end is technical, not TES completion');
select ok((select not therapist_present and participant_count = 0 and termination_confirmed_at is null from target_video), 'technical close clears presence without finalizing');
select pg_temp.emit('instance-a', 'session.user_joined', 500, 'tes-v1-t-host');
select ok((select not therapist_present and provider_session_id is null from target_video), 'late old join cannot rebind a closed provider instance');
select pg_temp.emit('instance-a', 'session.started', 590);
select ok((select provider_session_id is null from target_video), 'late old started cannot rebind');
select pg_temp.emit('instance-a', 'session.ended', 300);
select pg_temp.emit('instance-b', 'session.user_joined', 200, 'tes-v1-p-patient');
select ok((select not therapist_present and participant_count = 1 from target_video), 'new patient event cannot revive host from previous instance');
select pg_temp.emit('instance-b', 'session.user_joined', 180, 'tes-v1-t-host');
select ok((select therapist_present and provider_session_id = 'instance-b' from target_video), 'host may reenter a new provider instance');
select is((select hard_ends_at from target_video), now() - interval '600 seconds' + interval '240 minutes', 'reentry never extends hard deadline');
select pg_temp.emit('instance-a', 'session.ended', 100);
select ok((select therapist_present and provider_session_id = 'instance-b' from target_video), 'old instance cannot end current one');
select pg_temp.emit('instance-b', 'session.user_left', 119, 'tes-v1-t-host');
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select ok(not exists(select 1 from public.video_session_control_jobs where video_session_id = (select id from target_video) and operation = 'end_therapist_absent'), '119 seconds is inside reconnect grace');
update public.video_sessions set therapist_last_left_at = now() - interval '120 seconds' where id = (select id from target_video);
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select ok(exists(select 1 from public.video_session_control_jobs where video_session_id = (select id from target_video) and operation = 'end_therapist_absent'), '120 seconds schedules absence control');

-- The authoritative request fence applies before provider confirmation.
update public.video_sessions set termination_requested_at = now() - interval '60 seconds', termination_reason = 'manual_end', therapist_present = false where id = (select id from target_video);
select pg_temp.emit('instance-b', 'session.user_joined', 50, 'tes-v1-t-host');
select ok((select not therapist_present from target_video), 'pending authorized termination cannot restore presence');
select pg_temp.emit('instance-b', 'session.ended', 40);
select ok((select status = 'ended' and termination_confirmed_at is not null from target_video), 'authorized end is logically terminal');
select pg_temp.emit('instance-b', 'session.user_joined', 30, 'tes-v1-t-host');
select ok((select status = 'ended' and not therapist_present from target_video), 'late join cannot revive completed session');

-- Reset only this transaction fixture to exercise temporal end independently.
update public.video_sessions set status = 'active', termination_requested_at = null,
  termination_confirmed_at = null, termination_reason = null,
  scheduled_ends_at = now() - interval '1 second' where id = (select id from target_video);
select pg_temp.emit('instance-b', 'session.user_joined', 0, 'tes-v1-t-host');
select ok((select not therapist_present from target_video), 'join after schedule cannot restore presence');
select pg_temp.emit('instance-b', 'session.ended', 0);
select is((select status::text from target_video), 'ended', 'provider end at final window is logically terminal');
select ok(not has_function_privilege('anon', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer)', 'EXECUTE') and not has_function_privilege('authenticated', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer)', 'EXECUTE'), 'environment overload is backend only');
select ok(not has_function_privilege('anon', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer)', 'EXECUTE') and not has_function_privilege('authenticated', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer)', 'EXECUTE'), 'compatibility overload is backend only');
select ok(has_function_privilege('service_role', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer)', 'EXECUTE') and has_function_privilege('service_role', 'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,integer,integer,integer)', 'EXECUTE'), 'service role retains both overloads');

-- Maintenance must not classify a just-closed long-running room as orphan.
delete from public.video_session_control_jobs where video_session_id = (select id from target_video);
update public.video_sessions set status = 'active', provider_session_id = 'instance-d',
  metadata = '{}', therapist_present = true, termination_requested_at = null,
  termination_confirmed_at = null, termination_reason = null,
  actual_started_at = now() - interval '20 minutes', scheduled_ends_at = now() + interval '45 minutes'
where id = (select id from target_video);
select pg_temp.emit('instance-d', 'session.user_left', 119, 'tes-v1-t-host');
select pg_temp.emit('instance-d', 'session.ended', 118);
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select ok(not exists(select 1 from public.video_session_control_jobs where video_session_id = (select id from target_video)), 'orphan reconciliation cannot bypass 120s reconnect grace');
update public.video_sessions set therapist_last_left_at = now() - interval '120 seconds',
  metadata = metadata || jsonb_build_object('zoom_provider_closed_at', now() - interval '120 seconds')
where id = (select id from target_video);
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select ok(exists(select 1 from public.video_session_control_jobs where video_session_id = (select id from target_video) and operation = 'reconcile_orphan'), 'closed provider can be finalized after grace without a REST session ID');
create temporary table reserved_jobs as select * from public.reserve_video_session_control_jobs_v1('development', 50, 60);
select ok(exists(select 1 from reserved_jobs where video_session_id = (select id from target_video)), 'due closure is reserved locally');
select ok((select termination_requested_at is not null from target_video), 'reservation fences reentry atomically before external maintenance');
delete from public.video_session_control_jobs where video_session_id = (select id from target_video);
update public.video_sessions set termination_requested_at = null, termination_reason = null,
  provider_session_id = 'instance-e', therapist_present = true where id = (select id from target_video);
select public.enqueue_video_session_control_job_v1((select id from target_video), 'end_therapist_absent', 'test-stale-absence-job', now(), '{}');
select ok(not exists(select 1 from public.reserve_video_session_control_jobs_v1('development', 50, 60) where video_session_id = (select id from target_video)), 'stale absence job cannot reserve a returned host');
select ok((select termination_requested_at is null from target_video), 'stale maintenance leaves the rejoined session open');
select * from finish();
rollback;
