-- MTR-0.1: canonical therapist metrics read model and the isolated
-- correction that keeps favorites scoped to the therapist profile.

create or replace function public.therapist_metric_counter_v1(
  p_current bigint,
  p_previous bigint,
  p_copy_key_prefix text,
  p_unit text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_direction text;
begin
  v_direction := case
    when p_current > p_previous then 'up'
    when p_current < p_previous then 'down'
    else 'stable'
  end;

  return jsonb_build_object(
    'status', case when p_current = 0 then 'empty' else 'ready' end,
    'value', p_current,
    'previousValue', p_previous,
    'direction', v_direction,
    'directionCopyKey', p_copy_key_prefix || '.' || v_direction,
    'unit', p_unit
  );
end;
$$;

comment on function public.therapist_metric_counter_v1(bigint, bigint, text, text)
is 'Internal MTR-0.1 helper. Every counter includes a direction and a required copy key.';

revoke all on function public.therapist_metric_counter_v1(
  bigint,
  bigint,
  text,
  text
) from public, anon, authenticated;

create or replace function public.get_therapist_metrics_foundation_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
  v_current_people bigint := 0;
  v_previous_people bigint := 0;
  v_current_sessions bigint := 0;
  v_previous_sessions bigint := 0;
  v_current_minutes bigint := 0;
  v_previous_minutes bigint := 0;
begin
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

  if v_therapist.plan not in (
    'premium'::public.therapist_plan,
    'premium_plus'::public.therapist_plan
  ) then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = '42501';
  end if;

  select settings.timezone
    into v_timezone
  from public.therapist_schedule_settings as settings
  where settings.therapist_profile_id = v_therapist.id;

  if v_timezone is null then
    raise exception 'UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_current_local_end := (now() at time zone v_timezone)::date;
  v_current_local_start := v_current_local_end - 30;
  v_previous_local_start := v_current_local_start - 30;
  v_current_start := v_current_local_start::timestamp at time zone v_timezone;
  v_current_end := v_current_local_end::timestamp at time zone v_timezone;
  v_previous_start := v_previous_local_start::timestamp at time zone v_timezone;

  select
    count(distinct booking.patient_profile_id) filter (
      where booking.starts_at >= v_current_start
        and booking.starts_at < v_current_end
    ),
    count(distinct booking.patient_profile_id) filter (
      where booking.starts_at >= v_previous_start
        and booking.starts_at < v_current_start
    ),
    count(*) filter (
      where booking.starts_at >= v_current_start
        and booking.starts_at < v_current_end
    ),
    count(*) filter (
      where booking.starts_at >= v_previous_start
        and booking.starts_at < v_current_start
    ),
    coalesce(sum(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at >= v_current_start
        and booking.starts_at < v_current_end
    ), 0),
    coalesce(sum(booking.service_duration_minutes_snapshot) filter (
      where booking.starts_at >= v_previous_start
        and booking.starts_at < v_current_start
    ), 0)
    into
      v_current_people,
      v_previous_people,
      v_current_sessions,
      v_previous_sessions,
      v_current_minutes,
      v_previous_minutes
  from public.bookings as booking
  where booking.therapist_profile_id = v_therapist.id
    and booking.status = 'completed'
    and booking.starts_at >= v_previous_start
    and booking.starts_at < v_current_end;

  return jsonb_build_object(
    'contractVersion', 1,
    'metricDefinitionVersion', 1,
    'therapist', jsonb_build_object(
      'profileId', v_therapist.id,
      'plan', v_therapist.plan
    ),
    'meta', jsonb_build_object(
      'timezone', v_timezone,
      'periodDays', 30,
      'periodStart', v_current_start,
      'periodEnd', v_current_end,
      'previousPeriodStart', v_previous_start,
      'previousPeriodEnd', v_current_start,
      'computedAt', now(),
      'freshThrough', v_current_end
    ),
    'counters', jsonb_build_object(
      'peopleServed', public.therapist_metric_counter_v1(
        v_current_people,
        v_previous_people,
        'therapist_metrics.people_served',
        'people'
      ),
      'sessionsCompleted', public.therapist_metric_counter_v1(
        v_current_sessions,
        v_previous_sessions,
        'therapist_metrics.sessions_completed',
        'sessions'
      ),
      'serviceMinutes', public.therapist_metric_counter_v1(
        v_current_minutes,
        v_previous_minutes,
        'therapist_metrics.service_minutes',
        'minutes'
      )
    )
  );
end;
$$;

comment on function public.get_therapist_metrics_foundation_v1()
is 'Authenticated MTR-0.1 read model: three no-lock counters for the last 30 complete local days and the preceding comparison period.';

revoke all on function public.get_therapist_metrics_foundation_v1()
from public, anon;

grant execute on function public.get_therapist_metrics_foundation_v1()
to authenticated;

-- Favorites belong to the therapist profile. The compatibility column remains
-- nullable in the legacy service view while all service JSON contracts stop
-- exposing it.
create or replace view public.therapist_service_metrics_v1 as
select
  service.id as service_id,
  null::integer as favorite_count,
  count(distinct booking.id)::integer as booking_count,
  count(distinct booking.id) filter (
    where booking.created_at >= now() - interval '30 days'
  )::integer as bookings_last_30_days,
  null::numeric as booking_count_delta_percent
from public.therapist_services as service
left join public.bookings as booking
  on booking.service_id = service.id
group by service.id;

comment on column public.therapist_service_metrics_v1.favorite_count
is 'Deprecated compatibility column. Favorites are a therapist-profile metric and must never be attributed to an individual service.';

create or replace view public.therapist_private_services_v1 as
select
  service.id as service_id,
  service.therapist_profile_id,
  service.therapy_id,
  therapy.name as therapy_name,
  therapy.slug as therapy_slug,
  therapy.status as therapy_status,
  therapy.is_public_visible as therapy_is_public_visible,
  therapy.is_available_for_services,
  category.id as category_id,
  category.name as category_name,
  category.slug as category_slug,
  service.status,
  service.title,
  service.description,
  service.duration_minutes,
  service.price_cents,
  service.currency,
  service.delivery_format,
  service.online_only,
  service.is_bookable,
  service.position,
  service.version,
  case
    when service.status <> 'active' then false
    when service.is_bookable = false then false
    when therapist.status <> 'approved' then false
    when therapist.is_public = false then false
    when therapist.is_accepting_bookings = false then false
    when therapy.status <> 'published' then false
    when therapy.is_public_visible = false then false
    when category.is_active = false then false
    else true
  end as is_reservable,
  case
    when service.status = 'paused' then 'service_paused'
    when service.status = 'archived' then 'service_archived'
    when service.status <> 'active' then 'service_not_active'
    when service.is_bookable = false then 'service_not_accepting_bookings'
    when therapist.status <> 'approved' then 'therapist_not_approved'
    when therapist.is_public = false then 'therapist_profile_private'
    when therapist.is_accepting_bookings = false then 'therapist_not_accepting_bookings'
    when therapy.status <> 'published' then 'therapy_not_published'
    when therapy.is_public_visible = false then 'therapy_not_public'
    when category.is_active = false then 'category_inactive'
    else null
  end as blocking_reason,
  metrics.favorite_count,
  coalesce(metrics.booking_count, 0)::integer as booking_count,
  coalesce(metrics.bookings_last_30_days, 0)::integer as bookings_last_30_days,
  metrics.booking_count_delta_percent,
  service.created_at,
  service.updated_at,
  service.archived_at
from public.therapist_services as service
join public.therapist_profiles as therapist
  on therapist.id = service.therapist_profile_id
join public.therapies as therapy
  on therapy.id = service.therapy_id
join public.therapy_categories as category
  on category.id = therapy.category_id
left join public.therapist_service_metrics_v1 as metrics
  on metrics.service_id = service.id;

create or replace function public.service_row_to_private_json_v1(
  p_service_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.therapist_private_services_v1%rowtype;
begin
  select *
    into v_service
  from public.therapist_private_services_v1
  where service_id = p_service_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'serviceId', v_service.service_id,
    'therapyId', v_service.therapy_id,
    'therapy', jsonb_build_object(
      'id', v_service.therapy_id,
      'name', v_service.therapy_name,
      'slug', v_service.therapy_slug,
      'status', v_service.therapy_status,
      'isPubliclyVisible', v_service.therapy_is_public_visible,
      'isAvailableForServices', v_service.is_available_for_services
    ),
    'category', jsonb_build_object(
      'id', v_service.category_id,
      'name', v_service.category_name,
      'slug', v_service.category_slug
    ),
    'status', v_service.status,
    'title', v_service.title,
    'description', v_service.description,
    'durationMinutes', v_service.duration_minutes,
    'priceCents', v_service.price_cents,
    'currency', v_service.currency,
    'deliveryFormat', v_service.delivery_format,
    'onlineOnly', v_service.online_only,
    'isBookable', v_service.is_bookable,
    'position', v_service.position,
    'version', v_service.version,
    'isReservable', v_service.is_reservable,
    'blockingReason', v_service.blocking_reason,
    'metrics', jsonb_build_object(
      'bookingCount', v_service.booking_count,
      'bookingsLast30Days', v_service.bookings_last_30_days,
      'bookingCountDeltaPercent', v_service.booking_count_delta_percent
    ),
    'createdAt', v_service.created_at,
    'updatedAt', v_service.updated_at,
    'archivedAt', v_service.archived_at
  );
end;
$$;

create or replace function public.list_private_therapist_services_v1(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
begin
  v_therapist := public.get_therapist_for_service_actor_v1(p_actor_user_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'serviceLimit', public.therapist_service_limit_for_plan_v1(v_therapist.plan),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'serviceId', service.service_id,
            'therapyId', service.therapy_id,
            'therapy', jsonb_build_object(
              'id', service.therapy_id,
              'name', service.therapy_name,
              'slug', service.therapy_slug,
              'status', service.therapy_status,
              'isPubliclyVisible', service.therapy_is_public_visible,
              'isAvailableForServices', service.is_available_for_services
            ),
            'category', jsonb_build_object(
              'id', service.category_id,
              'name', service.category_name,
              'slug', service.category_slug
            ),
            'status', service.status,
            'title', service.title,
            'description', service.description,
            'durationMinutes', service.duration_minutes,
            'priceCents', service.price_cents,
            'currency', service.currency,
            'deliveryFormat', service.delivery_format,
            'onlineOnly', service.online_only,
            'isBookable', service.is_bookable,
            'position', service.position,
            'version', service.version,
            'isReservable', service.is_reservable,
            'blockingReason', service.blocking_reason,
            'metrics', jsonb_build_object(
              'bookingCount', service.booking_count,
              'bookingsLast30Days', service.bookings_last_30_days,
              'bookingCountDeltaPercent', service.booking_count_delta_percent
            ),
            'createdAt', service.created_at,
            'updatedAt', service.updated_at,
            'archivedAt', service.archived_at
          )
          order by service.position, service.created_at, service.service_id
        ),
        '[]'::jsonb
      )
      from public.therapist_private_services_v1 as service
      where service.therapist_profile_id = v_therapist.id
    )
  );
end;
$$;
