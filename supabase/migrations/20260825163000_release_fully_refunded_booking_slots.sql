-- A full session refund is terminal for the associated booking. Keep the
-- booking visible for audit/calendar history, but release its occupied range
-- so the therapist can offer the time again.

create or replace function public.release_booking_after_full_refund_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_request_id text;
begin
  if new.financial_status <> 'refunded' then
    return new;
  end if;

  select *
    into v_booking
  from public.bookings
  where id = new.booking_id
  for update;

  if not found
    or v_booking.status not in (
      'pending_payment',
      'confirmed',
      'completed',
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'no_show_patient',
      'no_show_therapist'
    ) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );

  v_request_id := left(
    coalesce(
      nullif(trim(new.stripe_event_id), ''),
      'payment-refund:' || new.id::text
    ),
    200
  );

  perform pg_catalog.set_config(
    'tes.booking_reason',
    'session_payment_refunded',
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_source',
    'payment_state',
    true
  );
  perform pg_catalog.set_config(
    'tes.booking_request_id',
    v_request_id,
    true
  );

  update public.bookings
  set status = 'refunded',
      updated_at = now()
  where id = v_booking.id;

  perform public.sync_booking_video_session_from_agenda_v1(
    v_booking.id,
    'cancel',
    v_request_id
  );

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
  if new.status in ('cancelled_by_payment', 'refunded')
    and new.status is distinct from old.status
    and coalesce(pg_catalog.current_setting('tes.booking_source', true), '')
      <> 'payment_state' then
    raise exception 'PAYMENT_WORKFLOW_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists z95_release_booking_after_full_refund
  on public.session_payments;
create trigger z95_release_booking_after_full_refund
after insert or update of financial_status on public.session_payments
for each row execute function public.release_booking_after_full_refund_v1();

revoke all on function public.release_booking_after_full_refund_v1()
  from public, anon, authenticated;
grant execute on function public.release_booking_after_full_refund_v1()
  to service_role;

comment on function public.release_booking_after_full_refund_v1() is
  'Moves a booking to refunded after the canonical session payment is fully refunded, releasing availability while preserving audit history.';

comment on function public.guard_payment_owned_booking_status_v1() is
  'Restricts payment-owned booking states to trusted payment workflows.';

-- Reconcile historical full refunds that were projected only to
-- bookings.payment_status and therefore could still occupy the therapist slot.
update public.session_payments as payment
set financial_status = payment.financial_status
where payment.financial_status = 'refunded'
  and exists (
    select 1
    from public.bookings as booking
    where booking.id = payment.booking_id
      and booking.status in (
        'pending_payment',
        'confirmed',
        'completed',
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'no_show_patient',
        'no_show_therapist'
      )
  );
