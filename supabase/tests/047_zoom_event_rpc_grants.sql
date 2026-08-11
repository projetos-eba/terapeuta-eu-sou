begin;

select plan(8);

select ok(
  to_regprocedure(
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)'
  ) is not null,
  'legacy zoom event RPC exists'
);

select ok(
  to_regprocedure(
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)'
  ) is not null,
  'environment-aware zoom event RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute legacy zoom event RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute legacy zoom event RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'service role can execute legacy zoom event RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute environment-aware zoom event RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute environment-aware zoom event RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamp with time zone,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'service role can execute environment-aware zoom event RPC'
);

select * from finish();

rollback;
