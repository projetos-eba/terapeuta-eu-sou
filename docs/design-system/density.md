# Níveis de densidade TES

Status: autoridade global de densidade  
Versão: 2026-08-13

Densidade expressa quantidade de informação e simultaneidade de tarefas. Ela não
autoriza microtexto, excesso de bordas ou perda de identidade.

## Seleção

| Nível       | Usar em                                                     | Composição                                                                             | Ações e informação                                                   |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Comfortable | Público, onboarding, Match, aquisição e jornadas emocionais | bastante whitespace, ritmo editorial, seções assimétricas e poucos limites visuais     | uma decisão dominante; detalhe revelado progressivamente             |
| Balanced    | Paciente e grande parte do terapeuta                        | orientação e operação em equilíbrio, hierarquia explícita, rail contextual quando útil | poucas ações simultâneas, estados próximos da entidade               |
| Operational | Admin, Financeiro, Sessões e partes densas da Agenda        | alto throughput, comparação, filtros, tabela/timeline e respiro compacto               | ações agrupadas por escopo, estados escaneáveis e dados prioritários |

## Regras comuns

- Texto funcional permanece em `14px` ou mais.
- Somente metadata secundária pode chegar a `11px` no desktop e `10px` no mobile.
- Controles touch preservam alvo mínimo de `44px`.
- Para coleções de cards compactos e independentes, preferir duas colunas no
  mobile quando cada item continuar com largura de leitura suficiente. Não
  aplicar essa regra a formulários longos, tabelas convertidas em registros
  complexos, alertas ou conteúdo que exigir uma coluna para permanecer legível.
- Densidade deve vir de melhor arquitetura, não de redução indiscriminada.
- Cada bloco mantém padding suficiente para que primeiro e último elementos não toquem o limite.
- Se mais de três ações competirem no mesmo nível, agrupar, priorizar ou revelar progressivamente.

## Comfortable

- Preferir largura narrativa e seções sem container quando a hierarquia tipográfica bastar.
- Usar display typography com moderação e supporting copy generosa.
- Evitar grids uniformes como estrutura primária quando a narrativa pede sequência.
- No mobile, preservar pausas editoriais; não compactar tudo para “caber acima da dobra”.

## Balanced

- Combinar uma região principal e contexto secundário somente quando o contexto ajuda a decisão atual.
- Usar cards para entidades ou escolhas; usar seções abertas para orientação e narrativa.
- No tablet, rails podem virar faixa horizontal ou bloco após o conteúdo crítico.
- No mobile, aproximar estado e ação da entidade e recolher filtros secundários.

## Operational

- Priorizar varredura, comparação, estado, prazo e ação.
- Preferir uma command/filter bar consistente a controles espalhados por cards.
- Tabelas devem ter header persistente apenas quando melhora comparação e não cria dois scrolls confusos.
- Usar dividers e alinhamento de colunas antes de envolver cada linha em card.
- No mobile, tabela pode virar lista estruturada, detail panel ou fluxo em etapas; não comprimir colunas ilegíveis.
- Manter personalidade TES no título, linguagem, cores semânticas, ritmo e estados — nunca por ornamento excessivo.

## Escopo misto

Uma página pode declarar mais de um nível. Exemplo: Agenda usa `Operational` na
grade e filtros, e `Balanced` no rail contextual. Registrar a densidade dominante
e as exceções na skill da feature.
