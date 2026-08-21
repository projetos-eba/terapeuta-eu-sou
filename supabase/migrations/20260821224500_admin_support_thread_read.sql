-- Fase 2 completion: Admin reads the authorized support thread through a
-- narrow RPC. Internal notes never become readable by requesters.

create or replace function public.admin_get_support_ticket_thread_v1(
  p_ticket_id uuid
)
returns table (
  id uuid,
  author_role public.user_role,
  body text,
  visibility text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;

  if p_ticket_id is null or not exists (
    select 1 from public.support_tickets where support_tickets.id = p_ticket_id
  ) then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;

  return query
  select
    support_ticket_messages.id,
    support_ticket_messages.author_role,
    support_ticket_messages.body,
    support_ticket_messages.visibility,
    support_ticket_messages.created_at
  from public.support_ticket_messages
  where support_ticket_messages.ticket_id = p_ticket_id
  order by support_ticket_messages.created_at asc, support_ticket_messages.id asc;
end;
$$;

revoke all on function public.admin_get_support_ticket_thread_v1(uuid)
from public, anon;
grant execute on function public.admin_get_support_ticket_thread_v1(uuid)
to authenticated;

comment on function public.admin_get_support_ticket_thread_v1(uuid) is
  'Admin-only support thread read. It may include internal notes and must never be used by requester APIs.';
