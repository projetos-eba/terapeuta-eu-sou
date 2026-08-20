insert into public.email_action_definitions (
  action_key,
  category,
  label,
  description,
  active,
  default_template_version
)
values
  ('booking_confirmed_patient', 'bookings', 'Encontro confirmado — pessoa', 'Confirma um encontro após o estado financeiro autoritativo e a persistência da reserva.', true, 'v1'),
  ('booking_confirmed_therapist', 'bookings', 'Sessão confirmada — terapeuta', 'Confirma uma sessão após o estado financeiro autoritativo e a persistência da reserva.', true, 'v1'),
  ('booking_cancelled_patient', 'bookings', 'Encontro cancelado — pessoa', 'Confirma um cancelamento persistido sem incluir motivo ou responsável.', true, 'v1'),
  ('booking_cancelled_therapist', 'bookings', 'Sessão cancelada — terapeuta', 'Confirma um cancelamento persistido sem incluir motivo ou responsável.', true, 'v1'),
  ('booking_rescheduled_patient', 'bookings', 'Encontro reagendado — pessoa', 'Confirma somente uma resolução de reagendamento aplicada.', true, 'v1'),
  ('booking_rescheduled_therapist', 'bookings', 'Sessão reagendada — terapeuta', 'Confirma somente uma resolução de reagendamento aplicada.', true, 'v1')
on conflict (action_key) do nothing;

alter table public.email_outbox
  drop constraint if exists email_outbox_entity_check,
  add constraint email_outbox_entity_check check (
    related_entity_type in (
      'auth_action_token',
      'booking',
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

create or replace function public.enqueue_booking_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_patient_action_key text;
  v_therapist_action_key text;
begin
  if new.event_type = 'booking_status_changed'
    and new.next_status::text = 'confirmed'
  then
    v_patient_action_key := 'booking_confirmed_patient';
    v_therapist_action_key := 'booking_confirmed_therapist';
  elsif new.event_type = 'booking_status_changed'
    and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist')
  then
    v_patient_action_key := 'booking_cancelled_patient';
    v_therapist_action_key := 'booking_cancelled_therapist';
  elsif new.event_type = 'booking_reschedule_resolved'
    and new.payload ->> 'status' = 'applied'
  then
    v_patient_action_key := 'booking_rescheduled_patient';
    v_therapist_action_key := 'booking_rescheduled_therapist';
  else
    return new;
  end if;

  select
    patient.user_id,
    therapist.user_id
  into
    v_patient_user_id,
    v_therapist_user_id
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if v_patient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_patient_action_key,
      new.id,
      'booking',
      new.booking_id,
      v_patient_user_id,
      'profile:' || v_patient_user_id::text,
      '{}'::jsonb
    );
  end if;

  if v_therapist_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_therapist_action_key,
      new.id,
      'booking',
      new.booking_id,
      v_therapist_user_id,
      'profile:' || v_therapist_user_id::text,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists enqueue_booking_email on public.booking_events;
create trigger enqueue_booking_email
after insert on public.booking_events
for each row execute function public.enqueue_booking_email_v1();

revoke all on function public.enqueue_booking_email_v1() from public;

comment on function public.enqueue_booking_email_v1() is
  'Enfileira comunicações de encontro somente a partir de booking_events persistidos. Não inclui motivo, URL Zoom ou dados clínicos no payload.';
