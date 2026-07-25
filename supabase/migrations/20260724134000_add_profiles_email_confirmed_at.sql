alter table public.profiles
add column if not exists email_confirmed_at timestamptz;

create index if not exists profiles_email_confirmed_at_idx
on public.profiles (email_confirmed_at);

comment on column public.profiles.email_confirmed_at is
  'Transactional mirror of Supabase Auth email confirmation used by server-side auth flows and polling. Supabase Auth remains authoritative.';
