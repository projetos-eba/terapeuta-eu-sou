create table if not exists public.booking_session_summaries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  title text,
  summary text,
  visibility text not null default 'patient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_session_summaries_visibility_check check (
    visibility in ('patient', 'therapist', 'internal')
  )
);

create index if not exists booking_session_summaries_patient_idx
  on public.booking_session_summaries (patient_profile_id, created_at desc);

create index if not exists booking_session_summaries_therapist_idx
  on public.booking_session_summaries (therapist_profile_id, created_at desc);

drop trigger if exists set_booking_session_summaries_updated_at
on public.booking_session_summaries;

create trigger set_booking_session_summaries_updated_at
before update on public.booking_session_summaries
for each row execute function public.set_updated_at();

alter table public.booking_session_summaries enable row level security;

drop policy if exists "Patients can read their session summaries"
on public.booking_session_summaries;

create policy "Patients can read their session summaries"
on public.booking_session_summaries
for select
to authenticated
using (
  visibility = 'patient'
  and exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = booking_session_summaries.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can read their session summaries"
on public.booking_session_summaries;

create policy "Therapists can read their session summaries"
on public.booking_session_summaries
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = booking_session_summaries.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

grant select on public.booking_session_summaries to authenticated, service_role;

comment on table public.booking_session_summaries is
  'Post-session summaries attached to bookings. Used by authenticated session history surfaces without creating a separate encounters domain.';
