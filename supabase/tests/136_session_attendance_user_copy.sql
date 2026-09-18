begin;
select plan(5);

select ok(
  to_regprocedure('public.finalize_due_session_attendance_v1(timestamptz,integer)') is not null,
  'the attendance finalizer exists'
);
select ok(has_function_privilege(
  'service_role',
  'public.finalize_due_session_attendance_v1(timestamptz,integer)',
  'EXECUTE'
), 'the trusted worker can finalize attendance');
select ok(not has_function_privilege(
  'authenticated',
  'public.finalize_due_session_attendance_v1(timestamptz,integer)',
  'EXECUTE'
), 'the browser cannot finalize attendance directly');
select ok(position(
  'Sessão não realizada. Se precisar de ajuda, fale com o suporte.' in pg_get_functiondef(
    'public.finalize_due_session_attendance_v1(timestamptz,integer)'::regprocedure
  )
) > 0, 'future participant notifications use neutral support copy');
select ok(position(
  'decisão financeira exige autorização' in pg_get_functiondef(
    'public.finalize_due_session_attendance_v1(timestamptz,integer)'::regprocedure
  )
) = 0, 'future participant notifications omit internal financial workflow');

select * from finish();
rollback;
