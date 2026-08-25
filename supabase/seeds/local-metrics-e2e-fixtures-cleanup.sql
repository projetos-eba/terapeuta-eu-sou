-- Optional cleanup for the dedicated local Metrics browser fixtures.
-- Never execute this file outside a disposable local Supabase environment.
begin;

-- Sessions/public-profile browser fixture.
delete from public.therapy_theme_weights
where id in (
  '44444444-4444-4444-8444-444444444451',
  '44444444-4444-4444-8444-444444444452',
  '44444444-4444-4444-8444-444444444453',
  '44444444-4444-4444-8444-444444444454'
);

delete from public.therapist_services
where id = 'd1000000-0000-4000-8000-000000000007';

delete from public.therapist_connect_accounts
where id = 'c3000000-0000-4000-8000-000000000001';

-- Synthetic profile-view rows created by the local browser-only validation.
delete from public.therapist_metric_events
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and event_source = 'browser'
  and metric_date = current_date;

delete from public.therapist_metric_daily_aggregates
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and metric_date = current_date;

delete from public.therapist_metric_events
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.therapist_metric_daily_aggregates
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.availability_rule_history
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.availability_rules
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.bookings
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.therapist_services
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

delete from public.therapist_availability_history_coverage
where therapist_profile_id in (
  'cc000000-0000-4000-8000-000000000001',
  'cc000000-0000-4000-8000-000000000002'
);

delete from public.therapist_profiles
where id in (
  'cc000000-0000-4000-8000-000000000001',
  'cc000000-0000-4000-8000-000000000002'
);

delete from public.profiles
where id in (
  'ac000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000002'
);

delete from auth.users
where id in (
  'ac000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000002'
);

update public.therapist_metrics_runtime_config
set public_telemetry_enabled = false, updated_at = now()
where singleton = true;

commit;
