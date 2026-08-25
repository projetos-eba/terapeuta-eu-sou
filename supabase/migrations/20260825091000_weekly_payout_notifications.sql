begin;

insert into public.email_action_definitions (
  action_key, category, label, description, active, default_template_version
) values
  ('payout_operational_alert_admin', 'financial', 'Alerta operacional de repasse', 'Notifica administradores sobre uma ocorrência sanitizada no repasse.', true, 'v1'),
  ('therapist_payout_failed_after_paid', 'financial', 'Falha posterior no repasse', 'Informa ao terapeuta que um repasse antes confirmado pelo banco retornou como falho.', true, 'v1')
on conflict (action_key) do update
set description = excluded.description, active = excluded.active;

update public.email_action_definitions
set description = 'Confirma o repasse somente após payout.paid autoritativo da Stripe.'
where action_key = 'therapist_payout_completed';

alter table public.email_outbox
  drop constraint if exists email_outbox_entity_check,
  add constraint email_outbox_entity_check check (
    related_entity_type in (
      'auth_action_token', 'billing_invoice', 'booking',
      'payout_operational_incident', 'session_payment', 'session_refund',
      'stripe_payout', 'stripe_transfer', 'therapist_subscription',
      'therapy_catalog_request', 'therapist_profile', 'therapist_verification'
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
  if p_action_key is null or p_domain_event_id is null
    or p_related_entity_id is null or p_recipient_user_id is null
    or p_recipient_key <> 'profile:' || p_recipient_user_id::text
    or pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
  then raise exception 'EMAIL_OUTBOX_INVALID_ENQUEUE'; end if;

  if p_related_entity_type not in (
    'auth_action_token', 'billing_invoice', 'booking',
    'payout_operational_incident', 'session_payment', 'session_refund',
    'stripe_payout', 'stripe_transfer', 'therapist_subscription',
    'therapy_catalog_request', 'therapist_profile', 'therapist_verification'
  ) then raise exception 'EMAIL_OUTBOX_INVALID_ENTITY'; end if;

  select definition.active and coalesce(setting.enabled, true),
    coalesce(setting.automatic_dispatch_enabled, true),
    definition.default_template_version,
    coalesce(setting.sender_profile_id, default_sender.id),
    pg_catalog.jsonb_build_object(
      'subject_override', setting.subject_override,
      'preheader_override', setting.preheader_override,
      'text_override', setting.text_override,
      'html_override', setting.html_override
    )
  into v_enabled, v_automatic, v_template_version, v_sender_profile_id, v_overrides
  from public.email_action_definitions definition
  left join public.email_action_settings setting on setting.action_key = definition.action_key
  left join lateral (
    select sender.id from public.email_sender_profiles sender
    where sender.active and sender.is_default order by sender.created_at limit 1
  ) default_sender on true
  where definition.action_key = p_action_key;

  if coalesce(v_enabled, false) is false or coalesce(v_automatic, false) is false then
    return null;
  end if;

  insert into public.email_outbox (
    action_key, domain_event_id, related_entity_type, related_entity_id,
    recipient_user_id, recipient_key, idempotency_key, payload,
    template_version, template_overrides, sender_profile_id
  ) values (
    p_action_key, p_domain_event_id, p_related_entity_type, p_related_entity_id,
    p_recipient_user_id, p_recipient_key, p_domain_event_id::text,
    coalesce(p_payload, '{}'::jsonb), coalesce(v_template_version, 'v1'),
    coalesce(v_overrides, '{}'::jsonb), v_sender_profile_id
  ) on conflict (action_key, domain_event_id, recipient_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.email_outbox
    where action_key = p_action_key and domain_event_id = p_domain_event_id
      and recipient_key = p_recipient_key;
  end if;
  return v_id;
end;
$$;

drop trigger if exists enqueue_therapist_payout_email on public.stripe_transfers;

create or replace function public.enqueue_stripe_payout_emails_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_user_id uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    v_action := 'therapist_payout_completed';
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status = 'failed' then
    v_action := 'therapist_payout_failed_after_paid';
  else
    return new;
  end if;

  select therapist.user_id into v_user_id
  from public.therapist_profiles therapist
  where therapist.id = new.therapist_profile_id;

  if v_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action, new.id, 'stripe_payout', new.id, v_user_id,
      'profile:' || v_user_id::text, '{}'::jsonb
    );
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      v_user_id,
      v_action,
      case when v_action = 'therapist_payout_completed'
        then 'Repasse bancário confirmado'
        else 'Repasse bancário precisa de atenção' end,
      case when v_action = 'therapist_payout_completed'
        then 'A Stripe confirmou o envio do valor à sua conta de recebimento.'
        else 'A instituição financeira devolveu uma falha após a confirmação anterior. Consulte os detalhes.' end,
      '/terapeuta/financeiro',
      v_action || ':' || new.id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger enqueue_stripe_payout_emails
after insert or update of status on public.stripe_payouts
for each row execute function public.enqueue_stripe_payout_emails_v1();

create or replace function public.notify_payout_incident_admins_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.profiles%rowtype;
  v_count integer := 0;
begin
  for v_admin in
    select profile.* from public.profiles profile
    where profile.role = 'admin' and nullif(trim(profile.email), '') is not null
      and profile.auth_deleted_at is null and profile.anonymized_at is null
  loop
    v_count := v_count + 1;
    perform public.enqueue_transactional_email_v1(
      'payout_operational_alert_admin', new.id,
      'payout_operational_incident', new.id, v_admin.id,
      'profile:' || v_admin.id::text, '{}'::jsonb
    );
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      v_admin.id, 'payout_operational_alert_admin',
      'Repasse exige atenção',
      'Uma ocorrência financeira foi registrada e precisa de revisão administrativa.',
      '/admin/pagamentos',
      'payout_incident:' || new.id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  end loop;

  if v_count = 0 then
    update public.payout_operational_incidents
    set metadata = metadata || '{"admin_recipient_missing":true}'::jsonb,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger notify_payout_incident_admins
after insert on public.payout_operational_incidents
for each row execute function public.notify_payout_incident_admins_v1();

revoke all on function public.enqueue_stripe_payout_emails_v1() from public, anon, authenticated;
revoke all on function public.notify_payout_incident_admins_v1() from public, anon, authenticated;

commit;
