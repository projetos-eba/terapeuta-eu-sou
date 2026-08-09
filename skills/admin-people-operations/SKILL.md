# Admin People Operations

Use esta skill ao alterar módulos admin de pessoas, operação e moderação:
profissionais, verificações, clientes/pacientes, sessões, suporte e avaliações.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/architecture/admin-plan.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-operations/*`
- `src/features/admin-dashboard/*`
- `supabase/migrations/*profile*`
- `supabase/migrations/*booking*`
- `supabase/migrations/*reviews*`
- `supabase/migrations/*support*`
- `supabase/migrations/*payments*`

## Rotas

- `/admin/profissionais`
- `/admin/profissionais/verificacoes`
- `/admin/pacientes` exibida como `Clientes`
- `/admin/sessoes`
- `/admin/suporte`
- `/admin/avaliacoes`

## Componentes e dados

- Página compartilhada: `AdminOperationPage`
- Consulta compartilhada: `getAdminOperationPage`
- Mapeadores: `mapAdminOperationRows`
- Read model: `admin_get_operation_module_v2(p_module, p_query)` para listas
  com `search`, `status`, `sort`, `page` e `pageSize`.
- Detalhe: `admin_get_operation_detail_v1(p_module, p_id)`.
- Comandos: `admin_execute_operation_command_v2(...)`, delegando comandos
  legados para v1 e cobrindo `verification.pause_review` e
  `verification.reopen_review`.
- Fontes:
  - `therapist_profiles`
  - `therapist_verifications`
  - `patient_profiles`
  - `bookings`
  - `support_tickets`
  - `reviews`

As páginas usam token admin autenticado no servidor Next e RPC Supabase sem
`service_role`. Leituras bloqueadas por RLS/grants aparecem como
`Indisponível`, nunca como zero. Filtros e paginação vivem na URL para suportar
refresh, cópia de link e QA com Playwright.

## Regras

- Não expor conteúdo clínico, intake, mensagens privadas, URL secreta de
  reunião, descrição completa de ticket ou comentário de review em listas.
- Documentos de verificação não devem ser enviados em payload de listagem.
- Ações críticas só podem existir por comando allowlisted com permissão
  server-side, motivo, `requestId` e auditoria append-only.
- Suspensão, aprovação, reprovação, reembolso, reagendamento, ocultação de
  avaliação e resolução de suporte devem preservar histórico.
- Sessões usam `bookings` como fonte operacional; Zoom e financeiro continuam
  subordinados aos domínios próprios.
- Reviews em listagem devem mostrar estado/moderação, não comentário completo.

## QA

- `npm run test -- admin-operations.mappers admin-operations.queries admin-list-query admin-shell-config`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Playwright:
  - sem sessão admin, cada rota redireciona para `/admin-login`;
  - com admin seed, cada rota renderiza título, métricas, filtros, paginação,
    guardrails e lista ou estado indisponível/vazio honesto;
  - confirmar que o menu expõe somente rotas implementadas;
  - confirmar que review comment, ticket description e meeting URL não aparecem
    em listagens.

## Pendências conhecidas

- Evoluir a implementação interna da v2 para busca em toda a base quando volume
  real ultrapassar a janela sanitizada atual de até 50 registros por módulo.
- Ampliar páginas de detalhe para workspace com abas quando o contrato visual de
  cada aba for refinado.
- Validar Supabase Advisor em HML/remoto antes de declarar fase homologada.
- Inspecionar Figma admin quando o conector estiver disponível.
