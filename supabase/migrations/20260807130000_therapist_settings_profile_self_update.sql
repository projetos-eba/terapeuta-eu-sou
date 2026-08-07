-- Therapist settings: allow authenticated therapists to update only their own
-- account-facing profile fields. Role, email, plan and public profile fields
-- stay outside this grant.

grant update (display_name, phone) on public.profiles to authenticated;

drop policy if exists "Therapists can update their own account settings"
on public.profiles;

create policy "Therapists can update their own account settings"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  and role = 'therapist'
)
with check (
  auth.uid() = id
  and role = 'therapist'
);

comment on policy "Therapists can update their own account settings"
on public.profiles is
  'Allows therapist users to update only column-granted account settings on their own profile row.';
