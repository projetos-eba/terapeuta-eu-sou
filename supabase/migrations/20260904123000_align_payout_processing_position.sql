begin;

-- The payout position follows the receipts operational view: a future paid
-- session (`receivable`) is not part of the processing amount until its
-- appointment is no longer future. Keep the legacy wrapper for every other
-- field and only replace this derived aggregate.
create or replace function public.get_private_therapist_payouts_v2(
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
  v_therapist public.therapist_profiles%rowtype;
  v_processing_cents integer;
begin
  v_payload := public.private_therapist_payouts_v2_legacy_blocked_card(
    p_period_start,
    p_period_end,
    p_status,
    p_page,
    p_page_size,
    p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select coalesce(sum(payment.therapist_amount_cents), 0)::integer
  into v_processing_cents
  from public.session_payments payment
  where payment.therapist_profile_id = v_therapist.id
    and public.private_therapist_receipt_status_v2(payment.id) in (
      'waiting_confirmation',
      'waiting_safety_period',
      'waiting_settlement',
      'eligible',
      'payout_processing',
      'bank_pending'
    );

  return jsonb_set(
    v_payload,
    '{summary,payoutProcessingCents}',
    to_jsonb(v_processing_cents),
    true
  );
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
) is 'Repasses v2; processamento exclui sessoes futuras no estado A receber e mantem a conciliacao integral como autoridade de Pago.';

commit;
