begin;

create or replace function public.claim_payout_transfer_items_v1(
  p_payout_batch_id uuid,
  p_worker_id uuid,
  p_limit integer default 10,
  p_lease_minutes integer default 5,
  p_environment text default 'test'
)
returns table (
  transfer_id uuid,
  payout_batch_item_id uuid,
  session_payment_id uuid,
  booking_id uuid,
  therapist_profile_id uuid,
  connect_account_id uuid,
  stripe_account_id text,
  stripe_charge_id text,
  amount_cents integer,
  idempotency_key text,
  request_fingerprint text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_payout_batch_id is null or p_worker_id is null
    or p_limit < 1 or p_limit > 50
    or p_lease_minutes < 1 or p_lease_minutes > 30
    or p_environment not in ('test', 'live')
  then
    raise exception 'PAYOUT_TRANSFER_CLAIM_INVALID';
  end if;

  return query
  with candidates as materialized (
    select item.id
    from public.payout_batch_items item
    where item.payout_batch_id = p_payout_batch_id
      and item.status in ('reserved', 'failed')
      and (
        not exists (
          select 1
          from public.stripe_transfers existing
          where existing.payout_batch_item_id = item.id
        )
        or exists (
          select 1
          from public.stripe_transfers retryable
          where retryable.payout_batch_item_id = item.id
            and retryable.status in ('failed', 'reconciliation_required')
            and retryable.next_retry_at <= now()
            and retryable.attempt_count < 4
            and (
              retryable.lease_expires_at is null
              or retryable.lease_expires_at <= now()
            )
        )
      )
    order by item.created_at, item.id
    limit p_limit
    for update of item skip locked
  ), claimed_items as (
    update public.payout_batch_items item
    set status = 'transfer_pending',
        failure_code = null,
        failure_message = null,
        updated_at = now()
    from candidates
    where item.id = candidates.id
    returning item.*
  ), prepared as (
    insert into public.stripe_transfers (
      payout_batch_item_id, session_payment_id, therapist_profile_id,
      connect_account_id, idempotency_key, amount_cents, currency,
      status, stripe_source_charge_id, attempt_count, lease_owner,
      lease_expires_at, request_fingerprint, last_attempt_at
    )
    select
      item.id, item.session_payment_id, item.therapist_profile_id,
      account.id,
      'tes:' || p_environment || ':transfer:' || item.id::text || ':v1',
      item.amount_cents, 'BRL', 'pending', payment.stripe_charge_id, 1,
      p_worker_id, now() + make_interval(mins => p_lease_minutes),
      pg_catalog.encode(extensions.digest(
        pg_catalog.concat_ws('|', p_environment, item.id::text, item.amount_cents::text, 'BRL',
          account.stripe_account_id, payment.stripe_charge_id),
        'sha256'
      ), 'hex'),
      now()
    from claimed_items item
    join public.payout_batch_therapists therapist_group
      on therapist_group.id = item.payout_batch_therapist_id
      and therapist_group.payout_batch_id = item.payout_batch_id
      and therapist_group.therapist_profile_id = item.therapist_profile_id
    join public.session_payments payment
      on payment.id = item.session_payment_id
      and payment.booking_id = item.booking_id
      and payment.therapist_profile_id = item.therapist_profile_id
    join public.therapist_connect_accounts account
      on account.id = therapist_group.connect_account_id
      and account.therapist_profile_id = item.therapist_profile_id
    on conflict on constraint stripe_transfers_payout_batch_item_id_key do update
    set status = 'pending',
        attempt_count = public.stripe_transfers.attempt_count + 1,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        last_attempt_at = now(),
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where public.stripe_transfers.attempt_count < 4
      and public.stripe_transfers.status in ('failed', 'reconciliation_required')
      and public.stripe_transfers.request_fingerprint = excluded.request_fingerprint
    returning public.stripe_transfers.*
  )
  select
    transfer.id, item.id, item.session_payment_id, item.booking_id,
    item.therapist_profile_id, account.id, account.stripe_account_id,
    payment.stripe_charge_id, item.amount_cents, transfer.idempotency_key,
    transfer.request_fingerprint, transfer.attempt_count
  from prepared transfer
  join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
  join public.session_payments payment on payment.id = item.session_payment_id
  join public.therapist_connect_accounts account on account.id = transfer.connect_account_id;

  update public.session_payments payment
  set transfer_status = 'transfer_pending', updated_at = now()
  where exists (
    select 1 from public.payout_batch_items item
    join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
    where item.session_payment_id = payment.id
      and transfer.lease_owner = p_worker_id
      and transfer.status = 'pending'
  );

  update public.payout_batches
  set status = 'processing', updated_at = now()
  where id = p_payout_batch_id and status in ('open', 'partially_failed');
end;
$$;

comment on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text) is
  'Claims items using explicit missing-or-retryable intention predicates and the immutable Connect account frozen in the batch group.';

revoke all on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
  to service_role;

commit;
