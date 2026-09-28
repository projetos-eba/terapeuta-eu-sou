-- The professional detail keeps its existing authorization boundary and only
-- adds the limited registration data needed by the Admin detail screen.
alter function public.admin_get_operation_detail_v1(text, uuid)
  rename to admin_get_operation_detail_v1_before_professional_main_data;

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
  v_main_data jsonb;
begin
  v_base := public.admin_get_operation_detail_v1_before_professional_main_data(
    p_module,
    p_id
  );
  v_record := v_base -> 'record';

  if p_module is distinct from 'professionals'
    or v_record is null
    or v_record = 'null'::jsonb then
    return v_base;
  end if;

  select jsonb_build_object(
    'email', profile.email,
    'phone', profile.phone,
    'phone_country_code', profile.phone_country_code,
    'birth_date', therapist.metadata #>> '{signup,birthDate}'
  )
  into v_main_data
  from public.therapist_profiles as therapist
  left join public.profiles as profile on profile.id = therapist.user_id
  where therapist.id = p_id;

  return jsonb_set(
    v_base,
    '{record}',
    v_record || jsonb_build_object('admin_main_data', v_main_data)
  );
end;
$$;

revoke all on function public.admin_get_operation_detail_v1_before_professional_main_data(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_detail_v1(text, uuid) from public, anon;
grant execute on function public.admin_get_operation_detail_v1(text, uuid) to authenticated, service_role;

comment on function public.admin_get_operation_detail_v1(text, uuid) is
  'Admin operation detail read model with allowlisted professional registration data. The in-function admin authorization remains delegated to the predecessor.';
