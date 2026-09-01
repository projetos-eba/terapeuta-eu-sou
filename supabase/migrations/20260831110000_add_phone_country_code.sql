-- Phone numbers remain stored as national digits in `phone` for compatibility.
-- The selected DDI is persisted separately and defaults to 55 only at read time
-- for legacy rows that predate this column.
alter table public.profiles
  add column if not exists phone_country_code text;

alter table public.patient_profiles
  add column if not exists phone_country_code text;

alter table public.profiles
  drop constraint if exists profiles_phone_country_code_format;
alter table public.profiles
  add constraint profiles_phone_country_code_format
  check (phone_country_code is null or phone_country_code ~ '^[1-9][0-9]{0,2}$');

alter table public.patient_profiles
  drop constraint if exists patient_profiles_phone_country_code_format;
alter table public.patient_profiles
  add constraint patient_profiles_phone_country_code_format
  check (phone_country_code is null or phone_country_code ~ '^[1-9][0-9]{0,2}$');

grant update (phone_country_code) on public.profiles to authenticated;
