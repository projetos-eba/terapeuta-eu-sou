-- Admin finance read models.
--
-- The admin shell needs horizontal visibility over payments and subscriptions,
-- but it must not query financial tables directly or expose Stripe payloads,
-- URLs, external object ids or raw metadata to the browser.

create or replace function public.admin_get_finance_module_v1(
  p_module text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_metrics jsonb;
  v_rows jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  case p_module
    when 'payments' then
      select jsonb_build_object(
        'pending-session-payments', count(*) filter (
          where session_payments.financial_status in (
            'pending'::public.session_financial_status,
            'processing'::public.session_financial_status
          )
        )::integer,
        'paid-session-payments', count(*) filter (
          where session_payments.financial_status in (
            'paid'::public.session_financial_status,
            'partially_refunded'::public.session_financial_status
          )
        )::integer,
        'failed-session-payments', count(*) filter (
          where session_payments.financial_status in (
            'failed'::public.session_financial_status,
            'canceled'::public.session_financial_status
          )
        )::integer,
        'pending-refunds', (
          select count(*)::integer
          from public.session_refunds
          where session_refunds.status = 'pending'
        ),
        'open-disputes', (
          select count(*)::integer
          from public.session_disputes
          where session_disputes.closed_at is null
        ),
        'open-payout-batches', (
          select count(*)::integer
          from public.payout_batches
          where payout_batches.status in (
            'draft'::public.payout_batch_status,
            'open'::public.payout_batch_status,
            'processing'::public.payout_batch_status,
            'partially_failed'::public.payout_batch_status
          )
        ),
        'ledger-entries', (
          select count(*)::integer
          from public.financial_ledger_entries
        ),
        'stripe-transfers', (
          select count(*)::integer
          from public.stripe_transfers
        )
      )
      into v_metrics
      from public.session_payments;

      select coalesce(jsonb_agg(row_payload order by updated_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          session_payments.updated_at,
          jsonb_build_object(
            'id', session_payments.id,
            'booking_id', session_payments.booking_id,
            'therapist_profile_id', session_payments.therapist_profile_id,
            'therapist_name', therapist_profiles.public_name,
            'patient_profile_id', session_payments.patient_profile_id,
            'patient_name', patient_profiles.display_name,
            'service_title', bookings.service_title_snapshot,
            'starts_at', bookings.starts_at,
            'financial_status', session_payments.financial_status,
            'service_status', session_payments.service_status,
            'transfer_status', session_payments.transfer_status,
            'gross_amount_cents', session_payments.gross_amount_cents,
            'therapist_amount_cents', session_payments.therapist_amount_cents,
            'platform_gross_commission_cents',
              session_payments.platform_gross_commission_cents,
            'currency', session_payments.currency,
            'refund_pending', session_payments.refund_pending,
            'refund_count', coalesce(refund_summary.refund_count, 0),
            'refunded_amount_cents',
              coalesce(refund_summary.refunded_amount_cents, 0),
            'dispute_count', coalesce(dispute_summary.dispute_count, 0),
            'transfer_count', coalesce(transfer_summary.transfer_count, 0),
            'latest_transfer_status', transfer_summary.latest_transfer_status,
            'ledger_entry_count', coalesce(ledger_summary.ledger_entry_count, 0),
            'disputed_at', session_payments.disputed_at,
            'paid_at', session_payments.paid_at,
            'created_at', session_payments.created_at,
            'updated_at', session_payments.updated_at
          ) as row_payload
        from public.session_payments
        left join public.bookings
          on bookings.id = session_payments.booking_id
        left join public.therapist_profiles
          on therapist_profiles.id = session_payments.therapist_profile_id
        left join public.patient_profiles
          on patient_profiles.id = session_payments.patient_profile_id
        left join lateral (
          select
            count(*)::integer as refund_count,
            coalesce(sum(session_refunds.amount_cents), 0)::integer
              as refunded_amount_cents
          from public.session_refunds
          where session_refunds.session_payment_id = session_payments.id
        ) refund_summary on true
        left join lateral (
          select count(*)::integer as dispute_count
          from public.session_disputes
          where session_disputes.session_payment_id = session_payments.id
        ) dispute_summary on true
        left join lateral (
          select
            count(*)::integer as transfer_count,
            (
              array_agg(stripe_transfers.status order by stripe_transfers.created_at desc)
            )[1] as latest_transfer_status
          from public.stripe_transfers
          where stripe_transfers.session_payment_id = session_payments.id
        ) transfer_summary on true
        left join lateral (
          select count(*)::integer as ledger_entry_count
          from public.financial_ledger_entries
          where financial_ledger_entries.session_payment_id = session_payments.id
        ) ledger_summary on true
        order by session_payments.updated_at desc
        limit v_limit offset v_offset
      ) rows;

    when 'subscriptions' then
      select jsonb_build_object(
        'active-subscriptions', count(*) filter (
          where therapist_subscriptions.status in (
            'trialing'::public.billing_subscription_status,
            'active'::public.billing_subscription_status
          )
        )::integer,
        'attention-subscriptions', count(*) filter (
          where therapist_subscriptions.status in (
            'past_due'::public.billing_subscription_status,
            'unpaid'::public.billing_subscription_status,
            'incomplete'::public.billing_subscription_status
          )
        )::integer,
        'ending-subscriptions', count(*) filter (
          where therapist_subscriptions.cancel_at_period_end is true
        )::integer,
        'failed-invoices', (
          select count(*)::integer
          from public.billing_invoices
          where billing_invoices.status in ('open', 'uncollectible', 'void')
        ),
        'active-prices', (
          select count(*)::integer
          from public.billing_plan_prices
          where billing_plan_prices.is_active is true
        ),
        'stripe-customers', (
          select count(*)::integer
          from public.stripe_customers
          where stripe_customers.role = 'therapist'::public.user_role
        )
      )
      into v_metrics
      from public.therapist_subscriptions;

      select coalesce(jsonb_agg(row_payload order by updated_at desc), '[]'::jsonb)
      into v_rows
      from (
        select
          therapist_subscriptions.updated_at,
          jsonb_build_object(
            'id', therapist_subscriptions.id,
            'therapist_profile_id',
              therapist_subscriptions.therapist_profile_id,
            'therapist_name', therapist_profiles.public_name,
            'therapist_current_plan', therapist_profiles.plan,
            'plan_code', therapist_subscriptions.plan_code,
            'plan_name', billing_plans.name,
            'status', therapist_subscriptions.status,
            'current_period_start',
              therapist_subscriptions.current_period_start,
            'current_period_end', therapist_subscriptions.current_period_end,
            'cancel_at_period_end',
              therapist_subscriptions.cancel_at_period_end,
            'canceled_at', therapist_subscriptions.canceled_at,
            'ended_at', therapist_subscriptions.ended_at,
            'unit_amount_cents', billing_plan_prices.unit_amount_cents,
            'currency', billing_plan_prices.currency,
            'interval', billing_plan_prices.interval,
            'customer_linked', stripe_customers.id is not null,
            'customer_environment', stripe_customers.environment,
            'customer_livemode', stripe_customers.livemode,
            'invoice_count', coalesce(invoice_summary.invoice_count, 0),
            'latest_invoice_status',
              invoice_summary.latest_invoice_status,
            'event_count', coalesce(event_summary.event_count, 0),
            'created_at', therapist_subscriptions.created_at,
            'updated_at', therapist_subscriptions.updated_at
          ) as row_payload
        from public.therapist_subscriptions
        left join public.therapist_profiles
          on therapist_profiles.id =
            therapist_subscriptions.therapist_profile_id
        left join public.billing_plans
          on billing_plans.id = therapist_subscriptions.billing_plan_id
        left join public.billing_plan_prices
          on billing_plan_prices.id =
            therapist_subscriptions.billing_plan_price_id
        left join public.stripe_customers
          on stripe_customers.id = therapist_subscriptions.stripe_customer_id
        left join lateral (
          select
            count(*)::integer as invoice_count,
            (
              array_agg(billing_invoices.status order by billing_invoices.created_at desc)
            )[1] as latest_invoice_status
          from public.billing_invoices
          where billing_invoices.therapist_subscription_id =
            therapist_subscriptions.id
        ) invoice_summary on true
        left join lateral (
          select count(*)::integer as event_count
          from public.therapist_subscription_events
          where therapist_subscription_events.therapist_subscription_id =
            therapist_subscriptions.id
        ) event_summary on true
        order by therapist_subscriptions.updated_at desc
        limit v_limit offset v_offset
      ) rows;

    else
      raise exception 'unsupported admin finance module: %', p_module
        using errcode = '22023';
  end case;

  return jsonb_build_object(
    'generatedAt', now(),
    'metrics', coalesce(v_metrics, '{}'::jsonb),
    'module', p_module,
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

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
  v_actor_id uuid := auth.uid();
  v_events jsonb := '[]'::jsonb;
  v_record jsonb;
begin
  if v_actor_id is null then
    raise exception 'admin authentication required'
      using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'admin finance detail id required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor_id
      and profiles.role = 'admin'::public.user_role
      and profiles.auth_deleted_at is null
      and profiles.anonymized_at is null
  ) then
    raise exception 'admin permission required'
      using errcode = '42501';
  end if;

  case p_module
    when 'payments' then
      select jsonb_build_object(
        'id', session_payments.id,
        'booking_id', session_payments.booking_id,
        'therapist_profile_id', session_payments.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'patient_profile_id', session_payments.patient_profile_id,
        'patient_name', patient_profiles.display_name,
        'service_id', session_payments.service_id,
        'service_title', bookings.service_title_snapshot,
        'starts_at', bookings.starts_at,
        'ends_at', bookings.ends_at,
        'financial_status', session_payments.financial_status,
        'service_status', session_payments.service_status,
        'transfer_status', session_payments.transfer_status,
        'service_confirmed_at', session_payments.service_confirmed_at,
        'service_confirmation_source',
          session_payments.service_confirmation_source,
        'eligible_at', session_payments.eligible_at,
        'transfer_blocked_reason',
          session_payments.transfer_blocked_reason,
        'refund_pending', session_payments.refund_pending,
        'disputed_at', session_payments.disputed_at,
        'internal_contested_at', session_payments.internal_contested_at,
        'admin_blocked_at', session_payments.admin_blocked_at,
        'paid_at', session_payments.paid_at,
        'failed_at', session_payments.failed_at,
        'canceled_at', session_payments.canceled_at,
        'gross_amount_cents', session_payments.gross_amount_cents,
        'therapist_amount_cents', session_payments.therapist_amount_cents,
        'platform_gross_commission_cents',
          session_payments.platform_gross_commission_cents,
        'stripe_fee_amount_cents',
          session_payments.stripe_fee_amount_cents,
        'stripe_net_amount_cents',
          session_payments.stripe_net_amount_cents,
        'currency', session_payments.currency,
        'has_checkout_session',
          session_payments.stripe_checkout_session_id is not null,
        'has_payment_intent',
          session_payments.stripe_payment_intent_id is not null,
        'has_charge', session_payments.stripe_charge_id is not null,
        'has_balance_transaction',
          session_payments.stripe_balance_transaction_id is not null,
        'stripe_event_created_at',
          session_payments.stripe_event_created_at,
        'metadata_present',
          coalesce(session_payments.metadata, '{}'::jsonb) <> '{}'::jsonb,
        'attempt_count', coalesce(attempt_summary.attempt_count, 0),
        'latest_attempt_status',
          attempt_summary.latest_attempt_status,
        'refund_count', coalesce(refund_summary.refund_count, 0),
        'refunded_amount_cents',
          coalesce(refund_summary.refunded_amount_cents, 0),
        'dispute_count', coalesce(dispute_summary.dispute_count, 0),
        'transfer_count', coalesce(transfer_summary.transfer_count, 0),
        'ledger_entry_count', coalesce(ledger_summary.ledger_entry_count, 0),
        'created_at', session_payments.created_at,
        'updated_at', session_payments.updated_at
      )
      into v_record
      from public.session_payments
      left join public.bookings
        on bookings.id = session_payments.booking_id
      left join public.therapist_profiles
        on therapist_profiles.id = session_payments.therapist_profile_id
      left join public.patient_profiles
        on patient_profiles.id = session_payments.patient_profile_id
      left join lateral (
        select
          count(*)::integer as attempt_count,
          (
            array_agg(session_payment_attempts.status order by session_payment_attempts.created_at desc)
          )[1] as latest_attempt_status
        from public.session_payment_attempts
        where session_payment_attempts.session_payment_id =
          session_payments.id
      ) attempt_summary on true
      left join lateral (
        select
          count(*)::integer as refund_count,
          coalesce(sum(session_refunds.amount_cents), 0)::integer
            as refunded_amount_cents
        from public.session_refunds
        where session_refunds.session_payment_id = session_payments.id
      ) refund_summary on true
      left join lateral (
        select count(*)::integer as dispute_count
        from public.session_disputes
        where session_disputes.session_payment_id = session_payments.id
      ) dispute_summary on true
      left join lateral (
        select count(*)::integer as transfer_count
        from public.stripe_transfers
        where stripe_transfers.session_payment_id = session_payments.id
      ) transfer_summary on true
      left join lateral (
        select count(*)::integer as ledger_entry_count
        from public.financial_ledger_entries
        where financial_ledger_entries.session_payment_id = session_payments.id
      ) ledger_summary on true
      where session_payments.id = p_id;

      select coalesce(jsonb_agg(event_payload order by occurred_at desc), '[]'::jsonb)
      into v_events
      from (
        select
          financial_ledger_entries.occurred_at,
          jsonb_build_object(
            'id', financial_ledger_entries.id,
            'kind', 'ledger_entry',
            'entry_type', financial_ledger_entries.entry_type,
            'direction', financial_ledger_entries.direction,
            'amount_cents', financial_ledger_entries.amount_cents,
            'currency', financial_ledger_entries.currency,
            'source_table', financial_ledger_entries.source_table,
            'occurred_at', financial_ledger_entries.occurred_at,
            'recorded_at', financial_ledger_entries.recorded_at
          ) as event_payload
        from public.financial_ledger_entries
        where financial_ledger_entries.session_payment_id = p_id
        order by financial_ledger_entries.occurred_at desc
        limit 12
      ) events;

    when 'subscriptions' then
      select jsonb_build_object(
        'id', therapist_subscriptions.id,
        'therapist_profile_id',
          therapist_subscriptions.therapist_profile_id,
        'therapist_name', therapist_profiles.public_name,
        'therapist_current_plan', therapist_profiles.plan,
        'plan_code', therapist_subscriptions.plan_code,
        'plan_name', billing_plans.name,
        'status', therapist_subscriptions.status,
        'current_period_start',
          therapist_subscriptions.current_period_start,
        'current_period_end', therapist_subscriptions.current_period_end,
        'cancel_at_period_end',
          therapist_subscriptions.cancel_at_period_end,
        'canceled_at', therapist_subscriptions.canceled_at,
        'ended_at', therapist_subscriptions.ended_at,
        'unit_amount_cents', billing_plan_prices.unit_amount_cents,
        'currency', billing_plan_prices.currency,
        'interval', billing_plan_prices.interval,
        'customer_linked', stripe_customers.id is not null,
        'customer_environment', stripe_customers.environment,
        'customer_livemode', stripe_customers.livemode,
        'customer_email_present',
          nullif(btrim(coalesce(stripe_customers.email, '')), '') is not null,
        'has_subscription_reference',
          therapist_subscriptions.stripe_subscription_id is not null,
        'has_checkout_session',
          therapist_subscriptions.stripe_checkout_session_id is not null,
        'has_latest_invoice_reference',
          therapist_subscriptions.stripe_latest_invoice_id is not null,
        'stripe_event_created_at',
          therapist_subscriptions.stripe_event_created_at,
        'metadata_present',
          coalesce(therapist_subscriptions.metadata, '{}'::jsonb) <> '{}'::jsonb,
        'invoice_count', coalesce(invoice_summary.invoice_count, 0),
        'open_invoice_count', coalesce(invoice_summary.open_invoice_count, 0),
        'paid_invoice_count', coalesce(invoice_summary.paid_invoice_count, 0),
        'event_count', coalesce(event_summary.event_count, 0),
        'created_at', therapist_subscriptions.created_at,
        'updated_at', therapist_subscriptions.updated_at
      )
      into v_record
      from public.therapist_subscriptions
      left join public.therapist_profiles
        on therapist_profiles.id =
          therapist_subscriptions.therapist_profile_id
      left join public.billing_plans
        on billing_plans.id = therapist_subscriptions.billing_plan_id
      left join public.billing_plan_prices
        on billing_plan_prices.id =
          therapist_subscriptions.billing_plan_price_id
      left join public.stripe_customers
        on stripe_customers.id = therapist_subscriptions.stripe_customer_id
      left join lateral (
        select
          count(*)::integer as invoice_count,
          count(*) filter (where billing_invoices.status = 'open')::integer
            as open_invoice_count,
          count(*) filter (where billing_invoices.status = 'paid')::integer
            as paid_invoice_count
        from public.billing_invoices
        where billing_invoices.therapist_subscription_id =
          therapist_subscriptions.id
      ) invoice_summary on true
      left join lateral (
        select count(*)::integer as event_count
        from public.therapist_subscription_events
        where therapist_subscription_events.therapist_subscription_id =
          therapist_subscriptions.id
      ) event_summary on true
      where therapist_subscriptions.id = p_id;

      select coalesce(jsonb_agg(event_payload order by created_at desc), '[]'::jsonb)
      into v_events
      from (
        select
          billing_invoices.created_at,
          jsonb_build_object(
            'id', billing_invoices.id,
            'kind', 'invoice',
            'status', billing_invoices.status,
            'amount_due_cents', billing_invoices.amount_due_cents,
            'amount_paid_cents', billing_invoices.amount_paid_cents,
            'currency', billing_invoices.currency,
            'paid_at', billing_invoices.paid_at,
            'due_at', billing_invoices.due_at,
            'created_at', billing_invoices.created_at
          ) as event_payload
        from public.billing_invoices
        where billing_invoices.therapist_subscription_id = p_id
        union all
        select
          therapist_subscription_events.created_at,
          jsonb_build_object(
            'id', therapist_subscription_events.id,
            'kind', 'subscription_event',
            'event_type', therapist_subscription_events.event_type,
            'previous_plan', therapist_subscription_events.previous_plan,
            'next_plan', therapist_subscription_events.next_plan,
            'previous_status', therapist_subscription_events.previous_status,
            'next_status', therapist_subscription_events.next_status,
            'stripe_event_present',
              therapist_subscription_events.stripe_event_id is not null,
            'created_at', therapist_subscription_events.created_at
          ) as event_payload
        from public.therapist_subscription_events
        where therapist_subscription_events.therapist_subscription_id = p_id
        order by created_at desc
        limit 12
      ) events;

    else
      raise exception 'unsupported admin finance module: %', p_module
        using errcode = '22023';
  end case;

  if v_record is null then
    return jsonb_build_object(
      'events', '[]'::jsonb,
      'generatedAt', now(),
      'id', p_id,
      'module', p_module,
      'record', null
    );
  end if;

  return jsonb_build_object(
    'events', coalesce(v_events, '[]'::jsonb),
    'generatedAt', now(),
    'id', p_id,
    'module', p_module,
    'record', v_record
  );
end;
$$;

revoke all on function public.admin_get_finance_module_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_module_v1(text, integer, integer)
  to authenticated, service_role;

revoke all on function public.admin_get_finance_detail_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_finance_detail_v1(text, uuid)
  to authenticated, service_role;

comment on function public.admin_get_finance_module_v1(text, integer, integer) is
  'Minimized admin finance list read model. Validates auth.uid() as admin and never returns Stripe external object ids, raw metadata, invoice URLs or webhook payloads.';

comment on function public.admin_get_finance_detail_v1(text, uuid) is
  'Minimized admin finance detail read model for payments and subscriptions. Read-only by design; financial mutations require a separate audited command boundary.';
