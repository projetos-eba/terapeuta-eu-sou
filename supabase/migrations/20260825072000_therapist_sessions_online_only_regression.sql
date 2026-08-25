-- Forward correction for environments that already applied the period-summary
-- migration. Therapist sessions remain online-only by the domain contract.
-- Therapist sessions: authoritative period summary for operational cards.
-- This is a forward correction; the historical read-model migration remains unchanged.

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
  v_summary jsonb;
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

  if p_modality is not null and p_modality <> 'online' then
    raise exception 'invalid_sessions_modality' using errcode = '22023';
  end if;

  v_timezone := coalesce(
    nullif(v_therapist.metadata ->> 'timezone', ''),
    'America/Sao_Paulo'
  );

  with scoped as (
    select session_row.*
    from public.therapist_session_read_model_v1 as session_row
    where session_row."_therapistProfileId" = v_therapist.id
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
        or session_row.modality = 'online'
      )
  ), counts as (
    select
      count(*)::integer as total,
      count(*) filter (
        where "bookingStatus" = 'completed'::public.booking_status
          or "fulfillmentStatus" in (
            'confirmed_by_patient_review'::public.session_service_status,
            'confirmed_by_therapist'::public.session_service_status,
            'auto_confirmed'::public.session_service_status
          )
      )::integer as completed,
      count(*) filter (
        where "bookingStatus" = any (array[
          'cancelled_by_patient'::public.booking_status,
          'cancelled_by_therapist'::public.booking_status,
          'no_show_patient'::public.booking_status,
          'no_show_therapist'::public.booking_status,
          'cancelled_by_payment'::public.booking_status,
          'refunded'::public.booking_status
        ])
      )::integer as cancelled,
      count(*) filter (
        where "bookingStatus" = 'pending_payment'::public.booking_status
          or "financialStatus" is null
          or "financialStatus" = any (array[
            'pending'::public.session_financial_status,
            'processing'::public.session_financial_status,
            'failed'::public.session_financial_status,
            'disputed'::public.session_financial_status
          ])
          or "rescheduleStatus" = 'pending'
          or coalesce("cancellationRequiresReview", false)
      )::integer as pending,
      count(*) filter (
        where "bookingStatus" = 'confirmed'::public.booking_status
      )::integer as confirmed
    from scoped
  )
  select jsonb_build_object(
    'total', total,
    'completed', completed,
    'cancelled', cancelled,
    'pending', pending,
    'attendanceRate', case
      when confirmed > 0 then round(
        (completed::numeric / greatest(confirmed, completed)::numeric) * 100
      )::integer
      else null
    end
  )
  into v_summary
  from counts;

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
        or session_row.modality = 'online'
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
        - '_videoSessionReady'
      ) || jsonb_build_object(
        'zoomAccess',
        public.build_video_session_access_state_v1(
          page."bookingStatus",
          page."financialStatus",
          page."startsAt",
          page."endsAt",
          page."videoSessionStatus",
          page."_videoSessionReady",
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
    'summary', v_summary,
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
  'Therapist-scoped sessions read model with a server-side period summary for operational cards.';


