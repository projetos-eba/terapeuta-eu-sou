create extension if not exists pgcrypto;

create table if not exists public.therapist_review_reply_mutation_requests (
  id uuid primary key default gen_random_uuid(),
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  payload_hash text not null,
  review_id uuid references public.reviews (id) on delete set null,
  reply_id uuid references public.review_replies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_review_reply_mutation_requests_operation_check check (
    operation in ('reply')
  ),
  constraint therapist_review_reply_mutation_requests_unique unique (
    therapist_profile_id,
    request_id,
    operation
  )
);

create index if not exists therapist_review_reply_requests_review_idx
on public.therapist_review_reply_mutation_requests (review_id);

drop trigger if exists set_therapist_review_reply_mutation_requests_updated_at
on public.therapist_review_reply_mutation_requests;
create trigger set_therapist_review_reply_mutation_requests_updated_at
before update on public.therapist_review_reply_mutation_requests
for each row execute function public.set_updated_at();

alter table public.therapist_review_reply_mutation_requests enable row level security;

revoke all on public.therapist_review_reply_mutation_requests from anon, authenticated;
grant all on public.therapist_review_reply_mutation_requests to service_role;

drop policy if exists "Service role manages therapist review reply requests"
on public.therapist_review_reply_mutation_requests;
create policy "Service role manages therapist review reply requests"
on public.therapist_review_reply_mutation_requests
for all
to service_role
using (true)
with check (true);

create or replace function public.resolve_current_therapist_for_reviews_v1()
returns public.therapist_profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.therapist_profiles%rowtype;
begin
  select *
  into v_profile
  from public.therapist_profiles
  where user_id = (select auth.uid())
  limit 1;

  if v_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_profile;
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
  v_now timestamptz := now();
  v_current_start timestamptz := now() - interval '30 days';
  v_previous_start timestamptz := now() - interval '60 days';
  v_reviews jsonb;
  v_distribution jsonb;
  v_total integer;
  v_distinct_patients integer;
  v_average numeric;
  v_responded integer;
  v_positive integer;
  v_current_count integer;
  v_previous_count integer;
  v_current_average numeric;
  v_previous_average numeric;
  v_current_responded integer;
  v_previous_responded integer;
  v_current_positive numeric;
  v_previous_positive numeric;
begin
  v_profile := public.resolve_current_therapist_for_reviews_v1();

  if v_profile.plan not in ('premium', 'premium_plus') then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  with eligible_reviews as (
    select
      reviews.id,
      reviews.patient_profile_id,
      reviews.rating,
      coalesce(reviews.comment, '') as comment,
      reviews.published_at,
      patient_profiles.display_name as patient_name,
      therapist_services.title as service_title,
      therapies.name as therapy_name,
      review_replies.id as reply_id,
      review_replies.body as reply_body,
      review_replies.status as reply_status,
      review_replies.published_at as reply_published_at
    from public.reviews
    join public.bookings
      on bookings.id = reviews.booking_id
    join public.session_payments
      on session_payments.booking_id = bookings.id
    join public.patient_profiles
      on patient_profiles.id = reviews.patient_profile_id
    left join public.therapist_services
      on therapist_services.id = bookings.service_id
    left join public.therapies
      on therapies.id = therapist_services.therapy_id
    left join public.review_replies
      on review_replies.review_id = reviews.id
      and review_replies.status = 'published'
    where reviews.therapist_profile_id = v_profile.id
      and reviews.status = 'published'
      and reviews.comment is not null
      and bookings.status = 'completed'
      and session_payments.financial_status = 'paid'
  )
  select
    coalesce(count(*), 0)::integer,
    coalesce(count(distinct patient_profile_id), 0)::integer,
    round(avg(rating), 1),
    coalesce(count(*) filter (where reply_id is not null), 0)::integer,
    coalesce(count(*) filter (where rating >= 4), 0)::integer
  into v_total, v_distinct_patients, v_average, v_responded, v_positive
  from eligible_reviews;

  with eligible_reviews as (
    select
      reviews.rating,
      reviews.published_at,
      review_replies.id as reply_id
    from public.reviews
    join public.bookings
      on bookings.id = reviews.booking_id
    join public.session_payments
      on session_payments.booking_id = bookings.id
    left join public.review_replies
      on review_replies.review_id = reviews.id
      and review_replies.status = 'published'
    where reviews.therapist_profile_id = v_profile.id
      and reviews.status = 'published'
      and reviews.comment is not null
      and bookings.status = 'completed'
      and session_payments.financial_status = 'paid'
  )
  select
    count(*) filter (where published_at >= v_current_start),
    count(*) filter (where published_at >= v_previous_start and published_at < v_current_start),
    round(avg(rating) filter (where published_at >= v_current_start), 1),
    round(avg(rating) filter (where published_at >= v_previous_start and published_at < v_current_start), 1),
    count(*) filter (where published_at >= v_current_start and reply_id is not null),
    count(*) filter (where published_at >= v_previous_start and published_at < v_current_start and reply_id is not null),
    round(
      100 * count(*) filter (where published_at >= v_current_start and rating >= 4)::numeric
      / nullif(count(*) filter (where published_at >= v_current_start), 0),
      0
    ),
    round(
      100 * count(*) filter (where published_at >= v_previous_start and published_at < v_current_start and rating >= 4)::numeric
      / nullif(count(*) filter (where published_at >= v_previous_start and published_at < v_current_start), 0),
      0
    )
  into
    v_current_count,
    v_previous_count,
    v_current_average,
    v_previous_average,
    v_current_responded,
    v_previous_responded,
    v_current_positive,
    v_previous_positive
  from eligible_reviews;

  with ratings as (
    select generate_series(5, 1, -1) as rating
  ),
  counts as (
    select reviews.rating, count(*)::integer as total
    from public.reviews
    join public.bookings
      on bookings.id = reviews.booking_id
    join public.session_payments
      on session_payments.booking_id = bookings.id
    where reviews.therapist_profile_id = v_profile.id
      and reviews.status = 'published'
      and reviews.comment is not null
      and bookings.status = 'completed'
      and session_payments.financial_status = 'paid'
    group by reviews.rating
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rating', ratings.rating,
        'count', coalesce(counts.total, 0)
      )
      order by ratings.rating desc
    ),
    '[]'::jsonb
  )
  into v_distribution
  from ratings
  left join counts
    on counts.rating = ratings.rating;

  with eligible_reviews as (
    select
      reviews.id,
      reviews.rating,
      coalesce(reviews.comment, '') as comment,
      reviews.published_at,
      coalesce(patient_profiles.display_name, 'Paciente TES') as patient_name,
      therapist_services.title as service_title,
      therapies.name as therapy_name,
      review_replies.id as reply_id,
      review_replies.body as reply_body,
      review_replies.status as reply_status,
      review_replies.published_at as reply_published_at
    from public.reviews
    join public.bookings
      on bookings.id = reviews.booking_id
    join public.session_payments
      on session_payments.booking_id = bookings.id
    join public.patient_profiles
      on patient_profiles.id = reviews.patient_profile_id
    left join public.therapist_services
      on therapist_services.id = bookings.service_id
    left join public.therapies
      on therapies.id = therapist_services.therapy_id
    left join public.review_replies
      on review_replies.review_id = reviews.id
      and review_replies.status = 'published'
    where reviews.therapist_profile_id = v_profile.id
      and reviews.status = 'published'
      and reviews.comment is not null
      and bookings.status = 'completed'
      and session_payments.financial_status = 'paid'
    order by reviews.published_at desc nulls last, reviews.created_at desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'patientName', patient_name,
        'patientInitials', public.therapist_reviews_initials_v1(patient_name),
        'rating', rating,
        'comment', comment,
        'publishedAt', published_at,
        'publishedLabel', public.therapist_reviews_date_label_v1(published_at),
        'serviceTitle', service_title,
        'therapyName', therapy_name,
        'responseStatus', case when reply_id is null then 'pending' else 'responded' end,
        'reply', case
          when reply_id is null then null
          else jsonb_build_object(
            'id', reply_id,
            'body', reply_body,
            'status', reply_status,
            'publishedAt', reply_published_at
          )
        end
      )
    ),
    '[]'::jsonb
  )
  into v_reviews
  from eligible_reviews;

  return jsonb_build_object(
    'therapist', jsonb_build_object(
      'profileId', v_profile.id,
      'publicName', v_profile.public_name,
      'plan', v_profile.plan,
      'publicSlug', v_profile.slug
    ),
    'metrics', jsonb_build_object(
      'averageRating', v_average,
      'totalReviews', v_total,
      'distinctPatients', v_distinct_patients,
      'respondedReviews', v_responded,
      'pendingReplies', greatest(v_total - v_responded, 0),
      'positiveReviews', v_positive,
      'positivePercent', round(100 * v_positive::numeric / nullif(v_total, 0), 0),
      'trends', jsonb_build_object(
        'averageRatingDelta', case when v_previous_average is null then null else round(v_current_average - v_previous_average, 1) end,
        'totalReviewsDelta', case when coalesce(v_previous_count, 0) = 0 then null else v_current_count - v_previous_count end,
        'respondedReviewsDelta', case when coalesce(v_previous_count, 0) = 0 then null else v_current_responded - v_previous_responded end,
        'positivePercentDelta', case when v_previous_positive is null then null else v_current_positive - v_previous_positive end
      )
    ),
    'distribution', v_distribution,
    'reviews', v_reviews,
    'generatedAt', v_now
  );
end;
$$;

create or replace function public.therapist_reviews_initials_v1(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(
    coalesce(
      nullif(
        left(split_part(trim(coalesce(p_name, 'Paciente TES')), ' ', 1), 1) ||
        left(
          case
            when strpos(trim(coalesce(p_name, '')), ' ') > 0
              then regexp_replace(trim(coalesce(p_name, '')), '^.*\s([^\s]+)$', '\1')
            else ''
          end,
          1
        ),
        ''
      ),
      'PT'
    )
  );
$$;

create or replace function public.therapist_reviews_date_label_v1(p_value timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_value is null then 'Data indisponível'
    else to_char(p_value at time zone 'America/Sao_Paulo', 'DD "de" Mon, YYYY')
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
  if p_review_id is null or p_request_id is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  if length(v_body) < 3 or length(v_body) > 600 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  v_profile := public.resolve_current_therapist_for_reviews_v1();

  if v_profile.plan not in ('premium', 'premium_plus') then
    raise exception 'CAPABILITY_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  v_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'reviewId', p_review_id,
        'body', v_body
      )::text,
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing_request
  from public.therapist_review_reply_mutation_requests
  where therapist_profile_id = v_profile.id
    and request_id = p_request_id
    and operation = 'reply'
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

  perform 1
  from public.reviews
  join public.bookings
    on bookings.id = reviews.booking_id
  join public.session_payments
    on session_payments.booking_id = bookings.id
  where reviews.id = p_review_id
    and reviews.therapist_profile_id = v_profile.id
    and reviews.status = 'published'
    and reviews.comment is not null
    and bookings.status = 'completed'
    and session_payments.financial_status = 'paid'
  for update of reviews;

  if not found then
    raise exception 'REVIEW_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.review_replies (
    review_id,
    therapist_profile_id,
    body,
    status,
    published_at
  )
  values (
    p_review_id,
    v_profile.id,
    v_body,
    'published',
    now()
  )
  on conflict (review_id) do update
  set
    body = excluded.body,
    therapist_profile_id = excluded.therapist_profile_id,
    status = 'published',
    published_at = coalesce(public.review_replies.published_at, excluded.published_at),
    updated_at = now()
  returning * into v_reply;

  insert into public.therapist_review_reply_mutation_requests (
    therapist_profile_id,
    request_id,
    operation,
    payload_hash,
    review_id,
    reply_id
  )
  values (
    v_profile.id,
    p_request_id,
    'reply',
    v_hash,
    p_review_id,
    v_reply.id
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'page', public.get_therapist_reviews_v1()
  );
end;
$$;

create or replace view public.public_therapist_profile_reviews_v as
select
  therapist_profiles.slug as therapist_slug,
  reviews.id,
  'Paciente TES'::text as author_label,
  reviews.comment as body,
  'Sessão concluída pela plataforma'::text as patient_context,
  case
    when reviews.published_at >= now() - interval '2 days' then 'Há dois dias'
    when reviews.published_at >= now() - interval '8 days' then 'Há uma semana'
    else 'Experiência compartilhada'
  end as created_label,
  reviews.rating,
  reviews.published_at,
  review_replies.body as reply_body,
  review_replies.published_at as reply_published_at
from public.reviews
join public.bookings
  on bookings.id = reviews.booking_id
join public.session_payments
  on session_payments.booking_id = bookings.id
join public.therapist_profiles
  on therapist_profiles.id = reviews.therapist_profile_id
left join public.review_replies
  on review_replies.review_id = reviews.id
  and review_replies.status = 'published'
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and reviews.status = 'published'
  and reviews.comment is not null
  and bookings.status = 'completed'
  and session_payments.financial_status = 'paid';

grant select on public.public_therapist_profile_reviews_v
to anon, authenticated, service_role;

revoke all on function public.resolve_current_therapist_for_reviews_v1()
from public;
revoke all on function public.get_therapist_reviews_v1()
from public;
revoke all on function public.upsert_therapist_review_reply_v1(uuid, text, uuid)
from public;
revoke all on function public.therapist_reviews_initials_v1(text)
from public;
revoke all on function public.therapist_reviews_date_label_v1(timestamptz)
from public;

grant execute on function public.get_therapist_reviews_v1()
to authenticated;
grant execute on function public.upsert_therapist_review_reply_v1(uuid, text, uuid)
to authenticated;
grant execute on function public.therapist_reviews_initials_v1(text)
to authenticated, service_role;
grant execute on function public.therapist_reviews_date_label_v1(timestamptz)
to authenticated, service_role;

comment on table public.therapist_review_reply_mutation_requests is
  'Idempotency ledger for therapist review replies. Same request id with a different payload is rejected.';
comment on function public.get_therapist_reviews_v1() is
  'Private therapist reviews read model. Resolves auth.uid(), includes only paid/completed published reviews and published replies.';
comment on function public.upsert_therapist_review_reply_v1(uuid, text, uuid) is
  'Authenticated therapist authority for publishing or updating a reply to an own published review.';
comment on view public.public_therapist_profile_reviews_v is
  'Safe published review projection gated by canonical paid session payment and completed booking, including published therapist replies.';
