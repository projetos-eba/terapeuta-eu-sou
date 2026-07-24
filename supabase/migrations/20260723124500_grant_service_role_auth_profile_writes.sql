-- Allow server-side auth flows to create profile rows through PostgREST.
-- RLS remains enabled; Supabase service_role bypasses RLS but still needs table privileges.

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.patient_profiles to service_role;
grant select, insert, update, delete on public.therapist_profiles to service_role;

grant usage, select on all sequences in schema public to service_role;
