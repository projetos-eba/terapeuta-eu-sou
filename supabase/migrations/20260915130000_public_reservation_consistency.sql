-- Align public publication, reservation eligibility and schedule fallbacks.
-- Existing bookings and their immutable snapshots are deliberately untouched.

begin;

create or replace function public.is_therapist_receiving_account_ready_v1(
  p_therapist_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.therapist_connect_accounts as account
    where account.therapist_profile_id = p_therapist_profile_id
      and account.is_current
      and account.closed_at is null
      and account.details_submitted
      and account.onboarding_status = 'ready'
      and account.operational_status = 'ready'
      and account.stripe_transfers_status = 'active'
      and account.payouts_enabled
      and account.payout_status = 'enabled'
      and account.payout_schedule_interval = 'daily'
      and case
        when jsonb_typeof(account.pending_requirements) = 'array'
          then jsonb_array_length(account.pending_requirements) = 0
        when jsonb_typeof(account.pending_requirements) = 'object'
          then jsonb_typeof(
            coalesce(
              account.pending_requirements -> 'currentlyDue',
              account.pending_requirements -> 'currently_due',
              '[]'::jsonb
            )
          ) = 'array'
          and jsonb_array_length(
            coalesce(
              account.pending_requirements -> 'currentlyDue',
              account.pending_requirements -> 'currently_due',
              '[]'::jsonb
            )
          ) = 0
        else false
      end
  )
$$;

revoke all on function public.is_therapist_receiving_account_ready_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_therapist_receiving_account_ready_v1(uuid)
  to service_role;

comment on function public.is_therapist_receiving_account_ready_v1(uuid) is
  'Fail-closed publication and new-booking gate for a current V10-ready receiving account.';

create or replace function public.get_therapist_publication_eligibility_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select *
    from public.therapist_profiles
    where id = p_therapist_profile_id
  ), services as (
    select
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
      )::integer as online_bookable,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
      )::integer as published_therapy,
      count(*) filter (
        where service.status = 'active'
          and service.is_bookable
          and service.online_only
          and therapy.status = 'published'
          and therapy.is_public_visible
          and public.therapy_has_active_matching_theme_v1(therapy.id)
      )::integer as eligible
    from public.therapist_services service
    join public.therapies therapy on therapy.id = service.therapy_id
    where service.therapist_profile_id = p_therapist_profile_id
      and service.archived_at is null
  )
  select jsonb_build_object(
    'eligible', coalesce(
      profile.status = 'approved'::public.therapist_status
      and profile.is_public
      and profile.is_accepting_bookings
      and profile.accepts_online_sessions
      and coalesce(services.eligible, 0) > 0
      and public.is_therapist_receiving_account_ready_v1(profile.id),
      false
    ),
    'blockers', coalesce((
      select jsonb_agg(code order by position)
      from unnest(array[
        case when profile.id is null then 'profile_not_found' end,
        case when profile.id is not null and profile.status <> 'approved'::public.therapist_status then 'profile_not_approved' end,
        case when profile.id is not null and not profile.is_public then 'profile_not_public' end,
        case when profile.id is not null and not profile.is_accepting_bookings then 'not_accepting_bookings' end,
        case when profile.id is not null and not profile.accepts_online_sessions then 'online_sessions_disabled' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) = 0 then 'no_active_bookable_online_service' end,
        case when profile.id is not null and coalesce(services.online_bookable, 0) > 0 and coalesce(services.published_therapy, 0) = 0 then 'therapy_not_public' end,
        case when profile.id is not null and coalesce(services.published_therapy, 0) > 0 and coalesce(services.eligible, 0) = 0 then 'therapy_without_active_theme' end,
        case when profile.id is not null and not public.is_therapist_receiving_account_ready_v1(profile.id) then 'receiving_account_not_ready' end
      ]) with ordinality as blockers(code, position)
      where code is not null
    ), '[]'::jsonb),
    'eligibleServiceCount', coalesce(services.eligible, 0)
  )
  from profile
  full join services on true
$$;

revoke all on function public.get_therapist_publication_eligibility_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_therapist_publication_eligibility_v1(uuid)
  to service_role;

with inserted_settings as (
  insert into public.therapist_service_booking_settings (
    service_id,
    buffer_before_minutes,
    buffer_after_minutes,
    min_notice_minutes,
    max_days_ahead,
    interval_minutes
  )
  select service.id, 0, 0, 120, 90, 30
  from public.therapist_services as service
  where service.archived_at is null
    and not exists (
      select 1
      from public.therapist_service_booking_settings as setting
      where setting.service_id = service.id
    )
  on conflict (service_id) do nothing
  returning service_id
), changed_therapists as (
  select distinct service.therapist_profile_id
  from inserted_settings as inserted
  join public.therapist_services as service on service.id = inserted.service_id
)
update public.therapist_schedule_settings as schedule
set version = schedule.version + 1,
    updated_at = now()
where schedule.therapist_profile_id in (
  select therapist_profile_id from changed_therapists
);

create or replace view public.public_therapist_profile_services_v_internal as
select therapist.slug as therapist_slug, service.id as service_id, service.title as service_title,
  service.description, service.duration_minutes, service.price_cents, service.currency,
  therapy.id as therapy_id, therapy.name as therapy_name, therapy.slug as therapy_slug,
  row_number() over (partition by therapist.id order by service.position,service.price_cents,therapy.name,service.title,service.id) as sort_order,
  coalesce(settings.buffer_before_minutes,0) as buffer_before_minutes,
  coalesce(settings.buffer_after_minutes,0) as buffer_after_minutes,
  coalesce(settings.min_notice_minutes,120) as min_notice_minutes,
  coalesce(settings.max_days_ahead,90) as max_days_ahead,
  coalesce(settings.interval_minutes,30) as interval_minutes,
  coalesce(rules.items,'[]'::jsonb) as availability_rules,
  coalesce(exceptions.items,'[]'::jsonb) as availability_exceptions,
  coalesce(conflicts.items,'[]'::jsonb) as booking_conflicts
from public.therapist_profiles therapist
join public.therapist_services service on service.therapist_profile_id=therapist.id
join public.therapies therapy on therapy.id=service.therapy_id
left join public.therapist_service_booking_settings settings on settings.service_id=service.id
left join lateral (select jsonb_agg(jsonb_build_object('dayOfWeek',rule.day_of_week,'endTime',rule.end_time::text,'isActive',rule.is_active,'serviceId',rule.service_id,'startTime',rule.start_time::text,'timezone',rule.timezone) order by rule.day_of_week,rule.start_time) as items from public.availability_rules rule where rule.therapist_profile_id=therapist.id and (rule.service_id is null or rule.service_id=service.id) and rule.is_active) rules on true
left join lateral (select jsonb_agg(jsonb_build_object('endsAt',exception.ends_at,'isAvailable',exception.is_available,'serviceId',exception.service_id,'startsAt',exception.starts_at)) as items from public.availability_exceptions exception where exception.therapist_profile_id=therapist.id and (exception.service_id is null or exception.service_id=service.id) and exception.ends_at>=now()) exceptions on true
left join lateral (select jsonb_agg(jsonb_build_object('endsAt',booking.ends_at,'serviceId',booking.service_id,'startsAt',booking.starts_at,'status',booking.status)) as items from public.bookings booking where booking.therapist_profile_id=therapist.id and booking.service_id=service.id and booking.ends_at>=now() and booking.status in ('pending_payment','confirmed','completed')) conflicts on true
where therapist.status='approved' and therapist.is_public and therapist.is_accepting_bookings and therapist.accepts_online_sessions
  and service.status='active' and service.is_bookable and service.online_only
  and therapy.status='published' and therapy.is_public_visible and public.therapy_has_active_matching_theme_v1(therapy.id);

commit;

