-- The therapist agenda has one business timezone: Brasília.
-- Historical booking timestamps remain immutable; this affects only live schedule configuration.

update public.availability_rules
set timezone = 'America/Sao_Paulo'
where timezone is distinct from 'America/Sao_Paulo';

update public.therapist_schedule_settings
set
  timezone = 'America/Sao_Paulo',
  version = version + 1,
  updated_at = now()
where timezone is distinct from 'America/Sao_Paulo';

update public.therapist_profiles
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{timezone}',
  '"America/Sao_Paulo"'::jsonb,
  true
)
where metadata ->> 'timezone' is distinct from 'America/Sao_Paulo';

alter table public.therapist_schedule_settings
  add constraint therapist_schedule_settings_brasilia_timezone
  check (timezone = 'America/Sao_Paulo');

alter table public.availability_rules
  add constraint availability_rules_brasilia_timezone
  check (timezone = 'America/Sao_Paulo');

create or replace function public.initialize_therapist_schedule_settings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.therapist_schedule_settings (
    therapist_profile_id,
    timezone
  )
  values (new.id, 'America/Sao_Paulo')
  on conflict (therapist_profile_id) do nothing;

  update public.therapist_profiles
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{timezone}',
    '"America/Sao_Paulo"'::jsonb,
    true
  )
  where id = new.id
    and metadata ->> 'timezone' is distinct from 'America/Sao_Paulo';

  return new;
end;
$$;
