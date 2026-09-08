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

- `public.session_feedback` guarda uma resposta privada e imutável por
  participante e booking, com `completed` ou `not_performed`, nota, motivo,
  comentário limitado a 500 caracteres, timestamps e campos internos de
  replay/hash.
- O papel e a identidade vêm do relacionamento da booking no backend. O
  navegador envia `bookingId`, campos da resposta e `requestId` opaco para
  retries; nunca envia `actorRole`.
- `get_session_feedback_v2` devolve a resposta do participante atual, as duas
  confirmações, origens, vencimentos, estado bilateral e bloqueios. O fim
  programado/definitivo libera o formulário; joins do Zoom
  são evidência e sinal de risco, não uma trava para resposta ou automação.
- `session_participant_confirmations` guarda uma confirmação independente por
  papel e snapshot da política. Paciente vence em +7 dias e terapeuta em +30;
  o automático grava o vencimento em `confirmed_at`. A segunda resposta
  `completed` define `service_confirmed_at` e inicia a verificação da liquidação
  Stripe, sem espera fixa adicional.
- `session-feedback-command` valida o payload e chama o RPC service-role
  idempotente. O feedback realizado registra a confirmação do ator e pode
  finalizar o estado bilateral; `not_performed` bloqueia o pagamento e abre
  `session_confirmation_incidents`. O comando nunca cria Transfer ou lote.
- `reviews` permanece separado, usa outro comando e nunca altera confirmação,
  pagamento ou lote.

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
