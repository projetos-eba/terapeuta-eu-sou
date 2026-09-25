begin;

-- Preserve the complete finance read model introduced in the previous
-- migration and narrow only the semantically incorrect failure metric.
-- Canceled payments remain available in their own filter and rows.
alter function public.admin_get_finance_module_v2(text, jsonb)
  rename to private_admin_finance_v2_pre_failed_metric_20260924;

revoke all on function
  public.private_admin_finance_v2_pre_failed_metric_20260924(
    text,
    jsonb
  )
  from public, anon, authenticated, service_role;

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
  v_failed_count integer;
begin
  -- The preserved function remains the authorization and read-model source.
  v_payload :=
    public.private_admin_finance_v2_pre_failed_metric_20260924(
      p_module,
      p_query
    );

  if p_module <> 'payments' then
    return v_payload;
  end if;

  select count(*)::integer
  into v_failed_count
  from public.session_payments as payment
  where payment.financial_status = 'failed';

  return jsonb_set(
    v_payload,
    '{metrics,failed-session-payments}',
    to_jsonb(v_failed_count),
    true
  );
end;
$$;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Paginated admin finance read model. The failed payment metric counts only financial_status=failed; canceled payments remain separate and queryable.';

comment on function
  public.private_admin_finance_v2_pre_failed_metric_20260924(
    text,
    jsonb
  ) is
  'Private preserved implementation used by admin_get_finance_module_v2 after the 2026-09-24 failed-payment metric correction.';

commit;
