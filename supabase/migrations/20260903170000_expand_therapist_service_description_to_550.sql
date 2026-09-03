-- Expand the published therapist service description contract without
-- rewriting the historical migration that introduced the previous guard.
create or replace function public.enforce_therapist_service_description_length_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.description is not null and length(new.description) > 550 then
      raise exception 'THERAPIST_SERVICE_INVALID_DESCRIPTION'
        using errcode = 'P0001';
    end if;
  elsif new.description is distinct from old.description
    and new.description is not null
    and length(new.description) > 550
  then
    raise exception 'THERAPIST_SERVICE_INVALID_DESCRIPTION'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.enforce_therapist_service_description_length_v1()
  is 'Limits new or edited therapist service descriptions to 550 characters while preserving legacy records.';
