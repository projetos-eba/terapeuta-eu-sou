-- Preserve the v2 compatibility contract: requesting changes from a submitted
-- verification advances it to review in the same transaction before pausing.

create or replace function public.admin_execute_operation_command_v2(
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
  v_verification public.therapist_verifications%rowtype;
begin
  if p_action like 'professional.%' or p_action like 'verification.%' then
    if p_action = 'verification.pause_review' then
      select * into v_verification
      from public.therapist_verifications
      where id = p_entity_id
      for update;

      if found and v_verification.status = 'submitted'::public.therapist_status then
        update public.therapist_verifications
        set status = 'in_review'::public.therapist_status,
            reviewed_at = coalesce(reviewed_at, now()),
            updated_at = now()
        where id = p_entity_id;

        update public.therapist_profiles
        set status = 'in_review'::public.therapist_status,
            updated_at = now()
        where id = v_verification.therapist_profile_id
          and status <> 'suspended'::public.therapist_status;
      end if;
    end if;

    return public.admin_execute_professional_lifecycle_command_v1(
      p_action,
      p_entity_id,
      p_reason,
      p_request_id,
      p_payload,
      p_correlation_id
    );
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

revoke all on function public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.admin_execute_operation_command_v2(text, uuid, text, text, jsonb, text) to authenticated, service_role;
