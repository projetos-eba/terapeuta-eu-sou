# Plano de rollout da refatoração visual TES

Status: fundação e três benchmarks concluídos; rollout bloqueado por Calibration  
Versão: 2026-08-14

## Fase 0 — Fundação

- auditar produto, código, Figma, components, docs e skills;
- estabelecer Experience Language, densidade, anti-patterns e patterns;
- criar skills globais, Visual Quality Score, Visual QA e workflow multi-agent;
- selecionar benchmarks e registrar decisão de Storybook.

Saída: esta documentação. Nenhuma página precisa mudar.

## Fase 1 — Benchmarks

Executar Agenda, Admin / Profissionais e Paciente / Encontros na ordem do plano.
Cada página passa pelos Agents A–E e pelos gates de domínio, implementação e QA.

Concluída em 2026-08-14. O handoff consolidado para a próxima fase está em
`docs/design-refactor/calibration-handoff.md`.

Não compartilhar componente novo apenas porque apareceu no primeiro benchmark.
Registrar candidates e validar repetição nos seguintes.

## Fase 2 — Calibration

Comparar as três experiências, recalibrar skills/tokens/patterns e decidir:

- variants de `AppPageHeader`, `AppPageSection` e surfaces;
- componentes a promover para `src/components/tes/patterns`;
- componentes que permanecem locais/domain;
- tokens insuficientes ou legados;
- introdução de Storybook.

Rollout permanece bloqueado até aprovação explícita.

## Fase 3 — Sistema operacional no código

Implementar somente abstrações comprovadas. Evolução de pastas pode seguir
`primitives/`, `patterns/` e `domain/`, mas sem migração massiva de imports.
Aplicar transição incremental, compatível e coberta por testes.

## Fase 4 — Ondas por risco

1. experiências adjacentes aos benchmarks;
2. shells e navegação compartilhada;
3. finanças, reserva e Zoom com owners de domínio;
4. público editorial e Match;
5. configurações e superfícies de menor prioridade.

Cada onda tem inventário, owner, Visual Quality Score, regressão funcional e
declaração documental.

## Fase 5 — Operação contínua

- revisar score e anti-patterns a cada benchmark/onda;
- manter skills globais e feature skills separadas;
- medir dívida visual aceita e data de revisão;
- executar auditoria periódica de componentes equivalentes e tokens arbitrários;
- introduzir visual regression somente quando referências estiverem estáveis.

## Gates de parada

Pausar rollout em regressão de domínio, eliminatório visual, divergência grave
entre áreas, API compartilhada instável, falta de evidência responsiva ou score
abaixo de 85. Pressão de cronograma não transforma gate reprovado em aprovado.
