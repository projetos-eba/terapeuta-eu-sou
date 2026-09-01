-- Support conversations remain open for requester complements while TES is
-- processing the ticket. `waiting_support` is an inbox priority, not a lock.

create or replace function public.send_support_ticket_requester_message_v1(
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
  v_actor_role public.user_role;
  v_body text;
  v_ticket public.support_tickets%rowtype;
  v_message public.support_ticket_messages%rowtype;
  v_existing public.support_ticket_messages%rowtype;
begin
  v_actor_role := public.support_current_requester_role_v1();
  v_body := public.support_plain_text_v1(p_body, 1, 4000, 'message');

  if p_ticket_id is null or p_request_id is null then
    raise exception 'support message request is invalid' using errcode = '22023';
  end if;

  select *
    into v_ticket
  from public.support_tickets
  where id = p_ticket_id
    and requester_profile_id = auth.uid()
  for update;

  if not found then
    raise exception 'support ticket requester required' using errcode = '42501';
  end if;

  select *
    into v_existing
  from public.support_ticket_messages
  where ticket_id = p_ticket_id
    and author_profile_id = auth.uid()
    and request_id = p_request_id;

  if found then
    return v_existing;
  end if;

  if v_ticket.status not in (
    'open',
    'in_progress',
    'waiting_requester',
    'waiting_support',
    'resolved'
  ) then
    raise exception 'support ticket state is invalid' using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.support_ticket_messages
    where ticket_id = p_ticket_id
      and author_profile_id = auth.uid()
      and created_at >= now() - interval '10 minutes'
  ) >= 12 then
    raise exception 'support message rate limit reached' using errcode = 'P0001';
  end if;

  insert into public.support_ticket_messages (
    ticket_id,
    author_profile_id,
    author_role,
    body,
    visibility,
    request_id
  )
  values (
    p_ticket_id,
    auth.uid(),
    v_actor_role,
    v_body,
    'requester',
    p_request_id
  )
  on conflict (ticket_id, author_profile_id, request_id)
  do update set body = public.support_ticket_messages.body
  returning * into v_message;

  update public.support_tickets
  set status = 'waiting_support',
      resolved_at = null,
      last_activity_at = now()
  where id = p_ticket_id;

  return v_message;
end;
$$;

create or replace function public.admin_support_ticket_message_exists_v1(
  p_ticket_id uuid,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;

  if p_ticket_id is null or p_request_id is null or not exists (
    select 1
    from public.support_tickets
    where id = p_ticket_id
  ) then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;

  return exists (
    select 1
    from public.support_ticket_messages
    where ticket_id = p_ticket_id
      and author_profile_id = auth.uid()
      and request_id = p_request_id
      and visibility = 'requester'
  );
end;
$$;

revoke all on function public.admin_support_ticket_message_exists_v1(uuid, uuid) from public, anon;
grant execute on function public.admin_support_ticket_message_exists_v1(uuid, uuid) to authenticated;

comment on function public.admin_support_ticket_message_exists_v1(uuid, uuid) is
  'Returns whether the authenticated Admin already created this public support reply request. Does not expose thread data.';
