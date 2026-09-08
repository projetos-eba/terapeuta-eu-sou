-- A pending reschedule proposal is a therapist-only workflow. Patients use
-- apply_patient_booking_reschedule_v1 and therefore never create pending rows.

create or replace function public.enforce_reschedule_proposal_requester_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  if not exists (
    select 1
    from public.bookings as booking
    join public.therapist_profiles as therapist
      on therapist.id = booking.therapist_profile_id
    where booking.id = new.booking_id
      and therapist.user_id = new.requested_by_profile_id
  ) then
    raise exception 'BOOKING_PROPOSAL_REQUIRES_THERAPIST'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists a15_enforce_reschedule_proposal_requester
  on public.booking_reschedule_requests;
create trigger a15_enforce_reschedule_proposal_requester
before insert on public.booking_reschedule_requests
for each row execute function public.enforce_reschedule_proposal_requester_v1();

revoke all on function public.enforce_reschedule_proposal_requester_v1()
from public, anon, authenticated;

comment on function public.enforce_reschedule_proposal_requester_v1() is
  'Prevents patient-originated pending reschedule proposals; patient changes use the atomic direct-apply command.';
