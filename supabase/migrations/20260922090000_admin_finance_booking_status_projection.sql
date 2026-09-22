begin;

-- Attendance outcome belongs to the booking lifecycle. Keep it separate from
-- the immutable payment/service snapshot so Admin can describe a no-show
-- without changing any charge, Transfer, Payout, ledger or refund state.
create or replace function public.private_admin_session_operational_projection_v1(
  p_session_payment_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('booking_status', booking.status)
  from public.session_payments as payment
  join public.bookings as booking on booking.id = payment.booking_id
  where payment.id = p_session_payment_id;
$$;

revoke all on function public.private_admin_session_operational_projection_v1(uuid)
  from public, anon, authenticated;

create or replace function public.admin_get_finance_module_v2(
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
      || coalesce(public.private_admin_session_operational_projection_v1(
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
  from public.session_transfer_jobs as job
  join public.session_payments as payment
    on payment.id = job.session_payment_id
  left join public.stripe_transfers as transfer
    on transfer.id = job.stripe_transfer_id
  where payment.payment_flow_version = 'v10'
    and job.status in (
      'queued', 'creating', 'pending_source', 'transferred',
      'reconciliation_required'
    )
    and not exists (
      select 1
      from public.stripe_payout_transfer_allocations as allocation
      join public.stripe_payouts as payout
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

create or replace function public.admin_get_finance_detail_v1(
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
  ) || coalesce(
    public.private_admin_session_operational_projection_v1(p_id),
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

comment on function public.private_admin_session_operational_projection_v1(uuid) is
  'Private sanitized booking outcome for Admin finance presentation. It never mutates financial state.';
comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Paginated admin finance read model with separate sanitized operational and payout states.';
comment on function public.admin_get_finance_detail_v1(text, uuid) is
  'Admin finance detail with separate sanitized booking outcome and financial reconciliation state.';

commit;
