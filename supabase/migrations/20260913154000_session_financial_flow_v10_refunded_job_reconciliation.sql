-- Refunds must not create a new Transfer job. Existing jobs, however, still
-- need to accept provider reversal and payout reconciliation after a refund.
create or replace function public.validate_session_transfer_job_v10()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_payment public.session_payments%rowtype;
begin
  select * into v_payment from public.session_payments
  where id = new.session_payment_id;
  if not found
    or v_payment.payment_flow_version <> 'v10'
    or (v_payment.financial_status not in ('paid','partially_refunded')
      and not (tg_op = 'UPDATE' and
        v_payment.financial_status = 'refunded' and old.id = new.id))
    or v_payment.booking_id <> new.booking_id
    or v_payment.policy_version_id <> new.policy_version_id
    or v_payment.connect_account_id_snapshot <> new.connect_account_id
    or v_payment.stripe_charge_id <> new.stripe_source_charge_id
    or v_payment.therapist_amount_cents <> new.therapist_gross_amount_cents
  then raise exception 'SESSION_TRANSFER_JOB_V10_PAYMENT_MISMATCH'
    using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function public.validate_session_transfer_job_v10()
  from public, anon, authenticated;
