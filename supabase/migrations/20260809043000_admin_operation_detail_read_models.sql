-- Admin operation detail read models.
--
-- Detail pages need more context than lists, but must still avoid direct
-- horizontal reads from canonical tables with the browser/session token.

create or replace function public.admin_get_operation_detail_v1(
  p_module text,
  p_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_audit_entity_type text;
  v_record jsonb;
  v_audit_events jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'admin operation detail id required'
      using errcode = '22023';
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
      v_audit_entity_type := 'therapist_profile';

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'user_id', therapist_profiles.user_id,
        'public_name', therapist_profiles.public_name,
        'slug', therapist_profiles.slug,
        'plan', therapist_profiles.plan,
        'status', therapist_profiles.status,
        'public_status', therapist_profiles.public_status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings,
        'accepts_online_sessions', therapist_profiles.accepts_online_sessions,
        'city', therapist_profiles.city,
        'state', therapist_profiles.state,
        'country', therapist_profiles.country,
        'languages', therapist_profiles.languages,
        'service_count', coalesce(service_counts.total, 0),
        'active_service_count', coalesce(service_counts.active_total, 0),
        'future_booking_count', coalesce(booking_counts.future_total, 0),
        'total_booking_count', coalesce(booking_counts.total, 0),
        'connect_status', therapist_connect_accounts.operational_status,
        'next_session_at', next_booking.starts_at,
        'created_at', therapist_profiles.created_at,
        'updated_at', therapist_profiles.updated_at
      )
      into v_record
      from public.therapist_profiles
      left join public.therapist_connect_accounts
        on therapist_connect_accounts.therapist_profile_id =
          therapist_profiles.id
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (
            where therapist_services.status = 'active'::public.service_status
          )::integer as active_total
        from public.therapist_services
        where therapist_services.therapist_profile_id = therapist_profiles.id
          and therapist_services.archived_at is null
      ) service_counts on true
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (where bookings.starts_at >= now())::integer
            as future_total
        from public.bookings
        where bookings.therapist_profile_id = therapist_profiles.id
      ) booking_counts on true
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
      where therapist_profiles.id = p_id;

    when 'patients' then
      v_audit_entity_type := 'patient_profile';

      select jsonb_build_object(
        'id', patient_profiles.id,
        'user_id', patient_profiles.user_id,
        'display_name', patient_profiles.display_name,
        'account_status', case
          when profiles.auth_deleted_at is not null then 'deleted'
          when profiles.anonymized_at is not null then 'anonymized'
          else 'active'
        end,
        'timezone', patient_profiles.timezone,
        'marketing_consent', patient_profiles.marketing_consent,
        'booking_count', coalesce(booking_counts.total, 0),
        'future_booking_count', coalesce(booking_counts.future_total, 0),
        'ticket_count', coalesce(ticket_counts.total, 0),
        'last_activity_at', greatest(
          patient_profiles.updated_at,
          coalesce(booking_counts.last_activity_at, patient_profiles.updated_at),
          coalesce(ticket_counts.last_activity_at, patient_profiles.updated_at)
        ),
        'created_at', patient_profiles.created_at,
        'updated_at', patient_profiles.updated_at
      )
      into v_record
      from public.patient_profiles
      left join public.profiles
        on profiles.id = patient_profiles.user_id
      left join lateral (
        select
          count(*)::integer as total,
          count(*) filter (where bookings.starts_at >= now())::integer
            as future_total,
          max(bookings.updated_at) as last_activity_at
        from public.bookings
        where bookings.patient_profile_id = patient_profiles.id
      ) booking_counts on true
      left join lateral (
        select
          count(*)::integer as total,
          max(support_tickets.updated_at) as last_activity_at
        from public.support_tickets
        where support_tickets.requester_profile_id = patient_profiles.user_id
      ) ticket_counts on true
      where patient_profiles.id = p_id;

    when 'sessions' then
      v_audit_entity_type := 'booking';

      select jsonb_build_object(
        'id', bookings.id,
        'status', bookings.status,
        'payment_status', bookings.payment_status,
        'starts_at', bookings.starts_at,
        'ends_at', bookings.ends_at,
        'timezone', bookings.timezone,
        'service_title_snapshot', bookings.service_title_snapshot,
        'service_duration_minutes_snapshot',
          bookings.service_duration_minutes_snapshot,
        'therapist_profile_id', bookings.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'patient_profile_id', bookings.patient_profile_id,
        'patient_name', patient_profiles.display_name,
        'meeting_provider', bookings.meeting_provider,
        'cancelled_at', bookings.cancelled_at,
        'completed_at', bookings.completed_at,
        'created_at', bookings.created_at,
        'updated_at', bookings.updated_at
      )
      into v_record
      from public.bookings
      left join public.therapist_profiles
        on therapist_profiles.id = bookings.therapist_profile_id
      left join public.patient_profiles
        on patient_profiles.id = bookings.patient_profile_id
      where bookings.id = p_id;

    when 'support' then
      v_audit_entity_type := 'support_ticket';

      select jsonb_build_object(
        'id', support_tickets.id,
        'subject', support_tickets.subject,
        'category', support_tickets.category,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency,
        'source', support_tickets.source,
        'booking_id', support_tickets.booking_id,
        'requester_profile_id', support_tickets.requester_profile_id,
        'requester_role', profiles.role,
        'requester_name', profiles.display_name,
        'created_at', support_tickets.created_at,
        'updated_at', support_tickets.updated_at
      )
      into v_record
      from public.support_tickets
      left join public.profiles
        on profiles.id = support_tickets.requester_profile_id
      where support_tickets.id = p_id;

    when 'reviews' then
      v_audit_entity_type := 'review';

      select jsonb_build_object(
        'id', reviews.id,
        'rating', reviews.rating,
        'status', reviews.status,
        'moderation_reason', reviews.moderation_reason,
        'published_at', reviews.published_at,
        'therapist_profile_id', reviews.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'patient_profile_id', reviews.patient_profile_id,
        'booking_id', reviews.booking_id,
        'created_at', reviews.created_at,
        'updated_at', reviews.updated_at
      )
      into v_record
      from public.reviews
      left join public.therapist_profiles
        on therapist_profiles.id = reviews.therapist_profile_id
      where reviews.id = p_id;

    when 'verifications' then
      v_audit_entity_type := 'therapist_verification';

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'therapist_profile_id', therapist_verifications.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'status', therapist_verifications.status,
        'changes_requested_present',
          nullif(btrim(coalesce(therapist_verifications.changes_requested, '')), '')
            is not null,
        'rejection_reason_present',
          nullif(btrim(coalesce(therapist_verifications.rejection_reason, '')), '')
            is not null,
        'reviewed_by', therapist_verifications.reviewed_by,
        'reviewed_at', therapist_verifications.reviewed_at,
        'submitted_at', therapist_verifications.submitted_at,
        'created_at', therapist_verifications.created_at,
        'updated_at', therapist_verifications.updated_at
      )
      into v_record
      from public.therapist_verifications
      left join public.therapist_profiles
        on therapist_profiles.id =
          therapist_verifications.therapist_profile_id
      where therapist_verifications.id = p_id;

    else
      raise exception 'unsupported admin operation module: %', p_module
        using errcode = '22023';
  end case;

  if v_record is null then
    return jsonb_build_object(
      'auditEvents', '[]'::jsonb,
      'generatedAt', now(),
      'id', p_id,
      'module', p_module,
      'record', null
    );
  end if;

  select coalesce(jsonb_agg(event_payload order by created_at desc), '[]'::jsonb)
  into v_audit_events
  from (
    select
      admin_audit_events.created_at,
      jsonb_build_object(
        'id', admin_audit_events.id,
        'action', admin_audit_events.action,
        'actor_role', admin_audit_events.actor_role,
        'permission', admin_audit_events.permission,
        'reason', admin_audit_events.reason,
        'source', admin_audit_events.source,
        'created_at', admin_audit_events.created_at
      ) as event_payload
    from public.admin_audit_events
    where admin_audit_events.entity_type = v_audit_entity_type
      and admin_audit_events.entity_id = p_id::text
    order by admin_audit_events.created_at desc
    limit 8
  ) events;

  return jsonb_build_object(
    'auditEvents', coalesce(v_audit_events, '[]'::jsonb),
    'generatedAt', now(),
    'id', p_id,
    'module', p_module,
    'record', v_record
  );
end;
$$;

revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

comment on function public.admin_get_operation_detail_v1(text, uuid) is
  'Minimized admin operation detail read model. Validates auth.uid() as admin and returns safe operational DTOs plus sanitized audit event summaries.';
