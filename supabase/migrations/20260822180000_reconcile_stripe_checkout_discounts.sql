create or replace function public.reconcile_session_payment_amount_v1(
  p_session_payment_id uuid,
  p_charged_amount_cents integer,
  p_original_amount_cents integer default null,
  p_discount_amount_cents integer default null,
  p_stripe_checkout_session_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_snapshot record;
  v_existing_original_amount_cents integer;
  v_original_amount_cents integer;
  v_discount_amount_cents integer;
  v_checkout_metadata jsonb;
begin
  if p_charged_amount_cents is null or p_charged_amount_cents < 0 then
    return jsonb_build_object('applied', false, 'reason', 'invalid_charged_amount');
  end if;

  if p_original_amount_cents is not null and p_original_amount_cents < 0 then
    return jsonb_build_object('applied', false, 'reason', 'invalid_original_amount');
  end if;

  if p_discount_amount_cents is not null and p_discount_amount_cents < 0 then
    return jsonb_build_object('applied', false, 'reason', 'invalid_discount_amount');
  end if;

  select *
    into v_payment
  from public.session_payments
  where id = p_session_payment_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  end if;

  v_existing_original_amount_cents := nullif(
    v_payment.metadata #>> '{stripe_checkout,original_amount_cents}',
    ''
  )::integer;

  if v_existing_original_amount_cents is not null
    and p_original_amount_cents is not null
    and v_existing_original_amount_cents <> p_original_amount_cents then
    return jsonb_build_object(
      'applied', false,
      'reason', 'original_amount_conflict'
    );
  end if;

  if v_payment.financial_status in ('paid', 'partially_refunded', 'refunded')
    and v_payment.gross_amount_cents <> p_charged_amount_cents then
    return jsonb_build_object(
      'applied', false,
      'reason', 'charged_amount_conflict'
    );
  end if;

  v_original_amount_cents := coalesce(
    v_existing_original_amount_cents,
    p_original_amount_cents,
    v_payment.gross_amount_cents
  );
  v_discount_amount_cents := coalesce(
    p_discount_amount_cents,
    greatest(v_original_amount_cents - p_charged_amount_cents, 0)
  );

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    return jsonb_build_object('applied', false, 'reason', 'invalid_metadata');
  end if;

  select *
    into v_snapshot
  from public.calculate_session_payment_snapshot(
    p_charged_amount_cents,
    v_payment.platform_commission_bps
  );

  v_checkout_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'original_amount_cents', v_original_amount_cents,
    'charged_amount_cents', p_charged_amount_cents,
    'discount_amount_cents', v_discount_amount_cents,
    'reconciled_at', now()
  );

  update public.session_payments
  set gross_amount_cents = v_snapshot.gross_amount_cents,
      platform_gross_commission_cents = v_snapshot.platform_gross_commission_cents,
      therapist_amount_cents = v_snapshot.therapist_amount_cents,
      stripe_checkout_session_id = coalesce(
        p_stripe_checkout_session_id,
        stripe_checkout_session_id
      ),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'stripe_checkout', v_checkout_metadata
      ),
      updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  return jsonb_build_object(
    'applied', true,
    'chargedAmountCents', v_payment.gross_amount_cents,
    'originalAmountCents', v_original_amount_cents,
    'discountAmountCents', v_discount_amount_cents,
    'platformGrossCommissionCents', v_payment.platform_gross_commission_cents,
    'therapistAmountCents', v_payment.therapist_amount_cents,
    'sessionPaymentId', v_payment.id
  );
end;
$$;

revoke all on function public.reconcile_session_payment_amount_v1(
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.reconcile_session_payment_amount_v1(
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
) to service_role;

comment on function public.reconcile_session_payment_amount_v1(
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
) is 'Reconcilia o valor efetivamente cobrado pela Stripe e recalcula comissao e repasse sem criar logica propria de cupons.';
