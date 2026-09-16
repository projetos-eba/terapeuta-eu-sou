begin;

create function public.private_admin_session_payout_projection_v10(
  p_session_payment_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'payout_display_status', case
      when coalesce(open_debt.open_amount_cents, 0) > 0
        then 'compensation_pending'
      when job.status = 'reversed' or transfer.status = 'reversed'
        then 'reversed'
      when payment.financial_status = 'refunded'
        then 'refunded'
      when job.status = 'offset_only'
        then 'compensated'
      when job.status in ('partially_reversed', 'failed')
        or transfer.status = 'failed'
        then 'failed'
      when job.status = 'reconciliation_required'
        or transfer.status = 'reconciliation_required'
        then 'needs_review'
      when paid_payout.id is not null
        then 'paid'
      when job.status in ('pending_source', 'transferred')
        or transfer.status = 'transferred'
        then 'bank_pending'
      when job.status in ('queued', 'creating')
        then 'processing'
      else 'processing'
    end,
    'debt_offset_amount_cents', job.debt_offset_amount_cents,
    'transfer_effective_amount_cents', job.transfer_amount_cents,
    'bank_paid_at', paid_payout.paid_at
  ))
  from public.session_payments payment
  join public.session_transfer_jobs job
    on job.session_payment_id = payment.id
  left join public.stripe_transfers transfer
    on transfer.id = job.stripe_transfer_id
  left join lateral (
    select coalesce(sum(debt.open_amount_cents), 0)::integer
      as open_amount_cents
    from public.therapist_financial_debts debt
    where debt.session_payment_id = payment.id
      and debt.status = 'open'
      and debt.open_amount_cents > 0
  ) open_debt on true
  left join lateral (
    select payout.id, payout.paid_at
    from public.stripe_payout_transfer_allocations allocation
    join public.stripe_payouts payout
      on payout.id = allocation.stripe_payout_id
    where allocation.stripe_transfer_id = transfer.id
      and allocation.allocation_origin = 'session_direct'
      and allocation.amount_cents = transfer.amount_cents
      and payout.status = 'paid'
      and payout.provider_reconciliation_status = 'completed'
      and payout.allocation_status = 'completed'
    order by payout.paid_at desc nulls last, payout.id desc
    limit 1
  ) paid_payout on true
  where payment.id = p_session_payment_id
    and payment.payment_flow_version = 'v10';
$$;

revoke all on function public.private_admin_session_payout_projection_v10(uuid)
from public, anon, authenticated;

alter function public.admin_get_finance_module_v2(text, jsonb)
  rename to private_admin_get_finance_module_v2_v9_legacy;
revoke all on function public.private_admin_get_finance_module_v2_v9_legacy(
  text, jsonb
) from public, anon, authenticated;

create function public.admin_get_finance_module_v2(
  p_module text,
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_open_v9 integer := 0;
  v_open_v10 integer := 0;
begin
  v_payload := public.private_admin_get_finance_module_v2_v9_legacy(
    p_module,
    p_query
  );

  if p_module <> 'payments' then
    return v_payload;
  end if;

  select coalesce(jsonb_agg(
    row_payload
      || coalesce(public.private_admin_session_payout_projection_v10(
        case
          when row_payload ->> 'id' ~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (row_payload ->> 'id')::uuid
          else null
        end
      ), '{}'::jsonb)
    order by ordinal
  ), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_payload -> 'rows', '[]'::jsonb))
    with ordinality as rows(row_payload, ordinal);

  v_open_v9 := coalesce(
    (v_payload #>> '{metrics,open-payout-batches}')::integer,
    0
  );

  select count(*)::integer
  into v_open_v10
  from public.session_transfer_jobs job
  join public.session_payments payment
    on payment.id = job.session_payment_id
  left join public.stripe_transfers transfer
    on transfer.id = job.stripe_transfer_id
  where payment.payment_flow_version = 'v10'
    and job.status in (
      'queued', 'creating', 'pending_source', 'transferred',
      'reconciliation_required'
    )
    and not exists (
      select 1
      from public.stripe_payout_transfer_allocations allocation
      join public.stripe_payouts payout
        on payout.id = allocation.stripe_payout_id
      where allocation.stripe_transfer_id = transfer.id
        and allocation.allocation_origin = 'session_direct'
        and allocation.amount_cents = transfer.amount_cents
        and payout.status = 'paid'
        and payout.provider_reconciliation_status = 'completed'
        and payout.allocation_status = 'completed'
    );

  v_payload := jsonb_set(v_payload, '{rows}', v_rows, true);
  return jsonb_set(
    v_payload,
    '{metrics,open-payout-batches}',
    to_jsonb(v_open_v9 + v_open_v10),
    true
  );
end;
$$;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
from public, anon;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
to authenticated, service_role;

alter function public.admin_get_finance_detail_v1(text, uuid)
  rename to private_admin_get_finance_detail_v1_v9_legacy;
revoke all on function public.private_admin_get_finance_detail_v1_v9_legacy(
  text, uuid
) from public, anon, authenticated;

create function public.admin_get_finance_detail_v1(
  p_module text,
  p_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_projection jsonb;
begin
  v_payload := public.private_admin_get_finance_detail_v1_v9_legacy(
    p_module,
    p_id
  );

  if p_module <> 'payments' or v_payload -> 'record' = 'null'::jsonb then
    return v_payload;
  end if;

  v_projection := coalesce(
    public.private_admin_session_payout_projection_v10(p_id),
    '{}'::jsonb
  );

  return jsonb_set(
    v_payload,
    '{record}',
    coalesce(v_payload -> 'record', '{}'::jsonb) || v_projection,
    true
  );
end;
$$;

revoke all on function public.admin_get_finance_detail_v1(text, uuid)
from public, anon;
grant execute on function public.admin_get_finance_detail_v1(text, uuid)
to authenticated, service_role;

comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Paginated admin finance read model with sanitized V9/V10 payout states and no provider object identifiers.';
comment on function public.admin_get_finance_detail_v1(text, uuid) is
  'Admin finance detail with sanitized V10 bank, compensation and reconciliation projection.';

commit;
