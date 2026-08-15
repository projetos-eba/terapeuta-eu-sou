-- `supabase/config.toml` configures local Storage, but environments are
-- provisioned through migrations. This bucket remains private: browsers use
-- authorized Edge Functions and never receive Storage object paths.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'therapist-private-documents',
  'therapist-private-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
