-- Human-readable, immutable references for therapist operational session flows.
-- The UUID remains the canonical identifier for authorization, navigation and writes.

alter table public.bookings
  add column if not exists session_reference text;

create table if not exists public.booking_session_reference_counters (
  reference_year smallint not null check (reference_year between 0 and 99),
  reference_month smallint not null check (reference_month between 1 and 12),
  last_sequence integer not null check (last_sequence between 0 and 999999),
  primary key (reference_year, reference_month)
);

revoke all on table public.booking_session_reference_counters
  from public, anon, authenticated;

create or replace function public.booking_session_reference_month_code_v1(
  p_created_at timestamptz
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case extract(month from p_created_at at time zone 'America/Sao_Paulo')::integer
    when 1 then 'J'
    when 2 then 'F'
    when 3 then 'M'
    when 4 then 'A'
    when 5 then 'I'
    when 6 then 'U'
    when 7 then 'L'
    when 8 then 'G'
    when 9 then 'S'
    when 10 then 'O'
    when 11 then 'N'
    when 12 then 'D'
  end;
$$;

create or replace function public.next_booking_session_reference_v1(
  p_created_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local_created_at timestamp;
  v_month smallint;
  v_sequence integer;
  v_year smallint;
begin
  if p_created_at is null then
    raise exception 'session_reference_created_at_required' using errcode = '22004';
  end if;

  v_local_created_at := p_created_at at time zone 'America/Sao_Paulo';
  v_year := mod(extract(year from v_local_created_at)::integer, 100)::smallint;
  v_month := extract(month from v_local_created_at)::smallint;

  insert into public.booking_session_reference_counters as counter (
    reference_year,
    reference_month,
    last_sequence
  )
  values (v_year, v_month, 1)
  on conflict (reference_year, reference_month) do update
    set last_sequence = counter.last_sequence + 1
    where counter.last_sequence < 999999
  returning last_sequence into v_sequence;

  if not found then
    raise exception 'session_reference_capacity_exhausted' using errcode = 'P0001';
  end if;

  return lpad(v_year::text, 2, '0')
    || public.booking_session_reference_month_code_v1(p_created_at)
    || lpad(v_sequence::text, 6, '0');
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.bookings
    where session_reference is null
    group by
      extract(year from created_at at time zone 'America/Sao_Paulo')::integer,
      extract(month from created_at at time zone 'America/Sao_Paulo')::integer
    having count(*) > 999999
  ) then
    raise exception 'session_reference_backfill_capacity_exhausted' using errcode = 'P0001';
  end if;
end;
$$;

with numbered_bookings as (
  select
    booking.id,
    booking.created_at,
    row_number() over (
      partition by
        extract(year from booking.created_at at time zone 'America/Sao_Paulo')::integer,
        extract(month from booking.created_at at time zone 'America/Sao_Paulo')::integer
      order by booking.created_at, booking.id
    )::integer as sequence
  from public.bookings as booking
  where booking.session_reference is null
)
update public.bookings as booking
set session_reference = lpad(
  mod(extract(year from numbered.created_at at time zone 'America/Sao_Paulo')::integer, 100)::text,
  2,
  '0'
) || public.booking_session_reference_month_code_v1(numbered.created_at)
  || lpad(numbered.sequence::text, 6, '0')
from numbered_bookings as numbered
where booking.id = numbered.id;

insert into public.booking_session_reference_counters as counter (
  reference_year,
  reference_month,
  last_sequence
)
select
  mod(extract(year from booking.created_at at time zone 'America/Sao_Paulo')::integer, 100)::smallint,
  extract(month from booking.created_at at time zone 'America/Sao_Paulo')::smallint,
  max(right(booking.session_reference, 6)::integer)
from public.bookings as booking
group by 1, 2
on conflict (reference_year, reference_month) do update
  set last_sequence = greatest(counter.last_sequence, excluded.last_sequence);

alter table public.bookings
  alter column session_reference set not null,
  add constraint bookings_session_reference_format_check
    check (session_reference ~ '^[0-9]{2}[JFMAIULGSOND][0-9]{6}$'),
  add constraint bookings_session_reference_key unique (session_reference);

create or replace function public.assign_booking_session_reference_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.session_reference is not null then
    raise exception 'session_reference_is_system_generated' using errcode = '42501';
  end if;

  new.session_reference := public.next_booking_session_reference_v1(new.created_at);
  return new;
end;
$$;

create or replace function public.protect_booking_session_reference_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_reference is distinct from old.session_reference then
    raise exception 'session_reference_immutable' using errcode = '22000';
  end if;

  return new;
end;
$$;

revoke all on function public.next_booking_session_reference_v1(timestamptz)
  from public, anon, authenticated;
revoke all on function public.assign_booking_session_reference_v1()
  from public, anon, authenticated;
revoke all on function public.protect_booking_session_reference_v1()
  from public, anon, authenticated;

drop trigger if exists bookings_assign_session_reference_before_insert on public.bookings;
create trigger bookings_assign_session_reference_before_insert
before insert on public.bookings
for each row execute function public.assign_booking_session_reference_v1();

drop trigger if exists bookings_protect_session_reference_before_update on public.bookings;
create trigger bookings_protect_session_reference_before_update
before update on public.bookings
for each row execute function public.protect_booking_session_reference_v1();

comment on column public.bookings.session_reference is
  'Immutable human-readable operational reference. UUID remains the canonical authorization key.';
comment on table public.booking_session_reference_counters is
  'Private monthly sequence state for immutable booking session references.';

create or replace view public.therapist_session_read_model_v1
with (security_invoker = true)
as
select
  booking.id as "bookingId",
  booking.therapist_profile_id as "_therapistProfileId",
  booking.patient_profile_id as "patientProfileId",
  patient.display_name as "patientName",
  patient.avatar_url as "patientAvatarUrl",
  booking.service_id as "serviceId",
  booking.service_title_snapshot as "serviceTitle",
  booking.service_duration_minutes_snapshot as "durationMinutes",
  booking.service_price_cents_snapshot as "priceCents",
  booking.currency_snapshot as "currency",
  booking.starts_at as "startsAt",
  booking.ends_at as "endsAt",
  booking.timezone,
  booking.status as "bookingStatus",
  booking.version as "bookingVersion",
  case
    when service.online_only then 'online'
    else 'in_person'
  end as modality,
  payment.financial_status as "financialStatus",
  payment.service_status as "fulfillmentStatus",
  payment.transfer_status as "transferStatus",
  payment.gross_amount_cents as "grossAmountCents",
  payment.therapist_amount_cents as "therapistAmountCents",
  payment.refund_pending as "refundPending",
  case booking.status
    when 'no_show_patient' then 'patient_no_show'
    when 'no_show_therapist' then 'therapist_no_show'
    else 'pending'
  end as "attendanceStatus",
  case
    when booking.status in ('no_show_patient', 'no_show_therapist')
      then 'booking_compatibility'
    else 'unavailable'
  end as "attendanceSource",
  reschedule.status as "rescheduleStatus",
  reschedule.proposed_starts_at as "proposedStartsAt",
  reschedule.proposed_ends_at as "proposedEndsAt",
  reschedule.proposed_timezone as "proposedTimezone",
  cancellation.decision as "cancellationDecision",
  cancellation.requires_manual_review as "cancellationRequiresReview",
  video_session.status as "videoSessionStatus",
  video_session.provider as "videoSessionProvider",
  (
    video_session.id is not null
    and video_session.status in ('ready', 'active')
  ) as "_videoSessionReady",
  booking.session_reference as "sessionReference"
from public.bookings as booking
join public.patient_profiles as patient
  on patient.id = booking.patient_profile_id
join public.therapist_services as service
  on service.id = booking.service_id
left join public.session_payments as payment
  on payment.booking_id = booking.id
left join lateral (
  select
    request.status,
    request.proposed_starts_at,
    request.proposed_ends_at,
    request.proposed_timezone
  from public.booking_reschedule_requests as request
  where request.booking_id = booking.id
  order by
    (request.status = 'pending') desc,
    request.created_at desc
  limit 1
) as reschedule on true
left join lateral (
  select
    decision.decision,
    decision.requires_manual_review
  from public.session_cancellation_decisions as decision
  where decision.booking_id = booking.id
  order by decision.created_at desc
  limit 1
) as cancellation on true
left join public.video_sessions as video_session
  on video_session.booking_id = booking.id
where public.is_current_therapist_profile(booking.therapist_profile_id);

grant select on public.therapist_session_read_model_v1 to authenticated;

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
  v_pending_sessions jsonb;
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

  select
    coalesce(jsonb_agg(row.booking_id order by row.ends_at desc, row.booking_id desc), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'bookingId', row.booking_id,
      'sessionReference', booking.session_reference
    ) order by row.ends_at desc, row.booking_id desc), '[]'::jsonb)
  into v_pending_ids, v_pending_sessions
  from public.therapist_pending_confirmation_rows_v1(v_profile.id) as row
  join public.bookings as booking
    on booking.id = row.booking_id;

  return jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_profile.id,
    'pendingBookingIds', v_pending_ids,
    'pendingSessions', v_pending_sessions,
    'pendingCount', jsonb_array_length(v_pending_ids),
    'generatedAt', now()
  );
end;
$$;

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
    'sessionReference', booking.session_reference,
    'patientName', pending.patient_name,
    'serviceTitle', pending.service_title,
    'startsAt', pending.starts_at,
    'endsAt', pending.ends_at,
    'timezone', booking.timezone,
    'dueAt', pending.due_at,
    'remainingSeconds', pending.remaining_seconds
  ) order by pending.ends_at desc, pending.booking_id desc), '[]'::jsonb)
  into v_pending
  from public.therapist_pending_confirmation_rows_v1(v_profile.id) as pending
  join public.bookings as booking
    on booking.id = pending.booking_id;

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

revoke all on function public.get_therapist_pending_confirmations_v1()
  from public, anon;
grant execute on function public.get_therapist_pending_confirmations_v1()
  to authenticated;
