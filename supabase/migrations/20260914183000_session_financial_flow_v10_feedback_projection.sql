begin;

-- V9 keeps its settlement/confirmation gate. A V10 payment has already
-- enqueued its direct Transfer at payment confirmation, so later feedback must
-- never run the weekly eligibility calculation against it.
alter function public.refresh_session_transfer_eligibility(uuid, timestamptz)
  rename to private_refresh_session_transfer_eligibility_v9_legacy;

revoke all on function public.private_refresh_session_transfer_eligibility_v9_legacy(uuid, timestamptz)
from public, anon, authenticated;

create function public.refresh_session_transfer_eligibility(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns public.session_transfer_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  select payment.* into v_payment
  from public.session_payments payment
  where payment.id = p_session_payment_id
  for update;

  if not found then
    raise exception 'session_payment_not_found';
  end if;

  if v_payment.payment_flow_version = 'v10' then
    return v_payment.transfer_status;
  end if;

  return public.private_refresh_session_transfer_eligibility_v9_legacy(
    p_session_payment_id, p_now
  );
end;
$$;

revoke all on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.refresh_session_transfer_eligibility(uuid, timestamptz)
to service_role;

-- The V9 presenter deliberately folds financial progress into confirmation.
-- V10 confirmation is independent, and its two participant answers are the
-- only source for a completed confirmation (apart from an open review).
alter function public.get_session_feedback_v2(uuid)
  rename to private_session_feedback_v2_v9_legacy;

revoke all on function public.private_session_feedback_v2_v9_legacy(uuid)
from public, anon, authenticated;

create function public.get_session_feedback_v2(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_payment public.session_payments%rowtype;
  v_state text;
begin
  -- The legacy reader authorizes the actor before any V10 projection runs.
  v_payload := public.private_session_feedback_v2_v9_legacy(p_booking_id);

  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id;

  if v_payment.payment_flow_version <> 'v10' then
    return v_payload;
  end if;

  v_state := case
    when v_payment.internal_contested_at is not null
      or v_payment.admin_blocked_at is not null
      or exists (
        select 1 from public.session_confirmation_incidents incident
        where incident.booking_id = p_booking_id and incident.status = 'open'
      ) then 'blocked_for_review'
    when v_payload -> 'actorConfirmation' = 'null'::jsonb
      and v_payload -> 'counterpartConfirmation' = 'null'::jsonb
      then 'awaiting_both'
    when v_payload -> 'actorConfirmation' = 'null'::jsonb
      then case when v_payload ->> 'actorRole' = 'patient'
        then 'awaiting_patient' else 'awaiting_therapist' end
    when v_payload -> 'counterpartConfirmation' = 'null'::jsonb
      then case when v_payload ->> 'actorRole' = 'patient'
        then 'awaiting_therapist' else 'awaiting_patient' end
    else 'completed'
  end;

  v_payload := jsonb_set(v_payload, '{confirmationState}', to_jsonb(v_state), true);
  return jsonb_set(v_payload, '{financial,nextBatchAt}', 'null'::jsonb, true);
end;
$$;

revoke all on function public.get_session_feedback_v2(uuid)
from public, anon;
grant execute on function public.get_session_feedback_v2(uuid)
to authenticated, service_role;

alter function public.get_patient_session_feedback_queue_v1()
  rename to private_patient_session_feedback_queue_v1_v9_legacy;

revoke all on function public.private_patient_session_feedback_queue_v1_v9_legacy()
from public, anon, authenticated;

create function public.get_patient_session_feedback_queue_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with legacy as (
    select public.private_patient_session_feedback_queue_v1_v9_legacy() payload
  ), items as (
    select item.value payload
    from legacy
    cross join lateral jsonb_array_elements(legacy.payload) item
  )
  select coalesce(jsonb_agg(
    case when payment.payment_flow_version = 'v10' then
      items.payload || jsonb_build_object(
        'confirmationState', case
          when payment.internal_contested_at is not null
            or payment.admin_blocked_at is not null
            or exists (
              select 1 from public.session_confirmation_incidents incident
              where incident.booking_id = payment.booking_id
                and incident.status = 'open'
            ) then 'blocked_for_review'
          when items.payload -> 'actorConfirmation' = 'null'::jsonb
            and items.payload -> 'counterpartConfirmation' = 'null'::jsonb
            then 'awaiting_both'
          when items.payload -> 'actorConfirmation' = 'null'::jsonb
            then 'awaiting_patient'
          when items.payload -> 'counterpartConfirmation' = 'null'::jsonb
            then 'awaiting_therapist'
          else 'completed'
        end,
        'eligibleAt', null,
        'nextBatchAt', null
      )
    else items.payload end
    order by (items.payload ->> 'endsAt')::timestamptz desc
  ), '[]'::jsonb)
  from items
  join public.session_payments payment
    on payment.booking_id = (items.payload ->> 'bookingId')::uuid;
$$;

revoke all on function public.get_patient_session_feedback_queue_v1()
from public, anon;
grant execute on function public.get_patient_session_feedback_queue_v1()
to authenticated, service_role;

commit;
