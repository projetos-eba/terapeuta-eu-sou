create table if not exists public.booking_intake_responses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  focus_area text not null,
  shared_note text not null,
  therapy_goal text not null,
  visibility text not null default 'patient_therapist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_intake_responses_booking_unique unique (booking_id),
  constraint booking_intake_responses_visibility_check check (
    visibility in ('patient_therapist', 'private_patient', 'support')
  )
);

create table if not exists public.booking_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'BRL',
  provider text not null default 'mock',
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_payment_receipts_booking_unique unique (booking_id),
  constraint booking_payment_receipts_amount_non_negative check (amount_cents >= 0)
);

create table if not exists public.therapist_service_cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.therapist_services (id) on delete cascade,
  free_until_hours integer not null default 24,
  late_cancel_fee_percent integer not null default 50,
  no_show_fee_percent integer not null default 100,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_service_cancellation_policies_service_unique unique (service_id),
  constraint therapist_service_cancellation_policies_percentages check (
    late_cancel_fee_percent between 0 and 100
    and no_show_fee_percent between 0 and 100
  ),
  constraint therapist_service_cancellation_policies_hours check (free_until_hours >= 0)
);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_intake_responses_patient_idx
  on public.booking_intake_responses (patient_profile_id, created_at desc);

create index if not exists booking_payment_receipts_booking_idx
  on public.booking_payment_receipts (booking_id);

create index if not exists booking_events_booking_idx
  on public.booking_events (booking_id, created_at desc);

drop trigger if exists set_booking_intake_responses_updated_at
on public.booking_intake_responses;

create trigger set_booking_intake_responses_updated_at
before update on public.booking_intake_responses
for each row execute function public.set_updated_at();

drop trigger if exists set_booking_payment_receipts_updated_at
on public.booking_payment_receipts;

create trigger set_booking_payment_receipts_updated_at
before update on public.booking_payment_receipts
for each row execute function public.set_updated_at();

drop trigger if exists set_therapist_service_cancellation_policies_updated_at
on public.therapist_service_cancellation_policies;

create trigger set_therapist_service_cancellation_policies_updated_at
before update on public.therapist_service_cancellation_policies
for each row execute function public.set_updated_at();

alter table public.booking_intake_responses enable row level security;
alter table public.booking_payment_receipts enable row level security;
alter table public.therapist_service_cancellation_policies enable row level security;
alter table public.booking_events enable row level security;

drop policy if exists "Patients can read their booking intake"
on public.booking_intake_responses;

create policy "Patients can read their booking intake"
on public.booking_intake_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = booking_intake_responses.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Therapists can read their booking intake"
on public.booking_intake_responses;

create policy "Therapists can read their booking intake"
on public.booking_intake_responses
for select
to authenticated
using (
  visibility = 'patient_therapist'
  and exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = booking_intake_responses.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Patients can read their payment receipts"
on public.booking_payment_receipts;

create policy "Patients can read their payment receipts"
on public.booking_payment_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    where bookings.id = booking_payment_receipts.booking_id
      and patient_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Public cancellation policies are readable"
on public.therapist_service_cancellation_policies;

create policy "Public cancellation policies are readable"
on public.therapist_service_cancellation_policies
for select
to authenticated
using (true);

drop policy if exists "Booking events are readable by booking participants"
on public.booking_events;

create policy "Booking events are readable by booking participants"
on public.booking_events
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    left join public.patient_profiles
      on patient_profiles.id = bookings.patient_profile_id
    left join public.therapist_profiles
      on therapist_profiles.id = bookings.therapist_profile_id
    where bookings.id = booking_events.booking_id
      and (
        patient_profiles.user_id = auth.uid()
        or therapist_profiles.user_id = auth.uid()
      )
  )
);

grant select on public.booking_intake_responses to authenticated, service_role;
grant select on public.booking_payment_receipts to authenticated, service_role;
grant select on public.therapist_service_cancellation_policies to authenticated, service_role;
grant select on public.booking_events to authenticated, service_role;

comment on table public.booking_intake_responses is
  'Structured intake responses linked to bookings. Supports detail views without creating a separate sessions domain.';

comment on table public.booking_payment_receipts is
  'Payment receipt metadata linked to bookings for authenticated detail surfaces.';

comment on table public.therapist_service_cancellation_policies is
  'Cancellation policy defaults per therapist service.';

comment on table public.booking_events is
  'Audit and timeline events for booking lifecycle changes.';
