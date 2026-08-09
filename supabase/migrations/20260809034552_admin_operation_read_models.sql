-- Admin operation read models.
--
-- The admin shell must not query canonical domain tables horizontally from the
-- browser/session token. This RPC exposes a minimized operational DTO after
-- validating the authenticated actor server-side through auth.uid().

create or replace function public.admin_get_operation_module_v1(
  p_module text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_metrics jsonb;
  v_rows jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  case p_module
    when 'professionals' then
      select jsonb_build_object(
        'total-professionals', count(*)::integer,
        'approved-professionals', count(*) filter (
          where therapist_profiles.status = 'approved'::public.therapist_status
        )::integer,
        'public-professionals', count(*) filter (
          where therapist_profiles.is_public is true
        )::integer,
        'booking-professionals', count(*) filter (
          where therapist_profiles.is_accepting_bookings is true
        )::integer
      )
      into v_metrics
      from public.therapist_profiles;

      select coalesce(jsonb_agg(row_payload order by updated_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          therapist_profiles.updated_at,
          jsonb_build_object(
            'id', therapist_profiles.id,
            'public_name', therapist_profiles.public_name,
            'slug', therapist_profiles.slug,
            'plan', therapist_profiles.plan,
            'status', therapist_profiles.status,
            'public_status', therapist_profiles.public_status,
            'is_public', therapist_profiles.is_public,
            'is_accepting_bookings', therapist_profiles.is_accepting_bookings,
            'service_count', coalesce(service_counts.total, 0),
            'connect_status', therapist_connect_accounts.operational_status,
            'next_session_at', next_booking.starts_at,
            'created_at', therapist_profiles.created_at,
            'updated_at', therapist_profiles.updated_at
          ) as row_payload
        from public.therapist_profiles
        left join lateral (
          select count(*)::integer as total
          from public.therapist_services
          where therapist_services.therapist_profile_id = therapist_profiles.id
            and therapist_services.archived_at is null
        ) service_counts on true
        left join public.therapist_connect_accounts
          on therapist_connect_accounts.therapist_profile_id =
            therapist_profiles.id
        left join lateral (
          select bookings.starts_at
          from public.bookings
          where bookings.therapist_profile_id = therapist_profiles.id
            and bookings.starts_at >= now()
            and bookings.status not in (
              'cancelled_by_patient'::public.booking_status,
              'cancelled_by_therapist'::public.booking_status,
              'refunded'::public.booking_status
            )
          order by bookings.starts_at asc
          limit 1
        ) next_booking on true
        order by therapist_profiles.updated_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'patients' then
      select jsonb_build_object(
        'total-patients', count(*)::integer,
        'recent-patients', count(*) filter (
          where patient_profiles.created_at >= now() - interval '30 days'
        )::integer
      )
      into v_metrics
      from public.patient_profiles;

      select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          patient_profiles.created_at,
          jsonb_build_object(
            'id', patient_profiles.id,
            'user_id', patient_profiles.user_id,
            'display_name', patient_profiles.display_name,
            'account_status', case
              when profiles.auth_deleted_at is not null then 'deleted'
              when profiles.anonymized_at is not null then 'anonymized'
              else 'active'
            end,
            'timezone', patient_profiles.timezone,
            'booking_count', coalesce(booking_counts.total, 0),
            'ticket_count', coalesce(ticket_counts.total, 0),
            'last_activity_at', greatest(
              patient_profiles.updated_at,
              coalesce(booking_counts.last_activity_at, patient_profiles.updated_at),
              coalesce(ticket_counts.last_activity_at, patient_profiles.updated_at)
            ),
            'created_at', patient_profiles.created_at,
            'updated_at', patient_profiles.updated_at
          ) as row_payload
        from public.patient_profiles
        left join public.profiles
          on profiles.id = patient_profiles.user_id
        left join lateral (
          select
            count(*)::integer as total,
            max(bookings.updated_at) as last_activity_at
          from public.bookings
          where bookings.patient_profile_id = patient_profiles.id
        ) booking_counts on true
        left join lateral (
          select
            count(*)::integer as total,
            max(support_tickets.updated_at) as last_activity_at
          from public.support_tickets
          where support_tickets.requester_profile_id =
            patient_profiles.user_id
        ) ticket_counts on true
        order by patient_profiles.created_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'sessions' then
      select jsonb_build_object(
        'total-sessions', count(*)::integer,
        'future-sessions', count(*) filter (
          where bookings.starts_at >= now()
        )::integer,
        'attention-sessions', count(*) filter (
          where bookings.status in (
            'pending_payment'::public.booking_status,
            'no_show_patient'::public.booking_status,
            'no_show_therapist'::public.booking_status,
            'refunded'::public.booking_status
          )
        )::integer
      )
      into v_metrics
      from public.bookings;

      select coalesce(jsonb_agg(row_payload order by starts_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          bookings.starts_at,
          jsonb_build_object(
            'id', bookings.id,
            'status', bookings.status,
            'payment_status', bookings.payment_status,
            'starts_at', bookings.starts_at,
            'ends_at', bookings.ends_at,
            'timezone', bookings.timezone,
            'service_title_snapshot', bookings.service_title_snapshot,
            'service_duration_minutes_snapshot',
              bookings.service_duration_minutes_snapshot,
            'therapist_name', therapist_profiles.public_name,
            'patient_name', patient_profiles.display_name,
            'created_at', bookings.created_at,
            'updated_at', bookings.updated_at
          ) as row_payload
        from public.bookings
        left join public.therapist_profiles
          on therapist_profiles.id = bookings.therapist_profile_id
        left join public.patient_profiles
          on patient_profiles.id = bookings.patient_profile_id
        order by bookings.starts_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'support' then
      select jsonb_build_object(
        'total-support', count(*)::integer,
        'open-support', count(*) filter (
          where support_tickets.status = 'open'
        )::integer,
        'urgent-support', count(*) filter (
          where support_tickets.urgency in ('high', 'critical')
        )::integer
      )
      into v_metrics
      from public.support_tickets;

      select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          support_tickets.created_at,
          jsonb_build_object(
            'id', support_tickets.id,
            'subject', support_tickets.subject,
            'category', support_tickets.category,
            'status', support_tickets.status,
            'priority', support_tickets.priority,
            'urgency', support_tickets.urgency,
            'source', support_tickets.source,
            'requester_role', profiles.role,
            'requester_name', profiles.display_name,
            'created_at', support_tickets.created_at,
            'updated_at', support_tickets.updated_at
          ) as row_payload
        from public.support_tickets
        left join public.profiles
          on profiles.id = support_tickets.requester_profile_id
        order by support_tickets.created_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'reviews' then
      select jsonb_build_object(
        'total-reviews', count(*)::integer,
        'published-reviews', count(*) filter (
          where reviews.status = 'published'::public.review_status
        )::integer,
        'pending-reviews', count(*) filter (
          where reviews.status in (
            'pending'::public.review_status,
            'reported'::public.review_status
          )
        )::integer
      )
      into v_metrics
      from public.reviews;

      select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          reviews.created_at,
          jsonb_build_object(
            'id', reviews.id,
            'rating', reviews.rating,
            'status', reviews.status,
            'moderation_reason', reviews.moderation_reason,
            'published_at', reviews.published_at,
            'therapist_name', therapist_profiles.public_name,
            'booking_id', reviews.booking_id,
            'created_at', reviews.created_at,
            'updated_at', reviews.updated_at
          ) as row_payload
        from public.reviews
        left join public.therapist_profiles
          on therapist_profiles.id = reviews.therapist_profile_id
        order by reviews.created_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'verifications' then
      select jsonb_build_object(
        'total-verifications', count(*)::integer,
        'pending-verifications', count(*) filter (
          where therapist_verifications.status in (
            'submitted'::public.therapist_status,
            'in_review'::public.therapist_status,
            'changes_requested'::public.therapist_status
          )
        )::integer
      )
      into v_metrics
      from public.therapist_verifications;

      select coalesce(jsonb_agg(row_payload order by submitted_at desc nulls last), '[]'::jsonb)
      into v_rows
      from (
        select
          therapist_verifications.submitted_at,
          jsonb_build_object(
            'id', therapist_verifications.id,
            'therapist_profile_id',
              therapist_verifications.therapist_profile_id,
            'therapist_name', therapist_profiles.public_name,
            'status', therapist_verifications.status,
            'submitted_at', therapist_verifications.submitted_at,
            'reviewed_at', therapist_verifications.reviewed_at,
            'created_at', therapist_verifications.created_at,
            'updated_at', therapist_verifications.updated_at
          ) as row_payload
        from public.therapist_verifications
        left join public.therapist_profiles
          on therapist_profiles.id =
            therapist_verifications.therapist_profile_id
        order by therapist_verifications.submitted_at desc nulls last,
          therapist_verifications.created_at desc
        limit v_limit offset v_offset
      ) rows;

    else
      raise exception 'unsupported admin operation module: %', p_module
        using errcode = '22023';
  end case;

  return jsonb_build_object(
    'generatedAt', now(),
    'metrics', coalesce(v_metrics, '{}'::jsonb),
    'module', p_module,
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_operation_module_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_module_v1(text, integer, integer)
  to authenticated, service_role;

comment on function public.admin_get_operation_module_v1(text, integer, integer) is
  'Minimized admin operation read model. Validates auth.uid() as an admin profile before reading canonical tables and returning DTOs; does not accept actor id from clients.';
