begin;

create or replace function public.is_unique_text_array(p_values text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    cardinality(p_values) = (
      select count(distinct value)
      from unnest(p_values) as item(value)
    ),
    false
  );
$$;

create table if not exists public.booking_journey_theme_selections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  selected_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  theme_keys text[] not null,
  taxonomy_version text not null default 'journey_topics_v1',
  source text not null default 'therapist_post_session',
  acknowledged_at timestamptz not null default now(),
  request_id uuid not null unique,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_journey_theme_selections_count_check check (
    cardinality(theme_keys) between 1 and 3
  ),
  constraint booking_journey_theme_selections_keys_check check (
    public.is_unique_text_array(theme_keys)
  ),
  constraint booking_journey_theme_selections_taxonomy_check check (
    taxonomy_version = 'journey_topics_v1'
  ),
  constraint booking_journey_theme_selections_source_check check (
    source = 'therapist_post_session'
  )
);

create index if not exists booking_journey_theme_selections_therapist_patient_idx
  on public.booking_journey_theme_selections (
    therapist_profile_id,
    patient_profile_id,
    created_at desc
  );

drop trigger if exists set_booking_journey_theme_selections_updated_at
on public.booking_journey_theme_selections;
create trigger set_booking_journey_theme_selections_updated_at
before update on public.booking_journey_theme_selections
for each row execute function public.set_updated_at();

alter table public.booking_journey_theme_selections enable row level security;
revoke all on public.booking_journey_theme_selections from anon, authenticated;
grant select on public.booking_journey_theme_selections to authenticated;
grant all on public.booking_journey_theme_selections to service_role;

drop policy if exists "Therapists can read their own journey theme selections"
on public.booking_journey_theme_selections;
create policy "Therapists can read their own journey theme selections"
on public.booking_journey_theme_selections
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles therapist
    where therapist.id = booking_journey_theme_selections.therapist_profile_id
      and therapist.user_id = (select auth.uid())
      and therapist.plan = 'premium_plus'::public.therapist_plan
  )
);

create or replace function public.booking_journey_theme_selection_payload(
  p_selection public.booking_journey_theme_selections
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'bookingId', p_selection.booking_id,
    'selectedAt', p_selection.created_at,
    'themeKeys', p_selection.theme_keys,
    'taxonomyVersion', p_selection.taxonomy_version
  );
$$;

create or replace function public.save_therapist_session_journey_themes_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_theme_keys text[],
  p_acknowledged boolean,
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
  v_existing public.booking_journey_theme_selections;
  v_selection public.booking_journey_theme_selections;
  v_theme_keys text[];
  v_hash text;
  v_allowed_keys constant text[] := array[
    'self_knowledge',
    'emotional_wellbeing',
    'relationships_and_bonds',
    'communication',
    'personal_boundaries',
    'self_esteem_and_confidence',
    'routine_and_self_care',
    'habits_and_organization',
    'work_and_career',
    'purpose_and_life_projects',
    'family',
    'parenting',
    'partnership',
    'life_transitions',
    'body_and_presence',
    'other_topic'
  ];
begin
  if p_actor_user_id is null
    or p_booking_id is null
    or p_request_id is null
    or p_acknowledged is not true
    or cardinality(p_theme_keys) not between 1 and 3
    or public.is_unique_text_array(p_theme_keys) is not true
    or not (p_theme_keys <@ v_allowed_keys) then
    raise exception 'JOURNEY_THEME_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select therapist.*
  into v_therapist
  from public.therapist_profiles therapist
  where therapist.user_id = p_actor_user_id
    and therapist.plan = 'premium_plus'::public.therapist_plan;

  if not found then
    raise exception 'JOURNEY_THEME_THERAPIST_PREMIUM_PLUS_REQUIRED' using errcode = '42501';
  end if;

  select booking.id, booking.patient_profile_id, booking.therapist_profile_id
  into v_booking
  from public.bookings booking
  join public.session_feedback feedback
    on feedback.booking_id = booking.id
   and feedback.author_role = 'therapist'::public.user_role
   and feedback.author_profile_id = p_actor_user_id
   and feedback.outcome = 'completed'
  join public.session_participant_confirmations confirmation
    on confirmation.booking_id = booking.id
   and confirmation.participant_role = 'therapist'::public.user_role
   and confirmation.outcome = 'completed'
  where booking.id = p_booking_id
    and booking.therapist_profile_id = v_therapist.id;

  if not found then
    raise exception 'JOURNEY_THEME_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  select array_agg(theme_key order by theme_key)
  into v_theme_keys
  from unnest(p_theme_keys) as item(theme_key);

  v_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_booking_id::text,
        p_actor_user_id::text,
        'journey_topics_v1',
        array_to_string(v_theme_keys, ','),
        'acknowledged'
      ),
      'sha256'
    ),
    'hex'
  );

  select selection.*
  into v_existing
  from public.booking_journey_theme_selections selection
  where selection.booking_id = p_booking_id
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'JOURNEY_THEME_SELECTION_IMMUTABLE' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'selection', public.booking_journey_theme_selection_payload(v_existing),
      'idempotentReplay', true
    );
  end if;

  insert into public.booking_journey_theme_selections (
    booking_id,
    therapist_profile_id,
    patient_profile_id,
    selected_by_profile_id,
    theme_keys,
    request_id,
    payload_hash
  ) values (
    p_booking_id,
    v_therapist.id,
    v_booking.patient_profile_id,
    p_actor_user_id,
    v_theme_keys,
    p_request_id,
    v_hash
  )
  returning * into v_selection;

  return jsonb_build_object(
    'selection', public.booking_journey_theme_selection_payload(v_selection),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select selection.*
    into v_existing
    from public.booking_journey_theme_selections selection
    where selection.booking_id = p_booking_id
    limit 1;

    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'selection', public.booking_journey_theme_selection_payload(v_existing),
        'idempotentReplay', true
      );
    end if;

    raise exception 'JOURNEY_THEME_SELECTION_IMMUTABLE' using errcode = '23505';
end;
$$;

revoke all on function public.is_unique_text_array(text[]) from public, anon, authenticated;
revoke all on function public.booking_journey_theme_selection_payload(public.booking_journey_theme_selections) from public, anon, authenticated;
revoke all on function public.save_therapist_session_journey_themes_v1(uuid, uuid, text[], boolean, uuid) from public, anon, authenticated;
grant execute on function public.save_therapist_session_journey_themes_v1(uuid, uuid, text[], boolean, uuid) to service_role;

comment on table public.booking_journey_theme_selections is
  'Private, immutable therapist-selected journey themes for one completed session. They never change financial, confirmation, review, Aura, or analytics state.';
comment on function public.save_therapist_session_journey_themes_v1(uuid, uuid, text[], boolean, uuid) is
  'Service-role-only idempotent command for Premium Plus therapists after they confirm a completed session.';

commit;
