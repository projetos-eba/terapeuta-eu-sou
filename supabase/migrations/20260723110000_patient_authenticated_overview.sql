-- Patient authenticated overview foundation.
-- Existing equivalents are intentionally reused: therapist_profiles, bookings,
-- favorite_therapists, reviews and support_tickets.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_patient_therapist_unique unique (patient_profile_id, therapist_profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (length(trim(body)) > 0)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_not_blank check (length(trim(kind)) > 0),
  constraint notifications_title_not_blank check (length(trim(title)) > 0)
);

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null references public.patient_profiles (id) on delete cascade,
  mood text not null,
  checked_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mood_checkins_mood_valid check (
    mood in ('calm', 'anxious', 'sad', 'confused', 'inspired', 'hopeful')
  ),
  constraint mood_checkins_one_per_patient_day unique (patient_profile_id, checked_on)
);

alter table public.support_tickets
  add column if not exists resolution_summary text,
  add column if not exists reviewed_at timestamptz;

create index if not exists conversations_patient_idx
  on public.conversations (patient_profile_id, last_message_at desc nulls last);
create index if not exists conversations_therapist_idx
  on public.conversations (therapist_profile_id, last_message_at desc nulls last);
create index if not exists messages_conversation_unread_idx
  on public.messages (conversation_id, read_at) where read_at is null;
create index if not exists notifications_profile_unread_idx
  on public.notifications (profile_id, read_at) where read_at is null;
create index if not exists mood_checkins_patient_checked_on_idx
  on public.mood_checkins (patient_profile_id, checked_on desc);

create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger set_mood_checkins_updated_at
before update on public.mood_checkins
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.mood_checkins enable row level security;

create policy "Conversation participants can read conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = conversations.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.therapist_profiles
    where therapist_profiles.id = conversations.therapist_profile_id
      and therapist_profiles.user_id = auth.uid()
  )
);

create policy "Conversation participants can read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    left join public.patient_profiles on patient_profiles.id = conversations.patient_profile_id
    left join public.therapist_profiles on therapist_profiles.id = conversations.therapist_profile_id
    where conversations.id = messages.conversation_id
      and (patient_profiles.user_id = auth.uid() or therapist_profiles.user_id = auth.uid())
  )
);

create policy "Conversation participants can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1
    from public.conversations
    left join public.patient_profiles on patient_profiles.id = conversations.patient_profile_id
    left join public.therapist_profiles on therapist_profiles.id = conversations.therapist_profile_id
    where conversations.id = messages.conversation_id
      and (patient_profiles.user_id = auth.uid() or therapist_profiles.user_id = auth.uid())
  )
);

create policy "Conversation participants can mark messages read"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations
    left join public.patient_profiles on patient_profiles.id = conversations.patient_profile_id
    left join public.therapist_profiles on therapist_profiles.id = conversations.therapist_profile_id
    where conversations.id = messages.conversation_id
      and (patient_profiles.user_id = auth.uid() or therapist_profiles.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.conversations
    left join public.patient_profiles on patient_profiles.id = conversations.patient_profile_id
    left join public.therapist_profiles on therapist_profiles.id = conversations.therapist_profile_id
    where conversations.id = messages.conversation_id
      and (patient_profiles.user_id = auth.uid() or therapist_profiles.user_id = auth.uid())
  )
);

create policy "Profiles can read their own notifications"
on public.notifications
for select
to authenticated
using (profile_id = auth.uid());

create policy "Profiles can update their own notifications"
on public.notifications
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Patients can read their own mood checkins"
on public.mood_checkins
for select
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = mood_checkins.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

create policy "Patients can create their own mood checkins"
on public.mood_checkins
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = mood_checkins.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

create policy "Patients can update their own mood checkins"
on public.mood_checkins
for update
to authenticated
using (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = mood_checkins.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.patient_profiles
    where patient_profiles.id = mood_checkins.patient_profile_id
      and patient_profiles.user_id = auth.uid()
  )
);

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.mood_checkins to authenticated;
