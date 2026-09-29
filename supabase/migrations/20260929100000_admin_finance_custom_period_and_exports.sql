begin;

-- Keep the established V2 projection untouched for the fast preset periods.
-- Custom ranges use this additive read-only projection so start/end are
-- validated in PostgreSQL instead of trusting URL parameters from the browser.
create function public.admin_get_finance_module_range_v1(
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
  v_actor_id uuid := auth.uid();
  v_page integer := 1;
  v_page_size integer := 12;
  v_page_text text := coalesce(p_query ->> 'page', '');
  v_page_size_text text := coalesce(p_query ->> 'pageSize', '');
  v_search text := nullif(btrim(coalesce(p_query ->> 'search', '')), '');
  v_sort text := nullif(btrim(coalesce(p_query ->> 'sort', 'recent')), '');
  v_status text := nullif(btrim(coalesce(p_query ->> 'status', '')), '');
  v_plan text := nullif(btrim(coalesce(p_query ->> 'plan', '')), '');
  v_start_text text := nullif(btrim(coalesce(p_query ->> 'start', '')), '');
  v_end_text text := nullif(btrim(coalesce(p_query ->> 'end', '')), '');
  v_start_date date;
  v_end_date date;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_metrics jsonb := '{}'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  if p_module not in ('payments', 'subscriptions')
    or (p_query ->> 'period') is distinct from 'custom'
    or v_start_text !~ '^\\d{4}-\\d{2}-\\d{2}$'
    or v_end_text !~ '^\\d{4}-\\d{2}-\\d{2}$'
  then
    raise exception 'ADMIN_FINANCE_INVALID_CUSTOM_RANGE' using errcode = '22023';
  end if;

  begin
    v_start_date := v_start_text::date;
    v_end_date := v_end_text::date;
  exception when others then
    raise exception 'ADMIN_FINANCE_INVALID_CUSTOM_RANGE' using errcode = '22023';
  end;

  if v_start_date > v_end_date
    or v_end_date > (now() at time zone 'America/Sao_Paulo')::date
    or v_end_date > (v_start_date + interval '1 year')::date
  then
    raise exception 'ADMIN_FINANCE_INVALID_CUSTOM_RANGE' using errcode = '22023';
  end if;

  v_period_start := v_start_date::timestamp at time zone 'America/Sao_Paulo';
  v_period_end := (v_end_date + 1)::timestamp at time zone 'America/Sao_Paulo';

  if v_page_text ~ '^[0-9]+$' then
    v_page := greatest(v_page_text::integer, 1);
  end if;
  if v_page_size_text ~ '^[0-9]+$' then
    v_page_size := least(greatest(v_page_size_text::integer, 1), 50);
  end if;
  if coalesce(v_sort, 'recent') not in ('recent', 'oldest', 'status', 'amount') then
    v_sort := 'recent';
  end if;

  if p_module = 'payments' then
    select jsonb_build_object(
      'pending-session-payments', count(*) filter (
        where payment.financial_status in ('pending'::public.session_financial_status, 'processing'::public.session_financial_status)
      )::integer,
      'paid-session-payments', count(*) filter (
        where payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
      )::integer,
      'failed-session-payments', count(*) filter (
        where payment.financial_status = 'failed'::public.session_financial_status
      )::integer,
      'total-payments-amount', coalesce(sum(payment.gross_amount_cents), 0)::bigint,
      'gross-platform-commission-amount', coalesce(sum(payment.platform_gross_commission_cents) filter (
        where payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
      ), 0)::bigint,
      'stripe-fees-amount', coalesce(sum(coalesce(payment.stripe_fee_amount_cents, 0)) filter (
        where payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
      ), 0)::bigint,
      'net-platform-revenue-amount', coalesce(sum(
        payment.platform_gross_commission_cents - coalesce(payment.stripe_fee_amount_cents, 0)
      ) filter (
        where payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
      ), 0)::bigint,
      'canceled-payment-amount', coalesce(sum(payment.gross_amount_cents) filter (
        where payment.financial_status = 'canceled'::public.session_financial_status
      ), 0)::bigint,
      'pending-payment-amount', coalesce(sum(payment.gross_amount_cents) filter (
        where payment.financial_status in ('pending'::public.session_financial_status, 'processing'::public.session_financial_status)
      ), 0)::bigint,
      'confirmed-payment-amount', coalesce(sum(payment.gross_amount_cents) filter (
        where payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
      ), 0)::bigint,
      'failed-payment-amount', coalesce(sum(payment.gross_amount_cents) filter (
        where payment.financial_status = 'failed'::public.session_financial_status
      ), 0)::bigint,
      'pending-refunds-amount', (
        select coalesce(sum(refund.amount_cents), 0)::bigint
        from public.session_refunds as refund
        where refund.status = 'pending'
          and coalesce(refund.updated_at, refund.created_at) >= v_period_start
          and coalesce(refund.updated_at, refund.created_at) < v_period_end
      ),
      'completed-refunds-amount', (
        select coalesce(sum(refund.amount_cents), 0)::bigint
        from public.session_refunds as refund
        where refund.status = 'succeeded'
          and coalesce(refund.processed_at, refund.updated_at, refund.created_at) >= v_period_start
          and coalesce(refund.processed_at, refund.updated_at, refund.created_at) < v_period_end
      ),
      'therapist-change-refund-reviews', (
        select count(*)::integer
        from public.booking_reschedule_requests as request
        where request.status = 'pending_admin_review'
          and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
      ),
      'open-disputes', (
        select count(*)::integer from public.session_disputes as dispute where dispute.closed_at is null
      ),
      'open-payout-batches', (
        select count(*)::integer
        from public.payout_batches as batch
        where batch.status in ('draft'::public.payout_batch_status, 'open'::public.payout_batch_status, 'processing'::public.payout_batch_status, 'partially_failed'::public.payout_batch_status)
      ) + (
        select count(*)::integer
        from public.session_transfer_jobs as job
        join public.session_payments as payment
          on payment.id = job.session_payment_id
        left join public.stripe_transfers as transfer
          on transfer.id = job.stripe_transfer_id
        where payment.payment_flow_version = 'v10'
          and job.status in ('queued', 'creating', 'pending_source', 'transferred', 'reconciliation_required')
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
          )
      ),
      'ledger-entries', (select count(*)::integer from public.financial_ledger_entries),
      'stripe-transfers', (select count(*)::integer from public.stripe_transfers)
    ) into v_metrics
    from public.session_payments as payment
    where coalesce(payment.paid_at, payment.updated_at, payment.created_at) >= v_period_start
      and coalesce(payment.paid_at, payment.updated_at, payment.created_at) < v_period_end;

    with base_rows as (
      select
        payment.id as payment_id,
        payment.booking_id,
        payment.therapist_profile_id,
        therapist.public_name as therapist_name,
        payment.patient_profile_id,
        patient.display_name as patient_name,
        booking.service_title_snapshot as service_title,
        booking.status as booking_status,
        payment.financial_status,
        payment.service_status,
        payment.transfer_status,
        payment.gross_amount_cents,
        payment.therapist_amount_cents,
        payment.platform_gross_commission_cents,
        payment.stripe_fee_amount_cents,
        payment.currency,
        payment.refund_pending,
        payment.disputed_at,
        payment.paid_at,
        payment.created_at,
        payment.updated_at,
        coalesce(refund_summary.refund_count, 0) as refund_count,
        coalesce(refund_summary.refunded_amount_cents, 0) as refunded_amount_cents,
        coalesce(dispute_summary.dispute_count, 0) as dispute_count,
        coalesce(transfer_summary.transfer_count, 0) as transfer_count,
        transfer_summary.latest_transfer_status,
        coalesce(ledger_summary.ledger_entry_count, 0) as ledger_entry_count,
        case lower(coalesce(
          nullif(payment.metadata ->> 'paymentMethodType', ''),
          nullif(payment.metadata ->> 'payment_method_type', ''),
          nullif(payment.metadata #>> '{payment_method,type}', '')
        )) when 'card' then 'card' when 'card_present' then 'card_present' when 'pix' then 'pix' when 'boleto' then 'boleto' else null end as payment_method_type
      from public.session_payments as payment
      left join public.bookings as booking on booking.id = payment.booking_id
      left join public.therapist_profiles as therapist on therapist.id = payment.therapist_profile_id
      left join public.patient_profiles as patient on patient.id = payment.patient_profile_id
      left join lateral (
        select count(*)::integer as refund_count, coalesce(sum(refund.amount_cents), 0)::integer as refunded_amount_cents
        from public.session_refunds as refund where refund.session_payment_id = payment.id
      ) as refund_summary on true
      left join lateral (
        select count(*)::integer as dispute_count from public.session_disputes as dispute where dispute.session_payment_id = payment.id
      ) as dispute_summary on true
      left join lateral (
        select count(*)::integer as transfer_count, (array_agg(transfer.status order by transfer.created_at desc))[1] as latest_transfer_status
        from public.stripe_transfers as transfer where transfer.session_payment_id = payment.id
      ) as transfer_summary on true
      left join lateral (
        select count(*)::integer as ledger_entry_count from public.financial_ledger_entries as entry where entry.session_payment_id = payment.id
      ) as ledger_summary on true
      where coalesce(payment.paid_at, payment.updated_at, payment.created_at) >= v_period_start
        and coalesce(payment.paid_at, payment.updated_at, payment.created_at) < v_period_end
        and (v_search is null or lower(concat_ws(' ', payment.id::text, payment.booking_id::text, therapist.public_name, patient.display_name, booking.service_title_snapshot, payment.financial_status::text)) like '%' || lower(v_search) || '%')
        and (v_status is null or payment.financial_status::text = v_status)
    ), numbered_rows as (
      select base_rows.*, count(*) over ()::integer as total,
        row_number() over (order by
          case when v_sort = 'status' then financial_status::text end asc nulls last,
          case when v_sort = 'amount' then gross_amount_cents end desc nulls last,
          case when v_sort = 'oldest' then coalesce(paid_at, created_at) end asc nulls last,
          coalesce(paid_at, updated_at, created_at) desc, payment_id desc
        )::integer as row_number
      from base_rows
    ), page_rows as (
      select * from numbered_rows
      where row_number > greatest((v_page - 1) * v_page_size, 0)
        and row_number <= greatest((v_page - 1) * v_page_size, 0) + v_page_size
    )
    select coalesce(max(numbered_rows.total), 0), coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', page_rows.payment_id, 'booking_id', page_rows.booking_id,
        'therapist_profile_id', page_rows.therapist_profile_id, 'therapist_name', page_rows.therapist_name,
        'patient_profile_id', page_rows.patient_profile_id, 'patient_name', page_rows.patient_name,
        'service_title', page_rows.service_title, 'booking_status', page_rows.booking_status,
        'financial_status', page_rows.financial_status, 'service_status', page_rows.service_status,
        'transfer_status', page_rows.transfer_status, 'gross_amount_cents', page_rows.gross_amount_cents,
        'therapist_amount_cents', page_rows.therapist_amount_cents,
        'platform_gross_commission_cents', page_rows.platform_gross_commission_cents,
        'stripe_fee_amount_cents', page_rows.stripe_fee_amount_cents, 'currency', page_rows.currency,
        'payment_method_type', page_rows.payment_method_type, 'refund_pending', page_rows.refund_pending,
        'refund_count', page_rows.refund_count, 'refunded_amount_cents', page_rows.refunded_amount_cents,
        'dispute_count', page_rows.dispute_count, 'transfer_count', page_rows.transfer_count,
        'latest_transfer_status', page_rows.latest_transfer_status, 'ledger_entry_count', page_rows.ledger_entry_count,
        'disputed_at', page_rows.disputed_at, 'paid_at', page_rows.paid_at,
        'created_at', page_rows.created_at, 'updated_at', page_rows.updated_at
      )) || coalesce(public.private_admin_session_payout_projection_v10(page_rows.payment_id), '{}'::jsonb)
        || coalesce(public.private_admin_session_operational_projection_v1(page_rows.payment_id), '{}'::jsonb)
      order by page_rows.row_number
    ) filter (where page_rows.payment_id is not null), '[]'::jsonb)
    into v_total, v_rows
    from numbered_rows left join page_rows on page_rows.payment_id = numbered_rows.payment_id;

    return jsonb_build_object(
      'filtersApplied', jsonb_build_object('period', 'custom', 'start', v_start_text, 'end', v_end_text, 'search', v_search, 'sort', coalesce(v_sort, 'recent'), 'status', v_status),
      'generatedAt', now(), 'metrics', v_metrics, 'module', p_module,
      'page', jsonb_build_object('hasNext', (v_page * v_page_size) < v_total, 'page', v_page, 'pageSize', v_page_size, 'total', v_total),
      'rows', v_rows
    );
  end if;

  if v_plan not in ('free', 'premium', 'premium_plus') then
    v_plan := null;
  end if;

  select jsonb_build_object(
    'paid-subscriptions', count(*) filter (where therapist_profiles.plan in ('premium'::public.therapist_plan, 'premium_plus'::public.therapist_plan))::integer,
    'free-therapists', count(*) filter (where therapist_profiles.plan = 'free'::public.therapist_plan)::integer,
    'premium-therapists', count(*) filter (where therapist_profiles.plan = 'premium'::public.therapist_plan)::integer,
    'premium-plus-therapists', count(*) filter (where therapist_profiles.plan = 'premium_plus'::public.therapist_plan)::integer,
    'canceled-subscriptions', (select count(*)::integer from public.therapist_subscriptions where status = 'canceled'::public.billing_subscription_status)
  ) into v_metrics from public.therapist_profiles;

  with source_rows as (
    select
      subscription.id, subscription.updated_at, therapist.public_name as therapist_name,
      therapist.plan as therapist_current_plan, subscription.plan_code, subscription.status,
      subscription.current_period_start, subscription.current_period_end, subscription.cancel_at_period_end,
      subscription.canceled_at, subscription.ended_at,
      coalesce(invoice_summary.invoice_count, 0) as invoice_count,
      invoice_summary.latest_invoice_status, invoice_summary.latest_invoice_at
    from public.therapist_subscriptions as subscription
    left join public.therapist_profiles as therapist on therapist.id = subscription.therapist_profile_id
    left join lateral (
      select count(*)::integer as invoice_count,
        (array_agg(invoice.status order by coalesce(invoice.paid_at, invoice.created_at) desc))[1] as latest_invoice_status,
        (array_agg(coalesce(invoice.paid_at, invoice.created_at) order by coalesce(invoice.paid_at, invoice.created_at) desc))[1] as latest_invoice_at
      from public.billing_invoices as invoice where invoice.therapist_subscription_id = subscription.id
    ) as invoice_summary on true
    where (v_plan is null or therapist.plan::text = v_plan)
      and (v_status is null or subscription.status::text = v_status)
      and subscription.updated_at >= v_period_start and subscription.updated_at < v_period_end
      and (v_search is null or lower(concat_ws(' ', therapist.public_name, therapist.plan::text, subscription.plan_code::text, subscription.status::text)) like '%' || lower(v_search) || '%')
  ), numbered_rows as (
    select source_rows.*, row_number() over (order by
      case when coalesce(v_sort, 'recent') = 'status' then source_rows.status::text end asc nulls last,
      case when coalesce(v_sort, 'recent') = 'oldest' then source_rows.updated_at end asc nulls last,
      source_rows.updated_at desc, source_rows.id asc
    )::integer as row_number from source_rows
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'therapist_name', therapist_name, 'therapist_current_plan', therapist_current_plan,
    'plan_code', plan_code, 'status', status, 'current_period_start', current_period_start,
    'current_period_end', current_period_end, 'cancel_at_period_end', cancel_at_period_end,
    'canceled_at', canceled_at, 'ended_at', ended_at, 'invoice_count', invoice_count,
    'latest_invoice_status', latest_invoice_status, 'latest_invoice_at', latest_invoice_at,
    'updated_at', updated_at
  ) order by row_number), '[]'::jsonb), (select count(*)::integer from source_rows)
  into v_rows, v_total from numbered_rows
  where row_number > greatest((v_page - 1) * v_page_size, 0)
    and row_number <= greatest((v_page - 1) * v_page_size, 0) + v_page_size;

  return jsonb_build_object(
    'filtersApplied', jsonb_build_object('plan', v_plan, 'period', 'custom', 'start', v_start_text, 'end', v_end_text, 'search', v_search, 'sort', coalesce(v_sort, 'recent'), 'status', v_status),
    'generatedAt', now(), 'metrics', v_metrics, 'module', p_module,
    'page', jsonb_build_object('hasNext', (v_page * v_page_size) < v_total, 'page', v_page, 'pageSize', v_page_size, 'total', v_total),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.admin_get_finance_module_range_v1(text, jsonb)
  from public, anon;
grant execute on function public.admin_get_finance_module_range_v1(text, jsonb)
  to authenticated, service_role;

comment on function public.admin_get_finance_module_range_v1(text, jsonb) is
  'Read-only admin finance projection for validated custom date ranges of at most one calendar year, with sanitized payment and subscription fields.';

commit;
