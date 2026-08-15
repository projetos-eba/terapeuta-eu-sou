-- Local-only recovery script for the Supabase Storage service.
-- Execute as supabase_storage_admin or supabase_admin, never as an app role.
-- The service owns these objects; this file is not a deployable application
-- migration and must not be pushed to a hosted environment.

create table if not exists storage.migrations (
  id integer primary key,
  name varchar(100) unique not null,
  hash varchar(40) not null,
  executed_at timestamp default current_timestamp
);

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  avif_autodetection_enabled boolean not null default false,
  owner_id uuid
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  version text,
  owner_id uuid,
  user_metadata jsonb
);

create unique index if not exists storage_objects_bucket_name_idx
  on storage.objects (bucket_id, name);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return coalesce(parts[1:array_length(parts, 1) - 1], array[]::text[]);
end;
$$;
