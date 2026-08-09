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
- Fontes:
  - `therapist_profiles`
  - `therapist_verifications`
  - `patient_profiles`
  - `bookings`
  - `support_tickets`
  - `reviews`

As páginas usam token admin autenticado no servidor Next e REST Supabase sem
`service_role`. Leituras bloqueadas por RLS/grants aparecem como
`Indisponível`, nunca como zero.

## Regras

- Não expor conteúdo clínico, intake, mensagens privadas, URL secreta de
  reunião, descrição completa de ticket ou comentário de review em listas.
- Documentos de verificação não devem ser enviados em payload de listagem.
- Ações críticas ainda não devem ser implementadas sem comando dedicado,
  permissão server-side, motivo, `requestId`, versão esperada e auditoria.
- Suspensão, aprovação, reprovação, reembolso, reagendamento, ocultação de
  avaliação e resolução de suporte devem preservar histórico.
- Sessões usam `bookings` como fonte operacional; Zoom e financeiro continuam
  subordinados aos domínios próprios.
- Reviews em listagem devem mostrar estado/moderação, não comentário completo.

## QA

- `npm run test -- admin-operations.mappers admin-shell-config`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Playwright:
  - sem sessão admin, cada rota redireciona para `/admin-login`;
  - com admin seed, cada rota renderiza título, métricas, guardrails e lista ou
    estado indisponível/vazio honesto;
  - confirmar que o menu expõe somente rotas implementadas;
  - confirmar que review comment, ticket description e meeting URL não aparecem
    em listagens.

## Pendências conhecidas

- Criar read models admin dedicados antes de ações críticas.
- Criar páginas de detalhe apenas quando houver contrato aprovado em rotas
  canônicas.
- Ligar módulos a auditoria append-only persistente.
- Validar Supabase Advisor em HML/remoto antes de declarar fase homologada.
- Inspecionar Figma admin quando o conector estiver disponível.
