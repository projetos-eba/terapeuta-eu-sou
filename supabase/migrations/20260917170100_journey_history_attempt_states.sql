begin;

create or replace function public.get_therapist_journey_session_states_v1(
  p_booking_ids uuid[]
)
returns table(
  booking_id uuid,
  confirmation_status text,
  realization_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with scoped as (
    select
      booking.id,
      booking.status as booking_status,
      payment.service_status,
      attempt.id as session_attempt_id,
      attempt.created_at as session_attempt_created_at,
      attempt.ends_at as session_attempt_ends_at,
      public.session_attempt_evidence_v1(booking.id) as evidence
    from public.bookings as booking
    join public.therapist_profiles as therapist
      on therapist.id = booking.therapist_profile_id
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    left join public.booking_session_attempts as attempt
      on attempt.id = public.current_session_attempt_id_v1(booking.id)
    where booking.id = any(coalesce(p_booking_ids, '{}'::uuid[]))
      and therapist.user_id = (select auth.uid())
  ),
  classified as (
    select
      scoped.*,
      case
        when coalesce((evidence ->> 'available')::boolean, false)
          and coalesce((evidence ->> 'bothJoined')::boolean, false)
          and coalesce((evidence ->> 'sessionClosed')::boolean, false)
          and evidence ->> 'classification' is null
          then 'performed'
        when (
          evidence ->> 'classification' in (
            'no_show_patient',
            'no_show_therapist',
            'no_show_both'
          )
          and not (
            session_attempt_id is null
            or session_attempt_created_at > session_attempt_ends_at
          )
        )
          or booking_status in (
            'no_show_patient'::public.booking_status,
            'no_show_therapist'::public.booking_status,
            'no_show_both'::public.booking_status
          )
          then 'not_performed'
        -- A synthetic snapshot created after a concluded legacy reservation is
        -- not attendance evidence. Preserve that historical realization without
        -- treating the later snapshot as a retroactive absence.
        when (
          session_attempt_id is null
          or session_attempt_created_at > session_attempt_ends_at
        )
          and (
            booking_status = 'completed'::public.booking_status
            or service_status in (
              'confirmed_bilateral'::public.session_service_status,
              'confirmed_by_patient_review'::public.session_service_status,
              'confirmed_by_therapist'::public.session_service_status,
              'auto_confirmed'::public.session_service_status
            )
          )
          then 'performed'
        else 'pending'
      end as realization_status
    from scoped
  )
  select
    classified.id as booking_id,
    case
      when classified.realization_status = 'performed'
        and (
          (
            classified.session_attempt_id is not null
            and exists (
              select 1
              from public.session_participant_confirmations as patient_confirmation
              where patient_confirmation.session_attempt_id = classified.session_attempt_id
                and patient_confirmation.participant_role = 'patient'::public.user_role
                and patient_confirmation.outcome = 'completed'
            )
            and exists (
              select 1
              from public.session_participant_confirmations as therapist_confirmation
              where therapist_confirmation.session_attempt_id = classified.session_attempt_id
                and therapist_confirmation.participant_role = 'therapist'::public.user_role
                and therapist_confirmation.outcome = 'completed'
            )
          )
          or (
            (
              classified.session_attempt_id is null
              or classified.session_attempt_created_at > classified.session_attempt_ends_at
            )
            and classified.service_status in (
              'confirmed_bilateral'::public.session_service_status,
              'confirmed_by_patient_review'::public.session_service_status,
              'confirmed_by_therapist'::public.session_service_status,
              'auto_confirmed'::public.session_service_status
            )
          )
        )
        then 'confirmed'
      else 'pending'
    end as confirmation_status,
    classified.realization_status
  from classified;
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
  v_quality_feedback public.session_quality_feedback;
  v_evidence jsonb;
  v_session_attempt_id uuid;
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
  from public.therapist_profiles as therapist
  where therapist.user_id = p_actor_user_id
    and therapist.plan = 'premium_plus'::public.therapist_plan;

  if not found then
    raise exception 'JOURNEY_THEME_THERAPIST_PREMIUM_PLUS_REQUIRED' using errcode = '42501';
  end if;

  select booking.id, booking.patient_profile_id, booking.therapist_profile_id
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.therapist_profile_id = v_therapist.id;

  if not found then
    raise exception 'JOURNEY_THEME_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_session_attempt_id := public.current_session_attempt_id_v1(p_booking_id);
  v_evidence := public.session_attempt_evidence_v1(p_booking_id);

  select feedback.*
  into v_quality_feedback
  from public.session_quality_feedback as feedback
  where feedback.booking_id = p_booking_id
    and feedback.session_attempt_id = v_session_attempt_id
    and feedback.author_role = 'therapist'::public.user_role
    and feedback.author_profile_id = p_actor_user_id
    and feedback.successful is true;

  if v_quality_feedback.id is null
    or coalesce((v_evidence ->> 'bothJoined')::boolean, false) is not true
    or coalesce((v_evidence ->> 'sessionClosed')::boolean, false) is not true
    or v_evidence ->> 'classification' is not null then
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
  from public.booking_journey_theme_selections as selection
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
    from public.booking_journey_theme_selections as selection
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

revoke all on function public.get_therapist_journey_session_states_v1(uuid[])
  from public, anon;
grant execute on function public.get_therapist_journey_session_states_v1(uuid[])
  to authenticated, service_role;

comment on function public.get_therapist_journey_session_states_v1(uuid[]) is
  'Private therapist journey states derived from current-attempt attendance and independent participant confirmations. It never mutates booking or payment state.';
comment on function public.save_therapist_session_journey_themes_v1(uuid, uuid, text[], boolean, uuid) is
  'Service-role-only idempotent command for Premium Plus therapists after their positive current-attempt quality feedback and verified bilateral attendance.';

commit;
