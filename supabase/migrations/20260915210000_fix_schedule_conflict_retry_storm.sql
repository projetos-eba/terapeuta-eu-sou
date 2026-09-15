-- Prevent optimistic-concurrency business conflicts from being classified as
-- PostgreSQL serialization failures. SQLSTATE 40001 is retryable at several
-- HTTP/connection layers and can turn a stale agenda request into a tight
-- retry loop. Keep the public error text unchanged so the API continues to
-- map it to the existing user-facing conflict response.
do $migration$
declare
  v_target text;
  v_oid oid;
  v_definition text;
  v_rewritten text;
  v_targets constant text[] := array[
    'public.transition_booking_status_v1(uuid,public.booking_status,uuid,text,text,integer,text)',
    'public.request_booking_reschedule_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text,integer,integer)',
    'public.resolve_booking_reschedule_v1(uuid,uuid,text,text,integer)',
    'public.save_therapist_schedule_v1(uuid,bigint,text,jsonb,jsonb,uuid)',
    'public.cancel_therapist_block_v1(uuid,uuid,uuid,text,bigint)',
    'public.apply_patient_booking_reschedule_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text,integer)',
    'public.swap_session_payment_checkout_v10(uuid,bigint,text,text,text,integer,integer,integer,text,text,text,text,text,integer,text)'
  ];
begin
  foreach v_target in array v_targets loop
    v_oid := to_regprocedure(v_target);
    if v_oid is null then
      raise exception 'schedule_conflict_function_missing:%', v_target
        using errcode = 'P0001';
    end if;

    v_definition := pg_get_functiondef(v_oid);
    if position('40001' in v_definition) = 0 then
      raise exception 'schedule_conflict_function_not_guarded:%', v_target
        using errcode = 'P0001';
    end if;

    v_rewritten := regexp_replace(
      v_definition,
      'errcode[[:space:]]*=[[:space:]]*''40001''',
      'errcode = ''P0001''',
      'gi'
    );

    if v_rewritten = v_definition then
      raise exception 'schedule_conflict_function_rewrite_failed:%', v_target
        using errcode = 'P0001';
    end if;

    execute v_rewritten;
  end loop;
end;
$migration$;
