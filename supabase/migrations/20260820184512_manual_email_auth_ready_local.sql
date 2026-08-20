-- Lote A do Manual de Comunicação Automatizada. As ações de onboarding são
-- registradas para configuração e preview, mas não recebem gatilho automático
-- até haver decisão de produto sobre cadência para evitar e-mails simultâneos.

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
)
values
  (
    'registration_completed',
    'registration',
    'Cadastro concluído',
    'Confirma que uma conta ativada está pronta para uso.',
    true,
    'v1'
  ),
  (
    'patient_welcome',
    'registration',
    'Boas-vindas para pessoas',
    'Apresenta a jornada inicial para pacientes com conta ativada.',
    true,
    'v1'
  ),
  (
    'therapist_welcome',
    'registration',
    'Boas-vindas para terapeutas',
    'Apresenta a jornada inicial para terapeutas com conta ativada.',
    true,
    'v1'
  ),
  (
    'password_changed',
    'auth',
    'Senha alterada',
    'Confirma uma alteração de senha concluída sem incluir credenciais.',
    true,
    'v1'
  )
on conflict (action_key) do nothing;

alter table public.email_outbox
  drop constraint if exists email_outbox_entity_check,
  drop constraint if exists email_outbox_payload_minimal,
  add constraint email_outbox_entity_check check (
    related_entity_type in ('therapy_catalog_request', 'auth_action_token')
  ),
  add constraint email_outbox_payload_minimal check (
    jsonb_typeof(payload) = 'object'
  );

create or replace function public.enqueue_transactional_email_v1(
  p_action_key text,
  p_domain_event_id uuid,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_recipient_user_id uuid,
  p_recipient_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_automatic boolean;
  v_id uuid;
  v_overrides jsonb;
  v_sender_profile_id uuid;
  v_template_version text;
begin
  if p_action_key is null
    or p_domain_event_id is null
    or p_related_entity_id is null
    or p_recipient_user_id is null
    or p_recipient_key <> 'profile:' || p_recipient_user_id::text
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
  then
    raise exception 'EMAIL_OUTBOX_INVALID_ENQUEUE';
  end if;

  if p_related_entity_type not in ('therapy_catalog_request', 'auth_action_token') then
    raise exception 'EMAIL_OUTBOX_INVALID_ENTITY';
  end if;

  select
    definition.active and coalesce(setting.enabled, true),
    coalesce(setting.automatic_dispatch_enabled, true),
    definition.default_template_version,
    coalesce(setting.sender_profile_id, default_sender.id),
    jsonb_build_object(
      'subject_override', setting.subject_override,
      'preheader_override', setting.preheader_override,
      'text_override', setting.text_override,
      'html_override', setting.html_override
    )
  into
    v_enabled,
    v_automatic,
    v_template_version,
    v_sender_profile_id,
    v_overrides
  from public.email_action_definitions definition
  left join public.email_action_settings setting
    on setting.action_key = definition.action_key
  left join lateral (
    select sender.id
    from public.email_sender_profiles sender
    where sender.active and sender.is_default
    order by sender.created_at asc
    limit 1
  ) default_sender on true
  where definition.action_key = p_action_key;

  -- Configuration is evaluated at the authoritative domain event. A later
  -- re-enable cannot revive an automatic delivery that was intentionally off.
  if coalesce(v_enabled, false) is false
    or coalesce(v_automatic, false) is false
  then
    return null;
  end if;

  insert into public.email_outbox (
    action_key,
    domain_event_id,
    related_entity_type,
    related_entity_id,
    recipient_user_id,
    recipient_key,
    idempotency_key,
    payload,
    template_version,
    template_overrides,
    sender_profile_id
  )
  values (
    p_action_key,
    p_domain_event_id,
    p_related_entity_type,
    p_related_entity_id,
    p_recipient_user_id,
    p_recipient_key,
    p_domain_event_id::text,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(v_template_version, 'v1'),
    coalesce(v_overrides, '{}'::jsonb),
    v_sender_profile_id
  )
  on conflict (action_key, domain_event_id, recipient_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.email_outbox
    where action_key = p_action_key
      and domain_event_id = p_domain_event_id
      and recipient_key = p_recipient_key;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enqueue_transactional_email_v1(
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.enqueue_transactional_email_v1(
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
) to service_role;

create or replace function public.enqueue_therapy_catalog_email_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_key text;
  v_recipient_id uuid;
begin
  if new.entity_type <> 'therapy_catalog_request' then
    return new;
  end if;

  v_action_key := case
    when new.event_type in ('therapy_request_submitted', 'therapy_request_resubmitted')
      then 'therapy_catalog_request_submitted'
    when new.event_type in (
      'therapy_request_under_review',
      'therapy_request_needs_information',
      'therapy_request_approved',
      'therapy_request_merged',
      'therapy_request_rejected'
    ) then 'therapy_catalog_request_updated'
    else null
  end;
  if v_action_key is null then
    return new;
  end if;

  select requester_profile_id into v_recipient_id
  from public.therapy_catalog_requests
  where id = new.entity_id;

  if v_recipient_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action_key,
      new.id,
      'therapy_catalog_request',
      new.entity_id,
      v_recipient_id,
      'profile:' || v_recipient_id::text,
      jsonb_build_object('catalog_event_id', new.id)
    );
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_therapy_catalog_email_v2() from public;

comment on function public.enqueue_transactional_email_v1(
  text,
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
) is 'Enfileira entrega automática com snapshot no mesmo commit do evento autoritativo. Não aceita destinatário ou action key do browser.';
