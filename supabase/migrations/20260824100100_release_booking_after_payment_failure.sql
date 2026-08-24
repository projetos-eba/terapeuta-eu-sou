-- A failed or expired Stripe payment is terminal for an unpaid booking.
-- Keep the booking as an auditable record, but release its occupied interval
-- instead of leaving it in pending_payment indefinitely.

create or replace function public.is_booking_status_transition_allowed_v1(
  p_current public.booking_status,
  p_next public.booking_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_current
    when 'draft' then p_next in (
      'pending_payment',
      'cancelled_by_patient',
      'cancelled_by_payment'
    )
    when 'pending_payment' then p_next in (
      'confirmed',
      'cancelled_by_patient',
      'cancelled_by_payment',
      'refunded'
    )
    when 'confirmed' then p_next in (
      'completed',
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'no_show_patient',
      'no_show_therapist',
      'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'no_show_patient' then p_next = 'refunded'
    when 'no_show_therapist' then p_next = 'refunded'
    when 'cancelled_by_payment' then false
    when 'refunded' then false
    else false
  end;
$$;

create or replace function public.release_booking_after_payment_failure_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_reason text;
begin
  if new.financial_status not in ('failed', 'canceled')
    or old.financial_status is not distinct from new.financial_status then
    return new;
  end if;

  select *
    into v_booking
  from public.bookings
  where id = new.booking_id
  for update;

  if not found
    or v_booking.status not in ('draft', 'pending_payment')
    or v_booking.payment_status = 'paid' then
    return new;
  end if;

  v_reason := case new.financial_status
    when 'canceled' then 'stripe_checkout_not_completed'
    else 'stripe_payment_failed'
  end;

  perform pg_catalog.set_config('tes.booking_reason', v_reason, true);
  perform pg_catalog.set_config('tes.booking_source', 'payment_state', true);
  perform pg_catalog.set_config('tes.booking_request_id', coalesce(new.stripe_event_id, ''), true);

  update public.bookings
  set status = 'cancelled_by_payment',
      cancellation_reason = v_reason,
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where id = v_booking.id;

  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);

  return new;
end;
$$;

create or replace function public.guard_payment_owned_booking_status_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled_by_payment'
    and new.status is distinct from old.status
    and coalesce(pg_catalog.current_setting('tes.booking_source', true), '')
      <> 'payment_state' then
    raise exception 'PAYMENT_WORKFLOW_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists a15_guard_payment_owned_booking_status
  on public.bookings;
create trigger a15_guard_payment_owned_booking_status
before update of status on public.bookings
for each row execute function public.guard_payment_owned_booking_status_v1();

drop trigger if exists a90_release_booking_after_payment_failure
  on public.session_payments;
create trigger a90_release_booking_after_payment_failure
after update of financial_status on public.session_payments
for each row execute function public.release_booking_after_payment_failure_v1();

revoke all on function public.release_booking_after_payment_failure_v1()
  from public, anon, authenticated;
grant execute on function public.release_booking_after_payment_failure_v1()
  to service_role;
revoke all on function public.guard_payment_owned_booking_status_v1()
  from public, anon, authenticated;
grant execute on function public.guard_payment_owned_booking_status_v1()
  to service_role;

comment on function public.release_booking_after_payment_failure_v1() is
  'Atomically closes an unpaid booking after a definitive Stripe failure/cancellation; retries are no-ops.';
