begin;
create function public.get_session_attempt_attendance_batch_v1(p_booking_ids uuid[])
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(booking.id::text,public.session_attempt_evidence_v1(booking.id)),'{}'::jsonb)
  from public.bookings booking join public.patient_profiles patient on patient.id=booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id=booking.therapist_profile_id
  where booking.id=any(p_booking_ids) and (patient.user_id=auth.uid() or therapist.user_id=auth.uid());
$$;
revoke all on function public.get_session_attempt_attendance_batch_v1(uuid[]) from public,anon;
grant execute on function public.get_session_attempt_attendance_batch_v1(uuid[]) to authenticated,service_role;

create or replace function public.therapist_pending_confirmation_rows_v1(p_therapist_profile_id uuid)
returns table(booking_id uuid,patient_name text,service_title text,starts_at timestamptz,
  ends_at timestamptz,due_at timestamptz,remaining_seconds bigint)
language sql stable security definer set search_path='' as $$
  select booking.id,patient.display_name,service.title,booking.starts_at,booking.ends_at,
    booking.ends_at+interval '30 days',
    greatest(0,extract(epoch from(booking.ends_at+interval '30 days'-now()))::bigint)
  from public.bookings booking join public.patient_profiles patient on patient.id=booking.patient_profile_id
  left join public.therapist_services service on service.id=booking.service_id
  where booking.therapist_profile_id=p_therapist_profile_id
    and booking.status in ('confirmed','completed')
    and exists(select 1 from public.therapist_profiles therapist where therapist.id=p_therapist_profile_id and therapist.user_id=auth.uid())
    and public.session_attempt_evidence_v1(booking.id)->>'classification' is null
    and (public.session_attempt_evidence_v1(booking.id)->>'bothJoined')::boolean
    and (public.session_attempt_evidence_v1(booking.id)->>'sessionClosed')::boolean
    and not exists(select 1 from public.session_participant_confirmations confirmation
      where confirmation.session_attempt_id=public.current_session_attempt_id_v1(booking.id) and confirmation.participant_role='therapist')
  order by booking.ends_at desc,booking.id desc;
$$;
commit;
