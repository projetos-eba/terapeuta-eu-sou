# Feedback individual e avaliação pública — HML e correção local

Data: 2026-09-18. Contrato normativo: ADR-024 — avaliação privada independente
de confirmação. Documentação atualizada.

## Evidência HML

- Projeto explicitamente linkado: `emzwqkmrryuqvqiohqnu`.
- Sessão observada: `95a69560-98ea-4434-80f1-645022b7aed5`, referência
  `26S000153`, 13:45–14:05 em America/Sao_Paulo.
- Cliente e terapeuta permaneceram conectados no IAB até o término previsto.
  Eventos de presença consultados estavam vinculados à tentativa atual.
- O encerramento foi persistido às `2026-09-18T17:05:01.230601Z`. A interface
  apresentou aviso transitório de cleanup parcial antes de abrir os formulários.
- Cliente: envio de “Sim”, nota 5 e comentário vazio resultou em
  “Revise os dados do feedback.”; os campos desapareceram e não houve gravação.
- Terapeuta: primeiro envio encontrou acesso expirado. Após renovar o login e
  reabrir pelo CTA dos detalhes, o mesmo cenário resultou no mesmo erro de
  validação e desaparecimento dos campos.
- A leitura autenticada de `get_session_quality_feedback_v1`, restrita ao
  booking indicado, retornou para ambos `contractVersion: 2`, tentativa atual,
  `realizationStatus: performed`, `status: eligible` e `feedback: null`.
- Não foi possível validar em HML o retorno após um envio efetivamente salvo:
  os dois envios foram rejeitados. Não tratar o desaparecimento dos campos como
  confirmação de sucesso.

## Divergência publicada

O código publicado de `session-feedback-command` foi baixado por CLI para uma
pasta temporária isolada, sem substituir o código local. Sua validação exige
`outcome` e `notPerformedReason` e chama
`submit_session_feedback_for_actor_v1`. Esse contrato rejeita o payload V2 de
qualidade por tentativa. O banco e o código local usam V2; a Function local
chama `submit_session_quality_feedback_v1` com tentativa e `successful`.

A correção de HML exige a publicação coordenada da aplicação e da Function
local atualizada, seguida de comparação semântica da fonte remota e repetição
dos dois envios. Publicar apenas a interface mantém esse bloqueio. Não adicionar
fallback para o contrato antigo: isso pode restaurar efeitos de confirmação
que a ADR-024 removeu. Nenhum deploy foi executado nesta tarefa.

## Correção local

- A sala do cliente oferece o formulário público existente após resposta
  privada positiva, inclusive ao reabrir a resposta. O terapeuta vem do detalhe
  autorizado. A nota pública começa separada e exige publicação explícita.
- O CTA do detalhe do cliente exige elegibilidade e ausência da própria
  resposta. A consulta do terapeuta usa explicitamente a RPC atual de qualidade.
- Resposta persistida mostra “Sua avaliação foi registrada”, sem depender de
  confirmação individual ou resposta da outra pessoa.
- A sala atualiza o retorno aos detalhes para ambos os perfis após persistir.
- Falha do POST mantém campos e permite retry com o mesmo request ID. Sucesso
  do POST permanece autoritativo mesmo se a leitura posterior falhar ou atrasar.

## Handoff

STATUS

IMPLEMENTED. Gate integrado: PARTIAL. HML ainda não homologada após a correção.

SCOPE

Avaliação privada individual, retorno aos detalhes e etapa pública opcional na
sala do cliente. Correção local para revisão e posterior PR.

FILES CHANGED

- `src/app/(authenticated)/app/encontros/[bookingId]/video/page.tsx`
- `src/features/patient-session-detail/components/session-overview-card.tsx`
- `src/features/patient-session-detail/components/online-session-card.test.tsx`
- `src/features/session-feedback/components/session-feedback-form.tsx`
- `src/features/session-feedback/components/session-feedback-form.test.tsx`
- `src/features/session-feedback/components/session-quality-status.tsx`
- `src/features/therapist-sessions/therapist-sessions.queries.ts`
- `src/features/therapist-sessions/therapist-sessions.queries.test.ts`
- `src/features/zoom/components/zoom-video-call-page.tsx`
- `src/features/zoom/zoom-video-session-adapter.tsx`
- `src/features/zoom/zoom-video-session-adapter.test.tsx`
- `tests/e2e/attendance-no-show.spec.ts`
- `tests/e2e/fixtures/attendance-no-show-entry.tsx`
- `tests/e2e/fixtures/attendance-no-show-boundaries.tsx`
- `skills/session-feedback/SKILL.md`
- `skills/patient-session-detail/SKILL.md`
- `skills/therapist-agenda-sessions/SKILL.md`
- `skills/zoom-video-call/SKILL.md`
- `docs/zoom/session-feedback-hml-local-fix-2026-09-18.md`

DB CHANGES

Nenhuma. Sem migration nova, alteração de schema, RLS, grants ou dados diretos.
A migration `20260918190000_decouple_quality_feedback_from_confirmation.sql`
já existia antes deste trabalho e não foi modificada ou aplicada nesta tarefa.

PUBLIC CONTRACT CHANGES

Nenhuma. Reutilizados contratos V2, rotas, cookies por papel e API pública de
avaliação do terapeuta. Nova prop interna transporta o terapeuta autorizado.

CROSS-DOMAIN IMPACT

Cliente e terapeuta: apresentação e atualização de resposta própria. Zoom:
experiência após encerramento. Sem alteração de presença, confirmação, Admin,
pagamentos, repasse, reembolso ou decisão financeira.

SECURITY IMPACT

Sem alteração de autorização. Consultas HML restritas à sessão, com credenciais
somente em memória e sem chave, JWT ou payload sensível nos artefatos. Escritas
de presença/encerramento ocorreram pelo fluxo normal da sala; feedback foi
tentado somente pela interface autorizada. Não houve escrita direta no banco.

TESTS

- Vitest focado em feedback, detalhes, consultas, API e página da sala:
  107 testes em 22 arquivos aprovados.
- Vitest do adapter da sala: 87 testes aprovados, incluindo refresh para cliente
  e terapeuta sem confirmação individual.
- Deno da Function local de feedback: 3 testes aprovados para V2 positivo,
  negativo e rejeição de contrato antigo/inválido.
- Playwright Chromium, filtro `quality feedback`: 9 cenários aprovados em
  `1440x900`, `1024x768`, `390x844`. Publicação pública independente e reabertura
  da resposta cobertas no fixture local; screenshots desktop/mobile revisadas.
- Typecheck, lint e build concluídos com sucesso.
- pgTAP local focado: execução falhou. `131_quality_review_privacy_and_deadlines`
  passou; `075` encontrou `PATIENT_SCHEDULE_CONFLICT`, `089` falhou na
  independência de confirmação automática e `130` encontrou confirmação pelo
  contrato antigo e um `set_config(unknown, uuid, boolean)` sem cast. Consulta
  somente leitura confirmou que a migration existente da ADR-024 está ausente
  no banco local. Estes testes/schema não foram alterados. Não houve reset.

KNOWN RISKS

P1 operacional em HML: Function publicada incompatível com V2. Gate remoto
permanece bloqueado até publicação autorizada e confirmação dos dois registros
individuais, sem alteração de confirmações/financeiro. Gate SQL local pendente
de alinhamento seguro do ambiente e revisão das fixtures existentes.

Rollback da interface: reverter somente este diff em revisão. Não reverter a
ADR-024 nem regressar a Function para confirmação acoplada ao feedback.

NEEDS FROM OTHER AGENTS

Nenhuma delegação. Revisão humana e publicação posterior fora desta tarefa.

SAFE TO INTEGRATE?

WITH CONDITIONS. Revisar o diff local; resolver gate SQL do ambiente e publicar
a Function V2 junto da aplicação antes de declarar HML homologada. Sem commit,
push ou PR neste trabalho.
