create or replace function public.resolve_payout_operational_incident_v1(
  p_incident_key text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  if nullif(trim(p_incident_key), '') is null or p_now is null then
    raise exception 'PAYOUT_INCIDENT_RESOLUTION_INVALID';
  end if;

  with resolved as (
    update public.payout_operational_incidents
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, p_now),
        updated_at = now()
    where incident_key = left(trim(p_incident_key), 240)
      and status = 'open'
    returning true
  )
  select coalesce(bool_or(true), false)
  into v_updated
  from resolved;

  return v_updated;
end;
$$;

revoke all on function public.resolve_payout_operational_incident_v1(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_payout_operational_incident_v1(text, timestamptz)
  to service_role;

comment on function public.resolve_payout_operational_incident_v1(text, timestamptz) is
  'Resolves a protected payout operational incident after confirmed worker recovery.';
