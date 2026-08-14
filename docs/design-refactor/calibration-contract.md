# Calibration Contract — Sistema Visual TES

Status: autoridade operacional pós-Benchmarks A/B/C  
Atualização: 2026-08-14  
Evidências: [Agenda](./benchmark-a-agenda.md), [Admin / Profissionais](./benchmark-b-admin-professionals.md), [Paciente / Encontros](./benchmark-c-patient-encounters.md) e [handoff](./calibration-handoff.md).

Este contrato promove regras de composição, não uma migração automática de componentes React. Produto, domínio e dados reais continuam acima dele.

## 1. TES Visual Principles

1. A primeira dobra responde à tarefa dominante, não à convenção de dashboard.
2. Hierarquia nasce de tipografia, alinhamento, espaço e ordem antes de card, borda ou sombra.
3. A família TES é humana, profissional, serena e precisa; a densidade muda com a tarefa, não cria uma identidade nova por área.
4. Uma surface só existe para entidade dominante, estado, interação, comparação ou profundidade reais. Card não é layout padrão.
5. Lista organiza identidade → contexto prioritário → estado/orientação → ação.
6. Estado é texto completo com cor, ícone ou surface como reforço; nunca só cor nem uma cápsula automática.
7. A ação forte é contextual e autorizada pelo estado atual; detalhes e ações secundárias não competem com ela.
8. Mobile muda a representação e a prioridade; não comprime tabela, calendário ou controles desktop.

## 2. Pattern Decision Matrix

| Pattern | Decision | Variants | Use when | Avoid when |
| --- | --- | --- | --- | --- |
| PageHeader | `PROMOTE_WITH_VARIANTS` | `open`, `balanced`, `compact-operational`, `legacy` | orienta tarefa, contexto e ActionCluster | card automático, KPI ou ação sem relação com a página |
| Light PageSection | `PROMOTE_WITH_VARIANTS` | `open`, `framed`, `accent` | spacing/divider ou uma delimitação bastam | envolver toda seção em surface elevada |
| EntityList | `PROMOTE_WITH_VARIANTS` | `operational`, `temporal-balanced`, `compact-mobile` | escanear entidades sem card por item | narrativa longa, comparação tabular ou domínio escondido |
| Status anatomy / StatusCluster | `PROMOTE_WITH_VARIANTS` | `inline`, `emphasized`, `guidance` | estado precisa de qualificador, prazo ou orientação | substituir presentation mapping do domínio ou usar badge em tudo |
| Hairline | `PROMOTE` | divider e separação comparável com `border-border` | rows, grupos temporais, tabela e timeline | borda decorativa ou token novo dedicado |
| AccentSemanticSurface | `PROMOTE_WITH_VARIANTS` | `dominant-entity`, `attention`, `contextual-support` | entidade prioritária, exceção ou orientação decisiva | preencher layout, decorar conteúdo ou aninhar surfaces |
| ContextualCTA | `PROMOTE_WITH_VARIANTS` | `primary-now`, `secondary-detail`, `blocked-guidance`, `destructive` | próxima ação muda com estado autorizado | destacar ação futura, não autorizada ou irrelevante |
| FilterBar | `PROMOTE_WITH_VARIANTS` | `operational-admin`, `temporal-agenda`, disclosure mobile | controla diretamente lista, tabela ou calendário | paciente sem refinamento real ou campos espalhados em cards |
| TemporalGroup | `DOMAIN_SPECIFIC` | futuros/histórico do Paciente | continuidade temporal de encontros | inferir API transversal entre Agenda e Paciente |
| NextEncounterSpotlight | `DOMAIN_SPECIFIC` | próximo encontro do Paciente | relação terapeuta–tempo–ação elegível | card genérico de “próximo item” |
| PatientStatusGuidance | `DOMAIN_SPECIFIC` | entrada, pagamento, reagendamento e tempo | traduzir estado em próximo passo | status técnico ou copy fora do mapper do Paciente |
| PatientEncounterIdentity | `DOMAIN_SPECIFIC` | terapeuta, oferta e abordagem | contexto do encontro do Paciente | unificar com entidade administrativa por semelhança visual |
| CommandBar | `DOMAIN_SPECIFIC` | período, modo e navegação da Agenda | comando temporal ou modo operacional real | toolbar simples, filtro ou ações sem grupo |
| ContextRail | `DOMAIN_SPECIFIC` | contexto temporal complementar da Agenda | ajuda decisão sem reduzir main | preencher espaço ou reduzir largura comparativa |
| MetricStrip | `DOMAIN_SPECIFIC` | resumo administrativo autoritativo | poucos números mudam uma decisão operacional | KPI decorativo ou primeira dobra sem necessidade |
| OperationalTable | `KEEP_LOCAL` | tabela de Profissionais | comparação por atributos equivalentes | dados heterogêneos ou mobile comprimido |
| Cores semânticas de terapia | `KEEP_LOCAL` | Agenda | reconhecer modalidade dentro da grade | expandir paleta local sem contraste comprovado |
| `AppPageHeader`/`AppPageSection` card-heavy por default | `DEPRECATE` | `legacy` até migração opt-in | consumidores existentes compatíveis | novas páginas/refactors que podem ser abertos |
| `TESCard` como unidade automática de página | `DEPRECATE` | primitive semântico permanece | entidade autônoma, escolha, resumo ou elevação real | cada seção, linha ou bloco textual |
| `TESBadge` para todo status | `DEPRECATE` | badge breve e escaneável | estado curto que exige varredura | metadata, orientação ou múltiplos estados relacionados |
| KPI cards universais | `REJECT` | — | — | números sem decisão associada |
| Token global de hairline | `REJECT` | — | — | `border-border` já cobre os três benchmarks |
| `UpcomingMeeting`/`JourneySection` genéricos | `REJECT` | — | — | generalizar semântica emocional ainda local |

Guardrail: uma ocorrência é local; duas são candidate; três contextos comprovadamente compatíveis justificam promoção. Promover pattern não implica componente React: a API só nasce após anatomia, estados, responsividade e acessibilidade estáveis.

## 3. Page Anatomy

```text
Page → Header → Primary Context (se muda a decisão) → Main task representation
     → Refinement/local actions → Secondary continuity or disclosure → Detail
```

- Temporal / Agenda: header operacional aberto → período e comandos → calendário/timeline dominante → contexto temporal complementar.
- Exception / Admin: header compacto → resumo somente se altera triagem → busca/filtros próximos → tabela ou EntityList → detalhe por rota.
- Balanced / Paciente: header editorial contido → próximo encontro dominante → futuros/histórico em grupos abertos → detalhe transacional.

Surface principal é permitida quando protege uma região espacial complexa, comparável ou uma entidade prioritária. Rail, filtro, métrica e card não são partes obrigatórias da anatomia.

## 4. Status System

- `inline`: dot ou ícone + label completo para estado escaneável.
- `emphasized`: superfície curta para exceção que muda a atenção.
- `guidance`: estado + explicação + CTA quando a pessoa precisa decidir agora.

O domínio é dono de status técnico, copy, autorização e presentation mapping. O sistema é dono da anatomia, contraste, legibilidade, foco e não depender só de cor. Badge é exceção, não formato padrão.

## 5. Action Hierarchy

| Nível | Papel | Regra |
| --- | --- | --- |
| Primary | próxima decisão autorizada agora | uma por escopo; pode ser full-width no mobile |
| Secondary | detalhe ou alternativa útil | peso visual menor; não competir com a primary |
| Contextual | pertence à entidade/linha | próximo do item; não esconder ação relevante em menu |
| Destructive | cancelar, suspender, encerrar | rótulo explícito, confirmação quando necessária e feedback real |
| Inline | navegação ou refinamento leve | não simular botão primary |

## 6. Surface Strategy

- Fundo separa regiões e estabelece atmosfera.
- Seção aberta é default para conteúdo relacionado por ordem e espaço.
- `framed` usa uma borda útil, sem sombra, para comparação ou delimitação.
- Accent semantic surface serve a estado, orientação ou entidade dominante.
- Card é opt-in para entidade interativa/autônoma ou elevação real.
- Modal, popover e detail panel obedecem aos contratos de acessibilidade existentes.

Wrappers card-heavy atuais são legados compatíveis. Não alterar defaults em massa; novas páginas devem escolhê-los explicitamente e justificar a surface.

## 7. Responsive Rules

- Desktop preserva comparação e contexto periférico úteis.
- Tablet reduz concorrência: ação desce do header, rail pode virar faixa, tabela preserva comparações essenciais.
- Mobile preserva contexto crítico junto da entidade e troca representação: calendário vira cronologia; tabela vira EntityList; filtros secundários recolhem com resumo ativo.
- Ações essenciais ficam alcançáveis, touch target tem pelo menos `44px` e texto funcional não fica abaixo de `14px` (`11px` desktop/`10px` mobile só para metadata secundária).
- Não criar scroll horizontal de página. Scroll interno é exceção justificada.

## 8. Reference Interpretation Rules

Referência externa ou Figma é direção, não especificação. Extrair hierarquia, composição, densidade, ritmo, transformação por viewport e ideia de interação. Adaptar ou rejeitar branding, tokens, copy, decoração, componentes e estruturas que conflitem com tarefa, domínio, acessibilidade ou TES.

Registrar divergência relevante entre referência, código e fontes de produto. Screenshot real da página pesa mais que inferência visual. Referência não pode reintroduzir microtexto, cardification, borda/sombra sem função, CTA concorrente ou desktop comprimido no mobile.

## 9. Deprecated / Rejected Patterns

Não usar em novas refatorações: wrapper card-heavy por default, card por entidade, badge para toda metadata, rail para ocupar espaço, KPI cards sem decisão, token hairline novo, CommandBar sem comandos reais e tabela comprimida no mobile. Não promover `UpcomingMeeting` ou `JourneySection` genéricos.

## 10. Migration Strategy

1. Inspecionar tarefa, domínio, estados e referências antes de escrever React.
2. Declarar densidade e patterns no plano da feature.
3. Usar contracts promovidos localmente; não criar componente global até a próxima ocorrência confirmar slots, states e responsividade.
4. Migrar página por página e manter wrappers legados até existir variante opt-in testada em consumidores reais.
5. Remover wrappers desnecessários primeiro; depois consolidar variante ou primitive se a repetição comprovar a API.
6. Executar Playwright visível em desktop, tablet e mobile; corrigir antes de aprovar e preservar domínio, rotas, RLS e contratos.

## 11. Workflow obrigatório

```text
Inspect → Understand dominant task → Reference interpretation → UX proposal
→ Visual composition → DS mapping → Implement → Playwright Visual QA → Fix → Approve
```

Usar dados e estados reais quando disponíveis. Mock visual não é evidência final se a página real puder ser aberta. A aprovação exige Visual Quality Score `>= 85`, sem eliminatório e com evidência desktop/tablet/mobile.

## 12. Next-page Readiness

O sistema está pronto para refatorações página por página. Não autoriza big-bang rewrite, instalação de Storybook, reorganização de `src/components/tes` ou promoção automática de APIs React. Cada página inicia pelo workflow acima e pelos contratos deste documento.

## 13. Adversarial QA

- **“Todas as telas vão ficar iguais?”** Não. Header, lista, surface e densidade
  variam por tarefa; somente anatomias estáveis e regras de decisão são comuns.
- **“Patterns promovidos já viram componentes globais?”** Não. A promoção é de
  contrato. APIs React aguardam uma próxima ocorrência compatível e testes.
- **“O contrato reintroduz dashboard SaaS?”** Não. Rail, MetricStrip, CommandBar
  e filtros permanecem condicionais, e KPI/card/badge automáticos foram
  deprecados ou rejeitados.
- **“Mobile foi tratado como compressão?”** Não. Há transformações explícitas
  para calendário, tabela, listas, filtros e ações.
- **“A personalidade TES depende de roxo ou decoração?”** Não. Ela depende da
  tarefa na primeira dobra, ritmo, display nos momentos editoriais, linguagem,
  estado explicativo e surfaces semânticas escassas.

Risco aceito: wrappers legados ainda usam card, borda e sombra por default. A
migração gradual evita regressão cross-shell; cada novo uso deve optar pela
variante adequada e justificar sua surface.

`CALIBRATION APPROVED`
