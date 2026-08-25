-- Local-only renewable browser fixtures. These bookings exercise real
-- cancellation, rescheduling and the mocked Zoom entry controls, so their time
-- windows must stay valid after a developer reapplies local seeds. This file
-- is referenced exclusively by supabase/config.toml and is never a production
-- migration.
update public.bookings
set
  starts_at = case id
    when 'f2000000-0000-4000-8000-000000000001'::uuid then now() + interval '10 minutes'
    when 'f2000000-0000-4000-8000-000000000002'::uuid then now() + interval '3 days'
    when 'f2000000-0000-4000-8000-000000000004'::uuid then now() + interval '4 days'
  end,
  ends_at = case id
    when 'f2000000-0000-4000-8000-000000000001'::uuid then now() + interval '1 hour 10 minutes'
    when 'f2000000-0000-4000-8000-000000000002'::uuid then now() + interval '3 days 1 hour'
    when 'f2000000-0000-4000-8000-000000000004'::uuid then now() + interval '4 days 1 hour'
  end,
  updated_at = now()
where id in (
  'f2000000-0000-4000-8000-000000000001'::uuid,
  'f2000000-0000-4000-8000-000000000002'::uuid,
  'f2000000-0000-4000-8000-000000000004'::uuid
)
  and status = 'confirmed';

-- Dedicated therapist metrics browser fixtures. These identities and their
-- operational rows are local-only, deterministic and isolated from the
-- product/demo therapists used by other journeys.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'ac000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'metricas.vazio@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Métricas Sem Histórico"}'::jsonb,
    now(),
    now()
  ),
  (
    'ac000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'metricas.completo@example.test',
    crypt('tes-mock-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Métricas Com Histórico"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where id in (
  'ac000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000002'
);

with metrics_auth_users(id, email) as (
  values
    ('ac000000-0000-4000-8000-000000000001'::uuid, 'metricas.vazio@example.test'),
    ('ac000000-0000-4000-8000-000000000002'::uuid, 'metricas.completo@example.test')
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  metrics_auth_users.id::text,
  metrics_auth_users.id,
  jsonb_build_object(
    'sub', metrics_auth_users.id::text,
    'email', metrics_auth_users.email,
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
from metrics_auth_users
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, role, display_name, email, avatar_url)
values
  (
    'ac000000-0000-4000-8000-000000000001',
    'therapist',
    'Métricas Sem Histórico',
    'metricas.vazio@example.test',
    '/therapists/celia-martins.png'
  ),
  (
    'ac000000-0000-4000-8000-000000000002',
    'therapist',
    'Métricas Com Histórico',
    'metricas.completo@example.test',
    '/therapists/ana-oliveira.png'
  )
on conflict (id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.therapist_profiles (
  id,
  user_id,
  plan,
  status,
  slug,
  public_name,
  legal_name,
  headline,
  bio,
  photo_url,
  city,
  state,
  languages,
  is_public,
  is_accepting_bookings,
  accepts_online_sessions,
  metadata
)
values
  (
    'cc000000-0000-4000-8000-000000000001',
    'ac000000-0000-4000-8000-000000000001',
    'premium_plus',
    'approved',
    'metricas-sem-historico',
    'Métricas Sem Histórico',
    'Métricas Sem Histórico',
    'Fixture local para validar o início do painel.',
    'Perfil sintético exclusivo do ambiente local de desenvolvimento.',
    '/therapists/celia-martins.png',
    'São Paulo',
    'SP',
    array['pt-BR'],
    false,
    false,
    true,
    '{"source":"local_metrics_e2e"}'::jsonb
  ),
  (
    'cc000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000002',
    'premium_plus',
    'approved',
    'metricas-com-historico',
    'Métricas Com Histórico',
    'Métricas Com Histórico',
    'Fixture local para validar o painel preenchido.',
    'Perfil sintético exclusivo do ambiente local de desenvolvimento.',
    '/therapists/ana-oliveira.png',
    'São Paulo',
    'SP',
    array['pt-BR'],
    false,
    false,
    true,
    '{"source":"local_metrics_e2e"}'::jsonb
  )
on conflict (id) do update
set
  plan = excluded.plan,
  status = excluded.status,
  public_name = excluded.public_name,
  headline = excluded.headline,
  bio = excluded.bio,
  photo_url = excluded.photo_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.therapist_services (
  id,
  therapist_profile_id,
  therapy_id,
  title,
  description,
  duration_minutes,
  price_cents,
  currency,
  status,
  online_only,
  is_bookable
)
values (
  'dc000000-0000-4000-8000-000000000001',
  'cc000000-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222225',
  'Reiki — fixture de métricas',
  'Serviço sintético local usado somente na validação agregada de métricas.',
  60,
  15000,
  'BRL',
  'active',
  true,
  false
)
on conflict (id) do update
set
  therapist_profile_id = excluded.therapist_profile_id,
  therapy_id = excluded.therapy_id,
  title = excluded.title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  status = excluded.status,
  is_bookable = excluded.is_bookable,
  updated_at = now();

with generated_bookings as (
  select
    series.n,
    (array[
      'b1000000-0000-4000-8000-000000000001'::uuid,
      'b1000000-0000-4000-8000-000000000002'::uuid,
      'b1000000-0000-4000-8000-000000000003'::uuid,
      'b1000000-0000-4000-8000-000000000004'::uuid,
      'b1000000-0000-4000-8000-000000000005'::uuid,
      'b1000000-0000-4000-8000-000000000006'::uuid,
      'b1000000-0000-4000-8000-000000000007'::uuid,
      'b1000000-0000-4000-8000-000000000008'::uuid,
      'b1000000-0000-4000-8000-000000000009'::uuid,
      'b1000000-0000-4000-8000-000000000010'::uuid
    ])[((series.n - 1) % 10) + 1] as patient_profile_id,
    case
      when series.n <= 12 then series.n * 2
      else 34 + ((series.n - 13) * 4)
    end as days_ago,
    8 + ((series.n - 1) % 5) * 2 as start_hour
  from generate_series(1, 22) as series(n)
), booking_times as (
  select
    generated_bookings.*,
    (
      current_date - generated_bookings.days_ago
      + make_time(generated_bookings.start_hour, 0, 0)
    ) at time zone 'America/Sao_Paulo' as starts_at
  from generated_bookings
)
insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  meeting_provider,
  meeting_url,
  completed_at
)
select
  md5('tes-metrics-full-booking-' || booking_times.n)::uuid,
  booking_times.patient_profile_id,
  'cc000000-0000-4000-8000-000000000002',
  'dc000000-0000-4000-8000-000000000001',
  booking_times.starts_at,
  booking_times.starts_at + interval '1 hour',
  'America/Sao_Paulo',
  'completed',
  'paid',
  'zoom',
  'https://example.test/metrics-fixture',
  booking_times.starts_at + interval '1 hour'
from booking_times
on conflict (id) do update
set
  patient_profile_id = excluded.patient_profile_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  payment_status = excluded.payment_status,
  completed_at = excluded.completed_at,
  updated_at = now();

insert into public.availability_rules (
  id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active
)
select
  md5('tes-metrics-full-rule-' || day_of_week)::uuid,
  'cc000000-0000-4000-8000-000000000002',
  'dc000000-0000-4000-8000-000000000001',
  day_of_week,
  '08:00',
  '20:00',
  'America/Sao_Paulo',
  true
from generate_series(0, 6) as generated(day_of_week)
on conflict (id) do update
set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  is_active = excluded.is_active,
  updated_at = now();

update public.therapist_availability_history_coverage
set started_at = now() - interval '121 days'
where therapist_profile_id = 'cc000000-0000-4000-8000-000000000002';

insert into public.availability_rule_history (
  source_rule_id,
  therapist_profile_id,
  service_id,
  day_of_week,
  start_time,
  end_time,
  timezone,
  is_active,
  operation,
  recorded_at
)
select
  md5('tes-metrics-full-rule-' || day_of_week)::uuid,
  'cc000000-0000-4000-8000-000000000002',
  'dc000000-0000-4000-8000-000000000001',
  day_of_week,
  '08:00',
  '20:00',
  'America/Sao_Paulo',
  true,
  'baseline',
  now() - interval '121 days'
from generate_series(0, 6) as generated(day_of_week)
where not exists (
  select 1
  from public.availability_rule_history as history
  where history.source_rule_id = md5('tes-metrics-full-rule-' || day_of_week)::uuid
    and history.recorded_at < now() - interval '120 days'
);

update public.therapist_metrics_runtime_config
set public_telemetry_enabled = true, updated_at = now()
where singleton = true;

insert into public.therapist_metric_daily_aggregates (
  therapist_profile_id,
  metric_date,
  definition_version,
  search_impressions,
  profile_views,
  booking_flow_starts,
  favorites_added,
  fresh_through
)
values
  (
    'cc000000-0000-4000-8000-000000000002',
    current_date - 5,
    1,
    48,
    30,
    16,
    8,
    now()
  ),
  (
    'cc000000-0000-4000-8000-000000000002',
    current_date - 35,
    1,
    32,
    21,
    10,
    5,
    now()
  ),
  (
    'cc000000-0000-4000-8000-000000000002',
    current_date - 70,
    1,
    20,
    12,
    6,
    3,
    now()
  )
on conflict (therapist_profile_id, metric_date, definition_version) do update
set
  search_impressions = excluded.search_impressions,
  profile_views = excluded.profile_views,
  booking_flow_starts = excluded.booking_flow_starts,
  favorites_added = excluded.favorites_added,
  fresh_through = excluded.fresh_through,
  updated_at = now();

with metric_sessions as (
  select
    period.label as period_label,
    period.days_ago,
    series.n,
    md5('tes-metrics-' || period.label || '-session-' || series.n) as session_hash
  from (
    values ('current'::text, 5), ('previous'::text, 35), ('older'::text, 70)
  ) as period(label, days_ago)
  cross join generate_series(1, 12) as series(n)
), metric_events as (
  select
    metric_sessions.*,
    event_kind.event_type,
    event_kind.sequence,
    event_kind.surface
  from metric_sessions
  cross join (
    values
      ('search_impression'::text, 1, 'therapist_search'::text),
      ('profile_view'::text, 2, 'therapist_profile'::text),
      ('booking_flow_started'::text, 3, 'therapist_profile'::text)
  ) as event_kind(event_type, sequence, surface)
)
insert into public.therapist_metric_events (
  event_id,
  event_type,
  event_source,
  therapist_profile_id,
  service_id,
  session_key_hash,
  source_surface,
  dedupe_key,
  metric_date,
  definition_version,
  occurred_at
)
select
  md5(
    'tes-metrics-' || metric_events.period_label || '-' ||
    metric_events.n || '-' || metric_events.event_type
  )::uuid,
  metric_events.event_type,
  'browser',
  'cc000000-0000-4000-8000-000000000002',
  case
    when metric_events.event_type = 'booking_flow_started'
      then 'dc000000-0000-4000-8000-000000000001'::uuid
    else null
  end,
  metric_events.session_hash,
  metric_events.surface,
  'local-metrics-e2e:' || metric_events.period_label || ':' ||
    metric_events.n || ':' || metric_events.event_type,
  current_date - metric_events.days_ago,
  1,
  (
    current_date - metric_events.days_ago
    + time '10:00'
    + make_interval(mins => metric_events.sequence)
  ) at time zone 'America/Sao_Paulo'
from metric_events
on conflict (dedupe_key) do update
set
  metric_date = excluded.metric_date,
  occurred_at = excluded.occurred_at;
