-- Allow authenticated guards to read the profile rows already protected by RLS.
grant select on public.profiles to authenticated;
grant select on public.patient_profiles to authenticated;
grant select on public.therapist_profiles to authenticated;
