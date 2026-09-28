-- The verification queue needs a small, allowlisted professional identity
-- projection for administrative review. It retains the current authorization,
-- filtering and lifecycle contracts from the predecessor read models.
alter function public.admin_get_operation_module_v1(text, integer, integer)
  rename to admin_get_operation_module_v1_before_verification_identity;

create function public.admin_get_operation_module_v1(
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
  v_rows jsonb;
begin
  v_base := public.admin_get_operation_module_v1_before_verification_identity(
    p_module,
    p_limit,
    p_offset
  );

  if p_module is distinct from 'verifications' then
    return v_base;
  end if;

  select coalesce(
    jsonb_agg(row_payload order by rows.ordinality),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(v_base -> 'rows') with ordinality as rows(row, ordinality)
  left join public.therapist_profiles as therapist
    on therapist.id = (rows.row ->> 'therapist_profile_id')::uuid
  left join public.profiles as profile
    on profile.id = therapist.user_id
  cross join lateral (
    select rows.row || jsonb_build_object(
      'therapist_email', profile.email,
      'therapist_created_at', therapist.created_at,
      'therapist_photo_url', therapist.photo_url
    ) as row_payload
  ) as enriched;

  return jsonb_set(v_base, '{rows}', v_rows);
end;
$$;

revoke all on function public.admin_get_operation_module_v1_before_verification_identity(
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_module_v1(text, integer, integer)
  from public, anon;
grant execute on function public.admin_get_operation_module_v1(text, integer, integer)
  to authenticated, service_role;

alter function public.admin_get_operation_detail_v1(text, uuid)
  rename to admin_get_operation_detail_v1_before_verification_identity;

create function public.admin_get_operation_detail_v1(p_module text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_record jsonb;
  v_professional_data jsonb;
begin
  v_base := public.admin_get_operation_detail_v1_before_verification_identity(
    p_module,
    p_id
  );
  v_record := v_base -> 'record';

  if p_module is distinct from 'verifications'
    or v_record is null
    or v_record = 'null'::jsonb then
    return v_base;
  end if;

  select jsonb_build_object(
    'email', profile.email,
    'id', therapist.id,
    'created_at', therapist.created_at
  )
  into v_professional_data
  from public.therapist_profiles as therapist
  left join public.profiles as profile on profile.id = therapist.user_id
  where therapist.id = (v_record ->> 'therapist_profile_id')::uuid;

  return jsonb_set(
    v_base,
    '{record}',
    v_record || jsonb_build_object(
      'admin_verification_professional',
      v_professional_data
    )
  );
end;
$$;

revoke all on function public.admin_get_operation_detail_v1_before_verification_identity(
  text,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

comment on function public.admin_get_operation_module_v1(text, integer, integer) is
  'Admin verification queue with allowlisted professional identity data. The predecessor retains queue state, authorization and publication eligibility.';

comment on function public.admin_get_operation_detail_v1(text, uuid) is
  'Admin verification detail with allowlisted professional identity data. The predecessor retains authorization, lifecycle state and document boundaries.';
