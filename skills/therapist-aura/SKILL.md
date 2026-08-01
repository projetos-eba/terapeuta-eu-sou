# Assessor IA / Aura

## Rota

- `/terapeuta/assessor-ia`
- Capability: `aura_full`
- Plano: Premium Plus

## Fontes Obrigatórias

- `AGENTS.md`
- `README.md`
- `docs/architecture/metricas-tes-LEIAME.md`
- `docs/architecture/adr/ADR-011-therapist-metrics-contracts-and-decisions.md`
- `docs/architecture/therapist-metrics-reports-strategy.md`
- `docs/architecture/therapist-metrics-mtr1-mtr3.md`
- `docs/architecture/therapist-metrics-mtr4-mtr5-mtr7.md`
- `src/domain/tes/plan-definitions.ts`
- `src/lib/permissions.ts`
- `src/features/therapist-shell/therapist-route-policy.ts`

## Contrato

- Aura IA e nome de produto. A implementacao MVP e deterministica, por regras versionadas.
- Nao usar IA generativa, LLM, embeddings, modelos de sentimento, chat ou texto livre.
- O terapeuta e derivado de `auth.uid()` em RPC privada.
- Premium nao recebe feed, pagina ou API Aura. `aura_limited` fica apenas como compatibilidade tecnica.
- A pagina consome `get_therapist_aura_signals_v1(period)` e calcula recomendacoes em regra server-only.
- Dismiss usa `dismiss_therapist_aura_signal_v1` com `requestId` server-side.

## Dados Permitidos

- Agregados operacionais do proprio terapeuta.
- Agenda publica/agendavel via slot engine canonico.
- Contagem de avaliacoes publicadas sem resposta publicada.
- Taxas com amostra minima de 10 quando aplicavel.

## Dados Proibidos

- Identificador de paciente.
- Booking individual.
- Conteudo de comentario privado, resumo de sessao, conversa ou intake.
- Tendencia agregada do portal.
- Comparacao entre terapeutas.
- Dados demonstrativos silenciosos.

## Regras MVP

- `aura.booking_readiness.no_future_slots.v1`
- `aura.reviews.pending_reply.v1`
- `aura.sessions.cancellation_increased.v1`
- `aura.sessions.no_show_increased.v1`
- `aura.continuity.return_rate_decreased.v1`

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test -- src/features/therapist-aura/therapist-aura.rules.test.ts`
- Playwright headed em `/terapeuta/assessor-ia` para Premium Plus logado.
