# Admin Finance, Subscriptions And Reports

Use this skill when changing `/admin/pagamentos`, `/admin/assinaturas`,
`/admin/relatorios` or the admin finance navigation.

## Sources

- `AGENTS.md`
- `docs/architecture/admin-plan.md`
- Figma file `Projeto Terapeuta Eu Sou Atualizado`, admin reference node
  `13425:778`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-finance/*`
- Stripe Billing, Checkout and Connect contracts already implemented in
  Supabase functions and shared payment modules.

## Routes

- `/admin/pagamentos` displays as `Financeiro` in the admin shell.
- `/admin/assinaturas` displays as `Assinaturas`.
- `/admin/relatorios` displays as `Relatórios`.

## Data Contract

These pages are admin read-only in Phase 4. They read aggregate counts and
minimal operational rows through
`admin_get_finance_module_v2(p_module, p_query)`, with `search`, `status`,
`sort`, `page` and `pageSize` in the URL. The implementation must not fall back
to horizontal REST table reads from the shell.

- `session_payments`
- `session_payment_attempts`
- `session_refunds`
- `session_disputes`
- `financial_ledger_entries`
- `payout_batches`
- `payout_batch_items`
- `stripe_transfers`
- `billing_plans`
- `billing_plan_prices`
- `stripe_customers`
- `therapist_subscriptions`
- `therapist_subscription_events`
- `billing_invoices`
- `stripe_webhook_events`

Do not send generic `select *` payloads to React.

## Never Expose In The Browser

- Stripe secret keys, webhook secrets or service role keys.
- Full Authorization, cookies or JWTs.
- Full Stripe Checkout Session, PaymentIntent, Charge, Balance Transaction,
  Subscription or Invoice identifiers in generic lists.
- `hosted_invoice_url`, `invoice_pdf`, raw `metadata`,
  `payload_sanitized`, document data or clinical content.

## Guardrails

- Redirects from Stripe are not financial confirmation.
- Stripe webhook/reconciliation remains the source of truth for payments and
  subscriptions.
- Admin does not edit `therapist_profiles.plan` directly.
- Refund, dispute and payout actions require a command with RBAC, reason,
  idempotency and audit before becoming writable.
- RLS/grant failures must render as unavailable/degraded, not as an empty
  success state.

## QA

- Unit: `npm run test -- admin-finance.mappers admin-finance.queries admin-list-query admin-shell-config`
- App checks: `npm run typecheck`, `npm run lint`, `npm run build`
- Browser: navigate `/admin/pagamentos`, `/admin/assinaturas`,
  `/admin/relatorios`, `/admin/integracoes` as an admin user, use filters and
  pagination, and confirm no forbidden fields appear in page HTML.

## Known Limits

- The v2 read model keeps the public contract stable and filters sanitized DTOs
  server-side. If production volume requires full-dataset search beyond the
  current bounded window, replace the internal SQL with module-specific indexed
  queries without changing the React/BFF contract.
