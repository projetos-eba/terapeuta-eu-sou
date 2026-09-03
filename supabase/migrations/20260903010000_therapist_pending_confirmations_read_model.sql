-- Therapist pending confirmations: one all-plan read model shared by the
-- dashboard, sessions list, and the paid reviews surface.

create or replace function public.therapist_pending_confirmation_rows_v1(
  p_therapist_profile_id uuid
)
returns table (
  booking_id uuid,
  patient_name text,
  service_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  remaining_seconds bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.id,
    patient.display_name,
    service.title,
    booking.starts_at,
    booking.ends_at,
    booking.ends_at + make_interval(
      days => policy.therapist_auto_confirmation_days
    ),
    greatest(0, extract(epoch from (
      booking.ends_at + make_interval(
        days => policy.therapist_auto_confirmation_days
      ) - now()
    ))::bigint)
  from public.bookings as booking
  join public.session_payments as payment
    on payment.booking_id = booking.id
  join public.financial_policy_versions as policy
    on policy.id = payment.policy_version_id
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  left join public.therapist_services as service
    on service.id = booking.service_id
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.ends_at <= now()
    and booking.status not in (
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'cancelled_by_payment',
      'refunded'
    )
    and payment.financial_status in ('paid', 'partially_refunded')
    and payment.service_status in (
      'scheduled',
      'occurred_pending_confirmation'
    )
    and payment.service_confirmed_at is null
    and payment.refund_pending = false
    and payment.disputed_at is null
    and payment.internal_contested_at is null
    and payment.admin_blocked_at is null
    and not exists (
      select 1
      from public.session_feedback as feedback
      where feedback.booking_id = booking.id
        and feedback.author_role = 'therapist'::public.user_role
    )
    and not exists (
      select 1
      from public.session_participant_confirmations as confirmation
      where confirmation.booking_id = booking.id
        and confirmation.participant_role = 'therapist'::public.user_role
    )
  order by booking.ends_at desc, booking.id desc;
$$;

create or replace function public.get_therapist_pending_confirmations_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_pending_ids jsonb;
begin
  select therapist.*
    into v_profile
  from public.profiles as profile
  join public.therapist_profiles as therapist
    on therapist.user_id = profile.id
  where profile.id = (select auth.uid())
    and profile.role = 'therapist';

  if not found then
    raise exception 'therapist_access_required' using errcode = '42501';
  end if;

  if v_profile.status in ('suspended', 'rejected') then
    raise exception 'therapist_access_blocked' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(row.booking_id order by row.ends_at desc, row.booking_id desc),
    '[]'::jsonb
  )
    into v_pending_ids
  from public.therapist_pending_confirmation_rows_v1(v_profile.id) as row;

  return jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_profile.id,
    'pendingBookingIds', v_pending_ids,
    'pendingCount', jsonb_array_length(v_pending_ids),
    'generatedAt', now()
  );
end;
$$;

-- Keep the paid reviews page on the same pending-confirmation predicate while
-- preserving its existing response shape and plan entitlement.
create or replace function public.get_therapist_reviews_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_reviews jsonb;
  v_distribution jsonb;
  v_private_feedback jsonb;
  v_pending jsonb;
  v_total integer;
  v_distinct_patients integer;
  v_average numeric;
  v_responded integer;
  v_positive integer;
begin
  v_profile := public.resolve_current_therapist_for_reviews_v1();
  if v_profile.plan not in ('premium', 'premium_plus') then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select count(*)::integer,
    count(distinct review.patient_profile_id)::integer,
    round(avg(review.rating), 1),
    count(*) filter (where reply.id is not null)::integer,
    count(*) filter (where review.rating >= 4)::integer
  into v_total, v_distinct_patients, v_average, v_responded, v_positive
  from public.reviews review
  left join public.review_replies reply
    on reply.review_id = review.id and reply.status = 'published'
  where review.therapist_profile_id = v_profile.id
    and review.status = 'published'
    and review.superseded_at is null;

  with ratings as (select generate_series(5, 1, -1) rating), counts as (
    select review.rating, count(*)::integer total
    from public.reviews review
    where review.therapist_profile_id = v_profile.id
      and review.status = 'published' and review.superseded_at is null
    group by review.rating
  )
  select jsonb_agg(jsonb_build_object(
    'rating', ratings.rating, 'count', coalesce(counts.total, 0)
  ) order by ratings.rating desc)
  into v_distribution from ratings left join counts using (rating);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', review.id,
    'patientName', coalesce(patient.display_name, 'Paciente TES'),
    'patientInitials', public.therapist_reviews_initials_v1(patient.display_name),
    'rating', review.rating,
    'comment', coalesce(review.comment, ''),
    'publishedAt', review.published_at,
    'publishedLabel', public.therapist_reviews_date_label_v1(review.published_at),
    'serviceTitle', service.title,
    'therapyName', therapy.name,
    'responseStatus', case when reply.id is null then 'pending' else 'responded' end,
    'reply', case when reply.id is null then null else jsonb_build_object(
      'id', reply.id, 'body', reply.body, 'status', reply.status,
      'publishedAt', reply.published_at
    ) end
  ) order by review.published_at desc nulls last, review.updated_at desc), '[]'::jsonb)
  into v_reviews
  from public.reviews review
  join public.patient_profiles patient on patient.id = review.patient_profile_id
  left join public.bookings booking on booking.id = review.booking_id
  left join public.therapist_services service on service.id = booking.service_id
  left join public.therapies therapy on therapy.id = service.therapy_id
  left join public.review_replies reply
    on reply.review_id = review.id and reply.status = 'published'
  where review.therapist_profile_id = v_profile.id
    and review.status = 'published' and review.superseded_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', feedback.id,
    'bookingId', feedback.booking_id,
    'authorRole', feedback.author_role,
    'comment', feedback.comment,
    'createdAt', feedback.created_at,
    'notPerformedReason', feedback.not_performed_reason,
    'outcome', feedback.outcome,
    'rating', feedback.rating,
    'patientName', patient.display_name,
    'serviceTitle', service.title,
    'startsAt', booking.starts_at
  ) order by feedback.created_at desc), '[]'::jsonb)
  into v_private_feedback
  from public.session_feedback feedback
  join public.bookings booking on booking.id = feedback.booking_id
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  left join public.therapist_services service on service.id = booking.service_id
  where booking.therapist_profile_id = v_profile.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'bookingId', pending.booking_id,
    'patientName', pending.patient_name,
    'serviceTitle', pending.service_title,
    'startsAt', pending.starts_at,
    'endsAt', pending.ends_at,
    'dueAt', pending.due_at,
    'remainingSeconds', pending.remaining_seconds
  ) order by pending.ends_at desc, pending.booking_id desc), '[]'::jsonb)
  into v_pending
  from public.therapist_pending_confirmation_rows_v1(v_profile.id) as pending;

  return jsonb_build_object(
    'therapist', jsonb_build_object(
      'profileId', v_profile.id, 'publicName', v_profile.public_name,
      'plan', v_profile.plan, 'publicSlug', v_profile.slug
    ),
    'metrics', jsonb_build_object(
      'averageRating', v_average,
      'totalReviews', coalesce(v_total, 0),
      'distinctPatients', coalesce(v_distinct_patients, 0),
      'respondedReviews', coalesce(v_responded, 0),
      'pendingReplies', greatest(coalesce(v_total, 0) - coalesce(v_responded, 0), 0),
      'positiveReviews', coalesce(v_positive, 0),
      'positivePercent', round(100 * coalesce(v_positive, 0)::numeric / nullif(v_total, 0), 0),
      'trends', jsonb_build_object(
        'averageRatingDelta', null, 'totalReviewsDelta', null,
        'respondedReviewsDelta', null, 'positivePercentDelta', null
      )
    ),
    'distribution', coalesce(v_distribution, '[]'::jsonb),
    'reviews', v_reviews,
    'privateFeedback', v_private_feedback,
    'pendingConfirmations', v_pending,
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.therapist_pending_confirmation_rows_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.therapist_pending_confirmation_rows_v1(uuid)
  to service_role;
revoke all on function public.get_therapist_pending_confirmations_v1()
  from public, anon;
grant execute on function public.get_therapist_pending_confirmations_v1()
  to authenticated;

comment on function public.get_therapist_pending_confirmations_v1() is
  'All-plan therapist read model for ended paid sessions that still need therapist confirmation.';
