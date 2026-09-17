begin;

-- The legacy reviews reader exposed the other participant's private answer.
-- Keep its remaining public-review projection, but publish only the actor's
-- own historical feedback and attempt-scoped quality responses.
alter function public.get_therapist_reviews_v1()
  rename to private_get_therapist_reviews_v1_legacy;
revoke all on function public.private_get_therapist_reviews_v1_legacy()
  from public, anon, authenticated, service_role;

create function public.get_therapist_reviews_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_therapist_id uuid;
  v_private jsonb;
begin
  v_payload := public.private_get_therapist_reviews_v1_legacy();
  select id into v_therapist_id from public.therapist_profiles
  where user_id = auth.uid();

  select coalesce(jsonb_agg(item order by (item->>'createdAt')::timestamptz desc), '[]'::jsonb)
    into v_private
  from (
    select legacy.value || jsonb_build_object('historical', true) as item
    from jsonb_array_elements(coalesce(v_payload->'privateFeedback', '[]'::jsonb)) legacy
    where legacy.value->>'authorRole' = 'therapist'
    union all
    select jsonb_build_object(
      'id', quality.id,
      'bookingId', quality.booking_id,
      'authorRole', 'therapist',
      'comment', quality.comment,
      'createdAt', quality.created_at,
      'notPerformedReason', null,
      'outcome', 'completed',
      'rating', quality.rating,
      'successful', quality.successful,
      'qualityReason', quality.quality_reason,
      'historical', attempt.id is distinct from public.current_session_attempt_id_v1(booking.id),
      'patientName', patient.display_name,
      'serviceTitle', service.title,
      'startsAt', attempt.starts_at
    ) as item
    from public.session_quality_feedback quality
    join public.booking_session_attempts attempt on attempt.id = quality.session_attempt_id
    join public.bookings booking on booking.id = quality.booking_id
    join public.patient_profiles patient on patient.id = booking.patient_profile_id
    left join public.therapist_services service on service.id = booking.service_id
    where quality.author_role = 'therapist' and booking.therapist_profile_id = v_therapist_id
  ) own_feedback;

  return jsonb_set(v_payload, '{privateFeedback}', v_private, true);
end;
$$;
revoke all on function public.get_therapist_reviews_v1() from public, anon;
grant execute on function public.get_therapist_reviews_v1() to authenticated, service_role;

commit;
