-- Agenda and Sessions preparation: canonical therapist read models,
-- cursor pagination, safe Zoom access previews, and lightweight shell counters.

create index if not exists bookings_therapist_cursor_idx
on public.bookings (therapist_profile_id, starts_at desc, id desc);

create index if not exists booking_reschedule_requests_booking_created_idx
on public.booking_reschedule_requests (booking_id, created_at desc);

grant select on public.availability_exceptions to authenticated;

drop policy if exists "Therapists can read own availability exceptions"
on public.availability_exceptions;
create policy "Therapists can read own availability exceptions"
on public.availability_exceptions
for select
to authenticated
using (public.is_current_therapist_profile(therapist_profile_id));

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
  zoom.status as "meetingStatus",
  zoom.provider as "meetingProvider",
  (
    zoom.zoom_meeting_id is not null
    and zoom.status in ('provisioned', 'scheduled', 'in_progress')
  ) as "_meetingReady"
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
left join public.zoom_meetings as zoom
  on zoom.booking_id = booking.id
where public.is_current_therapist_profile(booking.therapist_profile_id);

grant select on public.therapist_session_read_model_v1 to authenticated;

comment on view public.therapist_session_read_model_v1 is
  'Versioned, security-invoker therapist session projection. Payment and fulfillment come from session_payments; attendance remains explicitly unavailable except for legacy no-show projections.';

create or replace function public.build_zoom_access_state_v1(
  p_booking_status public.booking_status,
  p_financial_status public.session_financial_status,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_meeting_status public.zoom_meeting_status,
  p_meeting_ready boolean,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_available_from timestamptz := p_starts_at - interval '15 minutes';
  v_available_until timestamptz := p_ends_at + interval '30 minutes';
  v_allowed boolean := false;
  v_reason text;
begin
  if p_booking_status in (
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'no_show_patient',
    'no_show_therapist',
    'refunded'
  ) then
    v_reason := 'BOOKING_CANCELLED';
  elsif p_financial_status is distinct from 'paid' then
    v_reason := 'PAYMENT_NOT_CONFIRMED';
  elsif p_now < v_available_from then
    v_reason := 'TOO_EARLY';
  elsif p_now >= v_available_until then
    v_reason := 'TOO_LATE';
  elsif p_meeting_status in ('ended', 'canceled') then
    v_reason := 'TOO_LATE';
  elsif p_meeting_status = 'failed' then
    v_reason := 'UNKNOWN';
  elsif not coalesce(p_meeting_ready, false) then
    v_reason := 'MEETING_NOT_READY';
  else
    v_allowed := true;
    v_reason := null;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'availableFrom', v_available_from,
    'availableUntil', v_available_until,
    'meetingStatus', coalesce(p_meeting_status::text, 'not_provisioned')
  );
end;
$$;

revoke all on function public.build_zoom_access_state_v1(
  public.booking_status,
  public.session_financial_status,
  timestamptz,
  timestamptz,
  public.zoom_meeting_status,
  boolean,
  timestamptz
) from public;
grant execute on function public.build_zoom_access_state_v1(
  public.booking_status,
  public.session_financial_status,
  timestamptz,
  timestamptz,
  public.zoom_meeting_status,
  boolean,
  timestamptz
) to authenticated;

create or replace function public.get_therapist_sessions_v1(
  p_limit integer default 20,
  p_cursor_starts_at timestamptz default null,
  p_cursor_booking_id uuid default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_booking_status public.booking_status default null,
  p_financial_status public.session_financial_status default null,
  p_patient_profile_id uuid default null,
  p_service_id uuid default null,
  p_modality text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor jsonb;
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

  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_sessions_page_size' using errcode = '22023';
  end if;

  if (p_cursor_starts_at is null) <> (p_cursor_booking_id is null) then
    raise exception 'invalid_sessions_cursor' using errcode = '22023';
  end if;

  if p_period_start is not null
    and p_period_end is not null
    and p_period_start >= p_period_end
  then
    raise exception 'invalid_sessions_period' using errcode = '22023';
  end if;

  if p_modality is not null and p_modality not in ('online', 'in_person') then
    raise exception 'invalid_sessions_modality' using errcode = '22023';
  end if;

  v_timezone := coalesce(
    nullif(v_therapist.metadata ->> 'timezone', ''),
    'America/Sao_Paulo'
  );

  with candidates as (
    select session_row.*
    from public.therapist_session_read_model_v1 as session_row
    where session_row."_therapistProfileId" = v_therapist.id
      and (
        p_cursor_starts_at is null
        or (
          session_row."startsAt",
          session_row."bookingId"
        ) < (
          p_cursor_starts_at,
          p_cursor_booking_id
        )
      )
      and (
        p_period_start is null
        or session_row."endsAt" > p_period_start
      )
      and (
        p_period_end is null
        or session_row."startsAt" < p_period_end
      )
      and (
        p_booking_status is null
        or session_row."bookingStatus" = p_booking_status
      )
      and (
        p_financial_status is null
        or session_row."financialStatus" = p_financial_status
      )
      and (
        p_patient_profile_id is null
        or session_row."patientProfileId" = p_patient_profile_id
      )
      and (
        p_service_id is null
        or session_row."serviceId" = p_service_id
      )
      and (
        p_modality is null
        or session_row.modality = p_modality
      )
    order by session_row."startsAt" desc, session_row."bookingId" desc
    limit p_limit + 1
  ),
  page as (
    select *
    from candidates
    order by "startsAt" desc, "bookingId" desc
    limit p_limit
  ),
  payload as (
    select
      page."startsAt",
      page."bookingId",
      (
        to_jsonb(page)
        - '_therapistProfileId'
        - '_meetingReady'
      ) || jsonb_build_object(
        'zoomAccess',
        public.build_zoom_access_state_v1(
          page."bookingStatus",
          page."financialStatus",
          page."startsAt",
          page."endsAt",
          page."meetingStatus",
          page."_meetingReady",
          now()
        )
      ) as item
    from page
  )
  select
    coalesce(
      jsonb_agg(item order by "startsAt" desc, "bookingId" desc),
      '[]'::jsonb
    ),
    (select count(*) > p_limit from candidates),
    (
      select jsonb_build_object(
        'startsAt', "startsAt",
        'bookingId', "bookingId"
      )
      from payload
      order by "startsAt" asc, "bookingId" asc
      limit 1
    )
  into v_items, v_has_more, v_next_cursor
  from payload;

  return jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_therapist.id,
    'timezone', v_timezone,
    'items', v_items,
    'page', jsonb_build_object(
      'limit', p_limit,
      'hasMore', coalesce(v_has_more, false),
      'nextCursor', case
        when coalesce(v_has_more, false) then v_next_cursor
        else null
      end
    ),
    'filters', jsonb_build_object(
      'periodStart', p_period_start,
      'periodEnd', p_period_end,
      'bookingStatus', p_booking_status,
      'financialStatus', p_financial_status,
      'patientProfileId', p_patient_profile_id,
      'serviceId', p_service_id,
      'modality', p_modality
    )
  );
end;
$$;

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

  return (
    to_jsonb(v_session)
    - '_therapistProfileId'
    - '_meetingReady'
  ) || jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_therapist.id,
    'zoomAccess',
    public.build_zoom_access_state_v1(
      v_session."bookingStatus",
      v_session."financialStatus",
      v_session."startsAt",
      v_session."endsAt",
      v_session."meetingStatus",
      v_session."_meetingReady",
      now()
    )
  );
end;
$$;

create or replace function public.get_therapist_agenda_v1(
  p_range_start timestamptz default null,
  p_range_end timestamptz default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_timezone text;
  v_range_start timestamptz := coalesce(
    p_range_start,
    now() - interval '7 days'
  );
  v_range_end timestamptz := coalesce(
    p_range_end,
    now() + interval '35 days'
  );
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

  if v_range_start >= v_range_end then
    raise exception 'invalid_agenda_range' using errcode = '22023';
  end if;

  if v_range_end - v_range_start > interval '93 days' then
    raise exception 'agenda_range_too_large' using errcode = '22023';
  end if;

  v_timezone := coalesce(
    nullif(v_therapist.metadata ->> 'timezone', ''),
    'America/Sao_Paulo'
  );

  return jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_therapist.id,
    'timezone', v_timezone,
    'range', jsonb_build_object(
      'start', v_range_start,
      'end', v_range_end,
      'endExclusive', true
    ),
    'summary', jsonb_build_object(
      'bookings', (
        select count(*)
        from public.therapist_session_read_model_v1 as session_row
        where session_row."_therapistProfileId" = v_therapist.id
          and session_row."startsAt" < v_range_end
          and session_row."endsAt" > v_range_start
      ),
      'activeHolds', (
        select count(*)
        from public.booking_holds as hold
        where hold.therapist_profile_id = v_therapist.id
          and hold.status = 'active'
          and hold.expires_at > now()
          and hold.starts_at < v_range_end
          and hold.ends_at > v_range_start
      ),
      'pendingReschedules', (
        select count(*)
        from public.booking_reschedule_requests as request
        join public.bookings as booking
          on booking.id = request.booking_id
        where booking.therapist_profile_id = v_therapist.id
          and request.status = 'pending'
      )
    ),
    'bookings', (
      select coalesce(
        jsonb_agg(
          (
            to_jsonb(session_row)
            - '_therapistProfileId'
            - '_meetingReady'
          ) || jsonb_build_object(
            'zoomAccess',
            public.build_zoom_access_state_v1(
              session_row."bookingStatus",
              session_row."financialStatus",
              session_row."startsAt",
              session_row."endsAt",
              session_row."meetingStatus",
              session_row."_meetingReady",
              now()
            )
          )
          order by session_row."startsAt", session_row."bookingId"
        ),
        '[]'::jsonb
      )
      from public.therapist_session_read_model_v1 as session_row
      where session_row."_therapistProfileId" = v_therapist.id
        and session_row."startsAt" < v_range_end
        and session_row."endsAt" > v_range_start
    ),
    'holds', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', hold.id,
            'serviceId', hold.service_id,
            'serviceTitle', hold.service_title_snapshot,
            'startsAt', hold.starts_at,
            'endsAt', hold.ends_at,
            'timezone', hold.timezone,
            'status', hold.status,
            'expiresAt', hold.expires_at
          )
          order by hold.starts_at
        ),
        '[]'::jsonb
      )
      from public.booking_holds as hold
      where hold.therapist_profile_id = v_therapist.id
        and hold.status = 'active'
        and hold.expires_at > now()
        and hold.starts_at < v_range_end
        and hold.ends_at > v_range_start
    ),
    'availability', jsonb_build_object(
      'rules', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', rule.id,
              'serviceId', rule.service_id,
              'dayOfWeek', rule.day_of_week,
              'startTime', rule.start_time,
              'endTime', rule.end_time,
              'timezone', rule.timezone,
              'isActive', rule.is_active
            )
            order by rule.day_of_week, rule.start_time
          ),
          '[]'::jsonb
        )
        from public.availability_rules as rule
        where rule.therapist_profile_id = v_therapist.id
      ),
      'exceptions', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', exception.id,
              'serviceId', exception.service_id,
              'startsAt', exception.starts_at,
              'endsAt', exception.ends_at,
              'isAvailable', exception.is_available
            )
            order by exception.starts_at
          ),
          '[]'::jsonb
        )
        from public.availability_exceptions as exception
        where exception.therapist_profile_id = v_therapist.id
          and exception.starts_at < v_range_end
          and exception.ends_at > v_range_start
      )
    )
  );
end;
$$;

create or replace function public.get_therapist_shell_counters_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
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

  return jsonb_build_object(
    'version', 1,
    'therapistProfileId', v_therapist.id,
    'unreadMessages', (
      select count(*)
      from public.messages as message
      join public.conversations as conversation
        on conversation.id = message.conversation_id
      where conversation.therapist_profile_id = v_therapist.id
        and message.sender_profile_id <> (select auth.uid())
        and message.read_at is null
    ),
    'unreadNotifications', (
      select count(*)
      from public.notifications as notification
      where notification.profile_id = (select auth.uid())
        and notification.read_at is null
    ),
    'pendingRescheduleRequests', (
      select count(*)
      from public.booking_reschedule_requests as request
      join public.bookings as booking
        on booking.id = request.booking_id
      where booking.therapist_profile_id = v_therapist.id
        and request.status = 'pending'
    ),
    'pendingPayments', (
      select count(*)
      from public.bookings as booking
      left join public.session_payments as payment
        on payment.booking_id = booking.id
      where booking.therapist_profile_id = v_therapist.id
        and (
          payment.financial_status in ('pending', 'processing')
          or (
            payment.id is null
            and booking.status = 'pending_payment'
          )
        )
    ),
    'pendingReviewReplies', (
      select count(*)
      from public.reviews as review
      where review.therapist_profile_id = v_therapist.id
        and review.status = 'published'
        and not exists (
          select 1
          from public.review_replies as reply
          where reply.review_id = review.id
            and reply.status = 'published'
        )
    ),
    'impactedBookings', 0
  );
end;
$$;

revoke all on function public.get_therapist_sessions_v1(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.session_financial_status,
  uuid,
  uuid,
  text
) from public;
revoke all on function public.get_therapist_session_detail_v1(uuid)
from public;
revoke all on function public.get_therapist_agenda_v1(
  timestamptz,
  timestamptz
) from public;
revoke all on function public.get_therapist_shell_counters_v1()
from public;

grant execute on function public.get_therapist_sessions_v1(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.session_financial_status,
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function public.get_therapist_session_detail_v1(uuid)
to authenticated;
grant execute on function public.get_therapist_agenda_v1(
  timestamptz,
  timestamptz
) to authenticated;
grant execute on function public.get_therapist_shell_counters_v1()
to authenticated;

comment on function public.get_therapist_sessions_v1(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.booking_status,
  public.session_financial_status,
  uuid,
  uuid,
  text
) is
  'Cursor-paginated therapist Sessions read model. Identity comes from auth.uid(); no arbitrary therapist id is accepted.';
comment on function public.get_therapist_session_detail_v1(uuid) is
  'Private-safe therapist session detail. Returns null for missing or non-owned bookings and never exposes Zoom host credentials.';
comment on function public.get_therapist_agenda_v1(
  timestamptz,
  timestamptz
) is
  'Timezone-aware Agenda read model over a semi-open instant range [start,end), including bookings, active holds, rules and exceptions.';
comment on function public.get_therapist_shell_counters_v1() is
  'Small plan-independent shell counter read model for every authorized therapist.';

-- Public paid-session projections now consult the canonical payment table.
create or replace view public.public_therapist_profiles_v as
select
  therapist_profiles.id,
  therapist_profiles.slug,
  therapist_profiles.public_name,
  therapist_profiles.plan,
  therapist_profiles.bio,
  therapist_profiles.photo_url,
  therapist_profiles.city,
  therapist_profiles.state,
  therapist_profiles.is_accepting_bookings,
  therapist_profiles.accepts_online_sessions,
  true as is_verified,
  coalesce(content.short_intro, therapist_profiles.headline) as short_intro,
  coalesce(content.short_intro, therapist_profiles.headline) as published_headline,
  coalesce(tags.tags, array[]::text[]) as tags,
  coalesce(
    content.video_url,
    therapist_profiles.metadata ->> 'video_url'
  ) as video_url,
  coalesce(content.video_provider, 'external') as video_provider,
  coalesce(
    content.video_thumbnail_url,
    '/home/tablet-video-session.png'
  ) as video_thumbnail_url,
  coalesce(content.video_title, 'Um convite para você') as video_title,
  case
    when therapist_profiles.plan = 'premium_plus'
      then array['Perfil verificado', 'Terapeuta Plus']::text[]
    else array['Perfil verificado']::text[]
  end as badges,
  reviews.average_rating,
  reviews.review_count,
  coalesce(sessions.sessions_completed, 0)::integer as sessions_completed,
  therapist_profiles.updated_at
from public.therapist_profiles
left join lateral (
  select *
  from public.therapist_profile_content_versions
  where therapist_profile_content_versions.therapist_profile_id =
    therapist_profiles.id
    and therapist_profile_content_versions.status = 'published'
  order by
    therapist_profile_content_versions.published_at desc nulls last,
    therapist_profile_content_versions.created_at desc
  limit 1
) as content on true
left join lateral (
  select coalesce(
    array_agg(tag.value order by tag.value),
    array[]::text[]
  ) as tags
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(
        therapist_profiles.metadata -> 'care_tags'
      ) = 'array'
        then therapist_profiles.metadata -> 'care_tags'
      else '[]'::jsonb
    end
  ) as tag(value)
) as tags on true
left join lateral (
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(*)::integer as review_count
  from public.reviews as review
  join public.bookings as booking
    on booking.id = review.booking_id
  join public.session_payments as payment
    on payment.booking_id = booking.id
  where review.therapist_profile_id = therapist_profiles.id
    and review.status = 'published'
    and booking.status = 'completed'
    and payment.financial_status = 'paid'
) as reviews on true
left join lateral (
  select count(*) as sessions_completed
  from public.bookings as booking
  join public.session_payments as payment
    on payment.booking_id = booking.id
  where booking.therapist_profile_id = therapist_profiles.id
    and booking.status = 'completed'
    and payment.financial_status = 'paid'
) as sessions on true
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and exists (
    select 1
    from public.therapist_services
    join public.therapies
      on therapies.id = therapist_services.therapy_id
    where therapist_services.therapist_profile_id = therapist_profiles.id
      and therapist_services.status = 'active'
      and therapies.status = 'published'
      and therapies.is_public_visible = true
  );

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
  reviews.published_at
from public.reviews
join public.bookings
  on bookings.id = reviews.booking_id
join public.session_payments
  on session_payments.booking_id = bookings.id
join public.therapist_profiles
  on therapist_profiles.id = reviews.therapist_profile_id
where therapist_profiles.status = 'approved'
  and therapist_profiles.is_public = true
  and reviews.status = 'published'
  and reviews.comment is not null
  and bookings.status = 'completed'
  and session_payments.financial_status = 'paid';

grant select on public.public_therapist_profiles_v
to anon, authenticated, service_role;
grant select on public.public_therapist_profile_reviews_v
to anon, authenticated, service_role;

comment on view public.public_therapist_profiles_v is
  'Safe public therapist projection. Paid/completed aggregates use canonical session_payments.';
comment on view public.public_therapist_profile_reviews_v is
  'Safe published review projection gated by canonical paid session payment and completed booking.';
