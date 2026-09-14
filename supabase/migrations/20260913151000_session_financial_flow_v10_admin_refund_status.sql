-- Product-only administrative read surface. Provider identifiers and internal
-- decision fields are intentionally not exposed to the browser.
create or replace function public.admin_get_full_session_refund_status_v10(
  p_session_payment_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_decision public.session_refund_decisions_v10%rowtype;
  v_job public.session_transfer_jobs%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
      and auth_deleted_at is null and anonymized_at is null
  ) then raise exception 'ADMIN_REFUND_FORBIDDEN' using errcode = '42501'; end if;
  select * into v_payment from public.session_payments
  where id = p_session_payment_id;
  if not found then return jsonb_build_object('available', false, 'state', 'not_found'); end if;
  select * into v_decision from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if found then
    return jsonb_build_object('available', false, 'state',
      case when v_payment.financial_status = 'refunded' then 'refunded'
           else 'in_review' end);
  end if;
  select * into v_job from public.session_transfer_jobs
  where session_payment_id = p_session_payment_id;
  return jsonb_build_object(
    'available', v_payment.payment_flow_version = 'v10'
      and v_payment.financial_status = 'paid'
      and v_payment.stripe_charge_id is not null
      and v_payment.disputed_at is null
      and v_payment.admin_blocked_at is null
      and not v_payment.refund_pending
      and not exists (select 1 from public.session_refunds
        where session_payment_id = p_session_payment_id)
      and (v_job.id is null or (
        v_job.status in ('queued','transferred','offset_only','reversed')
        and (v_job.prepared_at is null or v_job.status <> 'queued')
      )),
    'state', case
      when v_payment.financial_status = 'refunded' then 'refunded'
      when v_payment.payment_flow_version <> 'v10' then 'other_flow'
      else 'unavailable' end
  );
end;
$$;
revoke all on function public.admin_get_full_session_refund_status_v10(uuid)
  from public, anon;
grant execute on function public.admin_get_full_session_refund_status_v10(uuid)
  to authenticated;
