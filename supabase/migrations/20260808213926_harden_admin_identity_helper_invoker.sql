-- H1 hardening: this helper only checks the caller's own row in profiles.
-- Running it as SECURITY INVOKER preserves the admin RLS contract while
-- removing one exposed SECURITY DEFINER RPC from the Data API surface.

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_current_admin() from public;
grant execute on function public.is_current_admin() to authenticated, service_role;

comment on function public.is_current_admin() is
  'Checks whether the authenticated caller is an admin using caller-visible profile data. SECURITY INVOKER by design to avoid exposing a privileged Data API helper.';
