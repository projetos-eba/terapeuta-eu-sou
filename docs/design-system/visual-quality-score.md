# TES Visual Quality Score

Status: gate obrigatório para benchmarks e refatorações visuais  
Versão: 2026-08-13

## Rubrica

Cada dimensão recebe nota de 0 a 5. A pontuação ponderada é
`(nota / 5) × peso`.

| Dimensão                   | Peso | Evidência esperada                                               |
| -------------------------- | ---: | ---------------------------------------------------------------- |
| Hierarquia de informação   |   20 | tarefa primária, primeira dobra e prioridade inequívocas         |
| Composição e ritmo         |   15 | alinhamento, spacing, largura, agrupamento e respiro deliberados |
| Clareza operacional        |   15 | estados, prazos, valores, filtros e ações fáceis de localizar    |
| Consistência TES           |   15 | experiência, voz, tokens, patterns e densidade coerentes         |
| Sofisticação visual        |   10 | personalidade sem decoração excessiva nem template SaaS          |
| Responsividade             |   10 | transformação real em desktop, tablet e mobile                   |
| Acessibilidade             |   10 | contraste, teclado, foco, semântica, touch e legibilidade        |
| Microinterações e feedback |    5 | loading, hover, pressed, error, success e empty adequados        |

## Escala

- `0`: ausente ou quebrado;
- `1`: problema severo, impede a tarefa;
- `2`: inconsistente, exige retrabalho relevante;
- `3`: funcional e aceitável, ainda genérico ou incompleto;
- `4`: sólido, consistente e claramente TES;
- `5`: excelente, comprovado em estados e breakpoints.

## Gate

- Aprovação geral: `>= 85/100`.
- Hierarquia, clareza operacional, consistência TES, responsividade e acessibilidade
  precisam de pelo menos `3.5/5` individualmente.
- A nota deve citar screenshots, estados e achados; opinião sem evidência não pontua.

## Critérios eliminatórios

Reprovar independentemente da média quando houver:

- overflow horizontal da página;
- ação principal ambígua;
- contraste inacessível ou conteúdo ilegível;
- quebra funcional ou regressão de domínio;
- componente essencial não operável por teclado;
- informação crítica escondida ou ausente;
- dialog sem foco confinado, Escape ou retorno de foco;
- estado de erro apresentado como vazio/sucesso;
- texto abaixo de `10px` no mobile ou `11px` no desktop;
- aparência severamente inconsistente com o TES.

## Teste anti-genérico

Responder obrigatoriamente:

> Existe alguma parte desta interface que poderia pertencer indistintamente a qualquer SaaS?

Se sim, registrar componente, impacto e justificativa. Primitives neutras podem
ser aceitáveis; first fold, composition patterns, voz e estados não podem ser
indistintos por falta de direção.
