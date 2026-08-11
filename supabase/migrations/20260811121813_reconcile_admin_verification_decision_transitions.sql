-- Reconcile the strict verification state machine with the existing audited
-- admin commands. The public RPC contract remains stable, while decisions on
-- submitted records now pass through in_review in the same transaction.

alter function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) rename to admin_execute_operation_command_v1_internal;

revoke all on function public.admin_execute_operation_command_v1_internal(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated, service_role;

create function public.admin_execute_operation_command_v1(
  p_action text,
  p_entity_id uuid,
  p_reason text,
  p_request_id text,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  if p_action in (
    'verification.approve',
    'verification.reject',
    'verification.request_changes'
  ) then
    update public.therapist_verifications
    set
      status = 'in_review'::public.therapist_status,
      reviewed_by = v_actor_id,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
    where id = p_entity_id
      and status = 'submitted'::public.therapist_status;
  end if;

  return public.admin_execute_operation_command_v1_internal(
    p_action,
    p_entity_id,
    p_reason,
    p_request_id,
    p_payload,
    p_correlation_id
  );
end;
$$;

revoke all on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

comment on function public.admin_execute_operation_command_v1(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Executes allowlisted admin operation commands and advances submitted verifications through in_review before an audited decision.';

comment on function public.admin_execute_operation_command_v1_internal(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Internal implementation for admin operation commands. Callable only through the guarded public wrapper.';

alter function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) rename to admin_execute_operation_command_v2_internal;

revoke all on function public.admin_execute_operation_command_v2_internal(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated, service_role;

create function public.admin_execute_operation_command_v2(
  p_action text,
  p_entity_id uuid,
  p_reason text,
  p_request_id text,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  if p_action = 'verification.pause_review' then
    update public.therapist_verifications
    set
      status = 'in_review'::public.therapist_status,
      reviewed_by = v_actor_id,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
    where id = p_entity_id
      and status = 'submitted'::public.therapist_status;
  end if;

  return public.admin_execute_operation_command_v2_internal(
    p_action,
    p_entity_id,
    p_reason,
    p_request_id,
    p_payload,
    p_correlation_id
  );
end;
$$;

revoke all on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;

comment on function public.admin_execute_operation_command_v2(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Extends guarded admin operation commands and advances submitted verifications through in_review before pausing for changes.';

comment on function public.admin_execute_operation_command_v2_internal(
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) is
  'Internal implementation for v2 admin operation commands. Callable only through the guarded public wrapper.';
