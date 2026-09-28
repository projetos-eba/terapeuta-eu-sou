begin;

-- Add subscription-specific dashboard data without changing the predecessor's
-- payment/report behaviour, authorization check, or public RPC signature.
alter function public.admin_get_finance_module_v2(text, jsonb)
  rename to private_admin_finance_v2_before_subscription_dashboard_20260927;

revoke all on function
  public.private_admin_finance_v2_before_subscription_dashboard_20260927(
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
  v_metrics jsonb := '{}'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := nullif(btrim(coalesce(p_query ->> 'sort', 'recent')), '');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_plan text := nullif(btrim(coalesce(p_query ->> 'plan', '')), '');
  v_period text := nullif(btrim(coalesce(p_query ->> 'period', '')), '');
  v_period_days integer := null;
  v_period_start timestamptz := null;
  v_total integer := 0;
begin
  -- The preserved function remains the authority for authentication and every
  -- pre-existing module. Only the subscriptions projection is extended here.
  v_payload := public.private_admin_finance_v2_before_subscription_dashboard_20260927(
    p_module,
    p_query
  );

  if p_module <> 'subscriptions' then
    return v_payload;
  end if;

  if v_page_text ~ '^[0-9]+$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;

  if v_page_size_text ~ '^[0-9]+$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;

  if v_plan not in ('free', 'premium', 'premium_plus') then
    v_plan := null;
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

  select jsonb_build_object(
    'paid-subscriptions', count(*) filter (
      where therapist_profiles.plan in (
        'premium'::public.therapist_plan,
        'premium_plus'::public.therapist_plan
      )
    )::integer,
    'free-therapists', count(*) filter (
      where therapist_profiles.plan = 'free'::public.therapist_plan
    )::integer,
    'premium-therapists', count(*) filter (
      where therapist_profiles.plan = 'premium'::public.therapist_plan
    )::integer,
    'premium-plus-therapists', count(*) filter (
      where therapist_profiles.plan = 'premium_plus'::public.therapist_plan
    )::integer,
    'canceled-subscriptions', (
      select count(*)::integer
      from public.therapist_subscriptions
      where status = 'canceled'::public.billing_subscription_status
    )
  )
  into v_metrics
  from public.therapist_profiles;

  with source_rows as (
    select
      therapist_subscriptions.id,
      therapist_subscriptions.updated_at,
      therapist_profiles.public_name as therapist_name,
      therapist_profiles.plan as therapist_current_plan,
      therapist_subscriptions.plan_code,
      therapist_subscriptions.status,
      therapist_subscriptions.current_period_start,
      therapist_subscriptions.current_period_end,
      therapist_subscriptions.cancel_at_period_end,
      therapist_subscriptions.canceled_at,
      therapist_subscriptions.ended_at,
      coalesce(invoice_summary.invoice_count, 0) as invoice_count,
      invoice_summary.latest_invoice_status,
      invoice_summary.latest_invoice_at
    from public.therapist_subscriptions
    left join public.therapist_profiles
      on therapist_profiles.id = therapist_subscriptions.therapist_profile_id
    left join lateral (
      select
        count(*)::integer as invoice_count,
        (
          array_agg(
            billing_invoices.status
            order by coalesce(
              billing_invoices.paid_at,
              billing_invoices.created_at
            ) desc
          )
        )[1] as latest_invoice_status,
        (
          array_agg(
            coalesce(billing_invoices.paid_at, billing_invoices.created_at)
            order by coalesce(
              billing_invoices.paid_at,
              billing_invoices.created_at
            ) desc
          )
        )[1] as latest_invoice_at
      from public.billing_invoices
      where billing_invoices.therapist_subscription_id =
        therapist_subscriptions.id
    ) invoice_summary on true
    where (v_plan is null or therapist_profiles.plan::text = v_plan)
      and (v_status is null or therapist_subscriptions.status::text = v_status)
      and (v_period_start is null or therapist_subscriptions.updated_at >= v_period_start)
      and (
        v_search is null
        or lower(concat_ws(' ',
          therapist_profiles.public_name,
          therapist_profiles.plan::text,
          therapist_subscriptions.plan_code::text,
          therapist_subscriptions.status::text
        )) like '%' || lower(v_search) || '%'
      )
  ), numbered_rows as (
    select
      source_rows.*,
      row_number() over (
        order by
          case when coalesce(v_sort, 'recent') = 'status'
            then source_rows.status::text end asc nulls last,
          case when coalesce(v_sort, 'recent') = 'oldest'
            then source_rows.updated_at end asc nulls last,
          source_rows.updated_at desc,
          source_rows.id asc
      )::integer as row_number
    from source_rows
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'therapist_name', therapist_name,
          'therapist_current_plan', therapist_current_plan,
          'plan_code', plan_code,
          'status', status,
          'current_period_start', current_period_start,
          'current_period_end', current_period_end,
          'cancel_at_period_end', cancel_at_period_end,
          'canceled_at', canceled_at,
          'ended_at', ended_at,
          'invoice_count', invoice_count,
          'latest_invoice_status', latest_invoice_status,
          'latest_invoice_at', latest_invoice_at,
          'updated_at', updated_at
        ) order by row_number
      ),
      '[]'::jsonb
    ),
    (select count(*)::integer from source_rows)
  into v_rows, v_total
  from numbered_rows
  where row_number > greatest((v_page - 1) * v_page_size, 0)
    and row_number <= greatest((v_page - 1) * v_page_size, 0) + v_page_size;

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object(
      'plan', v_plan,
      'period', v_period,
      'search', v_search,
      'sort', coalesce(v_sort, 'recent'),
      'status', v_status
    ),
    'generatedAt', coalesce(v_payload -> 'generatedAt', to_jsonb(now())),
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
  'Read-only admin finance projection with sanitized subscription dashboard metrics, plan/status/period filters and last billing dates.';

comment on function
  public.private_admin_finance_v2_before_subscription_dashboard_20260927(
    text,
    jsonb
  ) is
  'Private preserved admin finance projection used while adding subscription dashboard fields.';

commit;
