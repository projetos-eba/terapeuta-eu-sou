-- Fase 3: operational Admin Support Inbox.
-- Keeps requester access constrained by the Phase 2 RLS contract and exposes
-- a separate, Admin-authorized read/mutation boundary for triage only.

alter table public.support_tickets
  add column if not exists assigned_admin_id uuid references public.profiles (id) on delete set null;

create index if not exists support_tickets_admin_inbox_idx
  on public.support_tickets (status, priority, last_activity_at asc, created_at desc);
create index if not exists support_tickets_assigned_admin_activity_idx
  on public.support_tickets (assigned_admin_id, last_activity_at asc)
  where assigned_admin_id is not null;

create or replace function public.admin_get_support_inbox_v1(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(1, least(10000, coalesce(nullif(p_query ->> 'page', '')::integer, 1)));
  v_page_size integer := greatest(1, least(50, coalesce(nullif(p_query ->> 'pageSize', '')::integer, 12)));
  v_search text := left(btrim(coalesce(p_query ->> 'search', '')), 120);
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_priority text := nullif(btrim(coalesce(p_query ->> 'priority', '')), '');
  v_category text := nullif(btrim(coalesce(p_query ->> 'category', '')), '');
  v_persona text := nullif(btrim(coalesce(p_query ->> 'persona', '')), '');
  v_assignment text := nullif(btrim(coalesce(p_query ->> 'assignment', '')), '');
  v_total integer;
  v_attention integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'open', 'in_progress', 'waiting_requester', 'waiting_support', 'resolved'
  ) then
    raise exception 'support inbox status is invalid' using errcode = '22023';
  end if;
  if v_priority is not null and v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'support inbox priority is invalid' using errcode = '22023';
  end if;
  if v_persona is not null and v_persona not in ('patient', 'therapist') then
    raise exception 'support inbox persona is invalid' using errcode = '22023';
  end if;
  if v_assignment is not null and v_assignment not in ('unassigned', 'me') then
    raise exception 'support inbox assignment is invalid' using errcode = '22023';
  end if;

  with filtered as (
    select
      tickets.id,
      tickets.subject,
      tickets.category,
      tickets.status,
      tickets.priority,
      tickets.booking_id,
      tickets.created_at,
      tickets.last_activity_at,
      requester.display_name as requester_name,
      requester.role::text as requester_role,
      assignee.display_name as assigned_admin_name,
      tickets.assigned_admin_id
    from public.support_tickets tickets
    left join public.profiles requester on requester.id = tickets.requester_profile_id
    left join public.profiles assignee on assignee.id = tickets.assigned_admin_id
    where (v_status is null or tickets.status = v_status)
      and (v_priority is null or tickets.priority = v_priority)
      and (v_category is null or tickets.category = v_category)
      and (v_persona is null or requester.role::text = v_persona)
      and (
        v_assignment is null
        or (v_assignment = 'unassigned' and tickets.assigned_admin_id is null)
        or (v_assignment = 'me' and tickets.assigned_admin_id = auth.uid())
      )
      and (
        v_search = ''
        or tickets.subject ilike '%' || v_search || '%'
        or tickets.id::text ilike v_search || '%'
        or coalesce(requester.display_name, '') ilike '%' || v_search || '%'
        or coalesce(requester.email, '') ilike '%' || v_search || '%'
      )
  )
  select count(*)::integer into v_total from filtered;

  select count(*)::integer into v_attention
  from public.support_tickets
  where status = 'waiting_support';

  with filtered as (
    select
      tickets.id,
      tickets.subject,
      tickets.category,
      tickets.status,
      tickets.priority,
      tickets.booking_id,
      tickets.created_at,
      tickets.last_activity_at,
      requester.display_name as requester_name,
      requester.role::text as requester_role,
      assignee.display_name as assigned_admin_name,
      tickets.assigned_admin_id
    from public.support_tickets tickets
    left join public.profiles requester on requester.id = tickets.requester_profile_id
    left join public.profiles assignee on assignee.id = tickets.assigned_admin_id
    where (v_status is null or tickets.status = v_status)
      and (v_priority is null or tickets.priority = v_priority)
      and (v_category is null or tickets.category = v_category)
      and (v_persona is null or requester.role::text = v_persona)
      and (
        v_assignment is null
        or (v_assignment = 'unassigned' and tickets.assigned_admin_id is null)
        or (v_assignment = 'me' and tickets.assigned_admin_id = auth.uid())
      )
      and (
        v_search = ''
        or tickets.subject ilike '%' || v_search || '%'
        or tickets.id::text ilike v_search || '%'
        or coalesce(requester.display_name, '') ilike '%' || v_search || '%'
        or coalesce(requester.email, '') ilike '%' || v_search || '%'
      )
  )
  select coalesce(jsonb_agg(row_payload order by attention_rank, priority_rank, pending_age, last_activity_at desc, created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id', id,
        'subject', subject,
        'category', category,
        'status', status,
        'priority', priority,
        'bookingId', booking_id,
        'createdAt', created_at,
        'lastActivityAt', last_activity_at,
        'requesterName', requester_name,
        'requesterRole', requester_role,
        'assignedAdminName', assigned_admin_name,
        'assignedAdminId', assigned_admin_id
      ) as row_payload,
      case status
        when 'waiting_support' then 0
        when 'open' then 1
        when 'in_progress' then 2
        when 'waiting_requester' then 3
        when 'resolved' then 4
        else 5
      end as attention_rank,
      case priority
        when 'urgent' then 0
        when 'high' then 1
        when 'normal' then 2
        when 'low' then 3
        else 2
      end as priority_rank,
      case when status in ('waiting_support', 'open', 'in_progress') then last_activity_at end as pending_age,
      last_activity_at,
      created_at
    from filtered
    limit v_page_size offset ((v_page - 1) * v_page_size)
  ) ordered_rows;

  return jsonb_build_object(
    'rows', v_rows,
    'attentionCount', v_attention,
    'page', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total,
      'hasNext', v_total > v_page * v_page_size
    )
  );
end;
$$;

create or replace function public.admin_get_support_ticket_management_v1(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ticket jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', tickets.id,
    'status', tickets.status,
    'priority', tickets.priority,
    'assignedAdminId', tickets.assigned_admin_id,
    'assignedAdminName', assignee.display_name,
    'requesterEmail', requester.email,
    'booking', case when bookings.id is null then null else jsonb_build_object(
      'id', bookings.id,
      'startsAt', bookings.starts_at,
      'status', bookings.status,
      'paymentStatus', bookings.payment_status,
      'therapistName', therapist_profiles.public_name,
      'patientName', patient_profiles.display_name
    ) end
  ) into v_ticket
  from public.support_tickets tickets
  left join public.profiles assignee on assignee.id = tickets.assigned_admin_id
  left join public.profiles requester on requester.id = tickets.requester_profile_id
  left join public.bookings bookings on bookings.id = tickets.booking_id
  left join public.therapist_profiles therapist_profiles on therapist_profiles.id = bookings.therapist_profile_id
  left join public.patient_profiles patient_profiles on patient_profiles.id = bookings.patient_profile_id
  where tickets.id = p_ticket_id;

  if v_ticket is null then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;
  return v_ticket;
end;
$$;

create or replace function public.admin_manage_support_ticket_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_action text,
  p_priority text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_previous jsonb;
  v_next jsonb;
  v_action text := nullif(btrim(coalesce(p_action, '')), '');
  v_priority text := nullif(btrim(coalesce(p_priority, '')), '');
  v_audit_id uuid;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles where id = v_actor_id and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;
  if p_ticket_id is null or p_request_id is null then
    raise exception 'support management request is invalid' using errcode = '22023';
  end if;
  if v_action not in ('assign_self', 'unassign', 'set_priority', 'start', 'resolve', 'reopen') then
    raise exception 'support management action is invalid' using errcode = '22023';
  end if;
  if v_action = 'set_priority' and v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'support priority is invalid' using errcode = '22023';
  end if;

  select * into v_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;
  if not found then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;

  v_previous := jsonb_build_object(
    'assignedAdminId', v_ticket.assigned_admin_id,
    'priority', v_ticket.priority,
    'status', v_ticket.status
  );

  if v_action = 'assign_self' then
    update public.support_tickets set assigned_admin_id = v_actor_id, last_activity_at = now()
    where id = p_ticket_id;
  elsif v_action = 'unassign' then
    update public.support_tickets set assigned_admin_id = null, last_activity_at = now()
    where id = p_ticket_id;
  elsif v_action = 'set_priority' then
    update public.support_tickets set priority = v_priority, last_activity_at = now()
    where id = p_ticket_id;
  elsif v_action = 'start' then
    if v_ticket.status not in ('open', 'waiting_support') then
      raise exception 'support ticket cannot enter in_progress from current status' using errcode = '22023';
    end if;
    update public.support_tickets set status = 'in_progress', last_activity_at = now()
    where id = p_ticket_id;
  elsif v_action = 'resolve' then
    if v_ticket.status = 'resolved' then
      raise exception 'support ticket is already resolved' using errcode = '22023';
    end if;
    update public.support_tickets set status = 'resolved', last_activity_at = now()
    where id = p_ticket_id;
  elsif v_action = 'reopen' then
    if v_ticket.status <> 'resolved' then
      raise exception 'only resolved tickets can be reopened' using errcode = '22023';
    end if;
    update public.support_tickets set status = 'open', last_activity_at = now()
    where id = p_ticket_id;
  end if;

  select jsonb_build_object(
    'assignedAdminId', tickets.assigned_admin_id,
    'priority', tickets.priority,
    'status', tickets.status
  ) into v_next
  from public.support_tickets tickets
  where id = p_ticket_id;

  v_audit_id := public.record_admin_audit_event_v1(
    v_actor_id,
    'admin',
    'admin.support.manage',
    'support.' || v_action,
    'support_ticket',
    p_ticket_id::text,
    v_previous,
    v_next,
    null,
    p_request_id::text,
    null,
    'admin-support-inbox'
  );

  return jsonb_build_object('ok', true, 'auditEventId', v_audit_id, 'ticket', v_next);
end;
$$;

-- Reply transitions are server-authoritative: an Admin may answer only when
-- TES is actually handling the ticket. Idempotent retries return their prior
-- message before evaluating the current lifecycle state.
create or replace function public.admin_reply_support_ticket_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_body text
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text;
  v_message public.support_ticket_messages%rowtype;
  v_existing public.support_ticket_messages%rowtype;
  v_ticket public.support_tickets%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;
  v_body := public.support_plain_text_v1(p_body, 1, 4000, 'message');
  if p_ticket_id is null or p_request_id is null then
    raise exception 'support message request is invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.support_ticket_messages
  where ticket_id = p_ticket_id and author_profile_id = auth.uid() and request_id = p_request_id;
  if found then return v_existing; end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'support ticket not found' using errcode = 'P0002'; end if;
  if v_ticket.status not in ('open', 'in_progress', 'waiting_support') then
    raise exception 'support ticket cannot receive a public reply in current status' using errcode = '22023';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_profile_id, author_role, body, visibility, request_id)
  values (p_ticket_id, auth.uid(), 'admin'::public.user_role, v_body, 'requester', p_request_id)
  returning * into v_message;

  update public.support_tickets
  set status = 'waiting_requester', resolved_at = null, last_activity_at = now()
  where id = p_ticket_id;

  perform public.record_admin_audit_event_v1(
    auth.uid(), 'admin', 'admin.support.manage', 'support.reply', 'support_ticket', p_ticket_id::text,
    jsonb_build_object('status', v_ticket.status), jsonb_build_object('status', 'waiting_requester'),
    null, p_request_id::text, null, 'support_ticketing'
  );
  return v_message;
end;
$$;

create or replace function public.admin_add_support_ticket_note_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_body text
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text;
  v_message public.support_ticket_messages%rowtype;
  v_existing public.support_ticket_messages%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;
  v_body := public.support_plain_text_v1(p_body, 1, 4000, 'note');
  if p_ticket_id is null or p_request_id is null then
    raise exception 'support note request is invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;
  select * into v_existing from public.support_ticket_messages
  where ticket_id = p_ticket_id and author_profile_id = auth.uid() and request_id = p_request_id;
  if found then return v_existing; end if;

  insert into public.support_ticket_messages (ticket_id, author_profile_id, author_role, body, visibility, request_id)
  values (p_ticket_id, auth.uid(), 'admin'::public.user_role, v_body, 'internal', p_request_id)
  returning * into v_message;
  update public.support_tickets set last_activity_at = now() where id = p_ticket_id;
  perform public.record_admin_audit_event_v1(
    auth.uid(), 'admin', 'admin.support.manage', 'support.internal_note', 'support_ticket', p_ticket_id::text,
    '{}'::jsonb, jsonb_build_object('visibility', 'internal'), null, p_request_id::text, null, 'support_ticketing'
  );
  return v_message;
end;
$$;

-- Preserve the legacy administrative command endpoint as a compatibility
-- facade, while routing its two support transitions through the same guarded
-- state machine used by the Inbox. Other operation modules keep their prior
-- command implementation unchanged.
create or replace function public.admin_execute_operation_command_v2(
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
  v_verification public.therapist_verifications%rowtype;
begin
  if p_action in ('support.resolve', 'support.reopen') then
    if p_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'support management request is invalid' using errcode = '22023';
    end if;
    return public.admin_manage_support_ticket_v1(
      p_entity_id,
      p_request_id::uuid,
      case when p_action = 'support.resolve' then 'resolve' else 'reopen' end,
      null
    );
  end if;

  if p_action like 'professional.%' or p_action like 'verification.%' then
    if p_action = 'verification.pause_review' then
      select * into v_verification
      from public.therapist_verifications
      where id = p_entity_id
      for update;

      if found and v_verification.status = 'submitted'::public.therapist_status then
        update public.therapist_verifications
        set status = 'in_review'::public.therapist_status,
            reviewed_at = coalesce(reviewed_at, now()),
            updated_at = now()
        where id = p_entity_id;

        update public.therapist_profiles
        set status = 'in_review'::public.therapist_status,
            updated_at = now()
        where id = v_verification.therapist_profile_id
          and status <> 'suspended'::public.therapist_status;
      end if;
    end if;

    return public.admin_execute_professional_lifecycle_command_v1(
      p_action,
      p_entity_id,
      p_reason,
      p_request_id,
      p_payload,
      p_correlation_id
    );
  end if;

  return public.admin_execute_operation_command_v2_internal(
    p_action,
    p_entity_id,
    p_reason,
    p_request_id,
    p_payload,
    p_correlation_id
  );
end;
$$;

revoke all on function public.admin_get_support_inbox_v1(jsonb) from public, anon;
revoke all on function public.admin_get_support_ticket_management_v1(uuid) from public, anon;
revoke all on function public.admin_manage_support_ticket_v1(uuid, uuid, text, text) from public, anon;
revoke all on function public.admin_reply_support_ticket_v1(uuid, uuid, text) from public, anon;
revoke all on function public.admin_add_support_ticket_note_v1(uuid, uuid, text) from public, anon;
revoke all on function public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.admin_get_support_inbox_v1(jsonb) to authenticated;
grant execute on function public.admin_get_support_ticket_management_v1(uuid) to authenticated;
grant execute on function public.admin_manage_support_ticket_v1(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_reply_support_ticket_v1(uuid, uuid, text) to authenticated;
grant execute on function public.admin_add_support_ticket_note_v1(uuid, uuid, text) to authenticated;
grant execute on function public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text) to authenticated, service_role;

comment on column public.support_tickets.assigned_admin_id is
  'Operational ownership for Admin Support Inbox. Never exposed to requester DTOs.';
comment on function public.admin_get_support_inbox_v1(jsonb) is
  'Admin-only paginated support inbox. Orders waiting_support first, then priority and oldest pending activity.';
comment on function public.admin_manage_support_ticket_v1(uuid, uuid, text, text) is
  'Admin-only allowlisted support triage mutation with append-only audit event.';
