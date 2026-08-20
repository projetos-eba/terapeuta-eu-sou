alter table public.billing_invoices
  add column if not exists billing_reason text;

insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
)
values
  ('therapist_subscription_created', 'subscriptions', 'Assinatura criada', 'Confirma uma assinatura somente após ativação autoritativa persistida.', true, 'v1'),
  ('therapist_subscription_renewed', 'subscriptions', 'Assinatura renovada', 'Confirma somente uma fatura recorrente paga e persistida.', true, 'v1'),
  ('therapist_subscription_cancelled', 'subscriptions', 'Assinatura cancelada', 'Confirma somente o encerramento efetivo de uma assinatura.', true, 'v1'),
  ('therapist_subscription_plan_changed', 'subscriptions', 'Alteração de plano', 'Confirma somente uma alteração de plano efetivada pela sincronização autoritativa.', true, 'v1')
on conflict (action_key) do nothing;

alter table public.email_outbox
  drop constraint if exists email_outbox_entity_check,
  add constraint email_outbox_entity_check check (
    related_entity_type in (
      'auth_action_token',
      'billing_invoice',
      'booking',
      'session_payment',
      'session_refund',
      'stripe_transfer',
      'therapist_subscription',
      'therapy_catalog_request',
      'therapist_profile',
      'therapist_verification'
    )
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
    or pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
  then
    raise exception 'EMAIL_OUTBOX_INVALID_ENQUEUE';
  end if;

  if p_related_entity_type not in (
    'auth_action_token',
    'billing_invoice',
    'booking',
    'session_payment',
    'session_refund',
    'stripe_transfer',
    'therapist_subscription',
    'therapy_catalog_request',
    'therapist_profile',
    'therapist_verification'
  ) then
    raise exception 'EMAIL_OUTBOX_INVALID_ENTITY';
  end if;

  select
    definition.active and coalesce(setting.enabled, true),
    coalesce(setting.automatic_dispatch_enabled, true),
    definition.default_template_version,
    coalesce(setting.sender_profile_id, default_sender.id),
    pg_catalog.jsonb_build_object(
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

create or replace function public.enqueue_therapist_subscription_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_key text;
  v_recipient_user_id uuid;
begin
  if new.event_type <> 'stripe_subscription_sync'
    or new.stripe_event_id is null
    or new.therapist_subscription_id is null
    or new.therapist_profile_id is null
    or not exists (
      select 1
      from public.stripe_webhook_events event
      where event.stripe_event_id = new.stripe_event_id
        and event.event_type in (
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted'
        )
        and event.processing_status in ('processing', 'processed')
    )
  then
    return new;
  end if;

  v_action_key := case
    when new.next_status in ('active', 'trialing')
      and coalesce(new.previous_status, '') not in ('active', 'trialing')
      then 'therapist_subscription_created'
    when new.next_status = 'canceled'
      and new.previous_status is distinct from 'canceled'
      then 'therapist_subscription_cancelled'
    when new.previous_plan is not null
      and new.previous_plan is distinct from new.next_plan
      and new.next_status in ('active', 'trialing')
      then 'therapist_subscription_plan_changed'
    else null
  end;

  if v_action_key is null then
    return new;
  end if;

  select therapist.user_id into v_recipient_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action_key,
      new.id,
      'therapist_subscription',
      new.therapist_subscription_id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_therapist_subscription_renewal_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
begin
  if new.status <> 'paid'
    or new.billing_reason <> 'subscription_cycle'
    or new.therapist_subscription_id is null
    or new.therapist_profile_id is null
    or not exists (
      select 1
      from public.stripe_webhook_events event
      where event.object_id = new.stripe_invoice_id
        and event.event_type = 'invoice.paid'
        and event.processing_status in ('processing', 'processed')
    )
  then
    return new;
  end if;

  select therapist.user_id into v_recipient_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      'therapist_subscription_renewed',
      new.id,
      'billing_invoice',
      new.id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists enqueue_therapist_subscription_email
on public.therapist_subscription_events;
create trigger enqueue_therapist_subscription_email
after insert on public.therapist_subscription_events
for each row execute function public.enqueue_therapist_subscription_email_v1();

drop trigger if exists enqueue_therapist_subscription_renewal_email
on public.billing_invoices;
create trigger enqueue_therapist_subscription_renewal_email
after insert or update of status, billing_reason on public.billing_invoices
for each row execute function public.enqueue_therapist_subscription_renewal_email_v1();

revoke all on function public.enqueue_therapist_subscription_email_v1() from public;
revoke all on function public.enqueue_therapist_subscription_renewal_email_v1() from public;

comment on column public.billing_invoices.billing_reason is
  'Motivo autoritativo retornado pela Stripe. Apenas subscription_cycle pode gerar e-mail de renovação.';
comment on function public.enqueue_therapist_subscription_email_v1() is
  'Enfileira assinatura criada, cancelada ou plano alterado somente por evento Stripe reservado e estado sincronizado. Cancelamento agendado nao envia.';
comment on function public.enqueue_therapist_subscription_renewal_email_v1() is
  'Enfileira renovacao somente por invoice.paid de subscription_cycle persistida. A cobranca inicial nao recebe e-mail de renovacao.';
