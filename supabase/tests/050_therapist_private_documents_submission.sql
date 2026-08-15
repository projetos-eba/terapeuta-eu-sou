begin;

select plan(4);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'therapist_private_documents_kind_check'
      and pg_get_constraintdef(oid) like '%identity_document%'
      and pg_get_constraintdef(oid) like '%address_proof%'
  ),
  'private document kinds are constrained to the supported submission domain'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'therapist_private_documents_active_kind_idx'
  ),
  'active document lookup has an index by professional and document kind'
);

select is(
  has_table_privilege('anon', 'public.therapist_private_documents', 'INSERT'),
  false,
  'anonymous visitors cannot create private document records'
);

select is(
  has_table_privilege('authenticated', 'public.therapist_private_documents', 'INSERT'),
  false,
  'therapist document writes remain mediated by the authenticated Edge Function'
);

select * from finish();

rollback;
