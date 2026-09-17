# Ausência do terapeuta após T+10 — entrega local

> Registro histórico da primeira correção local. As evidências abaixo não
> validam as migrações posteriores de tentativas, qualidade e confirmação.
> Para o contrato vigente nesta árvore, siga a ADR-023: classificação sem
> mutação financeira; avaliação somente com duas entradas; relatos privados;
> confirmação automática em 7/30 dias. O pagamento não aparece mais como
> “em análise” só pela ausência. As evidências da implementação posterior,
> incluindo reexecução em banco local isolado, estão em
> `session-quality-local-validation-2026-09-17.md`. Esses testes não autorizam
> implantação ou regularização de HML.

## Resultado e limites de autoridade

Implementação somente local. Nenhum deploy, commit, push, regularização de
sessão HML, chamada real ao Zoom ou movimentação Stripe foi executado.
O banco local original não recebeu as migrations desta entrega. Alterações
preexistentes do worktree foram preservadas, incluindo ajustes de câmera,
botões do cliente e busca pública.

O finalizador seleciona somente casos classificáveis antes do limite, revalida
versão/horário sob lock e distingue ausência de ambos, ausência exclusiva e
entradas incompletas após o fim. Sessões normais antigas e encerramentos
pendentes não consomem a página de classificação.

Cada participante precisa de sua própria chegada/entrada pontual para acessar
após T+10. T+10 exato permanece inclusivo; reentrada termina no fim agendado.
A chegada do cliente não autoriza a primeira chegada tardia do terapeuta.
A classificação bloqueia imediatamente o acesso e enfileira encerramento
versionado, inclusive para sala lógica `ready`. O worker verifica novamente
versão, horário e motivo antes de usar ID persistido ou uma única
correspondência exata de nome. Ambiguidade não autoriza encerramento.

Paciente recebe `Encontro não realizado`, sem indicação de liberação futura.
Terapeuta recebe `Relatar ocorrência`, não `Confirmar sessão`. Admin recebe
classificação explícita, acesso bloqueado e pagamento em análise. Confirmação
`completed` exige entradas confiáveis de ambos e ausência de classificação
adversa; as duas RPCs de escrita também rejeitam uma confirmação falsa.
Relatos complementam o incidente da versão confirmada, mesmo após incremento
de versão por status; reagendamento não herda sua classificação na projeção.

Ausência do terapeuta/ambos ou acesso incompleto mantém revisão administrativa.
Classificação não faz Refund, Transfer Reversal ou retry de Transfer. O fluxo
administrativo existente decide reagendamento/reembolso com justificativa e
idempotência; não reescreve movimentações já realizadas.

## Evidências locais

- 69 verificações pgTAP aprovadas: `100` (13), `126` (18), `127` (22),
  `128` (7) e `129` (9).
- 175 testes Vitest aprovados em nove arquivos: estado do cliente,
  apresentação, ação/serviço/pagamento do terapeuta, detalhe Admin, formulário,
  sala de espera e adapter Zoom, preservando as regressões de mídia existentes.
- 25 testes Deno aprovados no módulo compartilhado Zoom, incluindo autorização
  por participante, limite inclusivo, evidência antiga/tardia, reentrada,
  bloqueios de alteração/reembolso e encerramento por correspondência exata.
- `deno check` aprovado para as duas Edge Functions alteradas.
- `npm run typecheck`, `npm run lint` e `git diff --check` aprovados.
  Foram reconhecidos 316 nomes de migrations com versões únicas.
- Análise `plpgsql_check` das nove funções PL/pgSQL alteradas, sem apontamentos.
  A reserva de jobs é uma função SQL e foi validada pela execução pgTAP.
- Seis testes Playwright Chromium aprovados: os três perfis em `1440x900` e
  `390x844`, com captura de tela e ausência de scroll horizontal/erros de
  execução. A página real do terapeuta, detalhe Admin e sala de espera real
  são montados com fronteiras de servidor/autenticação simuladas. Requests
  externos são bloqueados; não é prova de rotas autenticadas em HML.
- Banco original: zero crons ativos entre os quatro existentes, conferência
  somente de leitura.

Os testes SQL rodaram em `tes_attendance_validation_20260916`, cópia temporária
do banco local com schemas de cron/realtime/Vault excluídos e ACLs relevantes
restauradas. As migrations de presença pré-requisito ausentes no banco
original foram aplicadas apenas nessa cópia, antes das seis novas migrations.
Cada teste termina em rollback. A cópia foi removida ao concluir; o volume e
o banco original permaneceram preservados. Ela pode ser recriada a partir do
original, sem depender de dados exclusivos apagados.

## Comandos e cobertura reproduzível

- Aplicação progressiva: `Get-Content -Raw <migration> | docker exec -i
  supabase_db_terapeuta-eu-sou psql -U postgres -d
  tes_attendance_validation_20260916 -v ON_ERROR_STOP=1 --quiet`.
- Mesma execução para os cinco arquivos pgTAP. Além do código de saída,
  conferir ausência de `not ok`, `ERROR` e falhas de `finish()`.
- `npx vitest run` com os nove arquivos focados e `--maxWorkers=2
  --reporter=verbose`.
- `deno test --config supabase/functions/deno.json --allow-env --allow-net
  supabase/functions/_shared/zoom-video-sdk`.
- `deno check --config supabase/functions/deno.json` com os entrypoints
  de acesso e manutenção.
- `npx playwright test tests/e2e/attendance-no-show.spec.ts
  --project=chromium`. Evidências regeneradas sob `test-results/`.
- `npm run typecheck`, `npm run lint`, `git diff --check`.

Os testes cobrem cliente exclusivo, terapeuta exclusivo, ausência dupla,
T+10 exato/ultrapassado, evidência pontual/tardia/antiga, reentrada,
reagendamento, fila com sessão normal antiga, encerramento pendente anterior,
idempotência, bloqueios financeiros e relato vinculado ao incidente existente.

## Pendências e riscos

- A suíte Vitest completa (`npm test -- --maxWorkers=2`) foi interrompida sem
  relatório final conclusivo. Não foi contabilizada como aprovada. A suíte
  focada foi repetida depois e passou integralmente.
- Build Next não executado nesta entrega por pressão de memória no host:
  snapshots locais mostraram aproximadamente 1,7–3,1 GiB livres de 15,8 GiB.
  Falta esse gate de compilação antes do rollout. As tentativas de consultar
  CPU/RAM por CIM foram negadas; snapshots alternativos usaram Node e processos.
- Não foi validado ingresso/encerramento real no provedor, concorrência real
  entre webhook e reagendamento, dispositivos físicos, hospedagem ou entrega
  final de comunicação externa. Webhooks tardios exigem revisão da evidência,
  não liberação financeira automática.
- A sessão HML originalmente testada permanece sem regularização. Implantação
  deve ser autorizada separadamente, com inspeção de divergências, migrations
  progressivas e publicação das duas Functions/UI antes do teste supervisionado.
- Antes de implantar, revisar conflitos com alterações locais de outros temas;
  esta entrega não inclui nem publica esses trabalhos.

## Arquivos desta implementação

Migrations novas:

- `supabase/migrations/20260916080000_fix_session_attendance_no_show.sql`
- `supabase/migrations/20260916081000_guard_session_confirmation_by_attendance.sql`
- `supabase/migrations/20260916082000_close_attendance_no_show_room.sql`
- `supabase/migrations/20260916083000_guard_waiting_room_arrival_window.sql`
- `supabase/migrations/20260916084000_scope_no_show_maintenance_to_patient_evidence.sql`
- `supabase/migrations/20260916085000_keep_attendance_reports_in_current_encounter.sql`

Backend/contratos:

- `supabase/functions/_shared/zoom-video-sdk/access-policy.ts`
- `supabase/functions/_shared/zoom-video-sdk/booking-authorization.ts`
- `supabase/functions/zoom-video-session-access/index.ts`
- `supabase/functions/zoom-video-session-maintenance/index.ts`
- `src/domain/tes/booking-contracts.ts`

Apresentação/formulários:

- `src/app/(therapist)/terapeuta/sessoes/[bookingId]/page.tsx`
- `src/features/admin-operations/components/admin-session-detail-page.tsx`
- `src/features/bookings/patient-encounter-state.ts`
- `src/features/bookings/session-presentation.ts`
- `src/features/session-feedback/components/session-feedback-form.tsx`
- `src/features/therapist-sessions/session-feedback-action.ts`
- `src/features/therapist-sessions/session-payment-status.ts`
- `src/features/therapist-sessions/therapist-sessions.service.ts`
- `src/features/zoom/components/zoom-waiting-room.tsx`
- `src/features/zoom/zoom-video-session-adapter.tsx` (somente estado/copy de espera
  nesta tarefa; demais diferenças de mídia já existiam).

Regressões novas/alteradas nesta tarefa:

- `supabase/functions/_shared/zoom-video-sdk/zoom-video-sdk.test.ts`
- `supabase/tests/126_session_attendance_accountability.sql`
- `supabase/tests/127_session_attendance_no_show_queue.sql`
- `supabase/tests/128_session_attendance_role_fences.sql`
- `supabase/tests/129_session_attendance_report_version.sql`
- `src/features/admin-operations/components/admin-detail-pages.test.tsx`
- `src/features/bookings/patient-encounter-state.test.ts`
- `src/features/therapist-sessions/session-feedback-action.test.ts`
- `src/features/therapist-sessions/session-payment-status.test.ts`
- `src/features/therapist-sessions/therapist-sessions.service.test.ts`
- `src/features/zoom/components/zoom-waiting-room.test.tsx`
- `tests/e2e/attendance-no-show.spec.ts`
- `tests/e2e/fixtures/attendance-no-show-boundaries.tsx`
- `tests/e2e/fixtures/attendance-no-show-entry.tsx`

Documentação atualizada:

- `docs/architecture/adr/ADR-022-session-attendance-accountability.md`
- `docs/zoom/architecture.md`
- `docs/zoom/reentry-lifecycle-2026-08-28.md`
- `docs/zoom/troubleshooting.md`
- `docs/zoom/attendance-no-show-local-validation-2026-09-16.md`
- `skills/patient-session-detail/SKILL.md`
- `skills/session-feedback/SKILL.md`
- `skills/therapist-agenda-sessions/SKILL.md`
- `skills/zoom-integration/SKILL.md`
