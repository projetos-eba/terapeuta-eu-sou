create table if not exists public.zoom_video_access_issue_limits (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  profile_id uuid not null,
  actor_role text not null,
  window_started_at timestamptz not null default now(),
  issued_count integer not null default 0,
  blocked_count integer not null default 0,
  last_issued_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint zoom_video_access_issue_limits_environment_check check (
    environment in ('development', 'production')
  ),
  constraint zoom_video_access_issue_limits_actor_role_check check (
    actor_role in ('patient', 'therapist')
  ),
  constraint zoom_video_access_issue_limits_counts_check check (
    issued_count >= 0 and blocked_count >= 0
  )
);

create unique index if not exists zoom_video_access_issue_limits_identity_idx
on public.zoom_video_access_issue_limits (
  environment,
  booking_id,
  profile_id,
  actor_role
);

create index if not exists zoom_video_access_issue_limits_updated_idx
on public.zoom_video_access_issue_limits (updated_at desc);

drop trigger if exists set_zoom_video_access_issue_limits_updated_at
on public.zoom_video_access_issue_limits;
create trigger set_zoom_video_access_issue_limits_updated_at
before update on public.zoom_video_access_issue_limits
for each row execute function public.set_updated_at();

alter table public.zoom_video_access_issue_limits enable row level security;

drop policy if exists "No direct authenticated access to zoom video access limits"
on public.zoom_video_access_issue_limits;
create policy "No direct authenticated access to zoom video access limits"
on public.zoom_video_access_issue_limits
for all
to authenticated
using (false)
with check (false);

grant all on public.zoom_video_access_issue_limits to service_role;

create or replace function public.reserve_zoom_video_access_issue_v1(
  p_environment text,
  p_booking_id uuid,
  p_profile_id uuid,
  p_actor_role text,
  p_window_seconds integer default 60,
  p_max_issued integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limit public.zoom_video_access_issue_limits%rowtype;
  v_window_seconds integer := greatest(5, least(coalesce(p_window_seconds, 60), 300));
  v_max_issued integer := greatest(1, least(coalesce(p_max_issued, 4), 20));
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_environment' using errcode = '22023';
  end if;

  if p_actor_role not in ('patient', 'therapist') then
    raise exception 'invalid_zoom_actor_role' using errcode = '22023';
  end if;

  insert into public.zoom_video_access_issue_limits (
    environment,
    booking_id,
    profile_id,
    actor_role,
    window_started_at,
    issued_count,
    blocked_count,
    last_issued_at
  )
  values (
    p_environment,
    p_booking_id,
    p_profile_id,
    p_actor_role,
    v_now,
    0,
    0,
    null
  )
  on conflict (environment, booking_id, profile_id, actor_role) do nothing;

  select *
    into v_limit
  from public.zoom_video_access_issue_limits
  where environment = p_environment
    and booking_id = p_booking_id
    and profile_id = p_profile_id
    and actor_role = p_actor_role
  for update;

  if not found then
    raise exception 'zoom_video_access_rate_limit_not_found';
  end if;

  if v_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now then
    update public.zoom_video_access_issue_limits
    set window_started_at = v_now,
        issued_count = 1,
        last_issued_at = v_now,
        updated_at = v_now
    where id = v_limit.id
    returning * into v_limit;

    return jsonb_build_object(
      'allowed', true,
      'issuedCount', v_limit.issued_count,
      'resetAt', v_limit.window_started_at + make_interval(secs => v_window_seconds)
    );
  end if;

  if v_limit.issued_count >= v_max_issued then
    update public.zoom_video_access_issue_limits
    set blocked_count = blocked_count + 1,
        updated_at = v_now
    where id = v_limit.id
    returning * into v_limit;

    return jsonb_build_object(
      'allowed', false,
      'issuedCount', v_limit.issued_count,
      'resetAt', v_limit.window_started_at + make_interval(secs => v_window_seconds)
    );
  end if;

  update public.zoom_video_access_issue_limits
  set issued_count = issued_count + 1,
      last_issued_at = v_now,
      updated_at = v_now
  where id = v_limit.id
  returning * into v_limit;

  return jsonb_build_object(
    'allowed', true,
    'issuedCount', v_limit.issued_count,
    'resetAt', v_limit.window_started_at + make_interval(secs => v_window_seconds)
  );
end;
$$;

revoke all on function public.reserve_zoom_video_access_issue_v1(
  text,
  uuid,
  uuid,
  text,
  integer,
  integer
) from public;
grant execute on function public.reserve_zoom_video_access_issue_v1(
  text,
  uuid,
  uuid,
  text,
  integer,
  integer
) to service_role;

comment on table public.zoom_video_access_issue_limits is
  'Distributed short-window limiter for Zoom Video SDK access token issuance.';
