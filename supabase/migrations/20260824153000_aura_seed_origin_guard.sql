-- Aura: preserve the demo origin marker for existing local/legacy seed rows.
-- This is forward-only and does not delete or reset operational data.

update public.aura_recommendations
set
  context = coalesce(context, '{}'::jsonb) || jsonb_build_object('source', 'demo_seed'),
  evidence = case
    when coalesce(evidence, '{}'::jsonb) = '{}'::jsonb
      then jsonb_build_object('source', 'seed')
    else evidence
  end,
  updated_at = now()
where source_rule_key in (
  'weekly_service_interest',
  'profile_views_growth',
  'open_schedule',
  'reply_reviews',
  'profile_video'
)
and coalesce(context->>'source', '') <> 'demo_seed';

comment on table public.aura_recommendations is
  'Persisted deterministic Aura recommendations. Rows marked context.source=demo_seed are excluded from therapist-facing output.';
