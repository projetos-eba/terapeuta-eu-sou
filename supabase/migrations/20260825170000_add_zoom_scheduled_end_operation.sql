begin;

alter type public.video_session_control_operation
  add value if not exists 'end_scheduled' before 'end_hard_timeout';

commit;
