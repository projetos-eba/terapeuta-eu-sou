-- Participant conversations and messages remain as historical read-only data.
drop trigger if exists ensure_participant_conversation_after_booking
  on public.bookings;
drop trigger if exists notify_message_recipient
  on public.messages;

revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.messages from authenticated;

revoke execute on function public.send_structured_participant_message_v1(uuid, text)
  from authenticated;
revoke execute on function public.send_structured_participant_message_v2(uuid, text, uuid, jsonb)
  from authenticated;
revoke execute on function public.preview_structured_participant_message_v2(uuid, text, uuid, jsonb)
  from authenticated;
revoke execute on function public.mark_structured_participant_messages_read_v1(uuid)
  from authenticated;

-- The booking lock serializes concurrent submissions for one reservation.
-- A deterministic request_id also survives retries after a committed response
-- is lost. The notice never changes booking or Zoom tolerance.
create or replace function public.send_session_delay_notice_v1(
  p_booking_id uuid,
  p_expected_booking_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_actor_role text;
  v_recipient_user_id uuid;
  v_request_id text;
  v_event_id uuid;
  v_sent_at timestamptz;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'session_access_required' using errcode = '42501';
  end if;

  select booking.*
    into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update of booking;

  if not found then
    raise exception 'session_access_required' using errcode = '42501';
  end if;

  select patient.user_id, therapist.user_id
    into v_patient_user_id, v_therapist_user_id
  from public.patient_profiles as patient
  cross join public.therapist_profiles as therapist
  where patient.id = v_booking.patient_profile_id
    and therapist.id = v_booking.therapist_profile_id;

  if not found
    or (select auth.uid()) not in (v_patient_user_id, v_therapist_user_id)
  then
    raise exception 'session_access_required' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed'::public.booking_status
    or v_booking.version <> p_expected_booking_version
  then
    raise exception 'session_state_changed' using errcode = '22023';
  end if;

  if v_now < v_booking.starts_at - interval '60 minutes'
    or v_now > v_booking.starts_at + interval '10 minutes'
  then
    raise exception 'delay_notice_window_closed' using errcode = '22023';
  end if;

  if (select auth.uid()) = v_patient_user_id then
    v_actor_role := 'patient';
    v_recipient_user_id := v_therapist_user_id;
  else
    v_actor_role := 'therapist';
    v_recipient_user_id := v_patient_user_id;
  end if;

  v_request_id := 'session-delay:' || v_actor_role || ':v' ||
    v_booking.version::text;

  insert into public.booking_events (
    booking_id,
    actor_profile_id,
    event_type,
    payload,
    request_id,
    source
  ) values (
    v_booking.id,
    (select auth.uid()),
    'session_delay_notice_sent',
    pg_catalog.jsonb_build_object(
      'actorRole', v_actor_role,
      'bookingVersion', v_booking.version
    ),
    v_request_id,
    'session_detail'
  )
  on conflict (booking_id, event_type, request_id)
    where request_id is not null
    do nothing
  returning id, created_at into v_event_id, v_sent_at;

  if v_event_id is null then
    select event.id, event.created_at
      into v_event_id, v_sent_at
    from public.booking_events as event
    where event.booking_id = v_booking.id
      and event.event_type = 'session_delay_notice_sent'
      and event.request_id = v_request_id;
  else
    insert into public.notifications (
      profile_id, kind, title, body, href, event_key
    ) values (
      v_recipient_user_id,
      'session_delay_notice',
      case
        when v_actor_role = 'patient' then 'Seu paciente avisou que pode se atrasar'
        else 'Seu terapeuta avisou que pode se atrasar'
      end,
      'Confira os detalhes do encontro. O prazo de tolerância não foi alterado.',
      case
        when v_actor_role = 'patient'
          then '/terapeuta/sessoes/' || v_booking.id::text
        else '/app/encontros/' || v_booking.id::text
      end,
      'session-delay:' || v_booking.id::text || ':' ||
        v_actor_role || ':v' || v_booking.version::text
    )
    on conflict (profile_id, event_key)
      where event_key is not null
      do nothing;
  end if;

  return pg_catalog.jsonb_build_object(
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'noticeId', v_event_id,
    'sentAt', v_sent_at
  );
end;
$$;

revoke all on function public.send_session_delay_notice_v1(uuid, integer)
  from public, anon;
grant execute on function public.send_session_delay_notice_v1(uuid, integer)
  to authenticated;

comment on function public.send_session_delay_notice_v1(uuid, integer) is
  'One unilateral delay notice per participant and booking version from T-60 through T+10; no tolerance mutation.';

-- Only the first provider-confirmed therapist join announces room availability.
create or replace function public.notify_patient_therapist_joined_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
begin
  if old.therapist_first_joined_at is not null
    or new.therapist_first_joined_at is null
    or not exists (
      select 1
      from public.video_session_participations as participation
      where participation.video_session_id = new.id
        and participation.participant_role =
          'therapist'::public.video_session_participant_role
        and participation.event_type = 'session.user_joined'
        and participation.joined_at is not null
    )
  then
    return new;
  end if;

  select patient.user_id into v_patient_user_id
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  where booking.id = new.booking_id
    and booking.status = 'confirmed'::public.booking_status;

  if v_patient_user_id is not null then
    insert into public.notifications (
      profile_id, kind, title, body, href, event_key
    ) values (
      v_patient_user_id,
      'therapist_joined',
      'Seu terapeuta já está na sala',
      'A entrada do encontro está disponível. Confira os detalhes para participar.',
      '/app/encontros/' || new.booking_id::text,
      'therapist-joined:' || new.booking_id::text || ':v' || new.version::text
    )
    on conflict (profile_id, event_key)
      where event_key is not null
      do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_patient_therapist_joined_v1()
  from public, anon, authenticated;

drop trigger if exists notify_patient_therapist_joined
  on public.video_sessions;
create trigger notify_patient_therapist_joined
after update of therapist_first_joined_at on public.video_sessions
for each row execute function public.notify_patient_therapist_joined_v1();

-- The normal patient-initiated direct reschedule is atomic, but its paid
-- branch did not enforce the published 24-hour cutoff at the database gate.
create or replace function public.enforce_patient_reschedule_cutoff_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
begin
  if new.status <> 'applied' then
    return new;
  end if;

  select patient.user_id into v_patient_user_id
  from public.bookings as booking
  join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  where booking.id = new.booking_id;

  if new.requested_by_profile_id = v_patient_user_id
    and new.original_starts_at < pg_catalog.clock_timestamp() + interval '24 hours'
  then
    raise exception 'PATIENT_RESCHEDULE_WINDOW_CLOSED'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_patient_reschedule_cutoff_v1()
  from public, anon, authenticated;

drop trigger if exists enforce_patient_reschedule_cutoff
  on public.booking_reschedule_requests;
create trigger enforce_patient_reschedule_cutoff
before insert on public.booking_reschedule_requests
for each row execute function public.enforce_patient_reschedule_cutoff_v1();

-- Catalog workflows and older ticket notifications may still generate the
-- previous path; normalize only these two known contracts, preserving history.
create or replace function public.canonicalize_support_notification_href_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.href like '/terapeuta/mensagens/solicitar-terapia%' then
    new.href := pg_catalog.replace(
      new.href,
      '/terapeuta/mensagens/solicitar-terapia',
      '/terapeuta/servicos/solicitar-terapia'
    );
  elsif new.href like '/terapeuta/mensagens/suporte/%' then
    new.href := pg_catalog.replace(
      new.href,
      '/terapeuta/mensagens/suporte/',
      '/terapeuta/suporte/'
    );
  elsif new.href like '/app/mensagens/suporte/%' then
    new.href := pg_catalog.replace(
      new.href,
      '/app/mensagens/suporte/',
      '/app/suporte/'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.canonicalize_support_notification_href_v1()
  from public, anon, authenticated;

drop trigger if exists canonicalize_support_notification_href
  on public.notifications;
create trigger canonicalize_support_notification_href
before insert or update of href on public.notifications
for each row execute function public.canonicalize_support_notification_href_v1();

update public.notifications
set href = case
  when href like '/terapeuta/mensagens/solicitar-terapia%'
    then pg_catalog.replace(
      href, '/terapeuta/mensagens/solicitar-terapia',
      '/terapeuta/servicos/solicitar-terapia'
    )
  when href like '/terapeuta/mensagens/suporte/%'
    then pg_catalog.replace(
      href, '/terapeuta/mensagens/suporte/', '/terapeuta/suporte/'
    )
  when href like '/app/mensagens/suporte/%'
    then pg_catalog.replace(
      href, '/app/mensagens/suporte/', '/app/suporte/'
    )
  else href
end
where href like '/terapeuta/mensagens/solicitar-terapia%'
  or href like '/terapeuta/mensagens/suporte/%'
  or href like '/app/mensagens/suporte/%';
