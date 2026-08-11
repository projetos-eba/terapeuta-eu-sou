revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) from public, anon, authenticated;

revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;

grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;

comment on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) is
  'Legacy internal Zoom Video SDK webhook event projection. Restricted to service_role.';

comment on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  integer
) is
  'Environment-aware internal Zoom Video SDK webhook event projection. Restricted to service_role.';
