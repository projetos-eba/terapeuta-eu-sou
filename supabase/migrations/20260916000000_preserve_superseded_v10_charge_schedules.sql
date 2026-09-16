-- A successful V10 charge can belong to a replacement schedule after a
-- pre-charge reschedule. Historical schedules are immutable terminal records
-- and must never be promoted to paid with the active schedule.
do $migration$
declare
  v_definition text;
  v_old_fragment text := $fragment$
  where session_payment_id = v_payment.id
    and status <> 'paid';$fragment$;
  v_new_fragment text := $fragment$
  where session_payment_id = v_payment.id
    and status not in ('paid', 'canceled', 'superseded');$fragment$;
  v_hits integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.confirm_session_payment_and_enqueue_transfer_v10(uuid,text,text,text,timestamptz,text,timestamptz)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'SESSION_PAYMENT_V10_CONFIRMATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  v_hits := (length(v_definition) - length(replace(v_definition, v_old_fragment, '')))
    / length(v_old_fragment);
  if v_hits <> 1 or position(v_new_fragment in v_definition) > 0 then
    raise exception 'SESSION_PAYMENT_V10_CONFIRMATION_SCHEMA_DRIFT'
      using errcode = 'P0001';
  end if;

  execute replace(v_definition, v_old_fragment, v_new_fragment);
end;
$migration$;

comment on function public.confirm_session_payment_and_enqueue_transfer_v10(
  uuid, text, text, text, timestamptz, text, timestamptz
) is 'Atomically records a confirmed V10 card payment and creates its direct Transfer outbox job. Superseded and canceled charge schedules remain immutable history.';
