-- Structured Participant Messaging is deliberately distinct from Support Ticketing.
-- Browser clients never write arbitrary participant-message bodies directly.

insert into public.message_templates (
  key,
  context,
  title,
  body,
  is_active
)
values
  (
    'patient_confirm_session',
    'patient_to_therapist'::public.message_context,
    'Confirmar presença',
    'Confirmo que estarei presente na sessão agendada.',
    true
  ),
  (
    'patient_practical_question',
    'patient_to_therapist'::public.message_context,
    'Dúvida prática',
    'Tenho uma dúvida sobre informações práticas da sessão.',
    true
  ),
  (
    'patient_request_reschedule',
    'patient_to_therapist'::public.message_context,
    'Sinalizar reagendamento',
    'Preciso solicitar um novo horário pelo fluxo de reagendamento da plataforma.',
    true
  ),
  (
    'therapist_confirm_session',
    'therapist_to_patient'::public.message_context,
    'Confirmar sessão',
    'Confirmo que nossa sessão está mantida no horário agendado.',
    true
  ),
  (
    'therapist_send_preparation',
    'therapist_to_patient'::public.message_context,
    'Orientação pré-sessão',
    'Enviei uma orientação geral para apoiar sua preparação antes do encontro.',
    true
  ),
  (
    'therapist_ack_reschedule',
    'therapist_to_patient'::public.message_context,
    'Receber reagendamento',
    'Recebi sua solicitação de reagendamento e vou avaliar a agenda pelo fluxo seguro da plataforma.',
    true
  )
on conflict (key) do update
set
  context = excluded.context,
  title = excluded.title,
  body = excluded.body,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.messages
  add column if not exists template_id uuid
    references public.message_templates (id) on delete restrict;

comment on column public.messages.template_id is
  'Template server-resolved for structured participant messages. Legacy rows may remain null.';

create index if not exists messages_template_idx
  on public.messages (template_id)
  where template_id is not null;

revoke insert, update on public.messages from authenticated;

create or replace function public.send_structured_participant_message_v1(
  p_conversation_id uuid,
  p_template_key text
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_expected_context public.message_context;
  v_template public.message_templates%rowtype;
  v_message public.messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authenticated participant required'
      using errcode = '42501';
  end if;

  if p_conversation_id is null
    or length(trim(coalesce(p_template_key, ''))) = 0
  then
    raise exception 'structured message request is invalid'
      using errcode = '22023';
  end if;

  select profiles.role
  into v_actor_role
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.role in ('patient'::public.user_role, 'therapist'::public.user_role);

  if not found then
    raise exception 'authenticated participant required'
      using errcode = '42501';
  end if;

  if v_actor_role = 'patient'::public.user_role then
    v_expected_context := 'patient_to_therapist'::public.message_context;

    if not exists (
      select 1
      from public.conversations
      join public.patient_profiles
        on patient_profiles.id = conversations.patient_profile_id
      where conversations.id = p_conversation_id
        and patient_profiles.user_id = auth.uid()
    ) then
      raise exception 'conversation participant required'
        using errcode = '42501';
    end if;
  else
    v_expected_context := 'therapist_to_patient'::public.message_context;

    if not exists (
      select 1
      from public.conversations
      join public.therapist_profiles
        on therapist_profiles.id = conversations.therapist_profile_id
      where conversations.id = p_conversation_id
        and therapist_profiles.user_id = auth.uid()
    ) then
      raise exception 'conversation participant required'
        using errcode = '42501';
    end if;
  end if;

  select *
  into v_template
  from public.message_templates
  where key = p_template_key
    and context = v_expected_context
    and is_active = true;

  if not found then
    raise exception 'participant template is unavailable for this direction'
      using errcode = '22023';
  end if;

  insert into public.messages (
    conversation_id,
    sender_profile_id,
    template_id,
    body
  )
  values (
    p_conversation_id,
    auth.uid(),
    v_template.id,
    v_template.body
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.send_structured_participant_message_v1(uuid, text)
  from public;
grant execute on function public.send_structured_participant_message_v1(uuid, text)
  to authenticated;

comment on function public.send_structured_participant_message_v1(uuid, text) is
  'Authenticated participant boundary: derives identity and direction, resolves an approved template body, and never accepts a browser-supplied body.';
