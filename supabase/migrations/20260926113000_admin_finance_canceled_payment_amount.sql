begin;

-- Extend the current, sanitized finance read model instead of changing any
-- financial status or payment record. The preserved function remains the
-- authority for authorization, filtering, pagination and all existing data.
alter function public.admin_get_finance_module_v2(text, jsonb)
  rename to private_admin_finance_v2_before_canceled_amount_20260926;

revoke all on function
  public.private_admin_finance_v2_before_canceled_amount_20260926(
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
  v_canceled_payment_amount bigint := 0;
begin
  -- The existing projection performs the admin authorization check before
  -- this wrapper reads the aggregate. It also preserves every existing module.
  v_payload := public.private_admin_finance_v2_before_canceled_amount_20260926(
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

  select coalesce(sum(payment.gross_amount_cents), 0)::bigint
  into v_canceled_payment_amount
  from public.session_payments as payment
  where payment.financial_status = 'canceled'::public.session_financial_status
    and (
      v_period_start is null
      or coalesce(payment.paid_at, payment.updated_at, payment.created_at)
        >= v_period_start
    );

  return jsonb_set(
    v_payload,
    '{metrics}',
    coalesce(v_payload -> 'metrics', '{}'::jsonb)
      || jsonb_build_object(
        'canceled-payment-amount',
        v_canceled_payment_amount
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
  'Read-only admin finance projection with sanitized, period-filtered payment aggregates. Canceled and failed payment amounts remain separate.';

comment on function
  public.private_admin_finance_v2_before_canceled_amount_20260926(
    text,
    jsonb
  ) is
  'Private preserved admin finance projection used while adding the canceled payment amount aggregate.';

commit;
