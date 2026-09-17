begin;
select plan(6);

select ok(
  to_regprocedure('public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)') is not null,
  'the V10 therapist reschedule resolution RPC exists'
);
select ok((
  select prosecdef
  from pg_proc
  where oid = 'public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)'::regprocedure
), 'the resolution RPC remains security definer');
select ok(position(
  'SET search_path TO' in pg_get_functiondef(
    'public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)'::regprocedure
  )
) > 0, 'the resolution RPC fixes its search path');
select ok(has_function_privilege('service_role',
  'public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)',
  'EXECUTE'), 'the trusted worker can resolve a V10 therapist reschedule');
select ok(not has_function_privilege('authenticated',
  'public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)',
  'EXECUTE'), 'the browser cannot invoke the resolution RPC directly');
select ok(not has_function_privilege('anon',
  'public.resolve_therapist_booking_reschedule_v10(uuid,uuid,text,timestamptz,timestamptz,text,text,integer)',
  'EXECUTE'), 'anonymous callers cannot invoke the resolution RPC');

select * from finish();
rollback;
