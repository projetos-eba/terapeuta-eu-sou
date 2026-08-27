begin;

alter table public.reviews
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_review_id uuid
    references public.reviews (id) on delete restrict;

alter table public.reviews
  drop constraint if exists reviews_booking_id_key;

create table if not exists public.review_revisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete restrict,
  source_review_id uuid references public.reviews (id) on delete set null,
  revision_number integer not null,
  rating integer not null,
  comment text,
  status public.review_status not null,
  published_at timestamptz,
  changed_by_profile_id uuid references public.profiles (id) on delete set null,
  change_source text not null,
  created_at timestamptz not null default now(),
  constraint review_revisions_rating_range check (rating between 1 and 5),
  constraint review_revisions_number_positive check (revision_number > 0),
  constraint review_revisions_source_check check (
    change_source in ('legacy_migration', 'patient_edit', 'patient_hide', 'patient_republish', 'moderation')
  ),
  constraint review_revisions_unique unique (review_id, revision_number)
);

create table if not exists public.patient_review_mutation_requests (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  request_id uuid not null,
  action text not null,
  payload_hash text not null,
  review_id uuid references public.reviews (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_review_mutation_action_check check (action in ('save', 'hide', 'publish')),
  constraint patient_review_mutation_request_key unique (patient_profile_id, request_id)
);

alter table public.review_revisions enable row level security;
alter table public.patient_review_mutation_requests enable row level security;
revoke all on public.review_revisions, public.patient_review_mutation_requests
  from public, anon, authenticated;
grant all on public.review_revisions, public.patient_review_mutation_requests
  to service_role;

with ranked as (
  select
    review.*,
    first_value(review.id) over (
      partition by review.patient_profile_id, review.therapist_profile_id
      order by review.updated_at desc, review.created_at desc, review.id desc
    ) as canonical_id,
    row_number() over (
      partition by review.patient_profile_id, review.therapist_profile_id
      order by review.updated_at desc, review.created_at desc, review.id desc
    ) as relation_rank
  from public.reviews review
), numbered as (
  select ranked.*,
    row_number() over (
      partition by canonical_id order by created_at, id
    )::integer as revision_number
  from ranked
  where relation_rank > 1
)
insert into public.review_revisions (
  review_id, source_review_id, revision_number, rating, comment,
  status, published_at, change_source, created_at
)
select
  canonical_id, id, revision_number, rating, comment,
  status, published_at, 'legacy_migration', coalesce(updated_at, created_at)
from numbered
on conflict (review_id, revision_number) do nothing;

with ranked as (
  select
    review.id,
    first_value(review.id) over (
      partition by review.patient_profile_id, review.therapist_profile_id
      order by review.updated_at desc, review.created_at desc, review.id desc
    ) as canonical_id,
    row_number() over (
      partition by review.patient_profile_id, review.therapist_profile_id
      order by review.updated_at desc, review.created_at desc, review.id desc
    ) as relation_rank
  from public.reviews review
)
update public.reviews review
set superseded_at = coalesce(review.superseded_at, now()),
    superseded_by_review_id = ranked.canonical_id,
    status = 'hidden'::public.review_status,
    updated_at = now()
from ranked
where review.id = ranked.id
  and ranked.relation_rank > 1;

create unique index if not exists reviews_current_patient_therapist_key
  on public.reviews (patient_profile_id, therapist_profile_id)
  where superseded_at is null;

create index if not exists review_revisions_review_created_idx
  on public.review_revisions (review_id, created_at desc);

create or replace function public.capture_review_revision_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := coalesce(nullif(current_setting('tes.review_change_source', true), ''), 'moderation');
  v_actor uuid := nullif(current_setting('tes.review_actor_id', true), '')::uuid;
  v_revision integer;
begin
  if old.rating is not distinct from new.rating
    and old.comment is not distinct from new.comment
    and old.status is not distinct from new.status
    and old.published_at is not distinct from new.published_at then
    return new;
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision
  from public.review_revisions revision
  where revision.review_id = old.id;

  insert into public.review_revisions (
    review_id, revision_number, rating, comment, status, published_at,
    changed_by_profile_id, change_source
  ) values (
    old.id, v_revision, old.rating, old.comment, old.status, old.published_at,
    v_actor,
    case when v_source in ('patient_edit', 'patient_hide', 'patient_republish', 'moderation')
      then v_source else 'moderation' end
  );
  return new;
end;
$$;

drop trigger if exists capture_review_revision on public.reviews;
create trigger capture_review_revision
before update of rating, comment, status, published_at on public.reviews
for each row execute function public.capture_review_revision_v1();

create or replace function public.patient_review_payload_v1(p_review public.reviews)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_review.id is null then null else jsonb_build_object(
    'comment', coalesce(p_review.comment, ''),
    'createdAt', p_review.created_at,
    'id', p_review.id,
    'publishedAt', p_review.published_at,
    'rating', p_review.rating,
    'status', p_review.status,
    'updatedAt', p_review.updated_at
  ) end;
$$;

create or replace function public.get_patient_therapist_review_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_patient_id uuid;
  v_review public.reviews;
  v_eligible boolean;
begin
  if v_actor_id is null then
    raise exception 'PATIENT_REVIEW_AUTH_REQUIRED' using errcode = '42501';
  end if;
  select patient.id into v_patient_id
  from public.patient_profiles patient where patient.user_id = v_actor_id;
  if v_patient_id is null then
    raise exception 'PATIENT_REVIEW_PATIENT_REQUIRED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.bookings booking
    join public.session_participant_confirmations confirmation
      on confirmation.booking_id = booking.id
      and confirmation.participant_role = 'patient'::public.user_role
      and confirmation.outcome = 'completed'
    where booking.patient_profile_id = v_patient_id
      and booking.therapist_profile_id = p_therapist_profile_id
  ) into v_eligible;

  select review.* into v_review
  from public.reviews review
  where review.patient_profile_id = v_patient_id
    and review.therapist_profile_id = p_therapist_profile_id
    and review.superseded_at is null;

  return jsonb_build_object(
    'eligible', v_eligible,
    'review', public.patient_review_payload_v1(v_review),
    'therapistProfileId', p_therapist_profile_id
  );
end;
$$;

create or replace function public.save_patient_therapist_review_for_actor_v1(
  p_actor_user_id uuid,
  p_therapist_profile_id uuid,
  p_action text,
  p_rating integer,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient public.patient_profiles%rowtype;
  v_booking_id uuid;
  v_review public.reviews;
  v_existing_request public.patient_review_mutation_requests%rowtype;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_hash text;
  v_change_source text;
begin
  if p_actor_user_id is null or p_therapist_profile_id is null or p_request_id is null
    or p_action not in ('save', 'hide', 'publish')
    or char_length(v_comment) > 1000 then
    raise exception 'PATIENT_REVIEW_VALIDATION_ERROR' using errcode = '22023';
  end if;
  if p_action in ('save', 'publish') and (p_rating is null or p_rating not between 1 and 5) then
    raise exception 'PATIENT_REVIEW_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select patient.* into v_patient
  from public.patient_profiles patient where patient.user_id = p_actor_user_id;
  if v_patient.id is null then
    raise exception 'PATIENT_REVIEW_PATIENT_REQUIRED' using errcode = '42501';
  end if;

  select booking.id into v_booking_id
  from public.bookings booking
  join public.session_participant_confirmations confirmation
    on confirmation.booking_id = booking.id
    and confirmation.participant_role = 'patient'::public.user_role
    and confirmation.outcome = 'completed'
  where booking.patient_profile_id = v_patient.id
    and booking.therapist_profile_id = p_therapist_profile_id
  order by confirmation.confirmed_at desc, booking.ends_at desc
  limit 1;
  if v_booking_id is null then
    raise exception 'PATIENT_REVIEW_RELATION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'action', p_action,
    'comment', v_comment,
    'rating', p_rating,
    'therapistProfileId', p_therapist_profile_id
  )::text, 'sha256'), 'hex');

  select request.* into v_existing_request
  from public.patient_review_mutation_requests request
  where request.patient_profile_id = v_patient.id
    and request.request_id = p_request_id
  for update;
  if v_existing_request.id is not null then
    if v_existing_request.payload_hash <> v_hash then
      raise exception 'PATIENT_REVIEW_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select review.* into v_review from public.reviews review
    where review.id = v_existing_request.review_id;
    return jsonb_build_object(
      'idempotentReplay', true,
      'review', public.patient_review_payload_v1(v_review)
    );
  end if;

  select review.* into v_review
  from public.reviews review
  where review.patient_profile_id = v_patient.id
    and review.therapist_profile_id = p_therapist_profile_id
    and review.superseded_at is null
  for update;

  if p_action = 'hide' then
    if v_review.id is null then raise exception 'PATIENT_REVIEW_NOT_FOUND'; end if;
    perform set_config('tes.review_change_source', 'patient_hide', true);
    perform set_config('tes.review_actor_id', p_actor_user_id::text, true);
    update public.reviews
    set status = 'hidden', published_at = null, updated_at = now()
    where id = v_review.id returning * into v_review;
  elsif v_review.id is null then
    insert into public.reviews (
      booking_id, patient_profile_id, therapist_profile_id,
      rating, comment, status, published_at
    ) values (
      v_booking_id, v_patient.id, p_therapist_profile_id,
      p_rating, nullif(v_comment, ''), 'published', now()
    ) returning * into v_review;
  else
    v_change_source := case when p_action = 'publish'
      then 'patient_republish' else 'patient_edit' end;
    perform set_config('tes.review_change_source', v_change_source, true);
    perform set_config('tes.review_actor_id', p_actor_user_id::text, true);
    update public.reviews
    set booking_id = v_booking_id,
        rating = p_rating,
        comment = nullif(v_comment, ''),
        status = 'published',
        published_at = case when status = 'published' then published_at else now() end,
        updated_at = now()
    where id = v_review.id returning * into v_review;
  end if;

  insert into public.patient_review_mutation_requests (
    patient_profile_id, therapist_profile_id, request_id,
    action, payload_hash, review_id
  ) values (
    v_patient.id, p_therapist_profile_id, p_request_id,
    p_action, v_hash, v_review.id
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'review', public.patient_review_payload_v1(v_review)
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
    'bookingId', booking.id,
    'patientName', patient.display_name,
    'serviceTitle', service.title,
    'startsAt', booking.starts_at,
    'endsAt', booking.ends_at,
    'dueAt', booking.ends_at + make_interval(days => policy.therapist_auto_confirmation_days),
    'remainingSeconds', greatest(0, extract(epoch from (
      booking.ends_at + make_interval(days => policy.therapist_auto_confirmation_days) - now()
    ))::bigint)
  ) order by booking.ends_at desc), '[]'::jsonb)
  into v_pending
  from public.bookings booking
  join public.session_payments payment on payment.booking_id = booking.id
  join public.financial_policy_versions policy on policy.id = payment.policy_version_id
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  left join public.therapist_services service on service.id = booking.service_id
  where booking.therapist_profile_id = v_profile.id
    and booking.ends_at <= now()
    and payment.financial_status in ('paid', 'partially_refunded')
    and not exists (
      select 1 from public.session_feedback feedback
      where feedback.booking_id = booking.id
        and feedback.author_role = 'therapist'::public.user_role
    );

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

create or replace function public.upsert_therapist_review_reply_v1(
  p_review_id uuid,
  p_body text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_hash text;
  v_existing_request public.therapist_review_reply_mutation_requests%rowtype;
  v_reply public.review_replies%rowtype;
begin
  if p_review_id is null or p_request_id is null
    or length(v_body) < 3 or length(v_body) > 600 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  v_profile := public.resolve_current_therapist_for_reviews_v1();
  if v_profile.plan not in ('premium', 'premium_plus') then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'reviewId', p_review_id, 'body', v_body
  )::text, 'sha256'), 'hex');

  select request.* into v_existing_request
  from public.therapist_review_reply_mutation_requests request
  where request.therapist_profile_id = v_profile.id
    and request.request_id = p_request_id
    and request.operation = 'reply'
  for update;
  if v_existing_request.id is not null then
    if v_existing_request.payload_hash <> v_hash then
      raise exception 'REQUEST_CONFLICT' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'idempotentReplay', true,
      'page', public.get_therapist_reviews_v1()
    );
  end if;

  perform 1 from public.reviews review
  where review.id = p_review_id
    and review.therapist_profile_id = v_profile.id
    and review.status = 'published'
    and review.superseded_at is null
  for update;
  if not found then raise exception 'REVIEW_NOT_FOUND' using errcode = 'P0001'; end if;

  insert into public.review_replies (
    review_id, therapist_profile_id, body, status, published_at
  ) values (
    p_review_id, v_profile.id, v_body, 'published', now()
  )
  on conflict (review_id) do update
  set body = excluded.body,
      therapist_profile_id = excluded.therapist_profile_id,
      status = 'published',
      published_at = coalesce(public.review_replies.published_at, excluded.published_at),
      updated_at = now()
  returning * into v_reply;

  insert into public.therapist_review_reply_mutation_requests (
    therapist_profile_id, request_id, operation, payload_hash, review_id, reply_id
  ) values (
    v_profile.id, p_request_id, 'reply', v_hash, p_review_id, v_reply.id
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'page', public.get_therapist_reviews_v1()
  );
end;
$$;

drop view if exists public.public_therapist_profile_reviews_v;
create or replace view public.public_therapist_profile_reviews_v_internal as
select
  therapist.slug as therapist_slug,
  review.id,
  'Paciente TES'::text as author_label,
  coalesce(review.comment, '') as body,
  'Paciente com encontro realizado na plataforma'::text as patient_context,
  case
    when review.published_at >= now() - interval '2 days' then 'Há dois dias'
    when review.published_at >= now() - interval '8 days' then 'Há uma semana'
    else 'Experiência compartilhada'
  end as created_label,
  review.rating,
  review.published_at,
  reply.body as reply_body,
  reply.published_at as reply_published_at
from public.reviews review
join public.therapist_profiles therapist on therapist.id = review.therapist_profile_id
left join public.review_replies reply
  on reply.review_id = review.id and reply.status = 'published'
where review.status = 'published'
  and review.superseded_at is null;

create view public.public_therapist_profile_reviews_v as
select internal.*
from public.public_therapist_profile_reviews_v_internal internal
join public.therapist_profiles therapist on therapist.slug = internal.therapist_slug
where public.is_therapist_publication_eligible_v1(therapist.id);

grant select on public.public_therapist_profile_reviews_v
  to anon, authenticated, service_role;
revoke all on public.public_therapist_profile_reviews_v_internal
  from public, anon, authenticated;

revoke all on function public.capture_review_revision_v1()
  from public, anon, authenticated;
revoke all on function public.patient_review_payload_v1(public.reviews)
  from public, anon, authenticated;
revoke all on function public.get_patient_therapist_review_v1(uuid)
  from public, anon;
revoke all on function public.save_patient_therapist_review_for_actor_v1(uuid, uuid, text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.patient_review_payload_v1(public.reviews)
  to service_role;
grant execute on function public.get_patient_therapist_review_v1(uuid)
  to authenticated, service_role;
grant execute on function public.save_patient_therapist_review_for_actor_v1(uuid, uuid, text, integer, text, uuid)
  to service_role;

comment on table public.review_revisions is
  'Append-only audit history for the canonical patient-therapist public review.';
comment on function public.save_patient_therapist_review_for_actor_v1(uuid, uuid, text, integer, text, uuid) is
  'Creates, edits, hides or republishes one public review per patient-therapist relationship after a completed patient confirmation; never changes financial tables.';
comment on view public.public_therapist_profile_reviews_v_internal is
  'Canonical published relationship reviews. Visibility is independent from future booking/payment state.';

commit;
