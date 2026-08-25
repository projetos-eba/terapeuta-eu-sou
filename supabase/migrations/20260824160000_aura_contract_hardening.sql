-- Aura contract hardening.
--
-- The historical v1 read RPC remains available for migration compatibility,
-- but is no longer executable by API roles. The v2 read model applies the
-- completed-period contract to persisted rows and makes pending reviews use
-- the same selected window as the rest of the dashboard.

create or replace function public.get_therapist_aura_signals_v2(
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
  v_payload jsonb;
  v_therapist_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_pending_reviews bigint := 0;
  v_recommendations jsonb := '[]'::jsonb;
begin
  if p_period_days not in (30, 90) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_payload := public.get_therapist_aura_signals_v1(p_period_days);
  v_period_start := (v_payload #>> '{meta,periodStart}')::timestamptz;
  v_period_end := (v_payload #>> '{meta,periodEnd}')::timestamptz;

  select therapist.id
    into v_therapist_id
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist';

  if v_therapist_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*)
    into v_pending_reviews
  from public.reviews as review
  where review.therapist_profile_id = v_therapist_id
    and review.status = 'published'
    and review.published_at >= v_period_start
    and review.published_at < v_period_end
    and not exists (
      select 1
      from public.review_replies as reply
      where reply.review_id = review.id
        and reply.therapist_profile_id = v_therapist_id
        and reply.status = 'published'
        and reply.published_at is not null
    );

  select coalesce(
    jsonb_agg(
      recommendation
      order by
        (recommendation->>'priority')::integer desc,
        recommendation->>'generatedAt' desc
    ),
    '[]'::jsonb
  )
    into v_recommendations
  from jsonb_array_elements(
    coalesce(v_payload->'recommendations', '[]'::jsonb)
  ) as item(recommendation)
  where recommendation->>'ruleKey' in (
      'aura.booking_readiness.no_future_slots.v1',
      'aura.reviews.pending_reply.v1',
      'aura.sessions.cancellation_increased.v1',
      'aura.sessions.no_show_increased.v1',
      'aura.continuity.return_rate_decreased.v1'
    )
    and (recommendation->>'ruleVersion')::integer = 1
    and (recommendation->>'generatedAt')::timestamptz >= v_period_start
    and (recommendation->>'generatedAt')::timestamptz < v_period_end;

  v_payload := jsonb_set(
    v_payload,
    '{signals,reviews}',
    jsonb_build_object(
      'status', case when v_pending_reviews = 0 then 'empty' else 'ready' end,
      'pendingReplyCount', v_pending_reviews,
      'windowDays', p_period_days
    ),
    true
  );

  return jsonb_set(v_payload, '{recommendations}', v_recommendations, true);
end;
$function$;

comment on function public.get_therapist_aura_signals_v2(integer)
is 'Private deterministic Aura read model v2. Persisted recommendations must be generated inside the selected completed period, pending reviews use that same period, and only registered rule versions are returned.';

revoke all on function public.get_therapist_aura_signals_v1(integer)
from public, authenticated;
grant execute on function public.get_therapist_aura_signals_v2(integer)
to authenticated;

create or replace function public.dismiss_therapist_aura_signal_v2(
  p_recommendation_key text,
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
  v_timezone text;
  v_local_end date;
  v_period_days integer;
  v_expected_start timestamptz;
  v_expected_end timestamptz;
  v_canonical_start text;
  v_canonical_end text;
  v_rule_key text;
  v_candidate text;
  v_rule_version integer := 1;
  v_recommendation_id uuid;
  v_payload jsonb;
  v_eligible boolean := false;
  v_existing public.aura_recommendation_dismissals%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_recommendation_key is null
    or length(trim(p_recommendation_key)) < 8
    or length(p_recommendation_key) > 220
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

  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist_id;

  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_local_end := (now() at time zone v_timezone)::date;

  if p_period_start = (v_local_end - 30)::timestamp at time zone v_timezone
    and p_period_end = v_local_end::timestamp at time zone v_timezone
  then
    v_period_days := 30;
  elsif p_period_start = (v_local_end - 90)::timestamp at time zone v_timezone
    and p_period_end = v_local_end::timestamp at time zone v_timezone
  then
    v_period_days := 90;
  else
    raise exception 'PERIOD_NOT_CURRENT' using errcode = '22023';
  end if;

  v_expected_start := p_period_start;
  v_expected_end := p_period_end;
  v_canonical_start := to_char(
    v_expected_start at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_canonical_end := to_char(
    v_expected_end at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  if p_recommendation_key like 'persisted:%' then
    begin
      v_recommendation_id := substring(
        p_recommendation_key from char_length('persisted:') + 1
      )::uuid;
    exception when others then
      raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
    end;

    select recommendation.source_rule_key, recommendation.rule_version
      into v_rule_key, v_rule_version
    from public.aura_recommendations as recommendation
    where recommendation.id = v_recommendation_id
      and recommendation.therapist_profile_id = v_therapist_id
      and recommendation.source_rule_key in (
        'aura.booking_readiness.no_future_slots.v1',
        'aura.reviews.pending_reply.v1',
        'aura.sessions.cancellation_increased.v1',
        'aura.sessions.no_show_increased.v1',
        'aura.continuity.return_rate_decreased.v1'
      )
      and recommendation.rule_version = 1
      and recommendation.status in ('active', 'dismissed')
      and recommendation.is_active is true
      and recommendation.plan_required = 'premium_plus'::public.therapist_plan
      and coalesce(recommendation.expires_at, now() + interval '1 second') > now()
      and coalesce(recommendation.context->>'source', '') not in ('demo_seed', 'seed')
      and coalesce(recommendation.evidence->>'source', '') not in ('demo_seed', 'seed')
      and recommendation.patient_profile_id is null
      and recommendation.booking_id is null
      and recommendation.generated_at >= v_expected_start
      and recommendation.generated_at < v_expected_end;

    if not found then
      raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
    end if;
  else
    foreach v_candidate in array array[
      'aura.booking_readiness.no_future_slots.v1',
      'aura.reviews.pending_reply.v1',
      'aura.sessions.cancellation_increased.v1',
      'aura.sessions.no_show_increased.v1',
      'aura.continuity.return_rate_decreased.v1'
    ]
    loop
      if p_recommendation_key = v_candidate || ':' || v_canonical_start || ':' || v_canonical_end then
        v_rule_key := v_candidate;
      end if;
    end loop;

    if v_rule_key is null then
      raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_payload := public.get_therapist_aura_signals_v2(v_period_days);
    v_eligible := case v_rule_key
      when 'aura.booking_readiness.no_future_slots.v1' then
        (v_payload #>> '{signals,bookingReadiness,status}') = 'ready'
        and (v_payload #>> '{signals,bookingReadiness,publicBookableServices}')::integer > 0
        and (v_payload #>> '{signals,bookingReadiness,servicesWithFutureAvailability}')::integer = 0
      when 'aura.reviews.pending_reply.v1' then
        (v_payload #>> '{signals,reviews,status}') = 'ready'
        and (v_payload #>> '{signals,reviews,pendingReplyCount}')::integer > 0
      when 'aura.sessions.cancellation_increased.v1' then
        (v_payload #>> '{signals,sessions,cancellationRate,status}') = 'ready'
        and (v_payload #>> '{signals,sessions,cancellationRate,direction}') = 'up'
        and nullif(v_payload #>> '{signals,sessions,cancellationRate,value}', '')::numeric
          is distinct from nullif(v_payload #>> '{signals,sessions,cancellationRate,previousValue}', '')::numeric
      when 'aura.sessions.no_show_increased.v1' then
        (v_payload #>> '{signals,sessions,noShowRate,status}') = 'ready'
        and (v_payload #>> '{signals,sessions,noShowRate,direction}') = 'up'
        and nullif(v_payload #>> '{signals,sessions,noShowRate,value}', '')::numeric
          is distinct from nullif(v_payload #>> '{signals,sessions,noShowRate,previousValue}', '')::numeric
      when 'aura.continuity.return_rate_decreased.v1' then
        (v_payload #>> '{signals,continuity,returnRate,status}') = 'ready'
        and (v_payload #>> '{signals,continuity,returnRate,direction}') = 'down'
        and nullif(v_payload #>> '{signals,continuity,returnRate,value}', '')::numeric
          is distinct from nullif(v_payload #>> '{signals,continuity,returnRate,previousValue}', '')::numeric
      else false
    end;

    if not coalesce(v_eligible, false) then
      raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  select *
    into v_existing
  from public.aura_recommendation_dismissals as dismissal
  where dismissal.therapist_profile_id = v_therapist_id
    and dismissal.recommendation_key = p_recommendation_key;

  if found then
    if v_existing.period_start <> v_expected_start
      or v_existing.period_end <> v_expected_end
    then
      raise exception 'RECOMMENDATION_NOT_FOUND' using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'status', 'dismissed',
      'recommendationKey', p_recommendation_key,
      'ruleKey', v_existing.rule_key,
      'ruleVersion', v_existing.rule_version,
      'periodStart', v_existing.period_start,
      'periodEnd', v_existing.period_end
    );
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
    v_rule_key,
    v_rule_version,
    v_expected_start,
    v_expected_end,
    p_request_id
  )
  on conflict (therapist_profile_id, recommendation_key) do nothing;

  return jsonb_build_object(
    'status', 'dismissed',
    'recommendationKey', p_recommendation_key,
    'ruleKey', v_rule_key,
    'ruleVersion', v_rule_version,
    'periodStart', v_expected_start,
    'periodEnd', v_expected_end
  );
end;
$function$;

comment on function public.dismiss_therapist_aura_signal_v2(
  text,
  timestamptz,
  timestamptz,
  uuid
) is 'Server-proven Aura dismiss command. The browser supplies only an opaque key and current period; the function proves tenant ownership, registered rule/version, temporal eligibility and current rule output.';

revoke all on function public.dismiss_therapist_aura_signal_v1(
  text,
  text,
  integer,
  timestamptz,
  timestamptz,
  uuid
) from public, authenticated;

revoke all on function public.dismiss_therapist_aura_recommendation_v1(uuid, uuid)
from public, authenticated;

grant execute on function public.dismiss_therapist_aura_signal_v2(
  text,
  timestamptz,
  timestamptz,
  uuid
)
to authenticated;
