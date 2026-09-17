---
name: session-feedback
description: Feedback bilateral privado pós-sessão e auditoria administrativa da chamada TES.
---

# Feedback pós-sessão

## Fontes obrigatórias

1. `AGENTS.md`.
2. `skills/tes-ui-experience/SKILL.md`.
3. `skills/tes-design-system/SKILL.md`.
4. `skills/zoom-video-call/SKILL.md`.
5. `docs/product/sitemap.md`.
6. `docs/product/routes-map.md`.
7. `docs/product/integration-map.md`.
8. `docs/product/page-inventory.md`.
9. `docs/zoom/architecture.md` e `docs/zoom/testing.md`.

Frame Figma dedicado para a sala de vídeo ou feedback: Não identificado nos
arquivos analisados. As referências anexadas orientam apenas hierarquia,
estados e responsividade. Nodes internos consultados: `12272:2`, `5999:10563`,
`12304:2`, `12450:506` e `12226:2678`.

## Rotas e jornada

- Paciente: `/app/encontros/:bookingId/video`.
- Terapeuta: `/terapeuta/sessoes/:bookingId/video`.
- O feedback é exibido na mesma rota depois de sair/encerrar. O detalhe pode
  reabrir a tela por `?feedback=1`; não criar entrada em `src/lib/routes.ts`.
- A Home do paciente mostra somente a pendência mais recente e abre
  `TESDialog` após clique. `/app/encontros` lista todas as pendências e abre o
  booking indicado por CTA/query.
- “Encontro” é a copy do paciente; “sessão” é a copy do terapeuta e Admin.

## Contrato de dados

### Regra vigente da ADR-023 (substitui o contrato legado descrito abaixo)

- `booking_session_attempts` identifica a tentativa atual e só avança em
  reagendamento efetivo. `session_feedback` permanece histórico; novas respostas
  privadas são `session_quality_feedback`, sempre vinculadas à tentativa.
- `GET /api/session-feedback` usa `get_session_quality_feedback_v1` e separa
  realização, resposta de qualidade, confirmação individual e financeiro.
  Transfer `transferred` jamais significa confirmação. Fila de avaliações
  inclui somente encontros encerrados com joins confiáveis de ambos, sem
  classificação de ausência ou revisão técnica pendente.
- `POST /api/session-feedback` exige `contractVersion: 2`, `bookingId`,
  `sessionAttemptId`, `successful`, `qualityReason`, `rating`, `comment` e
  `requestId`. “Sim” exige nota 1–5 sem motivo. “Não” exige motivo
  `internet_problem`, `audio_video_problem` ou `other`, sem estrelas. Máximo de
  500 caracteres. O servidor verifica identidade e tentativa; contrato antigo
  e tentativa vencida falham fechados.
- “Não” significa sessão realizada não bem-sucedida, não `not_performed`.
  Cria ticket privado e revisão com cinco dias corridos; só resposta pública do
  TES naquele ticket conta. Um ou dois relatos ficam separados. Sem joins
  bilaterais não há formulário, nota nem pendência de avaliação: usar suporte
  ou incidente de presença fora do feedback.
- Qualidade, confirmação e presença não chamam nem bloqueiam Transfer, Refund
  ou Reversal. Confirmação automática de cliente/terapeuta vence após 7/30 dias
  do término previsto, revalida a tentativa e nunca ocorre em “Não realizada”.
  Um relato não respondido pausa a automação até seu prazo de cinco dias; depois
  ela retoma o vencimento original, mantendo a análise aberta e alertando Admin.
  Resposta do TES não fabrica confirmação individual nem modifica registros.
- Admin lê relatos da tentativa atual e legados históricos separadamente,
  sem resposta privada cruzada para cliente ou terapeuta. QA: resposta
  positiva/negativa, idempotência, tentativa desatualizada, dois tickets,
  privacidade RLS, SLA exato, confirmação 7/30 dias, ausência e snapshots
  financeiros imutáveis, desktop/mobile dos três perfis.

### Histórico anterior (não normativo para o contrato V2)

- `public.session_feedback` guarda uma resposta privada e imutável por
  participante e booking, com `completed` ou `not_performed`, nota, motivo,
  comentário limitado a 500 caracteres, timestamps e campos internos de
  replay/hash.
- O papel e a identidade vêm do relacionamento da booking no backend. O
  navegador envia `bookingId`, campos da resposta e `requestId` opaco para
  retries; nunca envia `actorRole`.
- `get_session_feedback_v2` devolve a resposta do participante atual, as duas
  confirmações, origens, vencimentos, estado bilateral e bloqueios. O fim
  programado/definitivo libera o formulário. `eligible` e confirmação
  `completed` exigem entradas confiáveis de ambos, sem incidente de presença
  aberto. `incident_only` permite exclusivamente relato `not_performed`, sem
  nota, mesmo quando a revisão administrativa bloqueia o pagamento. Ausência
  de evidência bilateral não pode oferecer `Confirmar sessão`.
- No V10, os dois read models de confirmação usam as respostas dos
  participantes para o estado bilateral: o envio do repasse não conclui a
  confirmação e não há data de lote semanal no feedback. A reavaliação de
  elegibilidade semanal é exclusiva do V9 e não pode reclassificar um pagamento
  V10. Ocorrências negativas abrem análise e a decisão de suporte preserva o
  estado autoritativo do repasse V10; esse contrato deve permanecer coberto por
  pgTAP e validação autenticada antes do rollout.
- `session_participant_confirmations` guarda uma confirmação independente por
  papel e snapshot da política. Paciente vence em +7 dias e terapeuta em +30;
  o automático grava o vencimento em `confirmed_at`. A segunda resposta
  `completed` define `service_confirmed_at`. Somente no V9 ela inicia a
  verificação da liquidação Stripe, sem espera fixa adicional; no V10 não
  reprograma o repasse criado após o pagamento.
- `session-feedback-command` valida o payload e chama o RPC service-role
  idempotente. O feedback realizado registra a confirmação do ator e pode
  finalizar o estado bilateral; `not_performed` bloqueia o pagamento e abre
  `session_confirmation_incidents`. O comando nunca cria Transfer ou lote.
- `reviews` permanece separado, usa outro comando e nunca altera confirmação,
  pagamento ou lote.
- Depois de um feedback `completed` do terapeuta, Premium Plus pode abrir a
  seção opcional “Quais foram os temas da sua sessão?” tanto no sucesso do
  feedback quanto no detalhe `/terapeuta/sessoes/:bookingId`. A orientação é
  “Registre até três temas para acompanhar essa jornada no seu histórico com o
  cliente.” Ela é um comando separado em
  `booking_journey_theme_selections`: aceita de um a três chaves da taxonomia
  fechada `journey_topics_v1`, exige declaração explícita, não tem texto livre
  e é imutável por booking. Falha, ausência ou retry desses temas nunca bloqueia
  feedback, confirmação, pagamento, ledger, repasse ou avaliação.
- O paciente não vê nem envia temas. O backend deriva terapeuta e vínculo da
  reserva, e o registro não alimenta Aura, exportação ou métricas entre pessoas
  nesta fase.

## Auditoria Admin

- `/admin/sessoes/:sessionId` usa `admin_get_session_feedback_v2`.
- Admin visualiza respostas do paciente e terapeuta, resultado, nota, motivo,
  comentário, data de envio, participantes pendentes e divergências.
- Admin não edita opiniões. Divergência exige decisão humana auditada por
  `admin_resolve_session_confirmation_incident_v1`: realizada inicia a
  verificação de liquidação na decisão; não realizada mantém o bloqueio e segue o fluxo de
  cancelamento/reembolso.
- O detalhe exibe presença, origem manual/automática, prazo, elegibilidade
  financeira e bloqueios de repasse.
- O modelo administrativo omite request id, hashes, identidade interna, dados
  do Video SDK e URLs privadas.

## Copy e acessibilidade

- Feedback realizado: confirmação da sessão, nota obrigatória de 1 a 5 e
  comentário opcional.
- Feedback não realizado: ausência do paciente/terapeuta, internet, áudio ou
  vídeo, sessão remarcada, cancelamento em cima da hora ou outro motivo.
- Campos usam labels, foco visível, controles de pelo menos 44px, live regions,
  tokens TES e linguagem sem termos técnicos.
- O sucesso confirma apenas que a resposta foi registrada e preserva sua
  privacidade. Nunca mencionar no feedback gates financeiros, segurança,
  liquidação, lotes, jobs, provedores ou próximos passos internos sem ação da
  pessoa usuária.
- Manter `prefers-reduced-motion` e estados honestos de carregamento,
  indisponibilidade, erro e sucesso.

## QA

- Testar paciente, terapeuta e Admin isoladamente.
- Testar envio realizado, não realizado, nota, motivo obrigatório, limite de
  500 caracteres, erro, replay idempotente e tentativa duplicada divergente.
- Testar feedback ausente, parcial, completo e conflitante no Admin.
- Testar antes do fim, ausência de telemetria, confirmação manual nas duas
  ordens, paciente automático no dia 7, terapeuta automático no dia 30,
  recuperação atrasada, concorrência/repetição e início imediato da verificação
  de liquidação após a confirmação bilateral.
- Testar bloqueio por relato negativo, cancelamento, reembolso, disputa,
  administração, decisão humana e cutoff do próximo lote.
- Testar isolamento RLS/RPC e ausência de secrets, JWT, nomes de sessão, URLs,
  áudio, vídeo ou transcrição.
- Testar temas apenas para terapeuta Premium Plus após confirmação realizada:
  limite de 1–3, taxonomia fechada, declaração obrigatória, replay idempotente,
  imutabilidade e rejeição de paciente, terapeuta externo e sessão inelegível.
- Executar Vitest focado, Deno, typecheck, lint, build, migrações progressivas,
  `npx supabase db lint --local` e `npx supabase test db --local`. Nunca resetar
  dados locais sem autorização explícita.
- QA visual: `1440x900`, `1024x768`, `390x844` e, se necessário, `360x800`,
  cobrindo sala de espera, chamada ativa, saída, feedback realizado, não
  realização e erro.

## Pendências

- Homologação real depende de Checkout Stripe test, webhook assinado,
  pagamento confirmado, Zoom real, contexts Playwright separados e confirmação
  manual do runbook. Nunca executar em produção.
