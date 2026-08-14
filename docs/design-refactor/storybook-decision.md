# Decisão arquitetural — Storybook

Data: 2026-08-13  
Decisão: **recomendado depois da calibração dos benchmarks; não instalar agora**.

## Evidência

- `package.json` não contém Storybook nem scripts relacionados.
- não existem `.storybook/` ou arquivos `*.stories.*`.
- há planos, auditorias e sync map documentais, mas nenhum catálogo operacional.
- primitives React existem hoje, ao contrário de alguns relatórios históricos.
- APIs de composition patterns e variantes de surface/density ainda precisam
  emergir dos três benchmarks.

## Motivo

Instalar agora acrescentaria custo e tenderia a congelar wrappers card-heavy ou
stories de componentes que ainda não representam a Experience Language. O maior
ganho atual vem de calibrar decisões reais; depois disso, Storybook passa a ser
útil para isolar estados e evitar regressão.

## Critérios de introdução

Introduzir quando todos forem verdadeiros:

1. os três benchmarks e a Calibration estiverem aprovados;
2. houver entre 6 e 10 primitives/patterns estáveis com owner;
3. variants de densidade/surface tiverem evidência de uso;
4. manutenção de stories fizer parte da definição de pronto;
5. custo de CI e estratégia de visual regression estiverem aprovados.

## Primeiro catálogo

- `TESButton`, `TESInput`, `TESBadge` e `TESDialog`;
- PageHeader e SectionHeader nas densidades aprovadas;
- FilterBar e SegmentedNavigation;
- EmptyState;
- OperationalTable apenas depois de validar Admin/Sessões/Financeiro.

Cada story deve cobrir states, viewport, conteúdo longo, teclado e contraste.
Componentes de domínio entram somente quando reutilizados e estáveis.

## Como evitar abandono

- mudança de API compartilhada exige atualização da story no mesmo PR;
- story referencia token/pattern e owner;
- CI executa build do catálogo quando instalado;
- itens sem consumidor real não entram;
- revisão trimestral remove apenas documentação obsoleta com plano de transição;
- Figma/Storybook/code sync map registra divergência, não simula paridade.

## Alternativa atual

Até a introdução, usar testes de componente existentes, rotas reais, Playwright
visível, evidence pack por viewport e os gates de `visual-qa.md`. Isso valida a
experiência composta, que é o risco prioritário desta fase.
