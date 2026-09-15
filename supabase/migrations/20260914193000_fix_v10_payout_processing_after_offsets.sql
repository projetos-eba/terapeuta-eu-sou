begin;

-- Preserve the unified V9/V10 history and correct only the current-position
-- processing total. V10 can consume part (or all) of the therapist amount
-- with a previously recorded debt, so the amount on its way to the bank is
-- the immutable transfer job amount, not the pre-offset therapist amount.
alter function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) rename to private_therapist_payouts_v2_v10_gross_processing_legacy;

revoke all on function public.private_therapist_payouts_v2_v10_gross_processing_legacy(
  date, date, text, integer, integer, text
) from public, anon, authenticated;

create function public.get_private_therapist_payouts_v2(
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
  v_payload jsonb;
  v_summary jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_processing_cents integer := 0;
begin
  -- This call retains authorization, filter validation, deterministic
  -- pagination and the complete unified history contract.
  v_payload := public.private_therapist_payouts_v2_v10_gross_processing_legacy(
    p_period_start,
    p_period_end,
    p_status,
    p_page,
    p_page_size,
    p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select coalesce(sum(
    case
      when payment.payment_flow_version = 'v10'
        then coalesce(job.transfer_amount_cents, payment.therapist_amount_cents)
      else payment.therapist_amount_cents
    end
  ), 0)::integer
  into v_processing_cents
  from public.session_payments payment
  left join public.session_transfer_jobs job
    on job.session_payment_id = payment.id
  where payment.therapist_profile_id = v_therapist.id
    and public.private_therapist_receipt_status_v2(payment.id) in (
      'waiting_confirmation',
      'waiting_safety_period',
      'waiting_settlement',
      'eligible',
      'payout_processing',
      'bank_pending'
    );

  v_summary := coalesce(v_payload -> 'summary', '{}'::jsonb)
    || jsonb_build_object('payoutProcessingCents', v_processing_cents);

  return jsonb_set(v_payload, '{summary}', v_summary, true);
end;
$$;

revoke all on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) from public, anon;
grant execute on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) to authenticated;

comment on function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) is 'Unified therapist payout history; the current processing total uses the post-compensation V10 transfer amount while preserving the V9 position.';

commit;
