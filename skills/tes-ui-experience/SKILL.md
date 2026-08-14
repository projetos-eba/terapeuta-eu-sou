---
name: tes-ui-experience
description: Definir e revisar UX, direção visual, hierarquia, densidade, composição, responsividade e qualidade perceptiva de qualquer página ou fluxo TES. Usar antes de criar ou refatorar interfaces de Público, Paciente, Terapeuta ou Admin e durante crítica visual; não substituir regras da skill de domínio.
---

# TES UI Experience

## Objetivo

Fazer decisões visuais reproduzíveis para que a interface pareça humana, serena,
sofisticada, profissional e distintamente TES, sem virar clínica, wellness
místico, dashboard SaaS genérico ou decoração sem função.

## Fontes obrigatórias

1. `AGENTS.md`.
2. skill e documentação de produto/domínio da página.
3. `docs/design-system/experience-principles.md`.
4. `docs/design-system/density.md`.
5. `docs/design-system/anti-patterns.md`.
6. `docs/design-system/composition-patterns.md`.
7. `docs/design-system/interaction-patterns.md`.
8. Figma/referência aplicável, sem copiar conflito conhecido.
9. implementação real e screenshots no navegador.

Produto e domínio prevalecem sobre direção visual. Registrar divergência; nunca
alterar contrato funcional para encaixar uma composição.

## Workflow

### Calibration authority

Para refatorações após os Benchmarks A/B/C, aplicar também
`docs/design-refactor/calibration-contract.md`. Ele define patterns promovidos,
variantes, decisões locais e anti-patterns rejeitados. Não repetir exploração
visual já encerrada nem usar a Agenda como template de outra área.

### 1. Formular a experiência

Entregar antes de desenhar ou implementar:

```text
Primary task
Secondary tasks
Information hierarchy
Critical states
Interaction model
Progressive disclosure
Responsive transformation
UX risks
```

Identificar o que precisa estar na primeira dobra e qual decisão domina a página.

### 2. Declarar densidade

Escolher `Comfortable`, `Balanced` ou `Operational`. Permitir escopo misto, desde
que cada região seja declarada. Densidade nunca reduz texto funcional abaixo de
`14px`; somente metadata secundária pode usar `11px` desktop/`10px` mobile.

### 3. Compor antes de conter

Usar proximity, alignment, typography e whitespace antes de card, border ou
shadow. Para cada limite visual, registrar se comunica grouping, interaction,
state ou depth. Se não comunicar, removê-lo da proposta.

Selecionar composition patterns existentes. Não inventar um componente React;
essa decisão pertence a `$tes-design-system`.

### 4. Transformar por viewport

- Desktop preserva comparação, visão periférica e contexto simultâneo útil.
- Tablet reduz concorrência e reposiciona rails/ações sem esconder criticidade.
- Mobile muda representação: tabela pode virar lista, calendário pode virar
  cronologia e filtros secundários podem recolher com resumo ativo.

Nunca tratar responsividade apenas como `flex-col`.

### 5. Definir estados e feedback

Especificar content, empty, no-results, loading, unavailable, forbidden e error,
além de hover, focus, pressed e disabled. Optimistic UI somente em ação reversível
e de baixo risco. Não transformar falha em vazio ou sucesso aparente.

### 6. Criticar a identidade

Responder: “Existe alguma parte desta interface que poderia pertencer
indistintamente a qualquer SaaS?”. Neutralidade é aceitável em primitives; first
fold, composição, voz e estados precisam expressar TES.

### 7. Fechar Visual QA

Seguir `docs/design-system/visual-qa.md` e pontuar com
`docs/design-system/visual-quality-score.md`. Exigir `>= 85`, floors por dimensão,
nenhum critério eliminatório e screenshots desktop/tablet/mobile.

## Workflow pós-Calibration

Seguir esta ordem para qualquer página nova ou refatorada:

```text
Inspect → Understand dominant task → Reference interpretation → UX proposal
→ Visual composition → DS mapping → Implement → Playwright Visual QA → Fix → Approve
```

- Interpretar referência externa como direção de hierarquia, ritmo, densidade e
  comportamento; nunca como especificação de branding, tokens ou estrutura.
- Declarar a transformação por viewport antes de implementar. Mobile muda
  representação e prioridade; não é desktop estreito.
- Escolher `open`, `balanced` ou `compact-operational` para PageHeader conforme
  densidade e tarefa, não por gosto local.
- Usar uma surface principal somente quando ela protege comparação, estado,
  interação, espacialidade ou entidade dominante.
- Não forçar rail, filtro, MetricStrip, CommandBar ou card em uma página que
  não tenha necessidade comprovada.

## Distinção entre áreas

- Público: Comfortable, editorial, narrativo e orientado à descoberta.
- Paciente: Balanced, humano e orientador, sem infantilização.
- Terapeuta: Balanced/Operational, profissional e acolhedor, sem health SaaS.
- Admin: Operational, comparável e direto, sem virar ERP genérico.

Compartilhar tokens, voz, tipografia, estados e princípios. Variar tarefa e
densidade, não criar identidades separadas.

## Limites

- Não decidir RPC, RLS, pagamento, Zoom, permissão, rota ou nomenclatura.
- Não prometer cura, diagnóstico ou resultado.
- Não aprovar microtexto, overflow, CTA ambígua ou informação crítica escondida.
- Não copiar Figma cegamente quando ele reproduzir um anti-pattern.
- Não autorizar rollout amplo antes da Calibration dos benchmarks.
