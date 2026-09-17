begin;

insert into public.email_action_definitions (
  action_key, category, label, description, active, default_template_version
)
values (
  'booking_therapist_reschedule_requested_patient',
  'bookings',
  'Escolher novo horário — pessoa',
  'Pede que a pessoa escolha um novo horário após uma solicitação do terapeuta.',
  true,
  'v1'
)
on conflict (action_key) do update
set category = excluded.category,
    label = excluded.label,
    description = excluded.description,
    active = excluded.active,
    default_template_version = excluded.default_template_version;

create or replace function public.notify_booking_lifecycle_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_requester_user_id uuid;
  v_therapist_user_id uuid;
  v_change_kind text;
  v_status text;
begin
  if not (
    (new.event_type = 'booking_status_changed'
      and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded'))
    or new.event_type in ('booking_reschedule_requested', 'booking_reschedule_resolved')
  ) then
    return new;
  end if;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if new.event_type like 'booking_reschedule_%' then
    select requested_by_profile_id, change_kind
    into v_requester_user_id, v_change_kind
    from public.booking_reschedule_requests
    where id = (new.payload ->> 'rescheduleRequestId')::uuid;
  end if;

  if new.event_type = 'booking_status_changed' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_cancelled_patient', 'Seu encontro foi cancelado',
        'O cancelamento foi concluído. Consulte os detalhes atualizados.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_cancelled_therapist', 'Sessão cancelada',
        'O cancelamento foi concluído e sua agenda foi atualizada.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
    return new;
  end if;

  v_status := coalesce(new.payload ->> 'status', 'pending');

  if new.event_type = 'booking_reschedule_requested' then
    if v_requester_user_id = v_patient_user_id then
      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values (v_therapist_user_id, 'booking_reschedule_requested_therapist',
        'Nova proposta de reagendamento',
        'Uma pessoa propôs outro horário para a sessão. Revise a solicitação.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    elsif v_change_kind = 'therapist_reschedule' then
      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values (v_patient_user_id, 'booking_reschedule_requested_patient',
        'Solicitação de reagendamento',
        'Seu terapeuta pediu que você escolha outro horário para o encontro.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    else
      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values (v_patient_user_id, 'booking_reschedule_requested_patient',
        'Nova proposta de reagendamento',
        'Sua terapeuta propôs outro horário para o encontro. Revise a solicitação.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    end if;
  elsif v_status = 'applied' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_rescheduled_patient', 'Encontro reagendado',
        'O novo horário foi confirmado. Consulte os detalhes atualizados.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_rescheduled_therapist', 'Sessão reagendada',
        'O novo horário foi confirmado e sua agenda foi atualizada.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'rejected' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      v_requester_user_id,
      case when v_requester_user_id = v_patient_user_id
        then 'booking_reschedule_rejected_patient'
        else 'booking_reschedule_rejected_therapist' end,
      'Proposta de reagendamento recusada',
      'A proposta não foi aceita. O horário original permanece confirmado.',
      case when v_requester_user_id = v_patient_user_id
        then '/app/encontros/' || new.booking_id::text
        else '/terapeuta/sessoes/' || new.booking_id::text end,
      'booking-event:' || new.id::text || ':' || v_requester_user_id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'cancelled' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      case when v_requester_user_id = v_patient_user_id
        then v_therapist_user_id else v_patient_user_id end,
      case when v_requester_user_id = v_patient_user_id
        then 'booking_reschedule_withdrawn_therapist'
        else 'booking_reschedule_withdrawn_patient' end,
      'Proposta de reagendamento retirada',
      'A proposta foi retirada. O horário original permanece confirmado.',
      case when v_requester_user_id = v_patient_user_id
        then '/terapeuta/sessoes/' || new.booking_id::text
        else '/app/encontros/' || new.booking_id::text end,
      'booking-event:' || new.id::text || ':counterparty'
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'expired' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_reschedule_expired_patient',
        'Proposta de reagendamento encerrada',
        'A proposta expirou ou o horário deixou de estar disponível. O horário original permanece confirmado.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_reschedule_expired_therapist',
        'Proposta de reagendamento encerrada',
        'A proposta expirou ou o horário deixou de estar disponível. O horário original permanece confirmado.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
  end if;

  return new;
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
  v_requester_user_id uuid;
  v_change_kind text;
  v_patient_action_key text;
  v_therapist_action_key text;
  v_status text;
  v_is_future_v10_reservation boolean := false;
begin
  if new.event_type = 'booking_created' and new.next_status::text = 'confirmed' then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    return new;
  end if;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if new.event_type like 'booking_reschedule_%' then
    select requested_by_profile_id, change_kind
    into v_requester_user_id, v_change_kind
    from public.booking_reschedule_requests
    where id = (new.payload ->> 'rescheduleRequestId')::uuid;
  end if;

  if new.event_type = 'booking_status_changed'
    and new.next_status::text = 'confirmed'
  then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);

    select exists (
      select 1
      from public.session_payments payment
      join public.session_payment_schedules schedule
        on schedule.session_payment_id = payment.id
      where payment.booking_id = new.booking_id
        and payment.payment_flow_version = 'v10'
        and payment.financial_status in ('pending', 'processing')
        and schedule.status in (
          'scheduled', 'claimed', 'processing',
          'requires_customer_action', 'retry_scheduled'
        )
    ) into v_is_future_v10_reservation;

    if v_is_future_v10_reservation then
      v_patient_action_key := 'booking_reserved_patient';
      v_therapist_action_key := 'booking_reserved_therapist';
    else
      v_patient_action_key := 'booking_confirmed_patient';
      v_therapist_action_key := 'booking_confirmed_therapist';
    end if;
  elsif new.event_type = 'booking_status_changed'
    and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
  then
    perform public.cancel_booking_reminder_jobs_v1(new.booking_id, 'booking_status_changed');
    v_patient_action_key := 'booking_cancelled_patient';
    v_therapist_action_key := 'booking_cancelled_therapist';
  elsif new.event_type = 'booking_reschedule_requested' then
    if v_requester_user_id = v_patient_user_id then
      v_therapist_action_key := 'booking_reschedule_requested_therapist';
    elsif v_change_kind = 'therapist_reschedule' then
      v_patient_action_key := 'booking_therapist_reschedule_requested_patient';
    else
      v_patient_action_key := 'booking_reschedule_requested_patient';
    end if;
  elsif new.event_type = 'booking_reschedule_resolved' then
    v_status := new.payload ->> 'status';
    if v_status = 'applied' then
      perform public.cancel_booking_reminder_jobs_v1(new.booking_id, 'booking_rescheduled');
      perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
      v_patient_action_key := 'booking_rescheduled_patient';
      v_therapist_action_key := 'booking_rescheduled_therapist';
    elsif v_status = 'rejected' then
      if v_requester_user_id = v_patient_user_id then
        v_patient_action_key := 'booking_reschedule_rejected_patient';
      else
        v_therapist_action_key := 'booking_reschedule_rejected_therapist';
      end if;
    elsif v_status = 'cancelled' then
      if v_requester_user_id = v_patient_user_id then
        v_therapist_action_key := 'booking_reschedule_withdrawn_therapist';
      else
        v_patient_action_key := 'booking_reschedule_withdrawn_patient';
      end if;
    elsif v_status = 'expired' then
      v_patient_action_key := 'booking_reschedule_expired_patient';
      v_therapist_action_key := 'booking_reschedule_expired_therapist';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_patient_action_key is not null and v_patient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_patient_action_key, new.id, 'booking', new.booking_id,
      v_patient_user_id, 'profile:' || v_patient_user_id::text, '{}'::jsonb
    );
  end if;

  if v_therapist_action_key is not null and v_therapist_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_therapist_action_key, new.id, 'booking', new.booking_id,
      v_therapist_user_id, 'profile:' || v_therapist_user_id::text, '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_booking_lifecycle_v1() from public, anon, authenticated;
revoke all on function public.enqueue_booking_email_v1() from public, anon, authenticated;

comment on function public.enqueue_booking_email_v1() is
  'Enfileira reserva, confirmação e demais comunicações do encontro a partir de eventos persistidos, sem dados clínicos ou financeiros no payload.';

commit;
