begin;

-- The stricter constraint applies to every new or changed service. Keeping it
-- NOT VALID preserves legacy rows for historical reads until they are edited
-- through the service command, when the new rule is enforced.
alter table public.therapist_services
  drop constraint if exists therapist_services_duration_range;

alter table public.therapist_services
  add constraint therapist_services_duration_range
  check (duration_minutes between 20 and 120)
  not valid;

comment on constraint therapist_services_duration_range on public.therapist_services is
  'Service duration must be a whole number between 20 and 120 minutes.';

commit;
