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
- “Encontro” é a copy do paciente; “sessão” é a copy do terapeuta e Admin.

## Contrato de dados

- `public.session_feedback` guarda uma resposta privada por participante e
  booking, com `completed` ou `not_performed`, nota opcional, motivo,
  comentário limitado a 500 caracteres, timestamps e campos internos de
  replay/hash.
- O papel e a identidade vêm do relacionamento da booking no backend. O
  navegador envia somente `bookingId` e os campos da resposta; nunca envia
  `actorRole` ou `requestId`.
- `get_session_feedback_v1` devolve apenas a resposta do participante atual,
  com estados `before_session`, `waiting_for_participants`,
  `attendance_pending`, `eligible`, `incident_only`, `submitted` e erro de
  leitura. A qualidade só fica elegível após os dois joins confiáveis do
  Zoom; `feedback=1` não contorna essa regra.
- `session_participant_confirmations` guarda uma confirmação independente por
  papel. A confirmação manual pode ser registrada junto do feedback concluído;
  a confirmação automática usa o fim programado da reserva + 7 dias. Depois da
  confirmação bilateral, a política ativa exige mais 1 dia de segurança antes
  da elegibilidade financeira.
- `session-feedback-command` valida o payload, cria request id no servidor e
  chama o RPC service-role idempotente. O comando não altera booking,
  `session_payments`, ledger, repasses, reembolsos ou confirmação de serviço.
- `reviews` permanece separado e não é preenchido silenciosamente por este
  fluxo.

## Auditoria Admin

- `/admin/sessoes/:sessionId` usa `admin_get_session_feedback_v1`.
- Admin visualiza respostas do paciente e terapeuta, resultado, nota, motivo,
  comentário, data de envio, participantes pendentes e divergências.
- Admin não edita opiniões, não resolve divergência automaticamente e não
  aciona efeitos financeiros ou de realização da sessão. O detalhe também
  exibe presença, origem manual/automática, prazo, elegibilidade financeira e
  bloqueios de repasse como auditoria somente leitura.
- O modelo administrativo omite request id, hashes, identidade interna, dados
  do Video SDK e URLs privadas.

## Copy e acessibilidade

- Feedback realizado: confirmação da sessão, nota de 1 a 5 e comentário
  opcional.
- Feedback não realizado: ausência do paciente/terapeuta, internet, áudio ou
  vídeo, sessão remarcada, cancelamento em cima da hora ou outro motivo.
- Campos usam labels, foco visível, controles de pelo menos 44px, live regions,
  tokens TES e linguagem sem termos técnicos.
- Manter `prefers-reduced-motion` e estados honestos de carregamento,
  indisponibilidade, erro e sucesso.

## QA

- Testar paciente, terapeuta e Admin isoladamente.
- Testar envio realizado, não realizado, nota, motivo obrigatório, limite de
  500 caracteres, erro, replay idempotente e tentativa duplicada divergente.
- Testar feedback ausente, parcial, completo e conflitante no Admin.
- Testar antes de T-15, somente um participante presente, confirmação manual,
  confirmação automática após sete dias e elegibilidade um dia depois.
- Testar isolamento RLS/RPC e ausência de secrets, JWT, nomes de sessão, URLs,
  áudio, vídeo ou transcrição.
- Executar Vitest focado, Deno, typecheck, lint, build, `npx supabase db
  reset`, `npx supabase db lint --schema public` e `npx supabase test db`.
- QA visual: `1440x900`, `1024x768`, `390x844` e, se necessário, `360x800`,
  cobrindo sala de espera, chamada ativa, saída, feedback realizado, não
  realização e erro.

## Pendências

- Homologação real depende de Checkout Stripe test, webhook assinado,
  pagamento confirmado, Zoom real, contexts Playwright separados e confirmação
  manual do runbook. Nunca executar em produção.
