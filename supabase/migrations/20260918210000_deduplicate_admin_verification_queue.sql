-- The verification table is an audit history: a therapist can legitimately
-- have one completed review and a newer reapproval after losing an essential
-- publication requirement. The Admin queue is a current-state projection and
-- must therefore expose only the latest review for each therapist.

begin;

alter function public.admin_get_operation_module_v1_internal(
  text,
  integer,
  integer
)
rename to admin_get_operation_module_v1_before_verification_queue;

create function public.admin_get_operation_module_v1_internal(
  p_module text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_metrics jsonb;
  v_rows jsonb;
begin
  -- The predecessor remains the authorization boundary and preserves every
  -- module other than the verification queue.
  v_base := public.admin_get_operation_module_v1_before_verification_queue(
    p_module,
    p_limit,
    p_offset
  );

  if p_module is distinct from 'verifications' then
    return v_base;
  end if;

  with current_verifications as (
    select distinct on (verification.therapist_profile_id)
      verification.*
    from public.therapist_verifications as verification
    order by
      verification.therapist_profile_id,
      verification.submitted_at desc nulls last,
      verification.created_at desc,
      verification.id desc
  )
  select jsonb_build_object(
    'total-verifications', count(*)::integer,
    'pending-verifications', count(*) filter (
      where current_verifications.status in (
        'submitted'::public.therapist_status,
        'in_review'::public.therapist_status,
        'changes_requested'::public.therapist_status
      )
    )::integer
  )
  into v_metrics
  from current_verifications;

  with current_verifications as (
    select distinct on (verification.therapist_profile_id)
      verification.*
    from public.therapist_verifications as verification
    order by
      verification.therapist_profile_id,
      verification.submitted_at desc nulls last,
      verification.created_at desc,
      verification.id desc
  )
  select coalesce(
    jsonb_agg(
      rows.row_payload
      order by
        rows.submitted_at desc nulls last,
        rows.created_at desc,
        rows.id desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      current_verification.id,
      current_verification.submitted_at,
      current_verification.created_at,
      jsonb_build_object(
        'id', current_verification.id,
        'therapist_profile_id',
          current_verification.therapist_profile_id,
        'therapist_name', therapist.public_name,
        'status', current_verification.status,
        'submitted_at', current_verification.submitted_at,
        'reviewed_at', current_verification.reviewed_at,
        'created_at', current_verification.created_at,
        'updated_at', current_verification.updated_at
      ) as row_payload
    from current_verifications as current_verification
    left join public.therapist_profiles as therapist
      on therapist.id = current_verification.therapist_profile_id
    order by
      current_verification.submitted_at desc nulls last,
      current_verification.created_at desc,
      current_verification.id desc
    limit v_limit offset v_offset
  ) as rows;

  return jsonb_set(
    jsonb_set(v_base, '{metrics}', v_metrics),
    '{rows}',
    v_rows
  );
end;
$$;

revoke all on function public.admin_get_operation_module_v1_before_verification_queue(
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

revoke all on function public.admin_get_operation_module_v1_internal(
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

comment on function public.admin_get_operation_module_v1_internal(
  text,
  integer,
  integer
) is
  'Internal Admin operation source. The verification queue projects only the latest review per therapist while therapist_verifications retains the complete audit history.';

commit;
