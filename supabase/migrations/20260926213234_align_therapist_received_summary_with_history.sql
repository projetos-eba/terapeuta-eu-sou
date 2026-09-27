begin;

-- Preserve the complete V9 payout projection and correct only the received
-- aggregate. A Transfer reversed after an already-paid Payout remains part of
-- that historical bank deposit when the provider-linked neutral pair proves
-- the chronology. This migration does not update financial records.
alter function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
)
  rename to private_therapist_payouts_v9_before_received_summary_20260926;

revoke all on function
  public.private_therapist_payouts_v9_before_received_summary_20260926(
    date, date, integer, integer, text, integer
  )
  from public, anon, authenticated, service_role;

create function public.get_private_therapist_payouts_v9(
  p_period_start date default null,
  p_period_end date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_timezone text default null,
  p_agenda_days integer default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_therapist_id uuid;
  v_period record;
  v_period_start_date date;
  v_period_end_date date;
  v_received_cents integer := 0;
begin
  -- The preserved projection performs authorization and remains authoritative
  -- for filters, agenda groups, history composition and pagination.
  v_payload :=
    public.private_therapist_payouts_v9_before_received_summary_20260926(
      p_period_start,
      p_period_end,
      p_page,
      p_page_size,
      p_timezone,
      p_agenda_days
    );

  v_therapist_id := (v_payload ->> 'therapistProfileId')::uuid;

  select *
  into v_period
  from public.normalize_private_therapist_finance_period_v1(
    p_period_start,
    p_period_end,
    v_payload -> 'filters' ->> 'timezone'
  );

  v_period_start_date :=
    (v_period.starts_at at time zone v_period.timezone)::date;
  v_period_end_date :=
    (v_period.ends_at at time zone v_period.timezone)::date;

  select coalesce(sum(allocation.amount_cents), 0)::integer
  into v_received_cents
  from public.stripe_payout_transfer_allocations as allocation
  join public.stripe_transfers as transfer
    on transfer.id = allocation.stripe_transfer_id
  join public.stripe_payouts as payout
    on payout.id = allocation.stripe_payout_id
  where transfer.therapist_profile_id = v_therapist_id
    and (
      transfer.status = 'transferred'
      or (
        transfer.status = 'reversed'
        and exists (
          select 1
          from jsonb_array_elements(
            coalesce(payout.neutral_transaction_pairs, '[]'::jsonb)
          ) as pair(value)
          where pair.value ->> 'classification' =
              'tes_v10_post_payout_reversal'
            and pair.value ->> 'localTransferId' = transfer.id::text
        )
      )
    )
    and payout.status = 'paid'
    and payout.provider_reconciliation_status = 'completed'
    and payout.allocation_status = 'completed'
    and allocation.amount_cents = transfer.amount_cents
    and (
      (
        payout.arrival_at is not null
        and (payout.arrival_at at time zone 'UTC')::date
          <= (now() at time zone v_period.timezone)::date
      )
      or (
        payout.arrival_at is null
        and coalesce(payout.paid_at, payout.updated_at) <= now()
      )
    )
    and case
      when payout.arrival_at is not null
        then (payout.arrival_at at time zone 'UTC')::date
      else (
        coalesce(payout.paid_at, payout.updated_at)
        at time zone v_period.timezone
      )::date
    end >= v_period_start_date
    and case
      when payout.arrival_at is not null
        then (payout.arrival_at at time zone 'UTC')::date
      else (
        coalesce(payout.paid_at, payout.updated_at)
        at time zone v_period.timezone
      )::date
    end < v_period_end_date;

  return jsonb_set(
    v_payload,
    '{summary,receivedCents}',
    to_jsonb(v_received_cents),
    true
  );
end;
$$;

revoke all on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) to authenticated;

comment on function public.get_private_therapist_payouts_v9(
  date, date, integer, integer, text, integer
) is
  'Private therapist payout V9 projection whose received summary uses the same paid bank allocations accepted by received history.';

comment on function
  public.private_therapist_payouts_v9_before_received_summary_20260926(
    date, date, integer, integer, text, integer
  ) is
  'Private preserved V9 payout projection used by the received-summary alignment wrapper.';

commit;
