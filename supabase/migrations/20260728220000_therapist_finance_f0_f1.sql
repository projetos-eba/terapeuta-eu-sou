create index if not exists session_payments_therapist_status_paid_idx
on public.session_payments (
  therapist_profile_id,
  financial_status,
  (coalesce(paid_at, created_at)) desc
);

create index if not exists session_payments_therapist_transfer_idx
on public.session_payments (
  therapist_profile_id,
  transfer_status,
  (coalesce(eligible_at, paid_at, created_at)) desc
);

create index if not exists session_refunds_payment_status_processed_idx
on public.session_refunds (
  session_payment_id,
  status,
  (coalesce(processed_at, created_at)) desc
);

create index if not exists session_disputes_payment_status_opened_idx
on public.session_disputes (
  session_payment_id,
  status,
  opened_at desc
);

create index if not exists payout_batch_items_therapist_batch_status_idx
on public.payout_batch_items (
  therapist_profile_id,
  payout_batch_id,
  status
);

create index if not exists stripe_transfers_therapist_status_transferred_idx
on public.stripe_transfers (
  therapist_profile_id,
  status,
  (coalesce(transferred_at, created_at)) desc
);

create or replace function public.get_private_therapist_financial_actor_v1()
returns public.therapist_profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_therapist public.therapist_profiles%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select therapist.*
    into v_therapist
  from public.therapist_profiles as therapist
  join public.profiles as profile
    on profile.id = therapist.user_id
  where therapist.user_id = v_actor_user_id
    and profile.role = 'therapist';

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_therapist.status in ('suspended', 'rejected') then
    raise exception 'PROFILE_LOCKED' using errcode = '42501';
  end if;

  return v_therapist;
end;
$$;

revoke all on function public.get_private_therapist_financial_actor_v1()
from public, anon, authenticated;

create or replace function public.normalize_private_therapist_finance_period_v1(
  p_period_start date default null,
  p_period_end date default null,
  p_timezone text default null
)
returns table (
  period_start date,
  period_end date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_period_start date;
  v_period_end date;
begin
  select name
    into v_timezone
  from pg_catalog.pg_timezone_names
  where name = coalesce(nullif(p_timezone, ''), 'America/Sao_Paulo')
  limit 1;

  if v_timezone is null then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_period_end := coalesce(p_period_end, (now() at time zone v_timezone)::date);
  v_period_start := coalesce(p_period_start, v_period_end - 30);

  if v_period_start > v_period_end
    or v_period_end - v_period_start > 366 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  period_start := v_period_start;
  period_end := v_period_end;
  starts_at := v_period_start::timestamp at time zone v_timezone;
  ends_at := (v_period_end + 1)::timestamp at time zone v_timezone;
  timezone := v_timezone;
  return next;
end;
$$;

revoke all on function public.normalize_private_therapist_finance_period_v1(
  date,
  date,
  text
) from public, anon, authenticated;

create or replace function public.private_therapist_finance_refunded_cents_v1(
  p_session_payment_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(refund.amount_cents), 0)::integer
  from public.session_refunds as refund
  where refund.session_payment_id = p_session_payment_id
    and refund.status = 'succeeded';
$$;

revoke all on function public.private_therapist_finance_refunded_cents_v1(uuid)
from public, anon, authenticated;

create or replace function public.get_private_therapist_financial_overview_v1(
  p_period_start date default null,
  p_period_end date default null,
  p_timezone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_gross_paid_cents integer := 0;
  v_tes_commission_cents integer := 0;
  v_refunded_to_customers_cents integer := 0;
  v_therapist_net_cents integer := 0;
  v_waiting_confirmation_cents integer := 0;
  v_waiting_safety_period_cents integer := 0;
  v_eligible_for_payout_cents integer := 0;
  v_payout_processing_cents integer := 0;
  v_transferred_cents integer := 0;
  v_blocked_cents integer := 0;
  v_disputed_cents integer := 0;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select *
    into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  select
    coalesce(sum(payment.gross_amount_cents), 0)::integer,
    coalesce(sum(payment.platform_gross_commission_cents), 0)::integer
    into v_gross_paid_cents, v_tes_commission_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and payment.financial_status in (
      'paid',
      'partially_refunded',
      'refunded',
      'disputed'
    )
    and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
    and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at;

  select coalesce(sum(refund.amount_cents), 0)::integer
    into v_refunded_to_customers_cents
  from public.session_refunds as refund
  join public.session_payments as payment
    on payment.id = refund.session_payment_id
  where payment.therapist_profile_id = v_therapist.id
    and refund.status = 'succeeded'
    and coalesce(refund.processed_at, refund.created_at) >= v_period.starts_at
    and coalesce(refund.processed_at, refund.created_at) < v_period.ends_at;

  v_therapist_net_cents :=
    v_gross_paid_cents
    - v_tes_commission_cents
    - v_refunded_to_customers_cents;

  select
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_confirmation'
    ), 0)::integer,
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_safety_period'
    ), 0)::integer,
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'eligible'
    ), 0)::integer,
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status in ('batched', 'transfer_pending')
    ), 0)::integer,
    coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'blocked'
    ), 0)::integer,
    coalesce(sum(payment.gross_amount_cents) filter (
      where payment.financial_status = 'disputed'
        or payment.disputed_at is not null
    ), 0)::integer
    into
      v_waiting_confirmation_cents,
      v_waiting_safety_period_cents,
      v_eligible_for_payout_cents,
      v_payout_processing_cents,
      v_blocked_cents,
      v_disputed_cents
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      >= v_period.starts_at
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      < v_period.ends_at;

  select coalesce(sum(transfer.amount_cents), 0)::integer
    into v_transferred_cents
  from public.stripe_transfers as transfer
  where transfer.therapist_profile_id = v_therapist.id
    and transfer.status = 'transferred'
    and coalesce(transfer.transferred_at, transfer.created_at) >= v_period.starts_at
    and coalesce(transfer.transferred_at, transfer.created_at) < v_period.ends_at;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'plan', v_therapist.plan,
    'grossPaidCents', v_gross_paid_cents,
    'tesCommissionCents', v_tes_commission_cents,
    'refundedToCustomersCents', v_refunded_to_customers_cents,
    'therapistNetCents', v_therapist_net_cents,
    'waitingConfirmationCents', v_waiting_confirmation_cents,
    'waitingSafetyPeriodCents', v_waiting_safety_period_cents,
    'eligibleForPayoutCents', v_eligible_for_payout_cents,
    'payoutProcessingCents', v_payout_processing_cents,
    'transferredCents', v_transferred_cents,
    'blockedCents', v_blocked_cents,
    'disputedCents', v_disputed_cents,
    'periodStart', v_period.period_start,
    'periodEnd', v_period.period_end,
    'timezone', v_period.timezone,
    'generatedAt', now()
  );
end;
$$;

create or replace function public.get_private_therapist_receipts_v1(
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_therapy_options jsonb := '[]'::jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if p_status is not null and p_status not in (
    'pending',
    'processing',
    'paid',
    'failed',
    'canceled',
    'partially_refunded',
    'refunded',
    'disputed'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;

  select *
    into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  with base as (
    select
      payment.id as session_payment_id,
      payment.booking_id,
      coalesce(patient.display_name, 'Paciente') as patient_display_name,
      coalesce(therapy.name, booking.service_title_snapshot, service.title)
        as therapy_name_snapshot,
      therapy.id as therapy_id,
      therapy.name as therapy_name,
      booking.starts_at as session_date,
      payment.gross_amount_cents,
      payment.platform_gross_commission_cents as tes_commission_cents,
      public.private_therapist_finance_refunded_cents_v1(payment.id)
        as refunded_amount_cents,
      payment.financial_status::text as financial_status,
      coalesce(
        nullif(payment.metadata ->> 'paymentMethodType', ''),
        nullif(payment.metadata ->> 'payment_method_type', ''),
        nullif(payment.metadata #>> '{payment_method,type}', '')
      ) as payment_method_type,
      coalesce(
        nullif(payment.metadata ->> 'paymentOrigin', ''),
        nullif(payment.metadata ->> 'payment_origin', ''),
        case
          when payment.stripe_checkout_session_id is not null
            then 'stripe_checkout'
          else 'unknown'
        end
      ) as payment_origin,
      receipt.receipt_url,
      (
        select dispute.status
        from public.session_disputes as dispute
        where dispute.session_payment_id = payment.id
        order by dispute.opened_at desc
        limit 1
      ) as dispute_status,
      payment.created_at
    from public.session_payments as payment
    join public.bookings as booking
      on booking.id = payment.booking_id
    left join public.patient_profiles as patient
      on patient.id = payment.patient_profile_id
    left join public.therapist_services as service
      on service.id = payment.service_id
    left join public.therapies as therapy
      on therapy.id = service.therapy_id
    left join public.booking_payment_receipts as receipt
      on receipt.booking_id = payment.booking_id
    where payment.therapist_profile_id = v_therapist.id
      and coalesce(payment.paid_at, payment.created_at) >= v_period.starts_at
      and coalesce(payment.paid_at, payment.created_at) < v_period.ends_at
      and (p_status is null or payment.financial_status::text = p_status)
      and (p_therapy_id is null or therapy.id = p_therapy_id)
      and (
        v_search is null
        or patient.display_name ilike '%' || v_search || '%'
        or therapy.name ilike '%' || v_search || '%'
        or booking.service_title_snapshot ilike '%' || v_search || '%'
      )
  ),
  counted as (
    select count(*)::integer as count from base
  ),
  paged as (
    select *
    from base
    order by coalesce(session_date, created_at) desc, session_payment_id desc
    limit v_page_size
    offset v_offset
  )
  select
    counted.count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sessionPaymentId', paged.session_payment_id,
          'bookingId', paged.booking_id,
          'patientDisplayName', paged.patient_display_name,
          'therapyNameSnapshot', paged.therapy_name_snapshot,
          'sessionDate', paged.session_date,
          'grossAmountCents', paged.gross_amount_cents,
          'tesCommissionCents', paged.tes_commission_cents,
          'refundedAmountCents', paged.refunded_amount_cents,
          'therapistNetAmountCents',
            paged.gross_amount_cents
            - paged.tes_commission_cents
            - paged.refunded_amount_cents,
          'financialStatus', paged.financial_status,
          'paymentMethodType', paged.payment_method_type,
          'paymentOrigin', paged.payment_origin,
          'receiptUrl', paged.receipt_url,
          'disputeStatus', paged.dispute_status,
          'createdAt', paged.created_at
        )
        order by coalesce(paged.session_date, paged.created_at) desc,
          paged.session_payment_id desc
      ) filter (where paged.session_payment_id is not null),
      '[]'::jsonb
    )
    into v_total_count, v_items
  from counted
  left join paged on true
  group by counted.count;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'therapyId', option_row.therapy_id,
        'name', option_row.therapy_name
      )
      order by option_row.therapy_name
    ),
    '[]'::jsonb
  )
    into v_therapy_options
  from (
    select distinct therapy.id as therapy_id, therapy.name as therapy_name
    from public.session_payments as payment
    join public.therapist_services as service
      on service.id = payment.service_id
    join public.therapies as therapy
      on therapy.id = service.therapy_id
    where payment.therapist_profile_id = v_therapist.id
  ) as option_row;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'items', v_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case
        when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer
      end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    'filters', jsonb_build_object(
      'status', p_status,
      'therapyId', p_therapy_id,
      'search', v_search,
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone
    ),
    'therapyOptions', v_therapy_options,
    'generatedAt', now()
  );
end;
$$;

create or replace function public.get_private_therapist_payouts_v1(
  p_period_start date default null,
  p_period_end date default null,
  p_status text default null,
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
  v_therapist public.therapist_profiles%rowtype;
  v_period record;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset integer;
  v_total_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  if p_status is not null and p_status not in (
    'waiting_confirmation',
    'waiting_safety_period',
    'eligible',
    'batched',
    'transfer_pending',
    'transferred',
    'blocked',
    'failed',
    'reversed'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_therapist := public.get_private_therapist_financial_actor_v1();
  v_offset := (v_page - 1) * v_page_size;

  select *
    into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    p_timezone
  );

  with batch_rows as (
    select
      batch.id as payout_batch_id,
      batch.reference_period_start as period_start,
      batch.reference_period_end as period_end,
      batch.cutoff_at as expected_transfer_at,
      max(transfer.transferred_at) as transferred_at,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer
        as tes_commission_cents,
      coalesce(sum(public.private_therapist_finance_refunded_cents_v1(payment.id)), 0)::integer
        as refunded_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_net_amount_cents,
      count(distinct item.session_payment_id)::integer as session_count,
      case
        when bool_or(transfer.status = 'reversed'
          or payment.transfer_status = 'reversed') then 'reversed'
        when bool_or(transfer.status = 'failed'
          or item.status = 'failed'
          or payment.transfer_status = 'failed') then 'failed'
        when bool_or(item.status = 'blocked'
          or payment.transfer_status = 'blocked') then 'blocked'
        when bool_and(item.status = 'transferred')
          or batch.status = 'completed' then 'transferred'
        when bool_or(item.status = 'transfer_pending'
          or transfer.status = 'pending')
          or batch.status = 'processing' then 'transfer_pending'
        else 'batched'
      end as transfer_status,
      max(item.failure_code) filter (
        where item.status = 'blocked' or payment.transfer_status = 'blocked'
      ) as blocked_reason,
      max(item.failure_code) filter (
        where item.status = 'failed'
          or transfer.status = 'failed'
          or payment.transfer_status = 'failed'
      ) as failed_reason
    from public.payout_batch_items as item
    join public.payout_batches as batch
      on batch.id = item.payout_batch_id
    join public.session_payments as payment
      on payment.id = item.session_payment_id
    left join public.stripe_transfers as transfer
      on transfer.payout_batch_item_id = item.id
    where item.therapist_profile_id = v_therapist.id
      and batch.reference_period_start >= v_period.period_start
      and batch.reference_period_start <= v_period.period_end
      and item.status <> 'removed'
    group by batch.id, batch.reference_period_start, batch.reference_period_end,
      batch.cutoff_at, batch.status
  ),
  filtered as (
    select *
    from batch_rows
    where p_status is null or transfer_status = p_status
  ),
  counted as (
    select count(*)::integer as count from filtered
  ),
  paged as (
    select *
    from filtered
    order by period_start desc, payout_batch_id desc
    limit v_page_size
    offset v_offset
  )
  select
    counted.count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'payoutBatchId', paged.payout_batch_id,
          'periodStart', paged.period_start,
          'periodEnd', paged.period_end,
          'grossAmountCents', paged.gross_amount_cents,
          'tesCommissionCents', paged.tes_commission_cents,
          'refundedAmountCents', paged.refunded_amount_cents,
          'therapistNetAmountCents', paged.therapist_net_amount_cents,
          'transferStatus', paged.transfer_status,
          'expectedTransferAt', paged.expected_transfer_at,
          'transferredAt', paged.transferred_at,
          'blockedReason', paged.blocked_reason,
          'failedReason', paged.failed_reason,
          'sessionCount', paged.session_count
        )
        order by paged.period_start desc, paged.payout_batch_id desc
      ) filter (where paged.payout_batch_id is not null),
      '[]'::jsonb
    )
    into v_total_count, v_items
  from counted
  left join paged on true
  group by counted.count;

  select jsonb_build_object(
    'eligibleForPayoutCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'eligible'
    ), 0)::integer,
    'waitingConfirmationCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_confirmation'
    ), 0)::integer,
    'waitingSafetyPeriodCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'waiting_safety_period'
    ), 0)::integer,
    'payoutProcessingCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status in ('batched', 'transfer_pending')
    ), 0)::integer,
    'blockedCents', coalesce(sum(payment.therapist_amount_cents) filter (
      where payment.transfer_status = 'blocked'
    ), 0)::integer,
    'nextBatchAt', (
      select min(batch.cutoff_at)
      from public.payout_batches as batch
      where batch.status in ('open', 'processing')
        and batch.cutoff_at >= now()
    )
  )
    into v_summary
  from public.session_payments as payment
  where payment.therapist_profile_id = v_therapist.id
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      >= v_period.starts_at
    and coalesce(payment.eligible_at, payment.paid_at, payment.created_at)
      < v_period.ends_at;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'items', v_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalCount', v_total_count,
      'totalPages', case
        when v_total_count = 0 then 0
        else ceil(v_total_count::numeric / v_page_size)::integer
      end,
      'hasNextPage', v_offset + v_page_size < v_total_count
    ),
    'filters', jsonb_build_object(
      'status', p_status,
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end,
      'timezone', v_period.timezone
    ),
    'summary', v_summary,
    'generatedAt', now()
  );
end;
$$;

create or replace function public.get_private_therapist_connect_account_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_therapist public.therapist_profiles%rowtype;
  v_account public.therapist_connect_accounts%rowtype;
  v_currently_due jsonb := '[]'::jsonb;
  v_eventually_due jsonb := '[]'::jsonb;
  v_pending_verification jsonb := '[]'::jsonb;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select *
    into v_account
  from public.therapist_connect_accounts as account
  where account.therapist_profile_id = v_therapist.id;

  if not found then
    return jsonb_build_object(
      'contractVersion', 1,
      'therapistProfileId', v_therapist.id,
      'accountExists', false,
      'maskedAccountId', null,
      'onboardingStatus', 'not_started',
      'detailsSubmitted', false,
      'payoutsEnabled', false,
      'chargesEnabled', false,
      'transferCapabilityStatus', 'inactive',
      'currentlyDue', '[]'::jsonb,
      'eventuallyDue', '[]'::jsonb,
      'pendingVerification', '[]'::jsonb,
      'disabledReason', null,
      'maskedBankAccountSummary', null,
      'lastSyncedAt', null,
      'generatedAt', now()
    );
  end if;

  if jsonb_typeof(v_account.pending_requirements) = 'object' then
    v_currently_due := coalesce(
      v_account.pending_requirements -> 'currentlyDue',
      v_account.pending_requirements -> 'currently_due',
      '[]'::jsonb
    );
    v_eventually_due := coalesce(
      v_account.pending_requirements -> 'eventuallyDue',
      v_account.pending_requirements -> 'eventually_due',
      '[]'::jsonb
    );
    v_pending_verification := coalesce(
      v_account.pending_requirements -> 'pendingVerification',
      v_account.pending_requirements -> 'pending_verification',
      '[]'::jsonb
    );
  elsif jsonb_typeof(v_account.pending_requirements) = 'array' then
    v_currently_due := v_account.pending_requirements;
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'accountExists', true,
    'maskedAccountId',
      left(v_account.stripe_account_id, 7)
      || '...'
      || right(v_account.stripe_account_id, 4),
    'onboardingStatus', v_account.onboarding_status,
    'detailsSubmitted', v_account.details_submitted,
    'payoutsEnabled', v_account.payouts_enabled,
    'chargesEnabled', v_account.charges_enabled,
    'transferCapabilityStatus', v_account.stripe_transfers_status,
    'currentlyDue', v_currently_due,
    'eventuallyDue', v_eventually_due,
    'pendingVerification', v_pending_verification,
    'disabledReason', v_account.disabled_reason,
    'maskedBankAccountSummary', null,
    'lastSyncedAt', v_account.last_synced_at,
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_private_therapist_financial_overview_v1(
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_receipts_v1(
  date,
  date,
  text,
  uuid,
  text,
  integer,
  integer,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_payouts_v1(
  date,
  date,
  text,
  integer,
  integer,
  text
) from public, anon, authenticated;
revoke all on function public.get_private_therapist_connect_account_v1()
from public, anon, authenticated;

grant execute on function public.get_private_therapist_financial_overview_v1(
  date,
  date,
  text
) to authenticated;
grant execute on function public.get_private_therapist_receipts_v1(
  date,
  date,
  text,
  uuid,
  text,
  integer,
  integer,
  text
) to authenticated;
grant execute on function public.get_private_therapist_payouts_v1(
  date,
  date,
  text,
  integer,
  integer,
  text
) to authenticated;
grant execute on function public.get_private_therapist_connect_account_v1()
to authenticated;

comment on function public.get_private_therapist_financial_overview_v1(
  date,
  date,
  text
) is
  'Private therapist financial overview read model. Uses session_payments as the canonical financial source and derives the therapist from auth.uid().';

comment on function public.get_private_therapist_receipts_v1(
  date,
  date,
  text,
  uuid,
  text,
  integer,
  integer,
  text
) is
  'Private therapist receipts read model with server-side filters and pagination. Does not expose raw Supabase rows or cross-therapist data.';

comment on function public.get_private_therapist_payouts_v1(
  date,
  date,
  text,
  integer,
  integer,
  text
) is
  'Private therapist payout read model. Amounts are returned in integer cents and derived from payout batches, batch items, transfers and session_payments.';

comment on function public.get_private_therapist_connect_account_v1() is
  'Private Stripe Connect account state for the therapist shell. Returns masked identifiers only and no bank-account form data.';
