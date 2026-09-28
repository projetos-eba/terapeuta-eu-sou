begin;

-- Extend the current read-only admin projection without changing payment,
-- refund, or status records. The preserved function remains responsible for
-- authorization, filtering, pagination, and every existing aggregate.
alter function public.admin_get_finance_module_v2(text, jsonb)
  rename to private_admin_finance_v2_before_completed_refunds_20260927;

revoke all on function
  public.private_admin_finance_v2_before_completed_refunds_20260927(
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
  v_period text := nullif(btrim(coalesce(p_query ->> 'period', '')), '');
  v_period_days integer := null;
  v_period_start timestamptz := null;
  v_completed_refunds_amount bigint := 0;
begin
  -- Delegate authorization and all existing finance behavior before reading
  -- the additional aggregate.
  v_payload := public.private_admin_finance_v2_before_completed_refunds_20260927(
    p_module,
    p_query
  );

  if p_module <> 'payments' then
    return v_payload;
  end if;

  case v_period
    when '7d' then v_period_days := 7;
    when '30d' then v_period_days := 30;
    when '90d' then v_period_days := 90;
    else v_period := null;
  end case;

  if v_period_days is not null then
    v_period_start := (
      (
        (now() at time zone 'America/Sao_Paulo')::date
        - (v_period_days - 1)
      )::timestamp at time zone 'America/Sao_Paulo'
    );
  end if;

  select coalesce(sum(refund.amount_cents), 0)::bigint
  into v_completed_refunds_amount
  from public.session_refunds as refund
  where refund.status = 'succeeded'
    and (
      v_period_start is null
      or coalesce(refund.processed_at, refund.updated_at, refund.created_at)
        >= v_period_start
    );

  return jsonb_set(
    v_payload,
    '{metrics}',
    coalesce(v_payload -> 'metrics', '{}'::jsonb)
      || jsonb_build_object(
        'completed-refunds-amount',
        v_completed_refunds_amount
      ),
    true
  );
end;
$$;

revoke all on function public.admin_get_finance_module_v2(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_finance_module_v2(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_finance_module_v2(text, jsonb) is
  'Read-only admin finance projection with sanitized, period-filtered payment and completed-refund aggregates.';

comment on function
  public.private_admin_finance_v2_before_completed_refunds_20260927(
    text,
    jsonb
  ) is
  'Private preserved admin finance projection used while adding the completed refund amount aggregate.';

commit;
