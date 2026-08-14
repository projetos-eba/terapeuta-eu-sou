---
name: tes-design-system
description: Governar tokens, primitives, composition patterns, componentes, variantes, estados, acessibilidade e responsividade do TES. Usar antes de criar, alterar, duplicar ou promover componente compartilhado e ao revisar dívida visual; não substituir UX nem domínio da feature.
---

# TES Design System

## Objetivo

Decidir como reutilizar e evoluir o sistema sem criar componentes paralelos nem
abstrações prematuras. Esta skill governa o **como sistêmico**; `$tes-ui-experience`
governa experiência/composição e a skill da feature governa domínio.

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/design-system/tokens.md` e `src/app/globals.css`.
3. `tailwind.config.ts`.
4. `src/components/tes/` e `src/components/app-page/`.
5. `docs/design-system/design-system.md`.
6. `docs/design-system/component-inventory.md`.
7. `docs/design-system/COMPONENT_ARCHITECTURE.md`.
8. `docs/design-system/COMPONENT_USAGE_GUIDELINES.md`.
9. `docs/design-system/composition-patterns.md`.
10. `docs/design-system/interaction-patterns.md`.
11. skill e componentes locais da feature.

Consultar Figma Design System e ícones quando a mudança envolver visual ou
iconografia. Usar o estado real do código quando documentação histórica divergir.

## Decision gate antes de criar componente

Responder e registrar:

1. Já existe componente funcionalmente equivalente?
2. Uma primitive existente pode compor a solução?
3. Existe composition pattern TES aplicável?
4. A necessidade deve ser uma variante de componente existente?
5. A regra é realmente específica do domínio?
6. Generalizar agora cria abstração prematura?

Se a resposta 1–4 for positiva, preferir reuso/composição/variante. Se o contrato
ainda estiver instável, manter local e registrar candidate; não criar API global.

## Classificação

- `primitive`: unidade de interação/estilo sem regra de domínio, como button ou input.
- `pattern`: composição recorrente, como FilterBar ou ContextRail.
- `domain`: conhece entidade, estado ou linguagem de uma área.
- `page-specific`: resolve uma necessidade local ainda não comprovada.

Não classificar por pasta atual. Classificar por responsabilidade e dependências.

## Admissão no Design System

Promover somente quando:

- houver repetição real em duas superfícies ou três usos próximos e confirmados;
- anatomia, states e responsividade estiverem estáveis;
- API reduzir divergência sem esconder domínio;
- todos os valores visuais usarem tokens TES ou exceção documentada;
- accessibility contract e testes estiverem definidos;
- owner e caminho de manutenção estiverem claros.

Um pattern documentado não precisa virar componente React.

## Calibration decisions

`docs/design-refactor/calibration-contract.md` é a decisão pós-Benchmarks A/B/C.
Aplicar suas classificações antes de criar componentes:

- PageHeader, Light PageSection, EntityList, status anatomy,
  AccentSemanticSurface, ContextualCTA e FilterBar são patterns compartilhados
  com variantes, mas não autorizam uma API React rígida automaticamente.
- Hairline é técnica com `border-border`; não criar token específico.
- CommandBar, ContextRail, MetricStrip, TemporalGroup e tratamentos de
  encontros permanecem locais/de domínio conforme o contrato.
- `AppPageHeader`, `AppPageSection` e `TESCard` continuam compatíveis, porém o
  uso card-heavy como default está deprecado para novos refactors. Não alterar
  defaults globais sem variante opt-in e testes de consumidores.

Regra de promoção: uma ocorrência é local, duas são candidate, e três contextos
compatíveis justificam promoção. Pattern promovido pode permanecer apenas
documentado até que slots, states, responsividade e acessibilidade estabilizem.

## Variantes e tokens

- Variantes representam diferenças semânticas ou de densidade, não preferências locais.
- Não adicionar prop booleana para cada exceção; compor ou manter local quando a API ficar incoerente.
- Usar `text-brand-deep`/`text-tesText-primary` para texto primário e tokens TES
  para cores funcionais. Não introduzir hex arbitrário com token equivalente.
- Não alterar tokens globais sem avaliar consumidores e impacto visual.
- Texto funcional: mínimo `14px`; metadata: mínimo `11px` desktop e `10px` mobile.

## States, acessibilidade e responsividade

Exigir states default, hover, focus-visible, pressed, disabled e loading quando
aplicáveis. Definir error/success/empty no pattern ou domínio correto.

- Icon button recebe nome acessível.
- Touch target preserva pelo menos `44px`.
- Dialog usa `TESDialog`.
- Tabela, calendar, rail e navigation declaram transformação, não só stacking.
- Cor nunca é a única portadora de estado.

## Card e surface gate

Antes de usar `TESCard`, `AppPageSection`, border ou shadow, confirmar função:
grouping, interaction, state ou depth. Se nenhuma se aplicar, preferir spacing,
alignment, typography ou divider. Não remover wrappers compartilhados em massa;
variants devem emergir dos benchmarks e passar Calibration.

## Saída obrigatória da revisão

```text
Existing component/pattern
Classification
Reuse or variant decision
Tokens and states
Responsive contract
Accessibility contract
Accepted debt
Promotion status: local | candidate | shared
```

## Limites

- Não redefinir domínio, copy canônica, rota, RLS, API ou permissão.
- Não instalar Storybook ou dependência sem decisão/confirmação aplicável.
- Não reorganizar `src/components/tes` em massa nesta fase.
- Não alegar paridade Figma/código sem validação real.
