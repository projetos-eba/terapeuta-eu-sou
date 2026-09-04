-- Recover an initial checkout that consumed a booking hold but failed before a
-- Stripe Checkout/session_payment could be persisted. These commands remain
-- service-role only because they own a payment-controlled booking transition.

create or replace function public.cancel_unstarted_initial_checkout_v1(
  p_booking_id uuid,
  p_hold_id uuid,
  p_reason text default 'checkout_bootstrap_failed'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_hold public.booking_holds%rowtype;
  v_payment public.session_payments%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  select * into v_hold
  from public.booking_holds
  where id = p_hold_id
  for update;

  if v_booking.id is null
    or v_hold.id is null
    or v_hold.consumed_booking_id is distinct from v_booking.id then
    return jsonb_build_object('released', false, 'reason', 'not_found');
  end if;

  if v_booking.status not in ('draft', 'pending_payment') then
    return jsonb_build_object('released', false, 'reason', v_booking.status);
  end if;

  select * into v_payment
  from public.session_payments
  where booking_id = v_booking.id
  for update;

  if v_payment.id is not null
    and (
      v_payment.stripe_checkout_session_id is not null
      or v_payment.financial_status not in ('pending', 'failed', 'canceled')
    ) then
    return jsonb_build_object('released', false, 'reason', 'checkout_persisted');
  end if;

  if v_payment.id is not null and v_payment.financial_status = 'pending' then
    update public.session_payments
    set financial_status = 'canceled',
        canceled_at = coalesce(canceled_at, now()),
        metadata = metadata || jsonb_build_object(
          'initial_checkout_terminal_reason',
          left(coalesce(nullif(trim(p_reason), ''), 'checkout_bootstrap_failed'), 120)
        ),
        updated_at = now()
    where id = v_payment.id;
  else
    perform pg_catalog.set_config('tes.booking_source', 'payment_state', true);
    update public.bookings
    set status = 'cancelled_by_payment',
        payment_status = 'failed',
        cancellation_reason = left(
          coalesce(nullif(trim(p_reason), ''), 'checkout_bootstrap_failed'),
          500
        ),
        cancelled_at = coalesce(cancelled_at, now()),
        last_transition_at = now(),
        version = version + 1,
        updated_at = now()
    where id = v_booking.id;
  end if;

  update public.session_payment_attempts
  set status = 'failed',
      terminal_reason = left(
        coalesce(nullif(trim(p_reason), ''), 'checkout_bootstrap_failed'),
        120
      ),
      updated_at = now()
  where session_payment_id = v_payment.id
    and status in ('created', 'checkout_created', 'waiting_payment');

  return jsonb_build_object('released', true, 'reason', p_reason);
end;
$$;

create or replace function public.expire_due_initial_checkout_orphans_v1(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_result jsonb;
begin
  for v_candidate in
    select hold.id as hold_id, booking.id as booking_id
    from public.booking_holds as hold
    join public.bookings as booking
      on booking.id = hold.consumed_booking_id
    left join public.session_payments as payment
      on payment.booking_id = booking.id
    where hold.status = 'consumed'
      and hold.expires_at <= p_now
      and booking.status in ('draft', 'pending_payment')
      and (
        payment.id is null
        or (
          payment.stripe_checkout_session_id is null
          and payment.financial_status in ('pending', 'failed', 'canceled')
        )
      )
    order by hold.expires_at, hold.id
    for update of hold, booking skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    v_result := public.cancel_unstarted_initial_checkout_v1(
      v_candidate.booking_id,
      v_candidate.hold_id,
      'reservation_expired_before_checkout'
    );
    if coalesce((v_result ->> 'released')::boolean, false) then
      booking_id := v_candidate.booking_id;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.cancel_unstarted_initial_checkout_v1(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.expire_due_initial_checkout_orphans_v1(timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.cancel_unstarted_initial_checkout_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.expire_due_initial_checkout_orphans_v1(timestamptz, integer)
  to service_role;

comment on function public.cancel_unstarted_initial_checkout_v1(uuid, uuid, text)
is 'Releases only an unstarted initial checkout whose consumed hold never gained a persisted Stripe Checkout.';

comment on function public.expire_due_initial_checkout_orphans_v1(timestamptz, integer)
is 'Recovers expired consumed holds whose booking bootstrap stopped before a Stripe Checkout was persisted.';
