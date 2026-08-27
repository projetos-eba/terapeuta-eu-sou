-- Participant messaging is available after a confirmed session relationship.
-- A conversation belongs to the patient/therapist pair, not to one specific
-- booking; booking_id keeps the most relevant authorized session context for
-- structured templates that require it.

create or replace function public.upsert_participant_conversation_for_booking_v1(
  p_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_conversation_id uuid;
begin
  select *
    into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found
    or v_booking.status not in (
      'confirmed'::public.booking_status,
      'completed'::public.booking_status
    )
  then
    return null;
  end if;

  insert into public.conversations as conversation (
    patient_profile_id,
    therapist_profile_id,
    booking_id
  )
  values (
    v_booking.patient_profile_id,
    v_booking.therapist_profile_id,
    v_booking.id
  )
  on conflict (patient_profile_id, therapist_profile_id) do update
  set
    booking_id = case
      -- Do not replace a more recent confirmed session context with a
      -- historical completion arriving later in the lifecycle.
      when exists (
        select 1
        from public.bookings as current_booking
        where current_booking.id = conversation.booking_id
          and current_booking.status = 'confirmed'::public.booking_status
          and current_booking.starts_at >= v_booking.starts_at
      ) then conversation.booking_id
      else excluded.booking_id
    end,
    updated_at = now()
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

create or replace function public.ensure_participant_conversation_after_booking_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in (
    'confirmed'::public.booking_status,
    'completed'::public.booking_status
  ) then
    perform public.upsert_participant_conversation_for_booking_v1(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_participant_conversation_after_booking
  on public.bookings;
create trigger ensure_participant_conversation_after_booking
after update of status on public.bookings
for each row
when (
  old.status is distinct from new.status
  and new.status in (
    'confirmed'::public.booking_status,
    'completed'::public.booking_status
  )
)
execute function public.ensure_participant_conversation_after_booking_v1();

-- Backfill the relationship for sessions that already happened or remain
-- confirmed. Prefer a confirmed session for template context; otherwise use
-- the latest completed one. Existing messages and timestamps are preserved.
with eligible_bookings as (
  select distinct on (booking.patient_profile_id, booking.therapist_profile_id)
    booking.patient_profile_id,
    booking.therapist_profile_id,
    booking.id as booking_id
  from public.bookings as booking
  where booking.status in (
    'confirmed'::public.booking_status,
    'completed'::public.booking_status
  )
  order by
    booking.patient_profile_id,
    booking.therapist_profile_id,
    case when booking.status = 'confirmed'::public.booking_status then 0 else 1 end,
    booking.starts_at desc,
    booking.id desc
)
insert into public.conversations as conversation (
  patient_profile_id,
  therapist_profile_id,
  booking_id
)
select
  eligible_bookings.patient_profile_id,
  eligible_bookings.therapist_profile_id,
  eligible_bookings.booking_id
from eligible_bookings
on conflict (patient_profile_id, therapist_profile_id) do update
set
  booking_id = excluded.booking_id,
  updated_at = now();

revoke all on function public.upsert_participant_conversation_for_booking_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_participant_conversation_after_booking_v1()
  from public, anon, authenticated;

comment on function public.upsert_participant_conversation_for_booking_v1(uuid) is
  'Creates or maintains the one structured participant conversation for an eligible confirmed or completed booking relationship.';
comment on function public.ensure_participant_conversation_after_booking_v1() is
  'Maintains structured participant messaging eligibility after a booking becomes confirmed or completed.';
