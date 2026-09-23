begin;

-- Receipts V3 intentionally describes the charge lifecycle. Keep that contract
-- stable and add the independent payout outcome required by the therapist UI.
-- A successful charge can be fully consumed by a debt offset and therefore
-- have no amount on its way to the therapist bank.
create or replace function public.get_private_therapist_receipts_v4(
  p_period_start date default null,
  p_period_end date default null,
  p_status text default null,
  p_therapy_id uuid default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_items jsonb;
begin
  v_payload := public.get_private_therapist_receipts_v3(
    p_period_start,
    p_period_end,
    p_status,
    p_therapy_id,
    p_search,
    p_page,
    p_page_size,
    p_timezone
  );

  select coalesce(
    jsonb_agg(
      item || jsonb_build_object(
        'receiptStatus',
        public.private_therapist_receipt_status_v2(
          (item ->> 'sessionPaymentId')::uuid
        )
      ) order by ordinal
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb))
    with ordinality as rows(item, ordinal);

  v_payload := jsonb_set(v_payload, '{items}', v_items, true);
  return jsonb_set(v_payload, '{contractVersion}', '4'::jsonb, true);
end;
$$;

revoke all on function public.get_private_therapist_receipts_v4(
  date, date, text, uuid, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_receipts_v4(
  date, date, text, uuid, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_receipts_v4(
  date, date, text, uuid, text, integer, integer, text
) is 'Recebimentos V4: preserva o estado da cobranca e inclui o resultado canonico do repasse, inclusive compensacao integral sem deposito bancario.';

commit;
