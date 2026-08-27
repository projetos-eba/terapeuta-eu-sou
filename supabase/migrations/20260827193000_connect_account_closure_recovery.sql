begin;

alter table public.therapist_connect_accounts
  add column if not exists account_generation integer not null default 1,
  add column if not exists is_current boolean not null default true,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_stripe_event_id text,
  add column if not exists closed_stripe_event_created_at timestamptz,
  add constraint therapist_connect_accounts_generation_positive
    check (account_generation > 0);

do $$
declare
  v_constraint_name text;
begin
  select constraint_name into v_constraint_name
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'therapist_connect_accounts'
    and constraint_type = 'UNIQUE'
    and constraint_name = 'therapist_connect_accounts_therapist_profile_id_key';

  if v_constraint_name is not null then
    execute format(
      'alter table public.therapist_connect_accounts drop constraint %I',
      v_constraint_name
    );
  end if;
end;
$$;

create unique index if not exists therapist_connect_accounts_current_therapist_idx
  on public.therapist_connect_accounts (therapist_profile_id)
  where is_current;

create unique index if not exists therapist_connect_accounts_generation_idx
  on public.therapist_connect_accounts (therapist_profile_id, account_generation);

do $$
begin
  alter table public.payout_batch_therapists
    drop constraint if exists payout_batch_therapists_unique;
exception when undefined_table then null;
end;
$$;

create unique index if not exists payout_batch_therapists_account_idx
  on public.payout_batch_therapists (
    payout_batch_id,
    therapist_profile_id,
    connect_account_id
  );

create or replace function public.retire_therapist_connect_account_v1(
  p_stripe_account_id text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_closed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.therapist_connect_accounts%rowtype;
  v_requeued_count integer := 0;
begin
  if nullif(trim(p_stripe_account_id), '') is null
    or nullif(trim(p_stripe_event_id), '') is null
    or p_stripe_event_created_at is null
    or p_closed_at is null
  then
    raise exception 'CONNECT_ACCOUNT_CLOSURE_INVALID';
  end if;

  select * into v_account
  from public.therapist_connect_accounts
  where stripe_account_id = p_stripe_account_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'connect_account_not_found');
  end if;

  if not v_account.is_current then
    return jsonb_build_object('applied', false, 'reason', 'already_historical');
  end if;

  update public.therapist_connect_accounts
  set is_current = false,
      closed_at = p_closed_at,
      closed_stripe_event_id = p_stripe_event_id,
      closed_stripe_event_created_at = p_stripe_event_created_at,
      disabled_reason = 'account_closed',
      charges_enabled = false,
      details_submitted = false,
      onboarding_status = 'disabled',
      operational_status = 'disabled',
      payout_schedule_interval = null,
      payout_status = 'disabled',
      payouts_enabled = false,
      stripe_event_created_at = p_stripe_event_created_at,
      stripe_event_id = p_stripe_event_id,
      stripe_transfers_status = 'inactive',
      last_synced_at = now(),
      updated_at = now()
  where id = v_account.id;

  -- Only entries with no Transfer attempt may return to the platform-held
  -- eligible queue. Any created Transfer remains tied to this historical account.
  with released as (
    update public.payout_batch_items item
    set status = 'removed',
        failure_code = 'connect_account_closed_before_transfer',
        failure_message = 'Conta de recebimento encerrada antes da criacao do Transfer.',
        metadata = item.metadata || jsonb_build_object(
          'connectAccountClosureEventId', p_stripe_event_id,
          'connectAccountClosedAt', p_closed_at
        ),
        updated_at = now()
    from public.payout_batch_therapists group_row
    where item.payout_batch_therapist_id = group_row.id
      and group_row.connect_account_id = v_account.id
      and item.status = 'reserved'
      and not exists (
        select 1
        from public.stripe_transfers transfer
        where transfer.payout_batch_item_id = item.id
      )
    returning item.session_payment_id
  ), restored as (
    update public.session_payments payment
    set transfer_status = 'eligible', updated_at = now()
    from released
    where payment.id = released.session_payment_id
      and payment.transfer_status = 'batched'
    returning payment.id
  )
  select count(*)::integer into v_requeued_count from restored;

  update public.payout_batch_therapists group_row
  set item_count = stats.item_count,
      total_amount_cents = stats.total_amount_cents,
      status = case when stats.item_count = 0 then 'removed'::public.payout_batch_item_status else group_row.status end,
      metadata = group_row.metadata || jsonb_build_object(
        'connectAccountClosureEventId', p_stripe_event_id,
        'connectAccountClosedAt', p_closed_at
      ),
      updated_at = now()
  from (
    select group_row_inner.id,
      count(item.id)::integer as item_count,
      coalesce(sum(item.amount_cents), 0)::integer as total_amount_cents
    from public.payout_batch_therapists group_row_inner
    left join public.payout_batch_items item
      on item.payout_batch_therapist_id = group_row_inner.id
      and item.status <> 'removed'
    where group_row_inner.connect_account_id = v_account.id
    group by group_row_inner.id
  ) stats
  where group_row.id = stats.id;

  insert into public.therapist_connect_account_snapshots (
    connect_account_id,
    stripe_event_id,
    snapshot
  ) values (
    v_account.id,
    p_stripe_event_id,
    jsonb_build_object(
      'account_status', 'disabled',
      'closure', jsonb_build_object(
        'closedAt', p_closed_at,
        'eventCreatedAt', p_stripe_event_created_at,
        'reason', 'account_closed'
      )
    )
  ) on conflict do nothing;

  return jsonb_build_object('applied', true, 'requeuedCount', v_requeued_count);
end;
$$;

create or replace function public.create_weekly_payout_batch(
  p_reference_period_start date,
  p_reference_period_end date,
  p_cutoff_at timestamptz default now(),
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  if p_reference_period_start is null
    or p_reference_period_end is null
    or p_reference_period_start > p_reference_period_end
    or p_cutoff_at is null
  then
    raise exception 'PAYOUT_BATCH_PERIOD_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'tes-payout-batch:' || p_reference_period_start::text || ':' || p_reference_period_end::text,
      0
    )
  );

  select id into v_batch_id
  from public.payout_batches
  where reference_period_start = p_reference_period_start
    and reference_period_end = p_reference_period_end
    and status <> 'canceled'
  order by created_at asc
  limit 1
  for update;

  if v_batch_id is null then
    insert into public.payout_batches (
      reference_period_start, reference_period_end, cutoff_at, status, created_by
    ) values (
      p_reference_period_start, p_reference_period_end, p_cutoff_at, 'open', p_created_by
    )
    returning id into v_batch_id;
  end if;

  insert into public.payout_batch_therapists (
    payout_batch_id, therapist_profile_id, connect_account_id,
    item_count, total_amount_cents
  )
  select
    v_batch_id, payment.therapist_profile_id, account.id,
    count(*)::integer, sum(payment.therapist_amount_cents)::integer
  from public.session_payments payment
  join public.therapist_connect_accounts account
    on account.therapist_profile_id = payment.therapist_profile_id
    and account.is_current
    and account.operational_status = 'ready'
    and account.stripe_transfers_status = 'active'
    and account.payouts_enabled
    and account.payout_status = 'enabled'
    and account.payout_schedule_interval = 'daily'
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1 from public.payout_batch_items existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    )
  group by payment.therapist_profile_id, account.id
  on conflict (payout_batch_id, therapist_profile_id, connect_account_id) do nothing;

  insert into public.payout_batch_items (
    payout_batch_id, payout_batch_therapist_id, session_payment_id,
    booking_id, therapist_profile_id, amount_cents
  )
  select
    v_batch_id, therapist_group.id, payment.id, payment.booking_id,
    payment.therapist_profile_id, payment.therapist_amount_cents
  from public.session_payments payment
  join public.payout_batch_therapists therapist_group
    on therapist_group.payout_batch_id = v_batch_id
    and therapist_group.therapist_profile_id = payment.therapist_profile_id
  join public.therapist_connect_accounts account
    on account.id = therapist_group.connect_account_id
    and account.is_current
    and account.operational_status = 'ready'
    and account.stripe_transfers_status = 'active'
    and account.payouts_enabled
    and account.payout_status = 'enabled'
    and account.payout_schedule_interval = 'daily'
  where payment.transfer_status = 'eligible'
    and payment.eligible_at <= p_cutoff_at
    and payment.therapist_amount_cents > 0
    and payment.stripe_charge_id is not null
    and payment.stripe_balance_transaction_id is not null
    and not exists (
      select 1 from public.payout_batch_items existing
      where existing.session_payment_id = payment.id
        and existing.status in ('reserved', 'transfer_pending', 'transferred')
    );

  update public.session_payments payment
  set transfer_status = 'batched', updated_at = now()
  where exists (
    select 1 from public.payout_batch_items item
    where item.payout_batch_id = v_batch_id
      and item.session_payment_id = payment.id
      and item.status = 'reserved'
  ) and payment.transfer_status = 'eligible';

  update public.payout_batch_therapists therapist_group
  set item_count = stats.item_count,
      total_amount_cents = stats.total_amount_cents,
      updated_at = now()
  from (
    select item.payout_batch_therapist_id,
      count(*)::integer as item_count,
      sum(item.amount_cents)::integer as total_amount_cents
    from public.payout_batch_items item
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
    group by item.payout_batch_therapist_id
  ) stats
  where therapist_group.id = stats.payout_batch_therapist_id;

  update public.payout_batches batch
  set item_count = stats.item_count,
      therapist_count = stats.therapist_count,
      gross_amount_cents = stats.gross_amount_cents,
      therapist_amount_cents = stats.therapist_amount_cents,
      platform_gross_commission_cents = stats.platform_amount_cents,
      status = case when stats.item_count = 0
        then 'completed'::public.payout_batch_status
        else 'open'::public.payout_batch_status end,
      processed_at = case when stats.item_count = 0 then now() else null end,
      updated_at = now()
  from (
    select
      count(item.id)::integer as item_count,
      count(distinct item.therapist_profile_id)::integer as therapist_count,
      coalesce(sum(payment.gross_amount_cents), 0)::integer as gross_amount_cents,
      coalesce(sum(item.amount_cents), 0)::integer as therapist_amount_cents,
      coalesce(sum(payment.platform_gross_commission_cents), 0)::integer as platform_amount_cents
    from public.payout_batch_items item
    join public.session_payments payment on payment.id = item.session_payment_id
    where item.payout_batch_id = v_batch_id
      and item.status <> 'removed'
  ) stats
  where batch.id = v_batch_id;

  return v_batch_id;
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
  v_previous_account_closed boolean := false;
  v_currently_due jsonb := '[]'::jsonb;
  v_eventually_due jsonb := '[]'::jsonb;
  v_pending_verification jsonb := '[]'::jsonb;
begin
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select * into v_account
  from public.therapist_connect_accounts as account
  where account.therapist_profile_id = v_therapist.id
    and account.is_current;

  if not found then
    select exists(
      select 1
      from public.therapist_connect_accounts historical
      where historical.therapist_profile_id = v_therapist.id
        and not historical.is_current
        and historical.disabled_reason = 'account_closed'
    ) into v_previous_account_closed;

    return jsonb_build_object(
      'contractVersion', 1,
      'therapistProfileId', v_therapist.id,
      'accountExists', false,
      'previousAccountClosed', v_previous_account_closed,
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
    v_currently_due := coalesce(v_account.pending_requirements -> 'currentlyDue', v_account.pending_requirements -> 'currently_due', '[]'::jsonb);
    v_eventually_due := coalesce(v_account.pending_requirements -> 'eventuallyDue', v_account.pending_requirements -> 'eventually_due', '[]'::jsonb);
    v_pending_verification := coalesce(v_account.pending_requirements -> 'pendingVerification', v_account.pending_requirements -> 'pending_verification', '[]'::jsonb);
  elsif jsonb_typeof(v_account.pending_requirements) = 'array' then
    v_currently_due := v_account.pending_requirements;
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'therapistProfileId', v_therapist.id,
    'accountExists', true,
    'previousAccountClosed', false,
    'maskedAccountId', left(v_account.stripe_account_id, 7) || '...' || right(v_account.stripe_account_id, 4),
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

revoke all on function public.retire_therapist_connect_account_v1(text, text, timestamptz, timestamptz)
from public, anon, authenticated;

comment on column public.therapist_connect_accounts.is_current is
  'Exactly one current receiving account may exist per therapist. Historical rows remain immutable financial references.';

comment on function public.retire_therapist_connect_account_v1(text, text, timestamptz, timestamptz) is
  'Internal, idempotent closure transition. Requeues only payout items with no Transfer record and preserves all historical Transfers and Payouts.';

commit;
