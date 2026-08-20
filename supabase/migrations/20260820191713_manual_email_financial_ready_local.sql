insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
)
values
  ('session_payment_approved', 'financial', 'Pagamento aprovado', 'Confirma um pagamento somente após estado financeiro persistido pelo webhook Stripe.', true, 'v1'),
  ('session_payment_declined', 'financial', 'Pagamento recusado', 'Comunica uma recusa financeira persistida sem expor dados do instrumento.', true, 'v1'),
  ('session_payment_pending', 'financial', 'Pagamento pendente', 'Comunica um pagamento em processamento persistido pelo webhook Stripe.', true, 'v1'),
  ('session_refund_approved', 'financial', 'Reembolso aprovado', 'Comunica somente um reembolso confirmado por evento Stripe.', true, 'v1'),
  ('therapist_payout_completed', 'financial', 'Repasse realizado', 'Confirma um repasse somente após aceite persistido do provider Stripe.', true, 'v1')
on conflict (action_key) do nothing;

alter table public.email_outbox
  drop constraint if exists email_outbox_entity_check,
  add constraint email_outbox_entity_check check (
    related_entity_type in (
      'auth_action_token',
      'booking',
      'session_payment',
      'session_refund',
      'stripe_transfer',
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
    'booking',
    'session_payment',
    'session_refund',
    'stripe_transfer',
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

create or replace function public.enqueue_session_payment_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_key text;
  v_domain_event_id uuid;
  v_recipient_user_id uuid;
begin
  if new.financial_status is not distinct from old.financial_status then
    return new;
  end if;

  v_action_key := case new.financial_status::text
    when 'paid' then 'session_payment_approved'
    when 'failed' then 'session_payment_declined'
    when 'processing' then 'session_payment_pending'
    else null
  end;

  if v_action_key is null or new.stripe_event_id is null then
    return new;
  end if;

  select event.id into v_domain_event_id
  from public.stripe_webhook_events event
  where event.stripe_event_id = new.stripe_event_id
    and event.processing_status in ('processing', 'processed')
  limit 1;

  if v_domain_event_id is null then
    return new;
  end if;

  select patient.user_id into v_recipient_user_id
  from public.patient_profiles patient
  where patient.id = new.patient_profile_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action_key,
      v_domain_event_id,
      'session_payment',
      new.id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_session_refund_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
begin
  if new.status <> 'succeeded' or new.stripe_refund_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.stripe_webhook_events event
    where event.object_id = new.stripe_refund_id
      and event.event_type in ('refund.created', 'refund.updated')
      and event.processing_status in ('processing', 'processed')
  ) then
    return new;
  end if;

  select patient.user_id into v_recipient_user_id
  from public.session_payments payment
  join public.patient_profiles patient on patient.id = payment.patient_profile_id
  where payment.id = new.session_payment_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      'session_refund_approved',
      new.id,
      'session_refund',
      new.id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_therapist_payout_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
begin
  if new.status <> 'transferred' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'transferred' then
    return new;
  end if;

  select therapist.user_id into v_recipient_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;

  if v_recipient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      'therapist_payout_completed',
      new.id,
      'stripe_transfer',
      new.id,
      v_recipient_user_id,
      'profile:' || v_recipient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists enqueue_session_payment_email on public.session_payments;
create trigger enqueue_session_payment_email
after update of financial_status on public.session_payments
for each row execute function public.enqueue_session_payment_email_v1();

drop trigger if exists enqueue_session_refund_email on public.session_refunds;
create trigger enqueue_session_refund_email
after insert or update of status, stripe_refund_id on public.session_refunds
for each row execute function public.enqueue_session_refund_email_v1();

drop trigger if exists enqueue_therapist_payout_email on public.stripe_transfers;
create trigger enqueue_therapist_payout_email
after insert or update of status on public.stripe_transfers
for each row execute function public.enqueue_therapist_payout_email_v1();

revoke all on function public.enqueue_session_payment_email_v1() from public;
revoke all on function public.enqueue_session_refund_email_v1() from public;
revoke all on function public.enqueue_therapist_payout_email_v1() from public;

comment on function public.enqueue_session_payment_email_v1() is
  'Enfileira pagamentos somente após transição persistida vinculada a stripe_webhook_events reservado. Não inclui dados de cartão ou payload Stripe.';
comment on function public.enqueue_session_refund_email_v1() is
  'Enfileira reembolso somente após status succeeded e um webhook Stripe de refund persistido. Falha técnica de refund não é comunicada como recusa de política.';
comment on function public.enqueue_therapist_payout_email_v1() is
  'Enfileira repasse somente após a API Stripe aceitar e o runtime persistir stripe_transfers.status=transferred.';
