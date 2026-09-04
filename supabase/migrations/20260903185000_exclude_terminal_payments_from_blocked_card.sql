alter function public.get_private_therapist_payouts_v2(
  date, date, text, integer, integer, text
) rename to private_therapist_payouts_v2_legacy_blocked_card;

revoke all on function public.private_therapist_payouts_v2_legacy_blocked_card(
  date, date, text, integer, integer, text
) from public, anon, authenticated;

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
  v_summary jsonb;
  v_therapist public.therapist_profiles%rowtype;
  v_blocked_cents integer := 0;
  v_blocked_reason_codes jsonb := '[]'::jsonb;
begin
  v_payload := public.private_therapist_payouts_v2_legacy_blocked_card(
    p_period_start, p_period_end, p_status, p_page, p_page_size, p_timezone
  );
  v_therapist := public.get_private_therapist_financial_actor_v1();

  select
    coalesce(sum(payment.therapist_amount_cents), 0)::integer,
    coalesce(
      jsonb_agg(distinct case
        when payment.transfer_blocked_reason = 'connect_not_ready' then 'account'
        when payment.transfer_blocked_reason in ('refund', 'manual_refund_review') then 'refund'
        when payment.transfer_blocked_reason in (
          'disputed', 'blocked_or_contested', 'participant_reported_not_performed'
        ) then 'review'
        else 'other'
      end) filter (
        where public.private_therapist_receipt_status_v2(payment.id) = 'blocked'
      ),
      '[]'::jsonb
    )
  into v_blocked_cents, v_blocked_reason_codes
  from public.session_payments payment
  where payment.therapist_profile_id = v_therapist.id
    and public.private_therapist_receipt_status_v2(payment.id) = 'blocked';

  v_summary := coalesce(v_payload->'summary', '{}'::jsonb)
    || jsonb_build_object(
      'blockedCents', v_blocked_cents,
      'blockedReasonCodes', v_blocked_reason_codes
    );

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
) is 'Repasses v2; o card bloqueado exclui reembolsos, falhas e demais estados terminais derivados.';
