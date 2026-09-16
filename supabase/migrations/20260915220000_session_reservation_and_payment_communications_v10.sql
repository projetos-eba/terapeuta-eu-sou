-- Keep the operational booking status stable while distinguishing a future
-- reservation from a financially confirmed encounter in user communications.

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
    'booking_reserved_patient',
    'bookings',
    'Encontro reservado — pessoa',
    'Confirma que o horário foi reservado e informa quando o pagamento será realizado.',
    true,
    'v1'
  ),
  (
    'booking_reserved_therapist',
    'bookings',
    'Sessão reservada — terapeuta',
    'Informa ao terapeuta que um horário foi reservado e ainda aguarda a confirmação do pagamento.',
    true,
    'v1'
  )
on conflict (action_key) do update
set category = excluded.category,
    label = excluded.label,
    description = excluded.description,
    active = excluded.active,
    default_template_version = excluded.default_template_version;

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
    select requested_by_profile_id into v_requester_user_id
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

create or replace function public.enqueue_session_payment_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_key text;
  v_booking_status public.booking_status;
  v_domain_event_id uuid;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
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

  if v_action_key is null then
    return new;
  end if;

  if new.stripe_event_id is not null then
    select event.id into v_domain_event_id
    from public.stripe_webhook_events event
    where event.stripe_event_id = new.stripe_event_id
      and event.processing_status in ('processing', 'processed')
    limit 1;
  end if;

  -- A scheduled charge may be confirmed by the worker before its webhook is
  -- delivered. The immutable schedule is the local event identity in that path.
  if v_domain_event_id is null and new.payment_flow_version = 'v10' then
    select schedule.id into v_domain_event_id
    from public.session_payment_schedules schedule
    where schedule.session_payment_id = new.id
    order by schedule.created_at desc, schedule.id desc
    limit 1;
  end if;

  if v_domain_event_id is null then
    return new;
  end if;

  select booking.status, patient.user_id, therapist.user_id
  into v_booking_status, v_patient_user_id, v_therapist_user_id
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if v_patient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_action_key,
      v_domain_event_id,
      'session_payment',
      new.id,
      v_patient_user_id,
      'profile:' || v_patient_user_id::text,
      '{}'::jsonb
    );
  end if;

  -- In the scheduled V10 path the operational booking was already confirmed
  -- when the card was saved. Payment success therefore has no second booking
  -- status transition from which to notify both participants.
  if new.payment_flow_version = 'v10'
    and new.financial_status = 'paid'
    and v_booking_status = 'confirmed'
  then
    if v_patient_user_id is not null then
      perform public.enqueue_transactional_email_v1(
        'booking_confirmed_patient',
        v_domain_event_id,
        'booking',
        new.booking_id,
        v_patient_user_id,
        'profile:' || v_patient_user_id::text,
        '{}'::jsonb
      );
    end if;

    if v_therapist_user_id is not null then
      perform public.enqueue_transactional_email_v1(
        'booking_confirmed_therapist',
        v_domain_event_id,
        'booking',
        new.booking_id,
        v_therapist_user_id,
        'profile:' || v_therapist_user_id::text,
        '{}'::jsonb
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_booking_email_v1() from public;
revoke all on function public.enqueue_session_payment_email_v1() from public;

comment on function public.enqueue_booking_email_v1() is
  'Enfileira reserva, confirmação e demais comunicações do encontro a partir de eventos persistidos, sem dados clínicos ou financeiros no payload.';
comment on function public.enqueue_session_payment_email_v1() is
  'Enfileira comunicações financeiras e confirmações V10 a partir do estado persistido, usando identidade local idempotente quando o worker antecede o webhook.';
