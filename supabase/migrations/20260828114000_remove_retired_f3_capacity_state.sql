-- The service-aware agenda capacity helper replaces the former raw F3 sums.
-- Remove variables that belonged exclusively to the retired calculation so
-- schema lint remains truthful and the reconstructed function stays readable.

do $$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, chr(13), '');
  -- `pg_get_functiondef` is server-canonicalized and may change indentation
  -- between PostgreSQL versions. Keep the replay guard strict about the
  -- expected fragments, but tolerant of whitespace-only differences.
  v_updated_definition := regexp_replace(
    v_definition,
    'v_window_starts_at[[:space:]]+timestamptz;[[:space:]]+v_window_ends_at[[:space:]]+timestamptz;[[:space:]]*',
    '',
    'n'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    'v_exception_minutes[[:space:]]+integer[[:space:]]*:=[[:space:]]*0;[[:space:]]*',
    '',
    'n'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    'select[[:space:]]+capacity\.scheduled_minutes,[[:space:]]+capacity\.exception_minutes,[[:space:]]+capacity\.committed_minutes,[[:space:]]+capacity\.available_minutes[[:space:]]+into[[:space:]]+v_scheduled_minutes,[[:space:]]+v_exception_minutes,[[:space:]]+v_committed_minutes,[[:space:]]+v_available_minutes',
    'select capacity.scheduled_minutes,
      capacity.committed_minutes,
      capacity.available_minutes
      into
        v_scheduled_minutes,
        v_committed_minutes,
        v_available_minutes',
    'n'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    'end[[:space:]]+if;[[:space:]]+v_primary_duration_minutes',
    'end if;

  v_primary_duration_minutes',
    'n'
  );

  if v_updated_definition = v_definition
    or v_updated_definition like '%v_window_starts_at%'
    or v_updated_definition like '%v_window_ends_at%'
    or v_updated_definition like '%v_exception_minutes%'
  then
    raise exception 'THERAPIST_FINANCE_F3_RETIRED_STATE_PATCH_FAILED'
      using errcode = 'P0001';
  end if;

  execute v_updated_definition;
end;
$$;
