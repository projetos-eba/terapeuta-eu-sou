# Handoff — Benchmark B / Admin Profissionais

Status: preparado; execução não iniciada  
Origem: `BENCHMARK A APPROVED`  
Rota alvo: `/admin/profissionais`  
Versão: 2026-08-14

Este handoff prepara o próximo benchmark sem autorizar rollout ou promoção de
componentes. O Benchmark B precisa repetir integralmente o workflow A–E.

## Aprendizados transferidos da Agenda

- Hierarquia melhora quando header, tabs e comandos usam alinhamento e spacing
  antes de surfaces adicionais.
- Uma borda externa pode ser legítima em uma região operacional complexa; bordas
  internas devem comunicar comparação, estado ou interação.
- Responsive transformation precisa trocar o modelo de tarefa. Na Agenda, a
  grade semanal virou lista cronológica no mobile; no Admin, tabela não deve ser
  simplesmente comprimida.
- Filtros podem permanecer próximos do conteúdo operacional sem dominar a
  primeira dobra; no mobile, progressive disclosure precisa preservar o resumo
  do estado ativo.
- Right rail funciona melhor quando oferece contexto e decisão, não uma sequência
  de cards equivalentes.
- Fixtures temporais precisam aceitar passagem do tempo. Estados críticos devem
  ser criados pelo teste ou admitir o empty state real.
- Visual QA precisa usar capturas frescas. A combinação `hidden` + utilitário de
  display mostrou que sem inspeção visual um estado semanticamente recolhido
  pode continuar visível.

## Candidates ainda não promovidos

| Candidate                          | O que comparar no Admin                                | Decisão antes da Calibration   |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------ |
| variante aberta de `AppPageHeader` | header compacto com ação e contexto administrativo     | manter local/variant           |
| `CommandBar`                       | ações em lote, busca, filtros e ordenação              | manter candidate               |
| `FilterBar` responsivo             | filtros densos, contador, limpar e recolhimento mobile | manter candidate               |
| `ContextRail` leve                 | resumo de seleção, risco ou detalhe contextual         | manter candidate               |
| `AppPageSection` sem elevação      | agrupamento operacional por divider/spacing            | manter local/variant           |
| semântica de grid/hairline         | tabela, divisórias e estados de seleção                | registrar necessidade de token |

## Hipóteses a testar

1. A página pode aumentar information throughput sem virar ERP genérico usando
   tabela operacional, alinhamento e prioridade em vez de KPI cards.
2. Status administrativos podem ser escaneáveis com texto e agrupamento, sem um
   badge para cada metadata.
3. Filtros e ações em lote podem formar uma CommandBar deliberada, mantendo a
   tarefa primária inequívoca.
4. Tablet deve preservar comparação; mobile deve priorizar triagem e drill-down,
   não reproduzir todas as colunas.
5. A identidade TES pode permanecer humana em densidade Operational por meio de
   voz, tipografia, ritmo e feedback responsável — sem decoração terapêutica.

## Dúvidas para Agents A–C

- Qual decisão domina `/admin/profissionais`: triagem, verificação, busca ou
  acompanhamento de risco?
- Quais colunas são essenciais para comparação e quais pertencem ao DetailPanel?
- Existe seleção em lote real ou ela seria affordance sem contrato?
- Qual estado exige atenção imediata e qual pode ser progressive disclosure?
- O detalhe deve abrir em rota, painel lateral ou composição master-detail já
  existente? Validar contra rotas e domínio antes de propor.
- Quais status são canônicos e quais são apenas apresentação derivada?

## Pontos de comparação obrigatórios com a Agenda

- first fold orientado à tarefa;
- uso de surface/border com justificativa;
- densidade Operational sem microtexto;
- comportamento de filtros em desktop/tablet/mobile;
- ausência de horizontal page overflow;
- transformação mobile deliberada;
- neutralidade aceitável de primitives versus identidade TES da composição;
- candidates realmente repetidos antes de qualquer promoção.

## Guardrails

- Preservar permissões, auditoria, read models, rotas e estados administrativos.
- Não reutilizar componentes locais da Agenda por semelhança superficial.
- Não promover candidates durante o Benchmark B; registrar repetição e decidir
  somente após o Benchmark C na Calibration.
- Não iniciar o Benchmark B como continuação automática deste trabalho.

## Entrada esperada do Benchmark B

- Agent A: tarefa primária, IA, estados e transformação responsiva.
- Agent B: direção visual anti-ERP e cardification audit.
- Agent C: mapa de reuse/variants/candidates e gaps de tokens.
- Declaração `DESIGN READY` antes de React.
- Agent E: desktop, tablet, mobile, score `>= 85` e nenhum eliminatório.
