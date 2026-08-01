-- MTR-6: deterministic Aura MVP.
-- Adds an aggregate read model RPC and idempotent recommendation dismissal.

alter table public.aura_recommendations
  add column if not exists status text not null default 'active',
  add column if not exists dismissed_at timestamptz,
  add column if not exists rule_version integer not null default 1,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists action_route_key text,
  add column if not exists generated_at timestamptz not null default now();

alter table public.aura_recommendations
  drop constraint if exists aura_recommendations_status_check;

alter table public.aura_recommendations
  add constraint aura_recommendations_status_check
  check (status in ('active', 'dismissed', 'expired'));

create index if not exists aura_recommendations_active_v1_idx
on public.aura_recommendations (
  therapist_profile_id,
  status,
  plan_required,
  priority desc,
  generated_at desc
)
where status = 'active';

create table if not exists public.aura_recommendation_dismissals (
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete cascade,
  recommendation_key text not null,
  rule_key text not null,
  rule_version integer not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  request_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (therapist_profile_id, recommendation_key)
);

alter table public.aura_recommendation_dismissals enable row level security;

drop policy if exists "Therapists can read own Aura dismissals"
on public.aura_recommendation_dismissals;
create policy "Therapists can read own Aura dismissals"
on public.aura_recommendation_dismissals
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

revoke all on public.aura_recommendation_dismissals from public, anon, authenticated;
grant select on public.aura_recommendation_dismissals to authenticated;

update public.aura_recommendations
set
  context = coalesce(context, '{}'::jsonb) || jsonb_build_object('source', 'demo_seed'),
  rule_version = 1,
  evidence = case
    when coalesce(evidence, '{}'::jsonb) = '{}'::jsonb then jsonb_build_object('source', 'seed')
    else evidence
  end,
  action_route_key = case
    when context->>'action_href' in ('/plus/avaliacoes', '/terapeuta/avaliacoes')
      then 'reviews'
    when context->>'action_href' in ('/plus/perfil', '/terapeuta/perfil')
      then 'profile'
    else action_route_key
  end
where source_rule_key in (
  'weekly_service_interest',
  'profile_views_growth',
  'open_schedule',
  'reply_reviews',
  'profile_video'
);

create or replace function public.get_therapist_aura_signals_v1(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
  v_current_local_end date;
  v_current_local_start date;
  v_previous_local_start date;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_next_start timestamptz;
  v_next_end timestamptz;
  v_current_completed bigint := 0;
  v_previous_completed bigint := 0;
  v_current_cancelled bigint := 0;
  v_previous_cancelled bigint := 0;
  v_current_no_shows bigint := 0;
  v_previous_no_shows bigint := 0;
  v_current_presence_sample bigint := 0;
  v_previous_presence_sample bigint := 0;
  v_current_people bigint := 0;
  v_previous_people bigint := 0;
  v_current_returned bigint := 0;
  v_previous_returned bigint := 0;
  v_pending_reviews bigint := 0;
  v_public_bookable_services bigint := 0;
  v_services_with_slots bigint := 0;
  v_active_recommendations jsonb := '[]'::jsonb;
  v_dismissals jsonb := '[]'::jsonb;
begin
  if p_period_days not in (30, 90) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select therapist.*
    into v_therapist
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'PROFILE_LOCKED' using errcode = '42501';
  end if;

  if v_therapist.plan <> 'premium_plus'::public.therapist_plan then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id;

  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  v_current_local_end := (now() at time zone v_timezone)::date;
  v_current_local_start := v_current_local_end - p_period_days;
  v_previous_local_start := v_current_local_start - p_period_days;
  v_current_start := v_current_local_start::timestamp at time zone v_timezone;
  v_current_end := v_current_local_end::timestamp at time zone v_timezone;
  v_previous_start := v_previous_local_start::timestamp at time zone v_timezone;
  v_next_start := now();
  v_next_end := now() + interval '14 days';

  select
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status = 'completed'
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status = 'completed'
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status in (
          'cancelled_by_patient',
          'cancelled_by_therapist'
        )
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status in (
          'cancelled_by_patient',
          'cancelled_by_therapist'
        )
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.status in ('no_show_patient', 'no_show_therapist')
    ),
    count(*) filter (
      where booking.starts_at < v_current_start
        and booking.status in ('no_show_patient', 'no_show_therapist')
    )
    into
      v_current_completed,
      v_previous_completed,
      v_current_cancelled,
      v_previous_cancelled,
      v_current_no_shows,
      v_previous_no_shows
  from public.bookings as booking
  where booking.therapist_profile_id = v_therapist.id
    and booking.starts_at >= v_previous_start
    and booking.starts_at < v_current_end;

  v_current_presence_sample := v_current_completed + v_current_no_shows;
  v_previous_presence_sample := v_previous_completed + v_previous_no_shows;

  with completed as (
    select booking.patient_profile_id, booking.starts_at
    from public.bookings as booking
    where booking.therapist_profile_id = v_therapist.id
      and booking.status = 'completed'
      and booking.starts_at < v_current_end
  )
  select
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_current_start
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_previous_start
        and completed.starts_at < v_current_start
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_current_start
        and exists (
          select 1
          from completed as earlier
          where earlier.patient_profile_id = completed.patient_profile_id
            and earlier.starts_at < v_current_start
        )
    ),
    count(distinct completed.patient_profile_id) filter (
      where completed.starts_at >= v_previous_start
        and completed.starts_at < v_current_start
        and exists (
          select 1
          from completed as earlier
          where earlier.patient_profile_id = completed.patient_profile_id
            and earlier.starts_at < v_previous_start
        )
    )
    into
      v_current_people,
      v_previous_people,
      v_current_returned,
      v_previous_returned
  from completed;

  select count(*)
    into v_pending_reviews
  from public.reviews as review
  where review.therapist_profile_id = v_therapist.id
    and review.status = 'published'
    and review.published_at is not null
    and not exists (
      select 1
      from public.review_replies as reply
      where reply.review_id = review.id
        and reply.therapist_profile_id = v_therapist.id
        and reply.status = 'published'
        and reply.published_at is not null
    );

  with public_services as (
    select service.id
    from public.therapist_services as service
    join public.therapies as therapy
      on therapy.id = service.therapy_id
    where service.therapist_profile_id = v_therapist.id
      and service.status = 'active'
      and service.is_bookable is true
      and service.online_only is true
      and service.delivery_format = 'online'
      and therapy.status = 'published'
      and v_therapist.status = 'approved'
      and v_therapist.is_public is true
      and v_therapist.is_accepting_bookings is true
  ),
  slot_checks as (
    select
      service.id,
      jsonb_array_length(
        coalesce(
          public.get_service_available_slots_v1(
            service.id,
            v_next_start,
            v_next_end,
            1
          )->'slots',
          '[]'::jsonb
        )
      ) as slot_count
    from public_services as service
  )
  select
    (select count(*) from public_services),
    (select count(*) from slot_checks where slot_count > 0)
    into v_public_bookable_services, v_services_with_slots;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', recommendation.id,
        'ruleKey', recommendation.source_rule_key,
        'ruleVersion', recommendation.rule_version,
        'title', recommendation.title,
        'body', recommendation.body,
        'priority', recommendation.priority,
        'actionRouteKey', recommendation.action_route_key,
        'evidence', recommendation.evidence,
        'generatedAt', recommendation.generated_at,
        'expiresAt', recommendation.expires_at
      )
      order by recommendation.priority desc, recommendation.generated_at desc
    ),
    '[]'::jsonb
  )
    into v_active_recommendations
  from public.aura_recommendations as recommendation
  where recommendation.therapist_profile_id = v_therapist.id
    and recommendation.status = 'active'
    and recommendation.is_active is true
    and recommendation.plan_required = 'premium_plus'::public.therapist_plan
    and coalesce(recommendation.expires_at, now() + interval '1 second') > now()
    and coalesce(recommendation.context->>'source', '') <> 'demo_seed'
    and recommendation.patient_profile_id is null
    and recommendation.booking_id is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recommendationKey', dismissal.recommendation_key,
        'ruleKey', dismissal.rule_key,
        'ruleVersion', dismissal.rule_version,
        'periodStart', dismissal.period_start,
        'periodEnd', dismissal.period_end,
        'dismissedAt', dismissal.dismissed_at
      )
      order by dismissal.dismissed_at desc
    ),
    '[]'::jsonb
  )
    into v_dismissals
  from public.aura_recommendation_dismissals as dismissal
  where dismissal.therapist_profile_id = v_therapist.id
    and dismissal.period_start = v_current_start
    and dismissal.period_end = v_current_end;

  return jsonb_build_object(
    'contractVersion', 1,
    'ruleRegistryVersion', 1,
    'therapist', jsonb_build_object(
      'profileId', v_therapist.id,
      'plan', v_therapist.plan
    ),
    'meta', jsonb_build_object(
      'timezone', v_timezone,
      'periodDays', p_period_days,
      'periodStart', v_current_start,
      'periodEnd', v_current_end,
      'previousPeriodStart', v_previous_start,
      'previousPeriodEnd', v_current_start,
      'computedAt', now(),
      'freshThrough', v_current_end
    ),
    'signals', jsonb_build_object(
      'bookingReadiness', jsonb_build_object(
        'status', case
          when v_public_bookable_services = 0 then 'empty'
          else 'ready'
        end,
        'windowDays', 14,
        'publicBookableServices', v_public_bookable_services,
        'servicesWithFutureAvailability', v_services_with_slots
      ),
      'reviews', jsonb_build_object(
        'status', case
          when v_pending_reviews = 0 then 'empty'
          else 'ready'
        end,
        'pendingReplyCount', v_pending_reviews
      ),
      'sessions', jsonb_build_object(
        'cancellationRate', public.therapist_metric_rate_v1(
          v_current_cancelled,
          v_current_completed + v_current_no_shows + v_current_cancelled,
          v_previous_cancelled,
          v_previous_completed + v_previous_no_shows + v_previous_cancelled,
          'therapist_metrics.sessions_cancelled',
          10
        ),
        'noShowRate', public.therapist_metric_rate_v1(
          v_current_no_shows,
          v_current_presence_sample,
          v_previous_no_shows,
          v_previous_presence_sample,
          'therapist_metrics.operational_presence',
          10
        )
      ),
      'continuity', jsonb_build_object(
        'returnRate', public.therapist_metric_rate_v1(
          v_current_returned,
          v_current_people,
          v_previous_returned,
          v_previous_people,
          'therapist_metrics.return_rate',
          10
        )
      )
    ),
    'recommendations', v_active_recommendations,
    'dismissals', v_dismissals
  );
end;
$function$;

comment on function public.get_therapist_aura_signals_v1(integer)
is 'Private deterministic Aura read model. Uses auth.uid(), Premium Plus only, aggregate signals, no patient ids, no free text and no demo recommendations.';

revoke all on function public.get_therapist_aura_signals_v1(integer)
from public;
grant execute on function public.get_therapist_aura_signals_v1(integer)
to authenticated;

create or replace function public.dismiss_therapist_aura_recommendation_v1(
  p_recommendation_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_therapist_id uuid;
  v_recommendation public.aura_recommendations%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_recommendation_id is null or p_request_id is null then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select therapist.id
    into v_therapist_id
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist'
    and therapist.plan = 'premium_plus'::public.therapist_plan
    and therapist.status not in ('suspended', 'rejected');

  if v_therapist_id is null then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select *
    into v_recommendation
  from public.aura_recommendations
  where id = p_recommendation_id
    and therapist_profile_id = v_therapist_id
  for update;

  if not found then
    raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_recommendation.status <> 'dismissed' then
    update public.aura_recommendations
    set
      status = 'dismissed',
      is_active = false,
      dismissed_at = now(),
      context = context || jsonb_build_object(
        'dismissRequestId',
        p_request_id
      ),
      updated_at = now()
    where id = p_recommendation_id;
  end if;

  return jsonb_build_object(
    'status', 'dismissed',
    'recommendationId', p_recommendation_id
  );
end;
$function$;

comment on function public.dismiss_therapist_aura_recommendation_v1(uuid, uuid)
is 'Idempotent therapist-owned dismiss command for deterministic Aura recommendations.';

revoke all on function public.dismiss_therapist_aura_recommendation_v1(uuid, uuid)
from public;
grant execute on function public.dismiss_therapist_aura_recommendation_v1(uuid, uuid)
to authenticated;

create or replace function public.dismiss_therapist_aura_signal_v1(
  p_recommendation_key text,
  p_rule_key text,
  p_rule_version integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_therapist_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_recommendation_key is null
    or length(trim(p_recommendation_key)) < 8
    or length(p_recommendation_key) > 160
    or p_rule_key is null
    or length(trim(p_rule_key)) < 8
    or length(p_rule_key) > 120
    or p_rule_version is null
    or p_rule_version < 1
    or p_period_start is null
    or p_period_end is null
    or p_period_start >= p_period_end
    or p_request_id is null
  then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select therapist.id
    into v_therapist_id
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist'
    and therapist.plan = 'premium_plus'::public.therapist_plan
    and therapist.status not in ('suspended', 'rejected');

  if v_therapist_id is null then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  insert into public.aura_recommendation_dismissals (
    therapist_profile_id,
    recommendation_key,
    rule_key,
    rule_version,
    period_start,
    period_end,
    request_id
  )
  values (
    v_therapist_id,
    p_recommendation_key,
    p_rule_key,
    p_rule_version,
    p_period_start,
    p_period_end,
    p_request_id
  )
  on conflict (therapist_profile_id, recommendation_key) do update
  set
    request_id = public.aura_recommendation_dismissals.request_id,
    dismissed_at = public.aura_recommendation_dismissals.dismissed_at;

  return jsonb_build_object(
    'status', 'dismissed',
    'recommendationKey', p_recommendation_key
  );
end;
$function$;

comment on function public.dismiss_therapist_aura_signal_v1(
  text,
  text,
  integer,
  timestamptz,
  timestamptz,
  uuid
) is 'Idempotent dismiss command for live deterministic Aura rule output.';

revoke all on function public.dismiss_therapist_aura_signal_v1(
  text,
  text,
  integer,
  timestamptz,
  timestamptz,
  uuid
) from public;
grant execute on function public.dismiss_therapist_aura_signal_v1(
  text,
  text,
  integer,
  timestamptz,
  timestamptz,
  uuid
) to authenticated;
