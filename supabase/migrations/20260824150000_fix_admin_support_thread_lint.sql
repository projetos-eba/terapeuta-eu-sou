-- Qualify the ticket id lookup so the RETURNS TABLE id column cannot be
-- confused with the support_tickets.id column by PL/pgSQL.

create or replace function public.admin_get_support_ticket_thread_v2(
  p_ticket_id uuid
)
returns table (
  id uuid,
  author_role public.user_role,
  body text,
  visibility text,
  created_at timestamptz,
  attachments jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;
  if p_ticket_id is null or not exists (
    select 1
    from public.support_tickets
    where public.support_tickets.id = p_ticket_id
  ) then
    raise exception 'support ticket not found' using errcode = 'P0002';
  end if;

  return query
  select
    messages.id,
    messages.author_role,
    messages.body,
    messages.visibility,
    messages.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', attachments.id,
          'fileName', attachments.original_name,
          'mimeType', attachments.mime_type,
          'sizeBytes', attachments.size_bytes
        ) order by attachments.created_at
      ) filter (where attachments.id is not null),
      '[]'::jsonb
    ) as attachments
  from public.support_ticket_messages messages
  left join public.support_ticket_message_attachments attachments
    on attachments.message_id = messages.id
  where messages.ticket_id = p_ticket_id
  group by messages.id, messages.author_role, messages.body,
    messages.visibility, messages.created_at
  order by messages.created_at asc, messages.id asc;
end;
$$;

grant execute on function public.admin_get_support_ticket_thread_v2(uuid)
  to authenticated;
