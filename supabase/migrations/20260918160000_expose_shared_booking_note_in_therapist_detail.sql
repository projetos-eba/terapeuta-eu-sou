-- A reservation note is optional. Preserve that distinction in the therapist's
-- private detail without adding it to list, agenda, or public projections.
create or replace function public.get_therapist_session_detail_v1(
  p_booking_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_session public.therapist_session_read_model_v1%rowtype;
  v_shared_note text;
begin
  select therapist.*
    into v_therapist
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = (select auth.uid())
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  select *
    into v_session
  from public.therapist_session_read_model_v1
  where "bookingId" = p_booking_id
    and "_therapistProfileId" = v_therapist.id;

  if not found then
    return null;
  end if;

  select nullif(btrim(intake.shared_note), '')
    into v_shared_note
  from public.booking_intake_responses as intake
  where intake.booking_id = v_session."bookingId"
    and intake.therapist_profile_id = v_therapist.id
    and intake.visibility = 'patient_therapist'
  limit 1;

  -- Older optional responses were persisted with this platform placeholder.
  -- Keep the record intact, but do not present it as patient-authored content.
  if v_shared_note =
    'Você poderá complementar suas informações antes do encontro, se desejar.'
  then
    v_shared_note := null;
  end if;

  return (
    to_jsonb(v_session)
    - '_therapistProfileId'
    - '_videoSessionReady'
  ) || jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_therapist.id,
    'sharedNote', v_shared_note,
    'zoomAccess',
    public.build_video_session_access_state_v1(
      v_session."bookingStatus",
      v_session."financialStatus",
      v_session."startsAt",
      v_session."endsAt",
      v_session."videoSessionStatus",
      v_session."_videoSessionReady",
      now()
    )
  );
end;
$$;

comment on function public.get_therapist_session_detail_v1(uuid) is
  'Private-safe therapist session detail. Returns null for missing or non-owned bookings, includes only an explicitly shareable optional booking note, and never exposes Zoom host credentials.';
