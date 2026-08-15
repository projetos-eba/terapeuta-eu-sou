-- The submission flow accepts only the two documents requested from a therapist.
-- Existing "administrative" records remain valid because they are historical
-- internal records and are never offered as a therapist-uploadable choice.
alter table public.therapist_private_documents
  drop constraint if exists therapist_private_documents_kind_check;

alter table public.therapist_private_documents
  add constraint therapist_private_documents_kind_check
  check (document_kind in ('identity_document', 'address_proof', 'administrative'));

create index if not exists therapist_private_documents_active_kind_idx
  on public.therapist_private_documents (
    therapist_profile_id,
    document_kind,
    updated_at desc
  )
  where status <> 'archived';

comment on table public.therapist_private_documents is
  'Private therapist documents. Browser access is mediated by authenticated Edge Functions and short-lived signed URLs.';
