-- Individual document decisions are distinct from the final professional
-- verification. Only the administrative verification command can approve or
-- reject the professional profile as a whole.

alter table public.therapist_private_documents
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;

alter table public.therapist_private_documents
  drop constraint if exists therapist_private_documents_review_note_length;

alter table public.therapist_private_documents
  add constraint therapist_private_documents_review_note_length
  check (review_note is null or char_length(btrim(review_note)) between 3 and 1000);

create table if not exists public.therapist_private_document_review_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.therapist_private_documents (id) on delete cascade,
  therapist_profile_id uuid not null references public.therapist_profiles (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  reason text,
  previous_status text not null,
  next_status text not null,
  created_at timestamptz not null default now(),
  constraint therapist_private_document_review_events_action_check
    check (action in ('accepted', 'resubmission_requested')),
  constraint therapist_private_document_review_events_reason_check
    check (
      (action = 'accepted' and reason is null)
      or (action = 'resubmission_requested' and char_length(btrim(reason)) between 3 and 1000)
    )
);

create index if not exists therapist_private_document_review_events_document_idx
  on public.therapist_private_document_review_events (document_id, created_at desc);

alter table public.therapist_private_document_review_events enable row level security;

revoke all on table public.therapist_private_document_review_events from anon, authenticated;

comment on table public.therapist_private_document_review_events is
  'Immutable audit trail for individual therapist document decisions. Writes are mediated by therapist-private-documents Edge Function.';
