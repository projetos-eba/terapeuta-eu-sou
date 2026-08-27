-- Protocolos legíveis para chamados do TES. O protocolo é identificador de
-- atendimento, não autorização e nunca substitui o UUID interno.

alter table public.support_tickets
  add column if not exists protocol text;

create or replace function public.support_ticket_protocol_suffix_v1(p_category text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'agenda_sessoes' then 'A'
    when 'zoom_acesso' then 'Z'
    when 'pagamentos' then 'P'
    when 'financeiro_repasses' then 'F'
    when 'plano_assinatura' then 'S'
    when 'perfil_verificacao' then 'V'
    when 'conta_acesso' then 'C'
    else 'O'
  end
$$;

create or replace function public.support_ticket_protocol_v1(p_category text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_protocol text;
begin
  -- Serializa apenas a alocação do identificador curto para eliminar a pequena
  -- janela de colisão entre a checagem e o insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('support_ticket_protocol_v1')
  );

  loop
    v_protocol := pg_catalog.lpad(
      pg_catalog.floor(pg_catalog.random() * 1000000000)::bigint::text,
      9,
      '0'
    ) || public.support_ticket_protocol_suffix_v1(p_category);

    exit when not exists (
      select 1
      from public.support_tickets
      where protocol = v_protocol
    );
  end loop;

  return v_protocol;
end;
$$;

update public.support_tickets
set protocol = public.support_ticket_protocol_v1(category)
where protocol is null;

alter table public.support_tickets
  alter column protocol set not null;

alter table public.support_tickets
  drop constraint if exists support_tickets_protocol_format;
alter table public.support_tickets
  add constraint support_tickets_protocol_format
  check (protocol ~ '^[0-9]{9}[A-Z]$');

create unique index if not exists support_tickets_protocol_key
  on public.support_tickets (protocol);

create or replace function public.set_support_ticket_protocol_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.protocol is null then
    new.protocol := public.support_ticket_protocol_v1(new.category);
  end if;
  return new;
end;
$$;

drop trigger if exists set_support_ticket_protocol on public.support_tickets;
create trigger set_support_ticket_protocol
before insert on public.support_tickets
for each row execute function public.set_support_ticket_protocol_v1();

create or replace function public.keep_support_ticket_protocol_immutable_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.protocol is distinct from old.protocol then
    raise exception 'support ticket protocol is immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_support_ticket_protocol_immutable on public.support_tickets;
create trigger keep_support_ticket_protocol_immutable
before update on public.support_tickets
for each row execute function public.keep_support_ticket_protocol_immutable_v1();

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
        or coalesce(requester.display_name, '') ilike '%' || v_search || '%'
        or coalesce(requester.email, '') ilike '%' || v_search || '%')
  )
  select coalesce(jsonb_agg(row_payload order by attention_rank, priority_rank, pending_age, last_activity_at desc, created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', id, 'protocol', protocol, 'subject', subject, 'category', category,
      'status', status, 'priority', priority, 'bookingId', booking_id,
      'createdAt', created_at, 'lastActivityAt', last_activity_at,
      'requesterName', requester_name, 'requesterRole', requester_role,
      'assignedAdminName', assigned_admin_name, 'assignedAdminId', assigned_admin_id
    ) as row_payload,
      case status when 'waiting_support' then 0 when 'open' then 1 when 'in_progress' then 2 when 'waiting_requester' then 3 when 'resolved' then 4 else 5 end as attention_rank,
      case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 when 'low' then 3 else 2 end as priority_rank,
      case when status in ('waiting_support', 'open', 'in_progress') then last_activity_at end as pending_age,
      last_activity_at, created_at
    from filtered
    limit v_page_size offset ((v_page - 1) * v_page_size)
  ) ordered_rows;

  return jsonb_build_object(
    'rows', v_rows, 'attentionCount', v_attention,
    'page', jsonb_build_object('page', v_page, 'pageSize', v_page_size, 'total', v_total, 'hasNext', v_total > v_page * v_page_size)
  );
end;
$$;

create or replace function public.admin_get_operation_detail_v1(
  p_module text, p_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_record jsonb;
  v_profile_id uuid;
  v_eligibility jsonb;
  v_verification_id uuid;
  v_verification_status text;
  v_protocol text;
begin
  v_base := public.admin_get_operation_detail_v1_internal(p_module, p_id);
  v_record := v_base -> 'record';
  if v_record is null or v_record = 'null'::jsonb then return v_base; end if;

  if p_module = 'support' then
    select protocol into v_protocol from public.support_tickets where id = p_id;
    return jsonb_set(v_base, '{record}', v_record || jsonb_build_object('protocol', v_protocol));
  end if;

  if p_module = 'professionals' then
    v_profile_id := (v_record ->> 'id')::uuid;
    select id, status::text into v_verification_id, v_verification_status
    from public.therapist_verifications
    where therapist_profile_id = v_profile_id
    order by submitted_at desc nulls last, created_at desc, id desc
    limit 1;
  elsif p_module = 'verifications' then
    v_profile_id := (v_record ->> 'therapist_profile_id')::uuid;
  else
    return v_base;
  end if;

  v_eligibility := public.get_therapist_publication_eligibility_v1(v_profile_id);
  v_record := v_record || jsonb_build_object(
    'latest_verification_id', v_verification_id,
    'verification_status', coalesce(v_verification_status, case when p_module = 'verifications' then v_record ->> 'status' else 'none' end),
    'publication_eligibility', v_eligibility,
    'publication_blockers', v_eligibility -> 'blockers'
  );
  return jsonb_set(v_base, '{record}', v_record);
end;
$$;

revoke all on function public.support_ticket_protocol_suffix_v1(text), public.support_ticket_protocol_v1(text), public.set_support_ticket_protocol_v1(), public.keep_support_ticket_protocol_immutable_v1() from public, anon, authenticated;
revoke all on function public.admin_get_support_inbox_v1(jsonb) from public, anon;
grant execute on function public.admin_get_support_inbox_v1(jsonb), public.admin_get_operation_detail_v1(text, uuid) to authenticated, service_role;

comment on column public.support_tickets.protocol is
  'Immutable public-facing support protocol: nine digits plus a category suffix. Not an authorization secret.';
