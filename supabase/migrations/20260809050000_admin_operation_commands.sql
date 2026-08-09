-- Admin operation commands for low-risk operational domains.
--
-- Commands are explicit, audited and idempotent by request_id through
-- record_admin_audit_event_v1. They do not handle financial reconciliation or
-- session cancellation/rescheduling.

create or replace function public.admin_execute_operation_command_v1(
  p_action text,
  p_entity_id uuid,
  p_reason text,
  p_request_id text,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_audit_id uuid;
  v_entity_type text;
  v_next jsonb;
  v_permission text;
  v_previous jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_id text := nullif(btrim(coalesce(p_request_id, '')), '');
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if p_entity_id is null then
    raise exception 'admin command entity id required'
      using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 8 then
    raise exception 'admin command reason must have at least 8 characters'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    raise exception 'admin command request_id required'
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

  case p_action
    when 'professional.suspend' then
      v_entity_type := 'therapist_profile';
      v_permission := 'admin.professionals.suspend';

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'status', therapist_profiles.status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings
      )
      into v_previous
      from public.therapist_profiles
      where therapist_profiles.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.therapist_profiles
      set
        status = 'suspended'::public.therapist_status,
        is_public = false,
        is_accepting_bookings = false,
        metadata = jsonb_set(
          jsonb_set(
            coalesce(metadata, '{}'::jsonb),
            '{adminSuspensionReason}',
            to_jsonb(v_reason),
            true
          ),
          '{adminSuspendedAt}',
          to_jsonb(now()),
          true
        ),
        updated_at = now()
      where id = p_entity_id;

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'status', therapist_profiles.status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings
      )
      into v_next
      from public.therapist_profiles
      where therapist_profiles.id = p_entity_id;

    when 'professional.reactivate' then
      v_entity_type := 'therapist_profile';
      v_permission := 'admin.professionals.suspend';

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'status', therapist_profiles.status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings
      )
      into v_previous
      from public.therapist_profiles
      where therapist_profiles.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.therapist_profiles
      set
        status = 'approved'::public.therapist_status,
        metadata = jsonb_set(
          coalesce(metadata, '{}'::jsonb),
          '{adminReactivatedAt}',
          to_jsonb(now()),
          true
        ),
        updated_at = now()
      where id = p_entity_id
        and status = 'suspended'::public.therapist_status;

      select jsonb_build_object(
        'id', therapist_profiles.id,
        'status', therapist_profiles.status,
        'is_public', therapist_profiles.is_public,
        'is_accepting_bookings', therapist_profiles.is_accepting_bookings
      )
      into v_next
      from public.therapist_profiles
      where therapist_profiles.id = p_entity_id;

    when 'verification.approve' then
      v_entity_type := 'therapist_verification';
      v_permission := 'admin.professionals.verify';

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_previous
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.therapist_verifications
      set
        status = 'approved'::public.therapist_status,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        changes_requested = null,
        rejection_reason = null,
        updated_at = now()
      where id = p_entity_id;

      update public.therapist_profiles
      set status = 'approved'::public.therapist_status,
          updated_at = now()
      where id = (v_previous ->> 'therapist_profile_id')::uuid
        and status <> 'suspended'::public.therapist_status;

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_next
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id;

    when 'verification.reject' then
      v_entity_type := 'therapist_verification';
      v_permission := 'admin.professionals.verify';

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_previous
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.therapist_verifications
      set
        status = 'rejected'::public.therapist_status,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        rejection_reason = v_reason,
        updated_at = now()
      where id = p_entity_id;

      update public.therapist_profiles
      set status = 'rejected'::public.therapist_status,
          is_public = false,
          is_accepting_bookings = false,
          updated_at = now()
      where id = (v_previous ->> 'therapist_profile_id')::uuid
        and status <> 'suspended'::public.therapist_status;

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_next
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id;

    when 'verification.request_changes' then
      v_entity_type := 'therapist_verification';
      v_permission := 'admin.professionals.verify';

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_previous
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.therapist_verifications
      set
        status = 'changes_requested'::public.therapist_status,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        changes_requested = v_reason,
        updated_at = now()
      where id = p_entity_id;

      update public.therapist_profiles
      set status = 'changes_requested'::public.therapist_status,
          is_public = false,
          is_accepting_bookings = false,
          updated_at = now()
      where id = (v_previous ->> 'therapist_profile_id')::uuid
        and status <> 'suspended'::public.therapist_status;

      select jsonb_build_object(
        'id', therapist_verifications.id,
        'status', therapist_verifications.status,
        'therapist_profile_id', therapist_verifications.therapist_profile_id
      )
      into v_next
      from public.therapist_verifications
      where therapist_verifications.id = p_entity_id;

    when 'support.resolve' then
      v_entity_type := 'support_ticket';
      v_permission := 'admin.support.manage';

      select jsonb_build_object(
        'id', support_tickets.id,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency
      )
      into v_previous
      from public.support_tickets
      where support_tickets.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.support_tickets
      set
        status = 'resolved',
        resolution_summary = v_reason,
        reviewed_at = now(),
        updated_at = now()
      where id = p_entity_id;

      select jsonb_build_object(
        'id', support_tickets.id,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency
      )
      into v_next
      from public.support_tickets
      where support_tickets.id = p_entity_id;

    when 'support.reopen' then
      v_entity_type := 'support_ticket';
      v_permission := 'admin.support.manage';

      select jsonb_build_object(
        'id', support_tickets.id,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency
      )
      into v_previous
      from public.support_tickets
      where support_tickets.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.support_tickets
      set
        status = 'open',
        reviewed_at = null,
        updated_at = now()
      where id = p_entity_id;

      select jsonb_build_object(
        'id', support_tickets.id,
        'status', support_tickets.status,
        'priority', support_tickets.priority,
        'urgency', support_tickets.urgency
      )
      into v_next
      from public.support_tickets
      where support_tickets.id = p_entity_id;

    when 'review.hide' then
      v_entity_type := 'review';
      v_permission := 'admin.reviews.moderate';

      select jsonb_build_object(
        'id', reviews.id,
        'status', reviews.status,
        'published_at', reviews.published_at
      )
      into v_previous
      from public.reviews
      where reviews.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.reviews
      set
        status = 'hidden'::public.review_status,
        moderation_reason = v_reason,
        updated_at = now()
      where id = p_entity_id;

      select jsonb_build_object(
        'id', reviews.id,
        'status', reviews.status,
        'published_at', reviews.published_at
      )
      into v_next
      from public.reviews
      where reviews.id = p_entity_id;

    when 'review.restore' then
      v_entity_type := 'review';
      v_permission := 'admin.reviews.moderate';

      select jsonb_build_object(
        'id', reviews.id,
        'status', reviews.status,
        'published_at', reviews.published_at
      )
      into v_previous
      from public.reviews
      where reviews.id = p_entity_id
      for update;

      if v_previous is null then
        raise exception 'admin command target not found'
          using errcode = 'P0002';
      end if;

      update public.reviews
      set
        status = 'published'::public.review_status,
        published_at = coalesce(published_at, now()),
        updated_at = now()
      where id = p_entity_id;

      select jsonb_build_object(
        'id', reviews.id,
        'status', reviews.status,
        'published_at', reviews.published_at
      )
      into v_next
      from public.reviews
      where reviews.id = p_entity_id;

    else
      raise exception 'unsupported admin operation command: %', p_action
        using errcode = '22023';
  end case;

  v_audit_id := public.record_admin_audit_event_v1(
    v_actor_id,
    'admin',
    v_permission,
    p_action,
    v_entity_type,
    p_entity_id::text,
    coalesce(v_previous, '{}'::jsonb),
    coalesce(v_next, '{}'::jsonb),
    v_reason,
    v_request_id,
    p_correlation_id,
    'admin-operation-command'
  );

  return jsonb_build_object(
    'auditEventId', v_audit_id,
    'entityId', p_entity_id,
    'entityType', v_entity_type,
    'nextState', coalesce(v_next, '{}'::jsonb),
    'ok', true,
    'permission', v_permission,
    'previousState', coalesce(v_previous, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

comment on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Executes allowlisted admin operation commands with mandatory reason, request_id and sanitized append-only audit. Does not handle financial reconciliation or session cancellation.';
