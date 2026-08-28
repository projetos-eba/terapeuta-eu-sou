-- The support inbox is a chronological operational queue. New activity must
-- be visible on the first page without a manual filter or refresh.

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
  v_search text := left(replace(btrim(coalesce(p_query ->> 'search', '')), '#', ''), 120);
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
  if v_status is not null and v_status not in ('open', 'in_progress', 'waiting_requester', 'waiting_support', 'resolved') then
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
    select tickets.id, tickets.protocol, tickets.subject, tickets.category,
      tickets.status, tickets.priority, tickets.booking_id, tickets.created_at,
      tickets.last_activity_at, requester.display_name as requester_name,
      requester.role::text as requester_role,
      assignee.display_name as assigned_admin_name, tickets.assigned_admin_id
    from public.support_tickets tickets
    left join public.profiles requester on requester.id = tickets.requester_profile_id
    left join public.profiles assignee on assignee.id = tickets.assigned_admin_id
    where (v_status is null or tickets.status = v_status)
      and (v_priority is null or tickets.priority = v_priority)
      and (v_category is null or tickets.category = v_category)
      and (v_persona is null or requester.role::text = v_persona)
      and (v_assignment is null
        or (v_assignment = 'unassigned' and tickets.assigned_admin_id is null)
        or (v_assignment = 'me' and tickets.assigned_admin_id = auth.uid()))
      and (v_search = '' or tickets.subject ilike '%' || v_search || '%'
        or tickets.protocol ilike v_search || '%'
        or coalesce(requester.display_name, '') ilike '%' || v_search || '%'
        or coalesce(requester.email, '') ilike '%' || v_search || '%')
  )
  select count(*)::integer into v_total from filtered;

  select count(*)::integer into v_attention
  from public.support_tickets where status = 'waiting_support';

  with filtered as (
    select tickets.id, tickets.protocol, tickets.subject, tickets.category,
      tickets.status, tickets.priority, tickets.booking_id, tickets.created_at,
      tickets.last_activity_at, requester.display_name as requester_name,
      requester.role::text as requester_role,
      assignee.display_name as assigned_admin_name, tickets.assigned_admin_id
    from public.support_tickets tickets
    left join public.profiles requester on requester.id = tickets.requester_profile_id
    left join public.profiles assignee on assignee.id = tickets.assigned_admin_id
    where (v_status is null or tickets.status = v_status)
      and (v_priority is null or tickets.priority = v_priority)
      and (v_category is null or tickets.category = v_category)
      and (v_persona is null or requester.role::text = v_persona)
      and (v_assignment is null
        or (v_assignment = 'unassigned' and tickets.assigned_admin_id is null)
        or (v_assignment = 'me' and tickets.assigned_admin_id = auth.uid()))
      and (v_search = '' or tickets.subject ilike '%' || v_search || '%'
        or tickets.protocol ilike v_search || '%'
        or coalesce(requester.display_name, '') ilike '%' || v_search || '%')
  ),
  ordered_rows as (
    select
      id,
      last_activity_at,
      created_at,
      jsonb_build_object(
        'id', id, 'protocol', protocol, 'subject', subject, 'category', category,
        'status', status, 'priority', priority, 'bookingId', booking_id,
        'createdAt', created_at, 'lastActivityAt', last_activity_at,
        'requesterName', requester_name, 'requesterRole', requester_role,
        'assignedAdminName', assigned_admin_name, 'assignedAdminId', assigned_admin_id
      ) as row_payload
    from filtered
    order by last_activity_at desc, created_at desc, id desc
    limit v_page_size offset ((v_page - 1) * v_page_size)
  )
  select coalesce(
    jsonb_agg(row_payload order by last_activity_at desc, created_at desc, id desc),
    '[]'::jsonb
  ) into v_rows
  from ordered_rows;

  return jsonb_build_object(
    'rows', v_rows, 'attentionCount', v_attention,
    'page', jsonb_build_object('page', v_page, 'pageSize', v_page_size, 'total', v_total, 'hasNext', v_total > v_page * v_page_size)
  );
end;
$$;

comment on function public.admin_get_support_inbox_v1(jsonb) is
  'Admin-only support inbox with server-side filters, chronological recency ordering and pagination.';
