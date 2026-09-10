create or replace function public.get_platform_transfer_reserve_requirement_v1()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'amountCents', coalesce(sum(payment.therapist_amount_cents), 0)::bigint,
    'paymentCount', count(*)::integer
  )
  from public.session_payments payment
  where payment.financial_status in ('paid', 'partially_refunded')
    and payment.therapist_amount_cents > 0
    and payment.transfer_status <> 'transferred';
$$;

revoke all on function public.get_platform_transfer_reserve_requirement_v1()
  from public, anon, authenticated;
grant execute on function public.get_platform_transfer_reserve_requirement_v1()
  to service_role;

comment on function public.get_platform_transfer_reserve_requirement_v1() is
  'Returns the full therapist liability that must remain protected from platform automatic payouts.';
