-- Reopen an expired V10 Checkout only through the trusted retry claim.
-- Incremental correction: 20260913130000 is already applied locally.

create or replace function public.begin_session_payment_retry_v10(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preflight jsonb;
  v_payment public.session_payments%rowtype;
  v_updated integer := 0;
begin
  v_preflight := public.preflight_session_payment_retry_v1(p_booking_id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;

  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id
  for update;

  if not found or v_payment.payment_flow_version <> 'v10' then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  perform pg_catalog.set_config(
    'tes.booking_reason',
    'v10_checkout_retry',
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_source',
    'payment_retry_claim',
    true
  );

  begin
    update public.bookings
    set status = 'pending_payment',
        payment_status = 'pending',
        cancellation_reason = null,
        cancelled_at = null,
        updated_at = now()
    where id = p_booking_id
      and status = 'cancelled_by_payment';
    get diagnostics v_updated = row_count;
  exception
    when exclusion_violation then
      perform pg_catalog.set_config('tes.booking_reason', '', true);
      perform pg_catalog.set_config('tes.booking_source', '', true);
      return jsonb_build_object('allowed', false, 'reason', 'slot_conflict');
  end;

  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);

  if v_updated <> 1 then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  update public.session_payments
  set financial_status = 'pending',
      failed_at = null,
      canceled_at = null,
      transfer_blocked_reason = null,
      updated_at = now()
  where id = v_payment.id;

  return jsonb_build_object('allowed', true, 'reason', 'retry_started');
end;
$$;

revoke all on function public.begin_session_payment_retry_v10(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_session_payment_retry_v10(uuid)
  to service_role;

comment on function public.begin_session_payment_retry_v10(uuid) is
  'Atomically reopens an available V10 booking after an expired or failed Checkout attempt.';
