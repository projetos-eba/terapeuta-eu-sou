begin;

-- The legacy v2 envelope loaded only the 50 newest payment rows and applied
-- filters afterwards. Once HML exceeded that window, valid canceled payments
-- disappeared from the "Cancelados" filter even though their canonical state
-- remained correct. Keep the minimized v1 DTO as the source, but exhaust its
-- bounded pages before filtering and paginating the administrative read model.
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
  v_chunk jsonb;
  v_chunk_rows jsonb;
  v_all_rows jsonb := '[]'::jsonb;
  v_filtered jsonb;
  v_metrics jsonb := '{}'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_offset integer := 0;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := nullif(btrim(coalesce(p_query ->> 'sort', 'recent')), '');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_total integer := 0;
  v_open_v9 integer := 0;
  v_open_v10 integer := 0;
begin
  if p_module <> 'payments' then
    return public.private_admin_get_finance_module_v2_v9_legacy(
      p_module,
      p_query
    );
  end if;

  if v_page_text ~ '^[0-9]+$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;

  if v_page_size_text ~ '^[0-9]+$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  loop
    v_chunk := public.admin_get_finance_module_v1('payments', 50, v_offset);
    v_chunk_rows := coalesce(v_chunk -> 'rows', '[]'::jsonb);

    if v_offset = 0 then
      v_metrics := coalesce(v_chunk -> 'metrics', '{}'::jsonb);
    end if;

    v_all_rows := v_all_rows || v_chunk_rows;
    exit when jsonb_array_length(v_chunk_rows) < 50;

    v_offset := v_offset + 50;
    if v_offset > 10000 then
      raise exception 'admin finance payment read limit exceeded'
        using errcode = '54000';
    end if;
  end loop;

  v_filtered := public.admin_filter_jsonb_read_model_rows_v1(
    v_all_rows,
    v_search,
    v_status,
    coalesce(v_sort, 'recent'),
    v_page,
    v_page_size
  );
  v_total := coalesce((v_filtered ->> 'total')::integer, 0);

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
  from jsonb_array_elements(coalesce(v_filtered -> 'rows', '[]'::jsonb))
    with ordinality as rows(row_payload, ordinal);

  v_open_v9 := coalesce(
    (v_metrics ->> 'open-payout-batches')::integer,
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

  v_metrics := jsonb_set(
    v_metrics,
    '{open-payout-batches}',
    to_jsonb(v_open_v9 + v_open_v10),
    true
  );

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'search', v_search,
      'sort', coalesce(v_sort, 'recent'),
      'status', v_status
    ),
    'generatedAt', now(),
    'metrics', v_metrics,
    'module', p_module,
    'page', jsonb_build_object(
      'hasNext', (v_page * v_page_size) < v_total,
      'page', v_page,
      'pageSize', v_page_size,
      'total', v_total
    ),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Paginated admin finance read model. Payment filters cover the complete minimized dataset before pagination; operational and payout states remain separate.';

commit;
