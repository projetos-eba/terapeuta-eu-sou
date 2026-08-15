begin;

select plan(4);

select is(
  (select public from storage.buckets where id = 'therapist-private-documents'),
  false,
  'therapist documents bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'therapist-private-documents'),
  10485760::bigint,
  'therapist documents bucket limits files to 10 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'therapist-private-documents'),
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[],
  'therapist documents bucket accepts only declared document MIME types'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and concat_ws(' ', qual, with_check) like '%therapist-private-documents%'
  ),
  0,
  'no browser storage policy exposes therapist private documents directly'
);

select * from finish();

rollback;
