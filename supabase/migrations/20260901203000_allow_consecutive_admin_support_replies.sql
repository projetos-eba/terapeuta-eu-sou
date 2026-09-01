-- Public support replies do not lock the conversation for the Admin either.
-- `waiting_requester` prioritizes the requester in the inbox; it is not a
-- permission boundary for a further message from the TES team.

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
  if v_ticket.status not in ('open', 'in_progress', 'waiting_support', 'waiting_requester') then
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

comment on function public.admin_reply_support_ticket_v1(uuid, uuid, text) is
  'Creates an authorized public Admin reply for an active ticket, including consecutive replies while waiting for the requester.';
