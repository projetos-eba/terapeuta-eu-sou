-- Support attachments remain private and are only reachable through the
-- authenticated support APIs. Participant conversations never use this table.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'support-ticket-attachments',
  'support-ticket-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.support_ticket_message_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid not null references public.support_ticket_messages (id) on delete cascade,
  storage_bucket text not null default 'support-ticket-attachments',
  storage_object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint support_ticket_attachment_bucket_valid
    check (storage_bucket = 'support-ticket-attachments'),
  constraint support_ticket_attachment_name_valid
    check (length(trim(original_name)) between 1 and 160),
  constraint support_ticket_attachment_mime_valid
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint support_ticket_attachment_size_valid
    check (size_bytes between 1 and 10485760)
);

create index if not exists support_ticket_attachment_message_idx
  on public.support_ticket_message_attachments (message_id, created_at asc);
create index if not exists support_ticket_attachment_ticket_idx
  on public.support_ticket_message_attachments (ticket_id, created_at asc);

drop policy if exists "Requesters read own support tickets" on public.support_tickets;
create policy "Requesters read own support tickets"
on public.support_tickets
for select
to authenticated
using (requester_profile_id = (select auth.uid()));

alter table public.support_ticket_message_attachments enable row level security;

drop policy if exists "Requesters read own support attachments"
on public.support_ticket_message_attachments;
create policy "Requesters read own support attachments"
on public.support_ticket_message_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets
    where support_tickets.id = support_ticket_message_attachments.ticket_id
      and support_tickets.requester_profile_id = (select auth.uid())
  )
);

drop policy if exists "Admins read support attachments"
on public.support_ticket_message_attachments;
create policy "Admins read support attachments"
on public.support_ticket_message_attachments
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'::public.user_role
  )
);

revoke all on public.support_ticket_message_attachments from authenticated;
grant select on public.support_ticket_message_attachments to authenticated;

drop policy if exists "Support requesters upload own attachments" on storage.objects;
create policy "Support requesters upload own attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'support-ticket-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (
    exists (
      select 1 from public.support_tickets
      where support_tickets.id = case
        when split_part(storage.objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then split_part(storage.objects.name, '/', 1)::uuid
        else null
      end
        and support_tickets.requester_profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'::public.user_role
    )
  )
);

drop policy if exists "Support participants read attachments" on storage.objects;
create policy "Support participants read attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'support-ticket-attachments'
  and exists (
    select 1
    from public.support_ticket_message_attachments attachments
    where attachments.storage_bucket = storage.objects.bucket_id
      and attachments.storage_object_path = storage.objects.name
      and (
        exists (
          select 1 from public.support_tickets
          where support_tickets.id = attachments.ticket_id
            and support_tickets.requester_profile_id = (select auth.uid())
        )
        or exists (
          select 1 from public.profiles
          where profiles.id = (select auth.uid())
            and profiles.role = 'admin'::public.user_role
        )
      )
  )
);

drop policy if exists "Support participants remove own failed uploads" on storage.objects;
create policy "Support participants remove own failed uploads"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'support-ticket-attachments'
  and (
    exists (
      select 1 from public.support_tickets
      where support_tickets.id = case
        when split_part(storage.objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then split_part(storage.objects.name, '/', 1)::uuid
        else null
      end
        and support_tickets.requester_profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'::public.user_role
    )
  )
);

create or replace function public.support_validate_ticket_attachments_v1(
  p_ticket_id uuid,
  p_message_id uuid,
  p_attachments jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment jsonb;
  v_path text;
  v_name text;
  v_mime text;
  v_size integer;
begin
  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'support attachments are invalid' using errcode = '22023';
  end if;
  if jsonb_array_length(p_attachments) > 5 then
    raise exception 'support attachment limit reached' using errcode = '22023';
  end if;

  for v_attachment in select value from jsonb_array_elements(p_attachments)
  loop
    v_path := nullif(btrim(v_attachment->>'storageObjectPath'), '');
    v_name := nullif(btrim(v_attachment->>'originalName'), '');
    v_mime := nullif(btrim(v_attachment->>'mimeType'), '');
    v_size := nullif(v_attachment->>'sizeBytes', '')::integer;

    if v_path is null or v_name is null or v_mime is null or v_size is null
      or length(v_name) > 160
      or v_size < 1 or v_size > 10485760
      or v_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      or v_path not like p_ticket_id::text || '/%'
      or v_path like '%..%'
      or not exists (
        select 1 from storage.objects
        where storage.objects.bucket_id = 'support-ticket-attachments'
          and storage.objects.name = v_path
      )
    then
      raise exception 'support attachment metadata is invalid' using errcode = '22023';
    end if;

    insert into public.support_ticket_message_attachments (
      ticket_id,
      message_id,
      storage_object_path,
      original_name,
      mime_type,
      size_bytes
    )
    values (
      p_ticket_id,
      p_message_id,
      v_path,
      v_name,
      v_mime,
      v_size
    )
    on conflict (storage_object_path) do nothing;
  end loop;
end;
$$;

revoke all on function public.support_validate_ticket_attachments_v1(uuid, uuid, jsonb)
from public, anon, authenticated;

create or replace function public.create_support_ticket_with_attachments_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_category text,
  p_subject text,
  p_description text,
  p_booking_id uuid default null,
  p_source text default 'message_center',
  p_attachments jsonb default '[]'::jsonb
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_category text;
  v_subject text;
  v_description text;
  v_ticket public.support_tickets%rowtype;
  v_existing public.support_tickets%rowtype;
  v_message_id uuid;
begin
  v_actor_role := public.support_current_requester_role_v1();
  v_category := lower(public.support_plain_text_v1(p_category, 1, 80, 'category'));
  v_subject := public.support_plain_text_v1(p_subject, 3, 120, 'subject');
  v_description := public.support_plain_text_v1(p_description, 1, 4000, 'description');

  if p_ticket_id is null or p_request_id is null then
    raise exception 'support request id is required' using errcode = '22023';
  end if;
  if v_category not in ('agenda_sessoes', 'zoom_acesso', 'pagamentos', 'financeiro_repasses', 'plano_assinatura', 'perfil_verificacao', 'conta_acesso', 'outro') then
    raise exception 'support category is invalid' using errcode = '22023';
  end if;
  if p_source not in ('message_center', 'encounter_detail', 'waiting_room', 'public_help') then
    raise exception 'support source is invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.support_tickets
  where requester_profile_id = auth.uid() and request_id = p_request_id;
  if found then return v_existing; end if;

  if p_booking_id is not null and not exists (
    select 1
    from public.bookings
    left join public.patient_profiles on patient_profiles.id = bookings.patient_profile_id
    left join public.therapist_profiles on therapist_profiles.id = bookings.therapist_profile_id
    where bookings.id = p_booking_id
      and (patient_profiles.user_id = auth.uid() or therapist_profiles.user_id = auth.uid())
  ) then
    raise exception 'support booking is not authorized' using errcode = '42501';
  end if;

  if (select count(*) from public.support_tickets where requester_profile_id = auth.uid() and created_at >= now() - interval '1 hour') >= 12 then
    raise exception 'support ticket rate limit reached' using errcode = 'P0001';
  end if;

  insert into public.support_tickets (
    id, requester_profile_id, booking_id, category, subject, description, status,
    priority, urgency, request_id, correlation_id, diagnostic_context, source,
    last_activity_at, resolved_at
  )
  values (
    p_ticket_id, auth.uid(), p_booking_id, v_category, v_subject, v_description,
    'open', 'normal', 'normal', p_request_id, gen_random_uuid(),
    jsonb_build_object('source', p_source, 'contract_version', 'support_ticket_v2'),
    p_source, now(), null
  )
  returning * into v_ticket;

  insert into public.support_ticket_messages (
    ticket_id, author_profile_id, author_role, body, visibility, request_id
  )
  values (v_ticket.id, auth.uid(), v_actor_role, v_description, 'requester', p_request_id)
  returning id into v_message_id;

  perform public.support_validate_ticket_attachments_v1(v_ticket.id, v_message_id, coalesce(p_attachments, '[]'::jsonb));
  return v_ticket;
end;
$$;

create or replace function public.send_support_ticket_requester_message_with_attachments_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_body text,
  p_attachments jsonb default '[]'::jsonb
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.support_ticket_messages%rowtype;
begin
  v_message := public.send_support_ticket_requester_message_v1(p_ticket_id, p_request_id, p_body);
  perform public.support_validate_ticket_attachments_v1(p_ticket_id, v_message.id, coalesce(p_attachments, '[]'::jsonb));
  return v_message;
end;
$$;

create or replace function public.attach_support_ticket_requester_attachments_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_attachments jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid;
begin
  if not exists (
    select 1 from public.support_tickets
    where id = p_ticket_id and requester_profile_id = auth.uid()
  ) then
    raise exception 'support ticket requester required' using errcode = '42501';
  end if;
  select id into v_message_id
  from public.support_ticket_messages
  where ticket_id = p_ticket_id
    and author_profile_id = auth.uid()
    and request_id = p_request_id
    and visibility = 'requester'
  order by created_at asc
  limit 1;
  if v_message_id is null then
    raise exception 'support ticket message not found' using errcode = 'P0002';
  end if;
  perform public.support_validate_ticket_attachments_v1(p_ticket_id, v_message_id, coalesce(p_attachments, '[]'::jsonb));
end;
$$;

create or replace function public.admin_reply_support_ticket_with_attachments_v1(
  p_ticket_id uuid,
  p_request_id uuid,
  p_body text,
  p_attachments jsonb default '[]'::jsonb
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.support_ticket_messages%rowtype;
begin
  v_message := public.admin_reply_support_ticket_v1(p_ticket_id, p_request_id, p_body);
  perform public.support_validate_ticket_attachments_v1(p_ticket_id, v_message.id, coalesce(p_attachments, '[]'::jsonb));
  return v_message;
end;
$$;

grant execute on function public.create_support_ticket_with_attachments_v1(uuid, uuid, text, text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.send_support_ticket_requester_message_with_attachments_v1(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.admin_reply_support_ticket_with_attachments_v1(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.attach_support_ticket_requester_attachments_v1(uuid, uuid, jsonb) to authenticated;

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
  if p_ticket_id is null or not exists (select 1 from public.support_tickets where id = p_ticket_id) then
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
  left join public.support_ticket_message_attachments attachments on attachments.message_id = messages.id
  where messages.ticket_id = p_ticket_id
  group by messages.id, messages.author_role, messages.body, messages.visibility, messages.created_at
  order by messages.created_at asc, messages.id asc;
end;
$$;

grant execute on function public.admin_get_support_ticket_thread_v2(uuid) to authenticated;

drop policy if exists "Admins read support tickets for realtime" on public.support_tickets;
create policy "Admins read support tickets for realtime"
on public.support_tickets
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'::public.user_role
  )
);

drop policy if exists "Admins read support messages for realtime" on public.support_ticket_messages;
create policy "Admins read support messages for realtime"
on public.support_ticket_messages
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'::public.user_role
  )
);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_ticket_messages') then
    alter publication supabase_realtime add table public.support_ticket_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_ticket_message_attachments') then
    alter publication supabase_realtime add table public.support_ticket_message_attachments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

update public.message_templates
set
  is_active = false,
  usage_description = 'Modelo histórico, indisponível para novos envios.',
  updated_at = now()
where key in ('therapist_cancel_processed', 'therapist_platform_action');

update public.message_templates
set usage_description = 'Comunica uma janela curta de atraso.', updated_at = now()
where key = 'therapist_delay';

comment on table public.support_ticket_message_attachments is
  'Private requester-visible attachments for TES support messages only.';
