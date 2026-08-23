create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete restrict,
  author_role public.user_role not null,
  outcome text not null,
  rating smallint,
  not_performed_reason text,
  comment text not null default '',
  request_id uuid not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_feedback_author_role_check check (
    author_role in ('patient'::public.user_role, 'therapist'::public.user_role)
  ),
  constraint session_feedback_outcome_check check (
    outcome in ('completed', 'not_performed')
  ),
  constraint session_feedback_rating_check check (
    rating is null or rating between 1 and 5
  ),
  constraint session_feedback_reason_check check (
    not_performed_reason is null or not_performed_reason in (
      'patient_absent',
      'therapist_absent',
      'internet_problem',
      'audio_video_problem',
      'rescheduled',
      'late_cancellation',
      'other'
    )
  ),
  constraint session_feedback_comment_length_check check (
    char_length(comment) <= 500
  ),
  constraint session_feedback_shape_check check (
    (
      outcome = 'completed'
      and rating is not null
      and not_performed_reason is null
    )
    or (
      outcome = 'not_performed'
      and rating is null
      and not_performed_reason is not null
    )
  ),
  constraint session_feedback_request_id_key unique (request_id),
  constraint session_feedback_participant_key unique (booking_id, author_role)
);

create index if not exists session_feedback_booking_created_idx
  on public.session_feedback (booking_id, created_at desc);

drop trigger if exists set_session_feedback_updated_at on public.session_feedback;
create trigger set_session_feedback_updated_at
before update on public.session_feedback
for each row execute function public.set_updated_at();

alter table public.session_feedback enable row level security;
revoke all on public.session_feedback from anon, authenticated;
grant all on public.session_feedback to service_role;

create or replace function public.session_feedback_payload(
  p_feedback public.session_feedback
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'authorRole', p_feedback.author_role,
    'comment', p_feedback.comment,
    'createdAt', p_feedback.created_at,
    'id', p_feedback.id,
    'notPerformedReason', p_feedback.not_performed_reason,
    'outcome', p_feedback.outcome,
    'rating', p_feedback.rating
  );
$$;

create or replace function public.get_session_feedback_v1(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_feedback public.session_feedback;
begin
  if v_actor_id is null then
    raise exception 'FEEDBACK_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_booking_id is null then
    raise exception 'FEEDBACK_BOOKING_REQUIRED' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.bookings
    left join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    left join public.therapist_profiles
      on therapist_profiles.id = bookings.therapist_profile_id
    where bookings.id = p_booking_id
      and (
        patient_profiles.user_id = v_actor_id
        or therapist_profiles.user_id = v_actor_id
      )
  ) then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.session_payments
    where session_payments.booking_id = p_booking_id
      and session_payments.financial_status = 'paid'::public.session_financial_status
  ) then
    return jsonb_build_object(
      'feedback', null,
      'status', 'unavailable'
    );
  end if;

  select session_feedback.*
  into v_feedback
  from public.session_feedback
  where session_feedback.booking_id = p_booking_id
    and session_feedback.author_profile_id = v_actor_id
  limit 1;

  return jsonb_build_object(
    'feedback', case
      when v_feedback.id is null then null
      else public.session_feedback_payload(v_feedback)
    end,
    'status', 'available'
  );
end;
$$;

create or replace function public.submit_session_feedback_for_actor_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_outcome text,
  p_rating smallint,
  p_not_performed_reason text,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_existing public.session_feedback;
  v_feedback public.session_feedback;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_hash text;
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.session_payments
    where session_payments.booking_id = p_booking_id
      and session_payments.financial_status = 'paid'::public.session_financial_status
  ) then
    raise exception 'FEEDBACK_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  select case
    when patient_profiles.user_id = p_actor_user_id then 'patient'::public.user_role
    when therapist_profiles.user_id = p_actor_user_id then 'therapist'::public.user_role
    else null
  end
  into v_actor_role
  from public.bookings
  left join public.patient_profiles
    on patient_profiles.id = bookings.patient_profile_id
  left join public.therapist_profiles
    on therapist_profiles.id = bookings.therapist_profile_id
  where bookings.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  if p_outcome not in ('completed', 'not_performed') then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if char_length(v_comment) > 500 then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if p_outcome = 'completed' then
    if p_rating is null or p_rating not between 1 and 5 or p_not_performed_reason is not null then
      raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
    end if;
  elsif p_rating is not null or p_not_performed_reason is null or p_not_performed_reason not in (
    'patient_absent',
    'therapist_absent',
    'internet_problem',
    'audio_video_problem',
    'rescheduled',
    'late_cancellation',
    'other'
  ) then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome, coalesce(p_rating::text, ''), coalesce(p_not_performed_reason, ''), v_comment),
      'sha256'
    ),
    'hex'
  );

  select session_feedback.*
  into v_existing
  from public.session_feedback
  where session_feedback.booking_id = p_booking_id
    and session_feedback.author_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'feedback', public.session_feedback_payload(v_existing),
      'idempotentReplay', true
    );
  end if;

  insert into public.session_feedback (
    author_profile_id,
    author_role,
    booking_id,
    comment,
    not_performed_reason,
    outcome,
    payload_hash,
    rating,
    request_id
  ) values (
    p_actor_user_id,
    v_actor_role,
    p_booking_id,
    v_comment,
    p_not_performed_reason,
    p_outcome,
    v_hash,
    p_rating,
    p_request_id
  )
  returning session_feedback.* into v_feedback;

  return jsonb_build_object(
    'feedback', public.session_feedback_payload(v_feedback),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select session_feedback.*
    into v_existing
    from public.session_feedback
    where session_feedback.booking_id = p_booking_id
      and session_feedback.author_role = v_actor_role
    limit 1;

    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'feedback', public.session_feedback_payload(v_existing),
        'idempotentReplay', true
      );
    end if;

    raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

create or replace function public.admin_get_session_feedback_v1(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_patient public.session_feedback;
  v_therapist public.session_feedback;
  v_pending jsonb := '[]'::jsonb;
  v_is_divergent boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'::public.user_role
  ) then
    raise exception 'FEEDBACK_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select session_feedback.* into v_patient
  from public.session_feedback
  where session_feedback.booking_id = p_booking_id
    and session_feedback.author_role = 'patient'::public.user_role
  limit 1;

  select session_feedback.* into v_therapist
  from public.session_feedback
  where session_feedback.booking_id = p_booking_id
    and session_feedback.author_role = 'therapist'::public.user_role
  limit 1;

  if v_patient.id is null then
    v_pending := v_pending || jsonb_build_array('patient');
  end if;
  if v_therapist.id is null then
    v_pending := v_pending || jsonb_build_array('therapist');
  end if;

  if v_patient.id is not null and v_therapist.id is not null then
    v_is_divergent := v_patient.outcome is distinct from v_therapist.outcome
      or v_patient.rating is distinct from v_therapist.rating
      or v_patient.not_performed_reason is distinct from v_therapist.not_performed_reason;
  end if;

  return jsonb_build_object(
    'divergent', v_is_divergent,
    'pendingRoles', v_pending,
    'patient', case when v_patient.id is null then null else public.session_feedback_payload(v_patient) end,
    'therapist', case when v_therapist.id is null then null else public.session_feedback_payload(v_therapist) end
  );
end;
$$;

revoke all on function public.session_feedback_payload(public.session_feedback) from public, anon, authenticated;
revoke all on function public.get_session_feedback_v1(uuid) from public, anon;
revoke all on function public.submit_session_feedback_for_actor_v1(uuid, uuid, text, smallint, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_get_session_feedback_v1(uuid) from public, anon;
grant execute on function public.get_session_feedback_v1(uuid) to authenticated;
grant execute on function public.submit_session_feedback_for_actor_v1(uuid, uuid, text, smallint, text, text, uuid) to service_role;
grant execute on function public.admin_get_session_feedback_v1(uuid) to authenticated, service_role;

comment on table public.session_feedback is
  'Private bilateral post-session feedback. It is independent from public reviews and never mutates payment or fulfillment state.';

comment on function public.get_session_feedback_v1(uuid) is
  'Returns only the authenticated participant feedback for a booking; identity is derived from auth.uid().';

comment on function public.admin_get_session_feedback_v1(uuid) is
  'Admin-only read model for private bilateral session feedback, including pending participant and divergence state.';
