-- Controlled V9 -> V10 policy cutover.
-- Run only after migrations, Functions, webhooks and V10 runtime flag are
-- verified in the target environment. Historical V9 payments keep their
-- frozen policy and continue to be processed by the V9 workers.

begin;

do $$
declare
  v_active_policy_key text;
begin
  if not exists (
    select 1
    from public.financial_policy_versions
    where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
  ) then
    raise exception 'SESSION_FINANCIAL_FLOW_V10_POLICY_MISSING';
  end if;

  select policy_key
  into v_active_policy_key
  from public.financial_policy_versions
  where is_active;

  if v_active_policy_key = 'tes-payments-v10-setup-t24-immediate-transfer' then
    return;
  end if;

  if v_active_policy_key is distinct from 'tes-payments-v9-settlement-only' then
    raise exception 'SESSION_FINANCIAL_FLOW_V10_UNEXPECTED_ACTIVE_POLICY';
  end if;

  update public.financial_policy_versions
  set is_active = false,
      effective_until = coalesce(effective_until, now()),
      metadata = jsonb_set(metadata, '{activation}', '"retired_for_v10"'::jsonb, true)
  where policy_key = 'tes-payments-v9-settlement-only'
    and is_active;

  update public.financial_policy_versions
  set is_active = true,
      effective_from = now(),
      effective_until = null,
      metadata = jsonb_set(metadata, '{activation}', '"enabled"'::jsonb, true)
  where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
    and not is_active;

  if (
    select count(*)
    from public.financial_policy_versions
    where is_active
  ) <> 1 or not exists (
    select 1
    from public.financial_policy_versions
    where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
      and is_active
  ) then
    raise exception 'SESSION_FINANCIAL_FLOW_V10_POLICY_CUTOVER_FAILED';
  end if;
end $$;

commit;
