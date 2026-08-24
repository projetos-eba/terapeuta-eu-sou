# Assessora Aura

## Rota

- `/terapeuta/assessor-ia`
- Capability: `aura_full`
- Plano: Premium Plus

## Referência visual e composição

- Figma principal: arquivo `OSXJi8tknHHCj82MTY2NbG`, nó `13366:1634`.
- A página segue uma composição editorial com hero Aura, personagem visual
  local, faixa de período 30/90 dias, quatro KPIs, três leituras contextuais,
  recomendações e bloco final de resultados.
- O personagem aprovado é reutilizado de
  `public/therapist/dashboard/aura.png`; não usar URL temporária do Figma no
  produto.
- KPIs e barras de referência devem distinguir claramente dado pronto de
  estrutura visual ainda sem base. Ausência de dados não vira zero falso.
- A página é responsiva: hero empilhado e cards em uma coluna no mobile;
  nenhum gráfico ou card pode criar overflow horizontal na página. A composição
  mobile usa alturas mínimas reduzidas sem perder o ritmo editorial do desktop,
  e os controles de período mantêm área de toque de 44px.
- A rota tem skeleton dedicado com `aria-busy` e rótulo acessível explícito. O
  frame Figma chama a superfície visual de `Aura IA`, enquanto o domínio e a
  documentação de rota usam `Assessora Aura`; isso é uma distinção de nome, não
  uma segunda feature ou capability.

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

- Assessora Aura é o nome de produto. A implementação MVP é determinística, por regras versionadas.
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
- Validar visualmente 1440x900, 1024x768, 390x844 e 360x800, incluindo foco,
  zoom de 200%, estado sem recomendações, amostra insuficiente e erro de
  leitura.
