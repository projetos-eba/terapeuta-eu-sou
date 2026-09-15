-- Keep an expired V10 Checkout retry recoverable across provider or network
-- failures between reopening the booking and persisting its replacement.

create or replace function public.begin_session_payment_retry_v10(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.session_payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_preflight jsonb;
  v_updated integer := 0;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id
  for update;

  if v_booking.id is null
    or v_payment.id is null
    or v_payment.payment_flow_version <> 'v10'
  then
    return jsonb_build_object('allowed', false, 'reason', 'booking_not_retryable');
  end if;

  select attempt.* into v_attempt
  from public.session_payment_attempts as attempt
  where attempt.session_payment_id = v_payment.id
    and attempt.stripe_checkout_session_id = v_payment.stripe_checkout_session_id
  order by attempt.created_at desc
  limit 1
  for update;

  -- The first invocation may have reopened the booking before Stripe or the
  -- following database write failed. Repeating the same operation is safe only
  -- while the current attempt is terminal and no charge authority exists.
  if v_booking.status = 'pending_payment'
    and v_booking.payment_status = 'pending'
    and v_booking.starts_at > now()
    and v_payment.financial_status = 'pending'
    and v_payment.stripe_payment_intent_id is null
    and v_payment.stripe_charge_id is null
    and v_attempt.id is not null
    and v_attempt.attempt_kind in ('initial_hold', 'payment_retry')
    and v_attempt.status in ('expired', 'failed', 'canceled', 'slot_conflict')
    and v_attempt.slot_claimed_at is null
    and not exists (
      select 1 from public.session_payment_setups as setup
      where setup.session_payment_id = v_payment.id
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    and not exists (
      select 1 from public.session_payment_schedules as schedule
      where schedule.session_payment_id = v_payment.id
        and schedule.status not in ('canceled', 'superseded')
    )
    and not exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    and not exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    return jsonb_build_object('allowed', true, 'reason', 'retry_already_started');
  end if;

  v_preflight := public.preflight_session_payment_retry_v1(p_booking_id);
  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;

  perform pg_catalog.set_config('tes.booking_reason', 'v10_checkout_retry', true);
  perform pg_catalog.set_config('tes.booking_source', 'payment_retry_claim', true);

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
  'Atomically starts or safely resumes a V10 replacement Checkout after a terminal unpaid attempt.';
