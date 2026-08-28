-- The service-aware agenda capacity helper replaces the former raw F3 sums.
-- Remove variables that belonged exclusively to the retired calculation so
-- schema lint remains truthful and the reconstructed function stays readable.

do $$
declare
  v_definition text;
  v_updated_definition text;
  v_old_capacity_read text := '    select capacity.scheduled_minutes,
      capacity.exception_minutes,
      capacity.committed_minutes,
      capacity.available_minutes
      into
        v_scheduled_minutes,
        v_exception_minutes,
        v_committed_minutes,
        v_available_minutes';
  v_new_capacity_read text := '    select capacity.scheduled_minutes,
      capacity.committed_minutes,
      capacity.available_minutes
      into
        v_scheduled_minutes,
        v_committed_minutes,
        v_available_minutes';
begin
  select pg_get_functiondef(
    'public.private_therapist_finance_advanced_dashboard_payload_v1(uuid,public.therapist_plan,date,date,text)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, chr(13), '');
  v_updated_definition := replace(
    v_definition,
    '  v_window_starts_at timestamptz;
  v_window_ends_at timestamptz;
',
    ''
  );
  v_updated_definition := replace(
    v_updated_definition,
    '  v_exception_minutes integer := 0;
',
    ''
  );
  v_updated_definition := replace(
    v_updated_definition,
    v_old_capacity_read,
    v_new_capacity_read
  );
  v_updated_definition := replace(
    v_updated_definition,
    '  end if;  v_primary_duration_minutes',
    '  end if;

  v_primary_duration_minutes'
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
