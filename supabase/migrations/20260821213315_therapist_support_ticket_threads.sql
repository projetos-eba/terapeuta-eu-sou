-- Support Ticketing Fase 2: requester-to-TES conversations remain distinct
-- from Structured Participant Messaging. No free-text path is added to
-- conversations or messages.

alter table public.support_tickets
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

update public.support_tickets
set last_activity_at = coalesce(updated_at, created_at, now())
where last_activity_at is null;

create index if not exists support_tickets_requester_activity_idx
  on public.support_tickets (requester_profile_id, last_activity_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete restrict,
  author_role public.user_role not null,
  body text not null,
  visibility text not null default 'requester',
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint support_ticket_messages_visibility_valid
    check (visibility in ('requester', 'internal')),
  constraint support_ticket_messages_body_not_blank
    check (length(trim(body)) between 1 and 4000),
  constraint support_ticket_messages_author_request_unique
    unique (ticket_id, author_profile_id, request_id)
);

comment on table public.support_ticket_messages is
  'Support thread only. Never use this table for participant-to-participant messaging.';
comment on column public.support_ticket_messages.visibility is
  'requester is visible to the ticket requester; internal is TES/Admin-only.';

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at asc);
create index if not exists support_ticket_messages_requester_idx
  on public.support_ticket_messages (ticket_id, created_at asc)
  where visibility = 'requester';

alter table public.support_ticket_messages enable row level security;

create or replace function public.support_plain_text_v1(
  p_value text,
  p_min_length integer,
  p_max_length integer,
  p_field_name text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := btrim(regexp_replace(coalesce(p_value, ''), '[[:cntrl:]]+', ' ', 'g'));
  v_value := regexp_replace(v_value, '[[:space:]]+', ' ', 'g');

  if length(v_value) < p_min_length or length(v_value) > p_max_length then
    raise exception '% length is invalid', p_field_name using errcode = '22023';
  end if;

  if v_value ~ '<[^>]+>' then
    raise exception '% must be plain text', p_field_name using errcode = '22023';
  end if;

  return v_value;
end;
$$;

create or replace function public.support_current_requester_role_v1()
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'authenticated requester required' using errcode = '42501';
  end if;

  select role
    into v_role
  from public.profiles
  where id = auth.uid()
    and role in ('patient'::public.user_role, 'therapist'::public.user_role);

  if not found then
    raise exception 'authenticated requester required' using errcode = '42501';
  end if;

  return v_role;
end;
$$;

create or replace function public.create_support_ticket_v1(
  p_request_id uuid,
  p_category text,
  p_subject text,
  p_description text,
  p_booking_id uuid default null,
  p_source text default 'message_center'
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
begin
  v_actor_role := public.support_current_requester_role_v1();
  v_category := lower(public.support_plain_text_v1(p_category, 1, 80, 'category'));
  v_subject := public.support_plain_text_v1(p_subject, 3, 120, 'subject');
  v_description := public.support_plain_text_v1(p_description, 1, 4000, 'description');

  if p_request_id is null then
    raise exception 'support request id is required' using errcode = '22023';
  end if;

  if v_category not in (
    'agenda_sessoes',
    'zoom_acesso',
    'pagamentos',
    'financeiro_repasses',
    'plano_assinatura',
    'perfil_verificacao',
    'conta_acesso',
    'outro'
  ) then
    raise exception 'support category is invalid' using errcode = '22023';
  end if;

  if p_source not in ('message_center', 'encounter_detail', 'waiting_room', 'public_help') then
    raise exception 'support source is invalid' using errcode = '22023';
  end if;

  select *
    into v_existing
  from public.support_tickets
  where requester_profile_id = auth.uid()
    and request_id = p_request_id;

  if found then
    return v_existing;
  end if;

  if p_booking_id is not null and not exists (
    select 1
    from public.bookings
    left join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    left join public.therapist_profiles
      on therapist_profiles.id = bookings.therapist_profile_id
    where bookings.id = p_booking_id
      and (
        patient_profiles.user_id = auth.uid()
        or therapist_profiles.user_id = auth.uid()
      )
  ) then
    raise exception 'support booking is not authorized' using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.support_tickets
    where requester_profile_id = auth.uid()
      and created_at >= now() - interval '1 hour'
  ) >= 12 then
    raise exception 'support ticket rate limit reached' using errcode = 'P0001';
  end if;

  insert into public.support_tickets (
    requester_profile_id,
    booking_id,
    category,
    subject,
    description,
    status,
    priority,
    urgency,
    request_id,
    correlation_id,
    diagnostic_context,
    source,
    last_activity_at,
    resolved_at
  )
  values (
    auth.uid(),
    p_booking_id,
    v_category,
    v_subject,
    v_description,
    'open',
    'normal',
    'normal',
    p_request_id,
    gen_random_uuid(),
    jsonb_build_object('source', p_source, 'contract_version', 'support_ticket_v2'),
    p_source,
    now(),
    null
  )
  returning * into v_ticket;

  insert into public.support_ticket_messages (
    ticket_id,
    author_profile_id,
    author_role,
    body,
    visibility,
    request_id
  )
  values (
    v_ticket.id,
    auth.uid(),
    v_actor_role,
    v_description,
    'requester',
    p_request_id
  );

  return v_ticket;
end;
$$;

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

  if v_ticket.status not in ('open', 'in_progress', 'waiting_requester', 'resolved') then
    raise exception 'support ticket is already awaiting TES' using errcode = '22023';
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
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  ) then
    raise exception 'authorized admin required' using errcode = '42501';
  end if;

  v_body := public.support_plain_text_v1(p_body, 1, 4000, 'message');
  if p_ticket_id is null or p_request_id is null then
    raise exception 'support message request is invalid' using errcode = '22023';
  end if;

  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'support ticket not found' using errcode = 'P0002';
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
    'admin'::public.user_role,
    v_body,
    'requester',
    p_request_id
  )
  on conflict (ticket_id, author_profile_id, request_id)
  do update set body = public.support_ticket_messages.body
  returning * into v_message;

  update public.support_tickets
  set status = 'waiting_requester',
      resolved_at = null,
      last_activity_at = now()
  where id = p_ticket_id;

  insert into public.admin_audit_events (
    action,
    actor_role,
    actor_user_id,
    entity_id,
    entity_type,
    next_state,
    previous_state,
    request_id,
    source
  )
  values (
    'support.reply',
    'admin',
    auth.uid(),
    p_ticket_id,
    'support_ticket',
    jsonb_build_object('status', 'waiting_requester'),
    '{}'::jsonb,
    p_request_id,
    'support_ticketing'
  )
  on conflict do nothing;

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
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
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

  insert into public.support_ticket_messages (
    ticket_id, author_profile_id, author_role, body, visibility, request_id
  )
  values (
    p_ticket_id, auth.uid(), 'admin'::public.user_role, v_body, 'internal', p_request_id
  )
  on conflict (ticket_id, author_profile_id, request_id)
  do update set body = public.support_ticket_messages.body
  returning * into v_message;

  update public.support_tickets
  set last_activity_at = now()
  where id = p_ticket_id;

  return v_message;
end;
$$;

create or replace function public.set_support_ticket_lifecycle_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := coalesce(new.resolved_at, now());
    else
      new.resolved_at := null;
    end if;
  end if;

  if new.last_activity_at is not distinct from old.last_activity_at then
    new.last_activity_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_support_ticket_lifecycle on public.support_tickets;
create trigger set_support_ticket_lifecycle
before update on public.support_tickets
for each row execute function public.set_support_ticket_lifecycle_v1();

drop policy if exists "Requesters read public messages from own support tickets"
on public.support_ticket_messages;
create policy "Requesters read public messages from own support tickets"
on public.support_ticket_messages
for select
to authenticated
using (
  visibility = 'requester'
  and exists (
    select 1
    from public.support_tickets
    where support_tickets.id = support_ticket_messages.ticket_id
      and support_tickets.requester_profile_id = (select auth.uid())
  )
);

revoke insert, update, delete on public.support_tickets from authenticated;
revoke all on public.support_ticket_messages from authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;

revoke all on function public.support_plain_text_v1(text, integer, integer, text) from public;
revoke all on function public.support_current_requester_role_v1() from public;
revoke all on function public.create_support_ticket_v1(uuid, text, text, text, uuid, text) from public;
revoke all on function public.send_support_ticket_requester_message_v1(uuid, uuid, text) from public;
revoke all on function public.admin_reply_support_ticket_v1(uuid, uuid, text) from public;
revoke all on function public.admin_add_support_ticket_note_v1(uuid, uuid, text) from public;
revoke all on function public.set_support_ticket_lifecycle_v1() from public;

grant execute on function public.create_support_ticket_v1(uuid, text, text, text, uuid, text) to authenticated;
grant execute on function public.send_support_ticket_requester_message_v1(uuid, uuid, text) to authenticated;
grant execute on function public.admin_reply_support_ticket_v1(uuid, uuid, text) to authenticated;
grant execute on function public.admin_add_support_ticket_note_v1(uuid, uuid, text) to authenticated;
