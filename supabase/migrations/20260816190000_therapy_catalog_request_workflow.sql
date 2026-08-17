-- Solicitações estruturadas de novas terapias enviadas por terapeutas.
-- A aprovação nunca publica texto livre nem cria uma terapia automaticamente.

alter table public.therapy_catalog_requests
  add column if not exists client_request_id uuid,
  add column if not exists submission_version integer not null default 1,
  add column if not exists submission jsonb not null default '{}'::jsonb,
  add column if not exists resubmitted_at timestamptz;

alter table public.therapy_catalog_requests
  drop constraint if exists therapy_catalog_requests_submission_version_check;
alter table public.therapy_catalog_requests
  add constraint therapy_catalog_requests_submission_version_check
  check (submission_version >= 1);

create unique index if not exists therapy_catalog_requests_requester_client_request_idx
  on public.therapy_catalog_requests (requester_profile_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists therapy_catalog_requests_open_name_idx
  on public.therapy_catalog_requests (requester_profile_id, lower(trim(informed_name)))
  where status in ('submitted', 'under_review', 'needs_information');

create table if not exists public.therapy_catalog_request_materials (
  id uuid primary key default gen_random_uuid(),
  therapy_catalog_request_id uuid not null references public.therapy_catalog_requests (id) on delete cascade,
  file_name text not null,
  file_size_bytes integer not null,
  mime_type text not null,
  storage_object_path text not null unique,
  created_at timestamptz not null default now(),
  constraint therapy_catalog_request_materials_file_name_check check (char_length(trim(file_name)) between 1 and 180),
  constraint therapy_catalog_request_materials_file_size_check check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint therapy_catalog_request_materials_mime_check check (
    mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    )
  )
);

create index if not exists therapy_catalog_request_materials_request_idx
  on public.therapy_catalog_request_materials (therapy_catalog_request_id, created_at desc);

alter table public.therapy_catalog_request_materials enable row level security;

drop policy if exists "Admins can read therapy catalog request materials"
on public.therapy_catalog_request_materials;
create policy "Admins can read therapy catalog request materials"
on public.therapy_catalog_request_materials
for select to authenticated
using (public.is_current_admin());

drop policy if exists "Therapists can read own therapy catalog request materials"
on public.therapy_catalog_request_materials;
create policy "Therapists can read own therapy catalog request materials"
on public.therapy_catalog_request_materials
for select to authenticated
using (
  exists (
    select 1
    from public.therapy_catalog_requests request
    where request.id = therapy_catalog_request_materials.therapy_catalog_request_id
      and request.requester_profile_id = auth.uid()
  )
);

grant select on public.therapy_catalog_request_materials to authenticated, service_role;
grant all on public.therapy_catalog_request_materials to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'therapy-catalog-request-materials',
  'therapy-catalog-request-materials',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active
)
values
  (
    'therapy_catalog_request_submitted',
    'therapy_catalog',
    'Solicitação de terapia recebida',
    'Confirma o recebimento de uma sugestão de terapia enviada por terapeuta.',
    true
  ),
  (
    'therapy_catalog_request_updated',
    'therapy_catalog',
    'Atualização de solicitação de terapia',
    'Informa uma mudança de estado ou pedido de informações em uma sugestão de terapia.',
    true
  )
on conflict (action_key) do nothing;

create or replace function public.submit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_therapist_profile_id uuid;
  v_existing public.therapy_catalog_requests;
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_category_id uuid := nullif(p_payload->>'suggestedCategoryId', '')::uuid;
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
  v_description text := nullif(trim(coalesce(v_submission->>'description', '')), '');
  v_objective text := nullif(trim(coalesce(v_submission->>'objective', '')), '');
  v_use_cases text := nullif(trim(coalesce(v_submission->>'useCases', '')), '');
  v_process text := nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '');
begin
  select * into v_profile
  from public.profiles
  where id = p_actor_user_id
    and role = 'therapist';

  if v_profile.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED';
  end if;

  select * into v_existing
  from public.therapy_catalog_requests
  where requester_profile_id = p_actor_user_id
    and client_request_id = p_request_id;

  if v_existing.id is not null then
    return jsonb_build_object(
      'contractVersion', 2,
      'idempotentReplay', true,
      'requestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  if p_request_id is null or char_length(v_name) < 2 or char_length(v_name) > 120
    or v_category_id is null or v_description is null or v_objective is null
    or v_use_cases is null or v_process is null then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1 from public.therapy_categories
    where id = v_category_id and is_active = true
  ) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_CATEGORY';
  end if;

  select id into v_therapist_profile_id
  from public.therapist_profiles
  where user_id = p_actor_user_id
  limit 1;

  insert into public.therapy_catalog_requests (
    requester_profile_id,
    requester_therapist_profile_id,
    client_request_id,
    informed_name,
    description,
    suggested_category_id,
    justification,
    submission,
    submission_version,
    status
  ) values (
    p_actor_user_id,
    v_therapist_profile_id,
    p_request_id,
    v_name,
    v_description,
    v_category_id,
    v_objective,
    v_submission,
    2,
    'submitted'
  )
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, next_state, request_id
  ) values (
    v_profile.id,
    v_profile.role,
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_submitted',
    jsonb_build_object('status', 'submitted', 'informedName', v_name),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação recebida',
    'Recebemos sua sugestão de terapia. Você será avisado quando houver uma atualização.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object(
    'contractVersion', 2,
    'idempotentReplay', false,
    'requestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

create or replace function public.resubmit_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_catalog_request_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.therapy_catalog_requests;
  v_name text := trim(coalesce(p_payload->>'informedName', ''));
  v_category_id uuid := nullif(p_payload->>'suggestedCategoryId', '')::uuid;
  v_submission jsonb := coalesce(p_payload->'submission', '{}'::jsonb);
begin
  select * into v_request
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
    and requester_profile_id = p_actor_user_id
  for update;

  if v_request.id is null then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'needs_information' then
    raise exception 'THERAPY_CATALOG_REQUEST_NOT_EDITABLE';
  end if;

  if p_request_id is null or char_length(v_name) < 2 or char_length(v_name) > 120
    or v_category_id is null or nullif(trim(coalesce(v_submission->>'description', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'objective', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'useCases', '')), '') is null
    or nullif(trim(coalesce(v_submission->>'sessionProcess', '')), '') is null then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1 from public.therapy_categories
    where id = v_category_id and is_active = true
  ) then
    raise exception 'THERAPY_CATALOG_REQUEST_INVALID_CATEGORY';
  end if;

  update public.therapy_catalog_requests
  set
    informed_name = v_name,
    description = nullif(trim(coalesce(v_submission->>'description', '')), ''),
    suggested_category_id = v_category_id,
    justification = nullif(trim(coalesce(v_submission->>'objective', '')), ''),
    submission = v_submission,
    submission_version = 2,
    status = 'submitted',
    decision = null,
    resubmitted_at = now(),
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.therapy_catalog_events (
    actor_profile_id, actor_role, entity_type, entity_id, event_type, previous_state, next_state, request_id
  ) values (
    p_actor_user_id,
    'therapist',
    'therapy_catalog_request',
    v_request.id,
    'therapy_request_resubmitted',
    jsonb_build_object('status', 'needs_information'),
    jsonb_build_object('status', 'submitted'),
    p_request_id
  );

  insert into public.notifications (profile_id, kind, title, body, href)
  values (
    p_actor_user_id,
    'therapy_catalog_request',
    'Solicitação atualizada',
    'Recebemos as informações adicionais da sua sugestão de terapia.',
    '/terapeuta/mensagens/solicitar-terapia?request=' || v_request.id::text
  );

  return jsonb_build_object('contractVersion', 2, 'requestId', v_request.id, 'status', v_request.status);
end;
$$;

revoke all on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid) from public;
revoke all on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.submit_therapy_catalog_request_v2(uuid, jsonb, uuid) to service_role;
grant execute on function public.resubmit_therapy_catalog_request_v2(uuid, uuid, jsonb, uuid) to service_role;

create or replace function public.admin_decide_therapy_catalog_request_v2(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_catalog_request_id uuid,
  p_status text,
  p_decision text,
  p_related_therapy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.therapy_catalog_requests;
  v_result jsonb;
begin
  select * into v_request
  from public.therapy_catalog_requests
  where id = p_catalog_request_id
  for update;

  if v_request.id is null then
    raise exception 'ADMIN_THERAPY_CATALOG_REQUEST_NOT_FOUND';
  end if;

  v_result := public.admin_decide_therapy_catalog_request_v1(
    p_actor_user_id,
    p_request_id,
    p_catalog_request_id,
    p_status,
    p_decision,
    p_related_therapy_id
  );

  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href
  )
  values (
    v_request.requester_profile_id,
    'therapy_catalog_request_updated',
    'Atualização da sua solicitação de terapia',
    case p_status
      when 'needs_information' then 'Nossa equipe precisa de mais informações para continuar a análise.'
      when 'approved' then 'Sua solicitação foi aprovada para a próxima etapa administrativa.'
      when 'merged' then 'Sua solicitação foi vinculada a uma terapia já existente.'
      when 'rejected' then 'A análise da sua solicitação foi concluída.'
      else 'Sua solicitação está em análise pela equipe da plataforma.'
    end,
    '/terapeuta/mensagens/solicitar-terapia?request=' || p_catalog_request_id::text
  );

  return v_result || jsonb_build_object(
    'requesterUserId', v_request.requester_profile_id,
    'requestStatus', p_status,
    'requestName', v_request.informed_name
  );
end;
$$;

revoke all on function public.admin_decide_therapy_catalog_request_v2(uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.admin_decide_therapy_catalog_request_v2(uuid, uuid, uuid, text, text, uuid) to service_role;

comment on table public.therapy_catalog_request_materials is
  'Private supporting materials for therapist-submitted therapy catalog requests.';
