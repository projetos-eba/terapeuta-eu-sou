# Assessora Aura

## Rota

- `/terapeuta/assessor-ia`
- Capability: `aura_full`
- Plano: Premium Plus

## Soft launch

- `AURA_ENABLED` é uma flag server-only e fail-closed: apenas o valor literal
  `true` libera a Assessora Aura.
- O acesso funcional exige `AURA_ENABLED` e a capability `aura_full`.
- Com a flag desligada, sidebar e rota exibem “Em breve”; a rota autenticada,
  dashboard, service, queries e dismiss não podem executar leituras ou RPCs da
  Aura.
- A reativação ocorre por configuração de ambiente seguida de deploy/restart.

## Referência visual e composição

- Figma principal: arquivo `OSXJi8tknHHCj82MTY2NbG`, nó `13366:1634`; o
  cabeçalho usa o nó `13366:1636`.
- A página segue uma composição editorial com hero Aura, personagem visual
  local, faixa de período 30/90 dias, quatro KPIs, três leituras contextuais,
  recomendações e bloco final de resultados.
- O cabeçalho dedicado usa o export aprovado
  `public/therapist/aura/hero-aura.png`, obtido do nó `13366:1636`; não usar
  URL temporária do Figma no produto. A personagem recortada em
  `public/therapist/dashboard/aura.png` permanece exclusiva do card da Aura na
  Visão geral.
- KPIs e barras de referência devem distinguir claramente dado pronto de
  estrutura visual ainda sem base. Ausência de dados não vira zero falso.
- A página é responsiva: hero empilhado e cards em uma coluna no mobile;
  nenhum gráfico ou card pode criar overflow horizontal na página. A composição
  mobile usa alturas mínimas reduzidas sem perder o ritmo editorial do desktop,
  e os controles de período mantêm área de toque de 44px.
- A rota tem skeleton dedicado com `aria-busy` e rótulo acessível explícito. O
  frame Figma ainda chama a superfície visual de `Aura IA`, mas o nome público
  e exibido no produto é `Assessora Aura`; isso é uma referência visual
  histórica, não uma segunda feature ou capability.
- No cabeçalho, preservar o nome público `Assessora Aura`, a composição
  editorial com asset panorâmico, a hierarquia de título/badges e a informação
  de que os sinais são calculados por regras. Em telas pequenas, priorizar a
  legibilidade do conteúdo sobre o enquadramento completo do asset.

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
- A pagina consome `get_therapist_aura_signals_v2(period)` e calcula recomendacoes em regra server-only.
- Recomendações persistidas só entram quando `generated_at` pertence ao período histórico completo selecionado, estão ativas, não expiraram e usam regra/versão registradas.
- Avaliações pendentes respeitam o mesmo período 30/90 exibido na página.
- Dismiss usa `dismiss_therapist_aura_signal_v2`: o navegador envia apenas a chave opaca e o período; o servidor prova tenant, regra, versão, elegibilidade e janela antes de persistir.
- O dashboard Premium Plus usa o mesmo `getTherapistAuraPage` da página
  dedicada, com período de 30 dias; não há leitura REST paralela da tabela
  `aura_recommendations`.
- A UI informa data/fuso da leitura, separa histórico de agenda futura e
  identifica barras sem série histórica como visual ilustrativo.
- Na Visão geral, a ilustração da Aura fica centralizada no espaço visual
  reservado; a copy exibida ao terapeuta usa linguagem simples e não menciona
  a implementação técnica das regras.

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
- Cobrir flag desligada/ligada, deep link sem chamada de dados e dashboard sem
  RPC quando a flag estiver desligada.
- `npx vitest run src/features/therapist-aura` (rules, mapper, page and dismiss UX)
- `npx supabase test db --local supabase/tests/083_aura_contract_security.sql`
- Playwright headed em `/terapeuta/assessor-ia` para Premium Plus logado.
- Validar visualmente 1440x900, 1024x768, 390x844 e 360x800, incluindo foco,
  zoom de 200%, estado sem recomendações, amostra insuficiente e erro de
  leitura.
