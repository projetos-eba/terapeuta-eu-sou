-- Allow patient authenticated surfaces to read their own data without service_role in the Next app.
-- Administrative bypass remains isolated to Supabase Edge Functions.

grant select on public.bookings to authenticated;
grant select on public.favorite_therapists to authenticated;
grant select on public.reviews to authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.therapist_services to authenticated;

drop policy if exists "Patients can read their own bookings"
on public.bookings;

create policy "Patients can read their own bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = bookings.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Patients can read their own reviews"
on public.reviews;

create policy "Patients can read their own reviews"
on public.reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = reviews.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Profiles can read their own support tickets"
on public.support_tickets;

create policy "Profiles can read their own support tickets"
on public.support_tickets
for select
to authenticated
using (requester_profile_id = auth.uid());

drop policy if exists "Patients can read booked therapist services"
on public.therapist_services;

create policy "Patients can read booked therapist services"
on public.therapist_services
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    where bookings.service_id = therapist_services.id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Patients can read booked or favorite therapists"
on public.therapist_profiles;

create policy "Patients can read booked or favorite therapists"
on public.therapist_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    where bookings.therapist_profile_id = therapist_profiles.id
      and patient_profiles.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.favorite_therapists
    join public.patient_profiles
      on patient_profiles.id = favorite_therapists.patient_profile_id
    where favorite_therapists.therapist_profile_id = therapist_profiles.id
      and patient_profiles.user_id = auth.uid()
  )
);
