begin;

create table if not exists public.therapist_session_observations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  content text not null,
  request_id uuid not null unique,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_session_observations_content_check check (
    char_length(btrim(content)) between 1 and 4000
  )
);

drop trigger if exists set_therapist_session_observations_updated_at
on public.therapist_session_observations;
create trigger set_therapist_session_observations_updated_at
before update on public.therapist_session_observations
for each row execute function public.set_updated_at();

alter table public.therapist_session_observations enable row level security;
revoke all on public.therapist_session_observations from public, anon, authenticated;
grant all on public.therapist_session_observations to service_role;

create or replace function public.therapist_session_observation_payload(
  p_observation public.therapist_session_observations
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'bookingId', p_observation.booking_id,
    'content', p_observation.content,
    'createdAt', p_observation.created_at,
    'updatedAt', p_observation.updated_at
  );
$$;

create or replace function public.save_therapist_session_observation_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_content text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles;
  v_booking record;
  v_existing public.therapist_session_observations;
  v_observation public.therapist_session_observations;
  v_content text := btrim(coalesce(p_content, ''));
  v_hash text;
begin
  if p_actor_user_id is null
    or p_booking_id is null
    or p_request_id is null
    or char_length(v_content) not between 1 and 4000 then
    raise exception 'SESSION_OBSERVATION_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select therapist.*
    into v_therapist
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = p_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'SESSION_OBSERVATION_THERAPIST_REQUIRED' using errcode = '42501';
  end if;

  select booking.id, booking.patient_profile_id, booking.therapist_profile_id,
    booking.ends_at, booking.status
    into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.therapist_profile_id = v_therapist.id
  for update;

  if not found then
    raise exception 'SESSION_OBSERVATION_NOT_FOUND' using errcode = '42501';
  end if;

  if v_therapist.plan <> 'premium_plus'::public.therapist_plan then
    raise exception 'SESSION_OBSERVATION_PREMIUM_PLUS_REQUIRED' using errcode = '42501';
  end if;

  if v_booking.ends_at > now()
    or v_booking.status in (
      'cancelled_by_patient'::public.booking_status,
      'cancelled_by_therapist'::public.booking_status,
      'refunded'::public.booking_status
    ) then
    raise exception 'SESSION_OBSERVATION_NOT_AVAILABLE' using errcode = '42501';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, p_actor_user_id::text, v_content),
      'sha256'
    ),
    'hex'
  );

  select observation.*
    into v_existing
  from public.therapist_session_observations as observation
  where observation.booking_id = p_booking_id
  for update;

  if v_existing.id is not null and v_existing.request_id = p_request_id then
    if v_existing.payload_hash <> v_hash then
      raise exception 'SESSION_OBSERVATION_REQUEST_CONFLICT' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'idempotentReplay', true,
      'observation', public.therapist_session_observation_payload(v_existing)
    );
  end if;

  if v_existing.id is null then
    insert into public.therapist_session_observations (
      booking_id,
      therapist_profile_id,
      patient_profile_id,
      content,
      request_id,
      payload_hash
    ) values (
      p_booking_id,
      v_therapist.id,
      v_booking.patient_profile_id,
      v_content,
      p_request_id,
      v_hash
    )
    returning * into v_observation;
  else
    update public.therapist_session_observations
    set
      content = v_content,
      request_id = p_request_id,
      payload_hash = v_hash
    where id = v_existing.id
    returning * into v_observation;
  end if;

  return jsonb_build_object(
    'idempotentReplay', false,
    'observation', public.therapist_session_observation_payload(v_observation)
  );
exception
  when unique_violation then
    raise exception 'SESSION_OBSERVATION_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

revoke all on function public.therapist_session_observation_payload(public.therapist_session_observations)
from public, anon, authenticated;
revoke all on function public.save_therapist_session_observation_v1(uuid, uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.save_therapist_session_observation_v1(uuid, uuid, text, uuid)
to service_role;

comment on table public.therapist_session_observations is
  'Private free-text observation for one therapist-owned booking. It is not part of patient, admin, analytics, journey, review, financial, or public projections.';
comment on function public.save_therapist_session_observation_v1(uuid, uuid, text, uuid) is
  'Service-role-only idempotent command. Only the responsible Premium Plus therapist can save one observation after a non-cancelled session ends.';

commit;
