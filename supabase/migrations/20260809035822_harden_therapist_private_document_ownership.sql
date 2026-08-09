-- H1 follow-up: public therapist profile gate policies made therapist_profiles
-- partially visible for public DTOs. Keep private document ownership independent
-- from those public gates by requiring the uploader identity directly.

drop policy if exists "Therapists can read their own private documents"
  on public.therapist_private_documents;

create policy "Therapists can read their own private documents"
on public.therapist_private_documents
for select
to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id =
      therapist_private_documents.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

comment on policy "Therapists can read their own private documents"
on public.therapist_private_documents is
  'Private document reads require direct uploader ownership plus matching therapist profile ownership; this prevents public therapist profile gates from widening private document visibility.';
