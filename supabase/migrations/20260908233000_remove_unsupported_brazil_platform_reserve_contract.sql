drop function if exists public.get_platform_transfer_reserve_requirement_v1();

comment on table public.payout_scheduler_runs is
  'Auditable weekly Transfer runs with lease, bounded backoff and a failure circuit. Brazilian platform payout settings cannot reserve weekly liabilities, so workers must preflight actual available balance.';
