begin;

select plan(8);

select has_column(
  'public',
  'therapist_private_documents',
  'review_note',
  'private documents retain the administrative re-submission orientation'
);

select has_column(
  'public',
  'therapist_private_documents',
  'reviewed_at',
  'private documents retain the individual review timestamp'
);

select has_column(
  'public',
  'therapist_private_documents',
  'reviewed_by',
  'private documents retain the individual reviewer identity'
);

select has_table(
  'public',
  'therapist_private_document_review_events',
  'document decisions have a dedicated immutable audit relation'
);

select has_index(
  'public',
  'therapist_private_document_review_events',
  'therapist_private_document_review_events_document_idx',
  'document decision history is indexed by document and recency'
);

select is(
  has_table_privilege(
    'anon',
    'public.therapist_private_document_review_events',
    'SELECT'
  ),
  false,
  'anonymous visitors cannot read private document review history'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.therapist_private_document_review_events',
    'INSERT'
  ),
  false,
  'review events remain mediated by the administrative Edge Function'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'therapist_private_document_review_events_reason_check'
  ),
  're-submission requests require an auditable reason'
);

select * from finish();

rollback;
