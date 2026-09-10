begin;

create or replace function public.get_payout_transfer_liquidity_requirement_v1(
  p_payout_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_count integer;
  v_amount_cents integer;
begin
  if p_payout_batch_id is null then
    raise exception 'PAYOUT_LIQUIDITY_REQUIREMENT_INVALID';
  end if;

  if not exists (
    select 1 from public.payout_batches where id = p_payout_batch_id
  ) then
    raise exception 'PAYOUT_BATCH_NOT_FOUND';
  end if;

  select count(*)::integer, coalesce(sum(item.amount_cents), 0)::integer
  into v_item_count, v_amount_cents
  from public.payout_batch_items item
  left join public.stripe_transfers transfer
    on transfer.payout_batch_item_id = item.id
  where item.payout_batch_id = p_payout_batch_id
    and item.status in ('reserved', 'failed', 'transfer_pending')
    and (transfer.id is null or transfer.status <> 'transferred');

  return jsonb_build_object(
    'itemCount', v_item_count,
    'amountCents', v_amount_cents
  );
end;
$$;

comment on function public.get_payout_transfer_liquidity_requirement_v1(uuid) is
  'Returns the complete unresolved batch liability for a fail-before-claim Stripe platform balance check. It does not reserve or mutate funds.';

revoke all on function public.get_payout_transfer_liquidity_requirement_v1(uuid)
from public, anon, authenticated;
grant execute on function public.get_payout_transfer_liquidity_requirement_v1(uuid)
to service_role;

commit;
