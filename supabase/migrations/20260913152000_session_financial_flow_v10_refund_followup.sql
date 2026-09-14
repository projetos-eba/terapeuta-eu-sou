create or replace function public.admin_get_full_session_refund_followup_v10(
  p_session_payment_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_decision public.session_refund_decisions_v10%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
      and auth_deleted_at is null and anonymized_at is null
  ) then raise exception 'ADMIN_REFUND_FORBIDDEN' using errcode = '42501'; end if;
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'requestId', v_decision.request_id,
    'reason', v_decision.reason);
end;
$$;
revoke all on function public.admin_get_full_session_refund_followup_v10(uuid)
  from public, anon;
grant execute on function public.admin_get_full_session_refund_followup_v10(uuid)
  to authenticated;
