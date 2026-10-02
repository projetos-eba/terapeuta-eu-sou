-- Allowlist the client name and review observation only in the authenticated
-- administrative detail. Operational listing payloads deliberately stay
-- without either field.
do $migration$
begin
  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_detail_v1_before_review_observation(text,uuid)'
  ) is not null then
    return;
  end if;

  if pg_catalog.to_regprocedure(
    'public.admin_get_operation_detail_v1(text,uuid)'
  ) is null then
    raise exception 'ADMIN_REVIEW_DETAIL_OBSERVATION_SCHEMA_DRIFT: missing %',
      'public.admin_get_operation_detail_v1(text,uuid)'
      using errcode = 'P0001';
  end if;

  execute
    'alter function public.admin_get_operation_detail_v1(text, uuid) '
    'rename to admin_get_operation_detail_v1_before_review_observation';

  execute $definition$
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
  v_review_detail jsonb;
begin
  -- The predecessor retains authorization, audit events and the complete
  -- allowlisted payload for every other administrative module.
  v_base := public.admin_get_operation_detail_v1_before_review_observation(
    p_module,
    p_id
  );
  v_record := v_base -> 'record';

  if p_module is distinct from 'reviews'
    or v_record is null
    or v_record = 'null'::jsonb then
    return v_base;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'comment', nullif(btrim(review.comment), ''),
    'patient_name', patient.display_name
  ))
  into v_review_detail
  from public.reviews as review
  left join public.patient_profiles as patient
    on patient.id = review.patient_profile_id
  where review.id = p_id;

  return jsonb_set(
    v_base,
    '{record}',
    v_record || coalesce(v_review_detail, '{}'::jsonb)
  );
end;
$$;
$definition$;
end;
$migration$;

revoke all on function public.admin_get_operation_detail_v1_before_review_observation(
  text,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

comment on function public.admin_get_operation_detail_v1(text, uuid) is
  'Admin operation detail read model. For reviews, the authenticated Admin detail additionally receives the allowlisted client display name and nonblank review observation; operational rows remain sanitized.';
