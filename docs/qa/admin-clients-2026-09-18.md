# Clientes ADM — implementação e validação local

## Resultado e limites

Implementados quatro indicadores globais, paginação sobre a base completa de
Clientes, contato privado formatado no detalhe e suspensão/reativação de **novos
agendamentos**. Login, suporte, sessões existentes e fluxo financeiro não foram
alterados. Datas vêm da criação/atualização do cadastro do cliente.

Contato: e-mail de `profiles`; celular/DDI de `patient_profiles`; somente as
chaves allowlisted de `patient_profiles.metadata.account.address`. Não há
projeção de metadata completa, contato na listagem ou novos dados clínicos.
Campos opcionais ausentes são distintos de uma projeção indisponível.
DDI ausente não é inferido do perfil geral nem substituído por `55` no detalhe
ADM. O valor do telefone permanece disponível e a ausência do DDI é explícita.

`booking_management_available` habilita os comandos apenas quando o servidor
implementa o contrato novo. Backend anterior mantém os dados existentes legíveis,
sem indicadores inventados nem CTA de suspensão desconectado.

Nenhum commit, push, deploy ou alteração remota foi executado. Migrations foram
verificadas em transações locais com rollback, não instaladas permanentemente.
Alterações anteriores dos detalhes de profissionais foram preservadas.

## Revisão em duas rodadas

1. Contratos e segurança: permissão dedicada, Admin ativo, motivo, idempotência
   com bloqueio por request e cliente, audit trail sem PII adicional, métricas
   independentes dos filtros, proteção de INSERTs sem alterar agenda/financeiro.
2. Regressões e compatibilidade: flag server-side de habilitação, requestId
   preservado em retry incerto, confirmação cancelável, layout local com largura
   mínima zero, alcance da suspensão explicitado, distinção entre hold ativo e
   reserva já criada, delegação dos demais comandos às funções anteriores.
   A comparação do responsável na idempotência é null-safe; contato sem DDI
   também tem cobertura explícita na interface e no banco.

O bloqueio de INSERT é transacional: a tentativa de consumir um hold ativo após
a suspensão falha e reverte o estado intermediário do hold. Retry de hold já
consumido continua retornando a reserva original. O comando administrativo não
adquire locks de agenda, evitando inverter a ordem existente terapeuta → cliente.

## Validação

- Vitest final: 98 testes passaram em 16 arquivos, incluindo a proteção de
  compatibilidade, contato sem DDI e QA visual isolada nos três tamanhos de tela.
- Deno: 16 testes de `booking-checkout-command.test.ts` passaram, incluindo o
  erro de suspensão e os contratos anteriores de checkout/idempotência.
- PostgreSQL/pgTAP final: 44 verificações novas e 54 regressões ADM passaram com
  rollback, incluindo e-mail, capability, DDI ausente e percentual da base completa.
- Concorrência: o harness PowerShell abriu duas conexões e comprovou que os
  locks do comando Admin e do INSERT de reserva não podem ser adquiridos pela
  segunda conexão. DDL e fixtures foram revertidos. Isso comprova a contenção do
  lock; não substitui homologação de reservas/pagamentos em HML.
- Typecheck e lint passaram na repetição final, sem erros. Build passou duas
  vezes, incluindo o ajuste final de DDI, numa cópia isolada das fontes atuais e
  configuração original. O `.next` do servidor local existente foi preservado.
- Layout dos componentes em Edge visível: listagem, detalhe e confirmação em
  1440, 1024 e 390 px com fixtures isoladas e CSS TES. Evidência de componentes,
  não de uma sessão autenticada real nem do shell completo. A rodada final usa
  fontes IvyPresto locais e compara overflow com a largura útil do documento.
- Rota sem autenticação: redirecionamento para `/admin-login` passou.
- Rota autenticada: não concluída; o login da conta de teste local não chegou ao
  painel. Nenhuma credencial, sessão existente ou regra de autenticação foi
  modificada para contornar o bloqueio. QA visual autenticada e aprovação visual
  integral permanecem pendentes.

CPU/RAM e containers locais foram acompanhados; testes e operações pesadas
rodaram em sequência, com um worker. Os jobs persistentes locais estavam inativos.
Após a rodada final: aproximadamente 2032 MB de RAM livre e 10% de CPU.
Banco permaneceu na migration `20260917221000`, sem a tabela nova ou fixtures
residuais. O harness de concorrência requer PowerShell 7; a execução acidental
com Windows PowerShell 5 foi interrompida antes de abrir a conexão de teste e a
repetição no PowerShell 7 passou.

## Arquivos desta implementação

- `src/lib/auth/admin-permissions.ts`
- `src/app/api/admin/operations/route.ts`
- `src/app/api/admin/operations/route.test.ts`
- `src/app/api/public/reservation/checkout/checkout-errors.ts`
- `src/app/api/public/reservation/checkout/checkout-errors.test.ts`
- `src/features/admin-operations/admin-operations.types.ts`
- `src/features/admin-operations/admin-operations.mappers.ts`
- `src/features/admin-operations/admin-operations.queries.ts`
- `src/features/admin-operations/admin-operations.queries.test.ts`
- `src/features/admin-operations/components/admin-patients-page.tsx`
- `src/features/admin-operations/components/admin-patient-detail-page.tsx`
- `src/features/admin-operations/components/admin-private-contact-details.tsx`
  (reutilização dos formatadores de telefone/CEP; componente anterior preservado)
- `src/features/admin-operations/components/admin-operation-command-panel.tsx`
- `src/features/admin-operations/components/admin-operation-display.tsx`
- `src/features/admin-operations/components/admin-patients-page.test.tsx`
- `supabase/functions/session-booking-checkout/booking-checkout-command.ts`
- `supabase/functions/session-booking-checkout/booking-checkout-command.test.ts`
- `supabase/migrations/20260918140000_admin_patient_booking_restrictions.sql`
- `supabase/tests/140_admin_patient_booking_restrictions.sql`
- `supabase/tests/140_patient_booking_restriction_concurrency.ps1`
- `tests/e2e/admin-clients.spec.ts`
- `skills/admin-people-operations/SKILL.md`
- `skills/patient-account/SKILL.md`
- `docs/architecture/admin-plan.md`
- Este relatório.

## Ativação e próximo gate

Documentação atualizada. Não liberar como homologado em HML/produção sem aplicar
a migration, publicar a versão compatível de `session-booking-checkout` e validar
a rota autenticada. Toda aplicação/deploy remoto exige autorização específica;
preservar os grants e a política JWT existentes. A interface suporta backend
anterior, mas contato e gestão de agendamentos dependem da nova migration.

Os comandos de QA usados: Vitest direcionado com `--maxWorkers=1`, Deno test do
contrato de checkout, `typecheck`, `lint`, pgTAP via psql local em rollback,
`pwsh -File supabase/tests/140_patient_booking_restriction_concurrency.ps1` e Playwright
`tests/e2e/admin-clients.spec.ts --project=msedge` contra `localhost:3011`.
Screenshots isolados ficam em `test-results/admin-clients-component-qa/`.
