# Domain Ownership

Ownership define quem implementa e quem precisa revisar; não cria exclusividade
rígida sobre contratos integrados. Pastas, tabelas e testes abaixo são os
principais pontos encontrados no repositório, não um inventário exaustivo.

| Domain                                     | Owner               | Reviewer                                                               | Pastas principais                                                                                                                                                                                                                | Tabelas/read models principais                                                                                                                                 | Edge Functions                                                                                                                                               | Rotas principais                                                                          | Testes principais                                                                                                                          |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Coordenação e integração                   | Orchestrator        | QA & Release + owners afetados                                         | `.codex/`, `docs/agent-work/`                                                                                                                                                                                                    | `CURRENT_GOAL`, `TASK_MATRIX`, handoffs                                                                                                                        | —                                                                                                                                                            | —                                                                                         | TOML, links, diff e dry-run                                                                                                                |
| Supabase, Auth, RLS, Storage e integridade | Security & Supabase | Owner funcional + QA                                                   | `supabase/migrations`, `supabase/functions/_shared/auth`, `docs/security`, `src/lib/auth`, `src/lib/supabase`                                                                                                                    | Policies, grants, RPCs, buckets, `database.types.ts`                                                                                                           | Auth/e-mail boundaries e revisão de toda function privilegiada                                                                                               | `/api/auth/*` conforme perfil                                                             | `supabase/tests/044_*`, pgTAP/RLS, testes auth/Deno                                                                                        |
| Admin                                      | Admin               | Security & Supabase + owner do domínio observado + QA                  | `src/app/(admin)`, `src/features/admin-*`, `src/app/api/admin`                                                                                                                                                                   | `admin_audit_events`, `therapist_verifications`, `admin_get_*`, catálogo/financeiro sanitizado                                                                 | `admin-auth-login`, `admin-therapy-catalog-command`                                                                                                          | `/admin*`, `/admin-login`                                                                 | `tests/e2e/admin-*.spec.ts`, `src/features/admin-*/**/*.test.*`, pgTAP `020_*`–`043_*`                                                     |
| Stripe Billing, Connect e financeiro       | Stripe & Finance    | Security & Supabase + Sessions & Zoom + Admin/Therapist quando UI + QA | `supabase/functions/_shared/payments`, `supabase/functions/stripe-*`, `src/domain/payments`, `src/features/therapist-finance`, `docs/payments`                                                                                   | `session_payments`, `financial_ledger_entries`, `therapist_subscriptions`, `therapist_connect_accounts`, `billing_*`, `payout_*`, `stripe_*`, refunds/disputes | `stripe-*`, `evaluate-transfer-eligibility`, `create-weekly-payout-batch`, `process-payout-batch`, `retry-failed-payout-items`, `reconcile-stripe-transfers` | `/terapeuta/checkout`, `/terapeuta/financeiro`, `/admin/pagamentos`, `/admin/assinaturas` | pgTAP `002_*`, `016_*`–`019_*`, `041_*`; payment Deno/Vitest/Playwright                                                                    |
| Agenda, booking, sessão e Zoom             | Sessions & Zoom     | Security & Supabase + Stripe & Finance + Public/Therapist + QA         | `src/features/availability`, `src/features/booking*`, `src/features/bookings`, `src/features/therapist-agenda`, `src/features/therapist-sessions`, `src/features/zoom`, `supabase/functions/_shared/zoom-video-sdk`, `docs/zoom` | `bookings`, `booking_holds`, availability/schedule, `video_sessions`, participations, control jobs, Zoom event/rate-limit tables                               | `session-booking-checkout`, `session-reschedule`, `therapist-schedule-update`, `therapist-blocks-update`, `zoom-*`                                           | `/reserva`, `/app/encontros*`, `/terapeuta/agenda`, `/terapeuta/sessoes*`, `/api/zoom/*`  | pgTAP `003_*`–`008_*`, Zoom/booking Deno/Vitest, Playwright agenda/patient/zoom                                                            |
| Catálogo de terapias e governança do Match | Admin               | Security & Supabase + Public / Patient + Therapist Product + QA        | `src/features/admin-therapy-catalog`, `src/features/admin-matching`, `src/features/therapies`, migrations de catálogo/Match                                                                                                      | `therapies`, `therapy_categories`, `therapy_public_content`, `therapy_*`, `matching_*`, `therapy_catalog_*`                                                    | `admin-therapy-catalog-command`                                                                                                                              | `/admin/terapias`, `/admin/matching`, `/terapias*`, `/sua-jornada*`                       | pgTAP `010_*`, `020_*`, `022_*`–`025_*`, `028_*`, `030_*`, `034_*`–`036_*`; Admin/Match E2E                                                |
| Público e paciente                         | Public / Patient    | Security & Supabase + owner do contrato consumido + QA                 | páginas públicas de `src/app`, `src/app/(authenticated)/app`, `src/features/public-*`, `src/features/patient-*`, `src/features/client-auth`, `src/features/legal`                                                                | Views `public_*`, `patient_profiles`, favorites, conversations/messages/notifications, support, `booking_session_summaries`                                    | `client-auth-*`, `matching-calculate`, `match-therapies`; consome checkout de Sessions/Stripe                                                                | `routes.public`, `routes.patient`, aliases legados do paciente                            | `tests/e2e/public-*`, `patient-*`, `payments-checkout`; testes de features/APIs públicas                                                   |
| Produto do terapeuta                       | Therapist Product   | Security & Supabase + Public / Patient + owner financeiro/sessões + QA | `src/app/(therapist)`, `src/features/therapist-*` exceto ownership funcional financeiro/sessões                                                                                                                                  | `therapist_profiles`, profile versions/events/docs, `therapist_services`, reviews/replies, metrics/aggregates, Aura                                            | `therapist-profile-command`, `therapist-services-command`, `therapist-reviews-command`, `therapist-auth-*`                                                   | `routes.therapist`                                                                        | Playwright perfil/serviços/métricas; Vitest `src/features/therapist-*`; pgTAP `001_*`, `009_*`, `011_*`–`015_*`, `026_*`, `027_*`, `032_*` |
| QA, homologação e release                  | QA & Release        | Orchestrator + owners dos achados                                      | `tests/e2e`, configs Vitest/Playwright, scripts de homologação, evidências sanitizadas                                                                                                                                           | Matriz de risco e release gate; não cria fonte de negócio                                                                                                      | Não implementa feature; harness/fixtures sob escopo explícito                                                                                                | Fluxos cross-shell                                                                        | lint, typecheck, Vitest, Deno, pgTAP/RLS, build, Playwright, legal e runbooks                                                              |

## Regras especiais de ownership

### Migrations

Security & Supabase possui ownership final de toda migration. O agente de
domínio pode identificar a necessidade e entregar um contrato contendo fonte
canônica, consumidores, compatibilidade/backfill, retenção, impacto e testes.
Security resolve ordem/timestamp, cria ou revisa o SQL, valida RLS/grants,
estratégia de roll-forward/rollback e assegura o teste pgTAP.

Nenhuma migration concorrente deve nascer em outra worktree sem reserva
explícita. Mudanças em schema, view, function, policy, índice, enum, Storage ou
projeção pública permanecem sujeitas ao gate de confirmação do `AGENTS.md`.

### Sobreposições intencionais

- `session-booking-checkout`: Sessions & Zoom é owner; Stripe & Finance revisa
  pagamento e Security revisa identidade/transação.
- `/terapeuta/financeiro`: Stripe & Finance é owner funcional; Therapist
  Product revisa shell, copy e capabilities.
- Agenda/sessões no shell: Sessions & Zoom é owner funcional; Therapist
  Product revisa a experiência.
- Reserva e detalhe do encontro: Public / Patient é owner da experiência;
  Sessions & Zoom e Stripe & Finance são owners dos contratos consumidos.
- Admin financeiro e Admin sessões observam fontes canônicas; Stripe ou
  Sessions revisa qualquer comando que deixe de ser somente leitura.
- Perfil/serviços do terapeuta projetados publicamente: Therapist Product é
  owner da origem; Public / Patient revisa o consumo e cache público.

## Arquivos de alto conflito

Exigem coordination note, owner único, janela de edição e handoff:

- `AGENTS.md`, `.gitignore`, `.codex/config.toml`;
- `src/lib/routes.ts`, `src/lib/permissions.ts`, `next.config.mjs`;
- `src/domain/tes/**`, `src/lib/auth/**`;
- `package.json`, lockfile e configurações de testes/build;
- `src/lib/supabase/database.types.ts`;
- `supabase/migrations/**`, seeds e `supabase/config.toml`;
- `src/components/app-page/**`, `src/components/authenticated-shell/**`,
  `src/components/tes/**`, `src/app/globals.css`;
- contratos compartilhados de bookings, mensagens e session actions;
- `docs/product/sitemap.md`, `routes-map.md`, `integration-map.md`;
- `docs/design-system/design-system.md` e `tokens.md`.

## Divergências registradas na auditoria

- `src/lib/routes.ts` declara rotas de pagamentos/configurações do paciente sem
  páginas equivalentes encontradas em `src/app/(authenticated)/app`.
- `routes.public.zoomHelp` declara `/ajuda/zoom`, mas não há página e o sitemap
  informa que ela não existe nesta fase.
- `/terapeuta/metricas` existe como redirect para `/terapeuta/insights`, não
  como domínio independente.
- `docs/product/integration-map.md` descreve parte das áreas autenticadas/Admin
  como pendente, enquanto código e testes já possuem várias superfícies.
- `docs/payments/stripe-phase-3-homologation.md` ainda cita flags Connect v1 em
  um ponto, enquanto arquitetura e runtime atuais documentam capability
  Accounts v2.

Essas divergências não foram corrigidas nesta tarefa porque não são necessárias
para configurar agentes e podem envolver decisão de produto/documentação.
