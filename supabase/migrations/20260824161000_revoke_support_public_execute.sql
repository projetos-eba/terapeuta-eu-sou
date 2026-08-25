-- Support RPCs use auth.uid() and are not anonymous public-catalog functions.
-- Their historical CREATE FUNCTION default left PUBLIC EXECUTE in place,
-- which caused the global authorization surface test to fail.

revoke execute on function public.create_support_ticket_with_attachments_v1(
  uuid, uuid, text, text, text, uuid, text, jsonb
) from public;
revoke execute on function public.send_support_ticket_requester_message_with_attachments_v1(
  uuid, uuid, text, jsonb
) from public;
revoke execute on function public.attach_support_ticket_requester_attachments_v1(
  uuid, uuid, jsonb
) from public;
revoke execute on function public.admin_reply_support_ticket_with_attachments_v1(
  uuid, uuid, text, jsonb
) from public;
revoke execute on function public.admin_get_support_ticket_thread_v2(uuid)
from public;

grant execute on function public.create_support_ticket_with_attachments_v1(
  uuid, uuid, text, text, text, uuid, text, jsonb
) to authenticated;
grant execute on function public.send_support_ticket_requester_message_with_attachments_v1(
  uuid, uuid, text, jsonb
) to authenticated;
grant execute on function public.attach_support_ticket_requester_attachments_v1(
  uuid, uuid, jsonb
) to authenticated;
grant execute on function public.admin_reply_support_ticket_with_attachments_v1(
  uuid, uuid, text, jsonb
) to authenticated;
grant execute on function public.admin_get_support_ticket_thread_v2(uuid)
to authenticated;
