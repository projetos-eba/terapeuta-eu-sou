-- New and edited therapist service descriptions are intentionally concise so
-- cards remain readable across the therapist and public surfaces.
create or replace function public.enforce_therapist_service_description_length_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.description is not null and length(new.description) > 200 then
      raise exception 'THERAPIST_SERVICE_INVALID_DESCRIPTION' using errcode = 'P0001';
    end if;
  elsif new.description is distinct from old.description
    and new.description is not null
    and length(new.description) > 200
  then
    raise exception 'THERAPIST_SERVICE_INVALID_DESCRIPTION' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists therapist_services_description_length_v1
  on public.therapist_services;

create trigger therapist_services_description_length_v1
before insert or update of description on public.therapist_services
for each row
execute function public.enforce_therapist_service_description_length_v1();

comment on function public.enforce_therapist_service_description_length_v1()
  is 'Limits new or edited therapist service descriptions to 200 characters while preserving legacy records.';

revoke all on function public.enforce_therapist_service_description_length_v1() from public;
