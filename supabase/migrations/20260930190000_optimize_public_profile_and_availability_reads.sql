-- Reduce repeated RLS and eligibility work on the two public read paths that
-- can approach the anonymous statement timeout. This migration preserves the
-- existing visibility and slot-generation contracts; it does not change any
-- booking, hold, payment, ledger, transfer, refund, or payout data.

create or replace function public.is_public_therapist_profile_visible_v1(
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
    from public.therapist_profiles as profile
    where profile.id = p_therapist_profile_id
      and profile.status = 'approved'::public.therapist_status
      and profile.is_public is true
  )
$$;

create or replace function public.is_public_therapist_profile_content_version_v1(
  p_content_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.therapist_profile_content_versions as content
    where content.id = p_content_version_id
      and content.status = 'published'
      and public.is_public_therapist_profile_visible_v1(
        content.therapist_profile_id
      )
  )
$$;

revoke all on function public.is_public_therapist_profile_visible_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_public_therapist_profile_visible_v1(uuid)
  to anon, authenticated, service_role;

revoke all on function public.is_public_therapist_profile_content_version_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.is_public_therapist_profile_content_version_v1(uuid)
  to anon, authenticated, service_role;

comment on function public.is_public_therapist_profile_visible_v1(uuid) is
  'Exact RLS helper for the approved and public therapist profile visibility predicate.';

comment on function public.is_public_therapist_profile_content_version_v1(uuid) is
  'Exact RLS helper for a published content version owned by an approved public therapist.';

drop policy if exists "Public can read published therapist profile content"
  on public.therapist_profile_content_versions;
create policy "Public can read published therapist profile content"
on public.therapist_profile_content_versions
for select
to anon, authenticated
using (
  status = 'published'
  and public.is_public_therapist_profile_visible_v1(therapist_profile_id)
);

drop policy if exists "Public can read active therapist profile guide items"
  on public.therapist_profile_guide_items;
create policy "Public can read active therapist profile guide items"
on public.therapist_profile_guide_items
for select
to anon, authenticated
using (
  is_active is true
  and public.is_public_therapist_profile_content_version_v1(content_version_id)
);

drop policy if exists "Public can read public therapist profile reflections"
  on public.therapist_profile_reflections;
create policy "Public can read public therapist profile reflections"
on public.therapist_profile_reflections
for select
to anon, authenticated
using (
  is_public is true
  and public.is_public_therapist_profile_content_version_v1(content_version_id)
);

-- Eligibility is checked once before entering the month loop. Reuse the same
-- authoritative slot engine directly for each day instead of invoking the
-- public wrapper, which would repeat publication and service eligibility for
-- every date. Slot conflicts, holds, bookings, exceptions, notice, buffers,
-- timezone, and horizon remain owned by the unchanged internal engine.
create or replace function public.get_service_available_days_v1(
  p_service_id uuid,
  p_month date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_horizon_ends_at timestamptz;
  v_month date;
  v_month_end timestamptz;
  v_month_start timestamptz;
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_timezone text;
begin
  if not public.is_public_service_booking_eligible_v1(p_service_id) then
    return null;
  end if;

  select
    schedule.timezone,
    now() + coalesce(settings.max_days_ahead, 90) * interval '1 day'
  into v_timezone, v_horizon_ends_at
  from public.therapist_services as service
  join public.therapist_schedule_settings as schedule
    on schedule.therapist_profile_id = service.therapist_profile_id
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = service.id
  where service.id = p_service_id;

  v_month := date_trunc(
    'month',
    coalesce(p_month, now() at time zone v_timezone)::date
  )::date;
  v_month_start := v_month::timestamp at time zone v_timezone;
  v_month_end := (v_month + interval '1 month')::timestamp at time zone v_timezone;
  v_range_start := greatest(v_month_start, now());
  v_range_end := least(v_month_end, v_horizon_ends_at);

  return jsonb_build_object(
    'contractVersion', 1,
    'timezone', v_timezone,
    'horizonEndsAt', v_horizon_ends_at,
    'month', to_char(v_month, 'YYYY-MM'),
    'days', case
      when v_range_start >= v_range_end then '[]'::jsonb
      else (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'date',
              to_char(local_day.day::date, 'YYYY-MM-DD')
            )
            order by local_day.day
          ),
          '[]'::jsonb
        )
        from generate_series(
          (v_range_start at time zone v_timezone)::date,
          ((v_range_end - interval '1 microsecond') at time zone v_timezone)::date,
          interval '1 day'
        ) as local_day(day)
        where jsonb_array_length(
          coalesce(
            public.get_service_available_slots_v1_internal(
              p_service_id,
              local_day.day::timestamp at time zone v_timezone,
              (local_day.day + interval '1 day')::timestamp at time zone v_timezone,
              500
            ) -> 'slots',
            '[]'::jsonb
          )
        ) > 0
      )
    end
  );
end;
$$;

revoke all on function public.get_service_available_days_v1(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_service_available_days_v1(uuid, date)
  to anon, authenticated, service_role;

comment on function public.get_service_available_days_v1(uuid, date) is
  'Public calendar-month availability. Returns only local dates that have at least one currently free authoritative slot, plus timezone and horizonEndsAt.';
