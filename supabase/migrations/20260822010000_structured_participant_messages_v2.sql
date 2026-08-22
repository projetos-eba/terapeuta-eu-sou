-- Fase 4: catálogo V2 de mensagens estruturadas.
-- O catálogo é metadata operacional; o corpo final continua sendo resolvido
-- exclusivamente dentro do boundary autenticado do banco.

alter table public.message_templates
  add column if not exists category text not null default 'acompanhamento',
  add column if not exists usage_description text not null default '',
  add column if not exists parameter_schema jsonb not null default '[]'::jsonb,
  add column if not exists requires_booking boolean not null default false,
  add column if not exists cta_action text;

alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.message_templates
  drop constraint if exists message_templates_category_check,
  drop constraint if exists message_templates_parameter_schema_check,
  drop constraint if exists message_templates_cta_action_check,
  drop constraint if exists message_templates_cta_booking_check;

alter table public.message_templates
  add constraint message_templates_category_check check (
    category in (
      'acompanhamento',
      'atendimento',
      'atualizacao',
      'confirmacao',
      'duvida',
      'plataforma',
      'reagendamento'
    )
  ),
  add constraint message_templates_parameter_schema_check check (
    jsonb_typeof(parameter_schema) = 'array'
  ),
  add constraint message_templates_cta_action_check check (
    cta_action is null
    or cta_action in (
      'view_session',
      'open_session',
      'reschedule_session',
      'cancel_session'
    )
  );

alter table public.messages
  drop constraint if exists messages_metadata_object_check;

alter table public.messages
  add constraint messages_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  );

comment on column public.message_templates.usage_description is
  'Operational guidance shown only in the participant template picker.';
comment on column public.message_templates.parameter_schema is
  'Closed parameter options. No free text is accepted by the send boundary.';
comment on column public.message_templates.requires_booking is
  'The sender must provide or derive an authorized booking context.';
comment on column public.message_templates.cta_action is
  'Allowlisted recipient action resolved to a canonical TES route by the RPC.';
comment on column public.messages.metadata is
  'Server-resolved structured metadata, including an optional allowlisted CTA.';

insert into public.message_templates (
  key,
  context,
  title,
  body,
  category,
  usage_description,
  parameter_schema,
  requires_booking,
  cta_action,
  is_active
)
values
  (
    'patient_confirm_session',
    'patient_to_therapist'::public.message_context,
    'Confirmar presença',
    'Confirmo que estarei presente na sessão agendada.',
    'confirmacao',
    'Use quando você já confirmou que participará da sessão.',
    '[]'::jsonb,
    false,
    'view_session',
    true
  ),
  (
    'patient_practical_question',
    'patient_to_therapist'::public.message_context,
    'Dúvida prática',
    'Tenho uma dúvida sobre informações práticas da sessão.',
    'duvida',
    'Use para sinalizar uma dúvida operacional sem escrever uma mensagem livre.',
    '[]'::jsonb,
    false,
    'view_session',
    true
  ),
  (
    'patient_request_reschedule',
    'patient_to_therapist'::public.message_context,
    'Sinalizar reagendamento',
    'Preciso solicitar um novo horário pelo fluxo de reagendamento da plataforma.',
    'reagendamento',
    'Use quando você precisa conversar sobre outro horário; o reagendamento acontece no fluxo próprio.',
    '[]'::jsonb,
    false,
    'reschedule_session',
    true
  ),
  (
    'patient_technical_difficulty',
    'patient_to_therapist'::public.message_context,
    'Dificuldade para entrar',
    'Estou com dificuldade para entrar no encontro.',
    'atendimento',
    'Use quando o acesso ao encontro não estiver funcionando como esperado.',
    '[]'::jsonb,
    true,
    'open_session',
    true
  ),
  (
    'patient_cancel_guidance',
    'patient_to_therapist'::public.message_context,
    'Orientação para cancelamento',
    'Preciso de orientação para cancelar este encontro. Vou usar o fluxo da plataforma.',
    'atualizacao',
    'Use para indicar que você precisa de orientação; o cancelamento só acontece no fluxo seguro.',
    '[]'::jsonb,
    true,
    'cancel_session',
    true
  ),
  (
    'therapist_confirm_session',
    'therapist_to_patient'::public.message_context,
    'Confirmar sessão',
    'Confirmo que nossa sessão está mantida no horário agendado.',
    'confirmacao',
    'Use para confirmar ao paciente que a sessão permanece no horário combinado.',
    '[]'::jsonb,
    false,
    'view_session',
    true
  ),
  (
    'therapist_send_preparation',
    'therapist_to_patient'::public.message_context,
    'Orientação pré-sessão',
    'Enviei uma orientação geral para apoiar sua preparação antes do encontro.',
    'acompanhamento',
    'Use para lembrar o paciente de consultar as orientações antes do encontro.',
    '[]'::jsonb,
    false,
    'view_session',
    true
  ),
  (
    'therapist_ack_reschedule',
    'therapist_to_patient'::public.message_context,
    'Receber reagendamento',
    'Recebi sua solicitação de reagendamento e vou avaliar a agenda pelo fluxo seguro da plataforma.',
    'reagendamento',
    'Use para confirmar que a solicitação de reagendamento foi recebida.',
    '[]'::jsonb,
    false,
    'reschedule_session',
    true
  ),
  (
    'therapist_available_in_room',
    'therapist_to_patient'::public.message_context,
    'Disponível na sala',
    'Estou disponível na sala e você já pode entrar no encontro.',
    'atendimento',
    'Use quando você já estiver disponível para iniciar o encontro online.',
    '[]'::jsonb,
    true,
    'open_session',
    true
  ),
  (
    'therapist_delay',
    'therapist_to_patient'::public.message_context,
    'Pequeno atraso',
    'Tive um pequeno atraso. Devo conseguir estar com você {{delay_window_label}}.',
    'atualizacao',
    'Use para comunicar uma janela curta de atraso sem escrever um motivo livre.',
    '[{"key":"delay_window","label":"Janela do atraso","options":[{"value":"up_to_5_minutes","label":"em até 5 minutos"},{"value":"up_to_10_minutes","label":"em até 10 minutos"},{"value":"technical_difficulty","label":"assim que resolver uma dificuldade técnica"}]}]'::jsonb,
    true,
    'view_session',
    true
  ),
  (
    'therapist_technical_difficulty',
    'therapist_to_patient'::public.message_context,
    'Dificuldade técnica',
    'Estou enfrentando uma dificuldade técnica. Por favor, aguarde enquanto restabeleço o acesso à sessão.',
    'atendimento',
    'Use quando uma dificuldade técnica estiver impedindo o início normal da sessão.',
    '[]'::jsonb,
    true,
    'view_session',
    true
  ),
  (
    'therapist_cancel_processed',
    'therapist_to_patient'::public.message_context,
    'Cancelamento processado',
    'O cancelamento desta sessão foi processado pelo fluxo da plataforma.',
    'atualizacao',
    'Use para informar que o cancelamento já foi confirmado pelo fluxo oficial.',
    '[]'::jsonb,
    true,
    'view_session',
    true
  ),
  (
    'therapist_platform_action',
    'therapist_to_patient'::public.message_context,
    'Ação na plataforma',
    'Para continuar, use o fluxo seguro da plataforma nesta sessão.',
    'plataforma',
    'Use quando o paciente precisa abrir a sessão e seguir uma ação conhecida no TES.',
    '[]'::jsonb,
    true,
    'view_session',
    true
  )
on conflict (key) do update
set
  context = excluded.context,
  title = excluded.title,
  body = excluded.body,
  category = excluded.category,
  usage_description = excluded.usage_description,
  parameter_schema = excluded.parameter_schema,
  requires_booking = excluded.requires_booking,
  cta_action = excluded.cta_action,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.resolve_structured_participant_message_v2(
  p_conversation_id uuid,
  p_template_key text,
  p_booking_id uuid default null,
  p_parameters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_expected_context public.message_context;
  v_conversation public.conversations%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_recipient_name text;
  v_template public.message_templates%rowtype;
  v_parameters jsonb := coalesce(p_parameters, '{}'::jsonb);
  v_resolved_parameters jsonb := '{}'::jsonb;
  v_body text;
  v_parameter jsonb;
  v_key text;
  v_value text;
  v_option_label text;
  v_context_booking_id uuid;
  v_cta jsonb := null;
  v_recipient_route text;
  v_recipient_role public.user_role;
begin
  if v_actor_id is null then
    raise exception 'authenticated participant required' using errcode = '42501';
  end if;

  if p_conversation_id is null
    or length(btrim(coalesce(p_template_key, ''))) = 0
    or jsonb_typeof(v_parameters) <> 'object'
  then
    raise exception 'structured message request is invalid' using errcode = '22023';
  end if;

  select *
  into v_conversation
  from public.conversations
  where conversations.id = p_conversation_id;

  if not found then
    raise exception 'conversation participant required' using errcode = '42501';
  end if;

  select patient_profiles.user_id
  into v_patient_user_id
  from public.patient_profiles
  where patient_profiles.id = v_conversation.patient_profile_id;

  select therapist_profiles.user_id
  into v_therapist_user_id
  from public.therapist_profiles
  where therapist_profiles.id = v_conversation.therapist_profile_id;

  if v_patient_user_id = v_actor_id then
    v_expected_context := 'patient_to_therapist'::public.message_context;
    v_recipient_role := 'therapist'::public.user_role;
    select public.therapist_profiles.public_name
    into v_recipient_name
    from public.therapist_profiles
    where public.therapist_profiles.id = v_conversation.therapist_profile_id;
  elsif v_therapist_user_id = v_actor_id then
    v_expected_context := 'therapist_to_patient'::public.message_context;
    v_recipient_role := 'patient'::public.user_role;
    select coalesce(public.patient_profiles.display_name, 'Paciente')
    into v_recipient_name
    from public.patient_profiles
    where public.patient_profiles.id = v_conversation.patient_profile_id;
  else
    raise exception 'conversation participant required' using errcode = '42501';
  end if;

  select *
  into v_template
  from public.message_templates
  where key = btrim(p_template_key)
    and context = v_expected_context
    and is_active = true;

  if not found then
    raise exception 'participant template is unavailable for this direction'
      using errcode = '22023';
  end if;

  v_context_booking_id := coalesce(p_booking_id, v_conversation.booking_id);
  if v_context_booking_id is not null then
    if not exists (
      select 1
      from public.bookings
      where bookings.id = v_context_booking_id
        and bookings.patient_profile_id = v_conversation.patient_profile_id
        and bookings.therapist_profile_id = v_conversation.therapist_profile_id
    ) then
      raise exception 'booking context is not authorized for this conversation'
        using errcode = '42501';
    end if;
  elsif v_template.requires_booking then
    raise exception 'this participant template requires an authorized session context'
      using errcode = '22023';
  end if;

  for v_key in
    select key from jsonb_object_keys(v_parameters) as key
  loop
    if not exists (
      select 1
      from jsonb_array_elements(v_template.parameter_schema) as parameter
      where parameter->>'key' = v_key
    ) then
      raise exception 'structured message parameter is not allowed'
        using errcode = '22023';
    end if;
  end loop;

  for v_parameter in
    select value from jsonb_array_elements(v_template.parameter_schema)
  loop
    v_key := v_parameter->>'key';
    if not (v_parameters ? v_key) then
      raise exception 'required structured message parameter is missing'
        using errcode = '22023';
    end if;

    v_value := v_parameters->>v_key;
    select option->>'label'
    into v_option_label
    from jsonb_array_elements(v_parameter->'options') as option
    where option->>'value' = v_value
    limit 1;

    if v_option_label is null then
      raise exception 'structured message parameter value is not allowed'
        using errcode = '22023';
    end if;

    v_body := coalesce(v_body, v_template.body);
    v_body := replace(v_body, '{{' || v_key || '_label}}', v_option_label);
    v_resolved_parameters := v_resolved_parameters || jsonb_build_object(
      v_key,
      jsonb_build_object('value', v_value, 'label', v_option_label)
    );
  end loop;

  if v_body is null then
    v_body := v_template.body;
  end if;

  if v_template.cta_action is not null then
    if v_context_booking_id is not null then
      if v_recipient_role = 'patient'::public.user_role then
        v_recipient_route := '/app/encontros/' || v_context_booking_id::text;
      else
        v_recipient_route := '/terapeuta/sessoes/' || v_context_booking_id::text;
      end if;

      v_cta := jsonb_build_object(
        'action', v_template.cta_action,
        'href', v_recipient_route,
        'label', case v_template.cta_action
          when 'open_session' then case when v_recipient_role = 'patient'::public.user_role then 'Entrar no encontro' else 'Abrir sessão' end
          when 'reschedule_session' then 'Reagendar'
          when 'cancel_session' then 'Cancelar sessão'
          else case when v_recipient_role = 'patient'::public.user_role then 'Ver encontro' else 'Ver sessão' end
        end
      );
    end if;
  end if;

  return jsonb_build_object(
    'actorId', v_actor_id,
    'body', v_body,
    'category', v_template.category,
    'context', case when v_context_booking_id is null then null else jsonb_build_object('bookingId', v_context_booking_id) end,
    'cta', v_cta,
    'parameters', v_resolved_parameters,
    'recipientName', coalesce(v_recipient_name, case when v_recipient_role = 'patient'::public.user_role then 'Paciente' else 'Terapeuta' end),
    'templateId', v_template.id,
    'templateKey', v_template.key,
    'title', v_template.title,
    'usageDescription', v_template.usage_description
  );
end;
$$;

create or replace function public.send_structured_participant_message_v2(
  p_conversation_id uuid,
  p_template_key text,
  p_booking_id uuid default null,
  p_parameters jsonb default '{}'::jsonb
)
returns public.messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_resolved jsonb;
  v_message public.messages%rowtype;
begin
  v_resolved := public.resolve_structured_participant_message_v2(
    p_conversation_id,
    p_template_key,
    p_booking_id,
    p_parameters
  );

  insert into public.messages (
    conversation_id,
    sender_profile_id,
    template_id,
    body,
    metadata
  )
  values (
    p_conversation_id,
    (v_resolved->>'actorId')::uuid,
    (v_resolved->>'templateId')::uuid,
    v_resolved->>'body',
    jsonb_build_object(
      'category', v_resolved->'category',
      'cta', v_resolved->'cta',
      'parameters', v_resolved->'parameters',
      'templateKey', v_resolved->'templateKey'
    )
  )
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.preview_structured_participant_message_v2(
  p_conversation_id uuid,
  p_template_key text,
  p_booking_id uuid default null,
  p_parameters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.resolve_structured_participant_message_v2(
    p_conversation_id,
    p_template_key,
    p_booking_id,
    p_parameters
  );
end;
$$;

create or replace function public.send_structured_participant_message_v1(
  p_conversation_id uuid,
  p_template_key text
)
returns public.messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.send_structured_participant_message_v2(
    p_conversation_id,
    p_template_key,
    null,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.resolve_structured_participant_message_v2(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.send_structured_participant_message_v2(uuid, text, uuid, jsonb)
  from public;
revoke all on function public.preview_structured_participant_message_v2(uuid, text, uuid, jsonb)
  from public;
grant execute on function public.send_structured_participant_message_v2(uuid, text, uuid, jsonb)
  to authenticated;
grant execute on function public.preview_structured_participant_message_v2(uuid, text, uuid, jsonb)
  to authenticated;
grant execute on function public.send_structured_participant_message_v1(uuid, text)
  to authenticated;

comment on function public.send_structured_participant_message_v2(uuid, text, uuid, jsonb) is
  'V2 structured participant boundary: validates closed parameters and authorized booking context, resolves body and CTA server-side, and persists no browser-authored content.';
comment on function public.preview_structured_participant_message_v2(uuid, text, uuid, jsonb) is
  'V2 preview boundary: returns only server-resolved participant content and allowlisted recipient CTA without persisting a message.';
