-- Persistent shell notifications are generated from canonical domain events.
-- The browser can read and mark only its own rows through the existing RLS.

alter table public.notifications
  add column if not exists event_key text;

create unique index if not exists notifications_profile_event_key_unique_idx
  on public.notifications (profile_id, event_key)
  where event_key is not null;

create or replace function public.notify_paid_session_payment_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_status public.booking_status;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
begin
  if new.financial_status <> 'paid'::public.session_financial_status
    or old.financial_status = 'paid'::public.session_financial_status
  then
    return new;
  end if;

  select
    booking.status,
    patient.user_id,
    therapist.user_id
  into
    v_booking_status,
    v_patient_user_id,
    v_therapist_user_id
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = new.patient_profile_id
  join public.therapist_profiles as therapist
    on therapist.id = new.therapist_profile_id
  where booking.id = new.booking_id;

  if not found or v_booking_status <> 'confirmed'::public.booking_status then
    return new;
  end if;

  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href,
    event_key
  ) values
    (
      v_patient_user_id,
      'booking_confirmed',
      'Seu encontro está confirmado',
      'O pagamento foi confirmado. Acompanhe os detalhes do seu encontro.',
      '/app/encontros/' || new.booking_id::text,
      'booking-confirmed:patient:' || new.id::text
    ),
    (
      v_therapist_user_id,
      'booking_confirmed',
      'Novo agendamento confirmado',
      'Um novo encontro foi confirmado. Consulte os detalhes para se preparar.',
      '/terapeuta/sessoes/' || new.booking_id::text,
      'booking-confirmed:therapist:' || new.id::text
    )
  on conflict (profile_id, event_key)
    where event_key is not null
    do nothing;

  return new;
end;
$$;

create or replace function public.notify_message_recipient_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_recipient_user_id uuid;
  v_href text;
begin
  select
    patient.user_id,
    therapist.user_id
  into
    v_patient_user_id,
    v_therapist_user_id
  from public.conversations as conversation
  join public.patient_profiles as patient
    on patient.id = conversation.patient_profile_id
  join public.therapist_profiles as therapist
    on therapist.id = conversation.therapist_profile_id
  where conversation.id = new.conversation_id;

  if not found then
    return new;
  end if;

  if new.sender_profile_id = v_patient_user_id then
    v_recipient_user_id := v_therapist_user_id;
    v_href := '/terapeuta/mensagens';
  elsif new.sender_profile_id = v_therapist_user_id then
    v_recipient_user_id := v_patient_user_id;
    v_href := '/app/mensagens';
  else
    return new;
  end if;

  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href,
    event_key
  ) values (
    v_recipient_user_id,
    'message_received',
    'Nova mensagem',
    'Você recebeu uma nova mensagem na Central de mensagens.',
    v_href,
    'message:' || new.id::text
  )
  on conflict (profile_id, event_key)
    where event_key is not null
    do nothing;

  return new;
end;
$$;

create or replace function public.notify_support_ticket_created_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href,
    event_key
  )
  select
    profile.id,
    'support_ticket_created',
    'Novo chamado de suporte',
    'Há uma nova solicitação de suporte para analisar.',
    '/admin/suporte/' || new.id::text,
    'support-ticket-created:' || new.id::text || ':' || profile.id::text
  from public.profiles as profile
  where profile.role = 'admin'::public.user_role
  on conflict (profile_id, event_key)
    where event_key is not null
    do nothing;

  return new;
end;
$$;

create or replace function public.notify_support_ticket_updated_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_href text;
begin
  if new.requester_profile_id is null
    or (
      new.status is not distinct from old.status
      and new.resolution_summary is not distinct from old.resolution_summary
    )
  then
    return new;
  end if;

  select case profile.role
    when 'therapist'::public.user_role then '/terapeuta/mensagens'
    else '/app/mensagens'
  end
  into v_href
  from public.profiles as profile
  where profile.id = new.requester_profile_id;

  if v_href is null then
    return new;
  end if;

  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href,
    event_key
  ) values (
    new.requester_profile_id,
    'support_ticket_updated',
    'Atualização do seu chamado',
    'Há uma atualização no seu chamado de suporte.',
    v_href,
    'support-ticket-updated:' || new.id::text || ':' || extract(epoch from new.updated_at)::text
  )
  on conflict (profile_id, event_key)
    where event_key is not null
    do nothing;

  return new;
end;
$$;

create or replace function public.notify_therapy_catalog_request_admins_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    href,
    event_key
  )
  select
    profile.id,
    'therapy_catalog_request_submitted',
    'Nova solicitação de terapia',
    'Há uma nova solicitação de terapia para analisar.',
    '/admin/terapias',
    'therapy-catalog-request:' || new.id::text || ':' || extract(epoch from new.updated_at)::text || ':' || profile.id::text
  from public.profiles as profile
  where profile.role = 'admin'::public.user_role
  on conflict (profile_id, event_key)
    where event_key is not null
    do nothing;

  return new;
end;
$$;

drop trigger if exists z_notify_paid_session_payment on public.session_payments;
create trigger z_notify_paid_session_payment
after update of financial_status on public.session_payments
for each row
execute function public.notify_paid_session_payment_v1();

drop trigger if exists notify_message_recipient on public.messages;
create trigger notify_message_recipient
after insert on public.messages
for each row
execute function public.notify_message_recipient_v1();

drop trigger if exists notify_support_ticket_created on public.support_tickets;
create trigger notify_support_ticket_created
after insert on public.support_tickets
for each row
execute function public.notify_support_ticket_created_v1();

drop trigger if exists notify_support_ticket_updated on public.support_tickets;
create trigger notify_support_ticket_updated
after update of status, resolution_summary on public.support_tickets
for each row
execute function public.notify_support_ticket_updated_v1();

drop trigger if exists notify_therapy_catalog_request_admins on public.therapy_catalog_requests;
create trigger notify_therapy_catalog_request_admins
after insert or update of status on public.therapy_catalog_requests
for each row
execute function public.notify_therapy_catalog_request_admins_v1();

revoke all on function public.notify_paid_session_payment_v1() from public;
revoke all on function public.notify_message_recipient_v1() from public;
revoke all on function public.notify_support_ticket_created_v1() from public;
revoke all on function public.notify_support_ticket_updated_v1() from public;
revoke all on function public.notify_therapy_catalog_request_admins_v1() from public;
