# Anti-patterns visuais TES

Status: gate canônico de prevenção  
Versão: 2026-08-13

Anti-pattern não significa proibição absoluta. A regra é exigir função visual
evidente em vez de aplicar convenções de dashboard automaticamente.

## Cardification

Antes de criar um container, perguntar:

> Esta surface ou borda comunica agrupamento, interação, estado ou hierarquia?

Se não, tentar primeiro spacing, alignment, typography, divider ou layout.

Aceitável: entidade acionável, resumo autônomo, escolha, conteúdo destacado ou
surface temporária. Evitar: header dentro de card por padrão, cada métrica em
card idêntico, cards dentro de cards e seção puramente textual contornada.

## Catálogo de decisões

| Anti-pattern                    | Por que falha                                       | Preferir                                               | Quando é aceitável                                       |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Card dentro de card             | multiplica limites e dilui hierarquia               | seção interna, divider ou lista                        | subentidade realmente independente e interativa          |
| KPI cards por convenção         | números ganham peso sem apoiar decisão              | MetricStrip, resumo textual ou tabela                  | poucos indicadores críticos com ações/estados distintos  |
| Grid simétrico automático       | iguala conteúdos de importância diferente           | composição assimétrica ou sequência                    | itens equivalentes e comparáveis                         |
| Borda em toda seção             | fragmenta a leitura                                 | whitespace, fundo ou divider                           | limite semântico, seleção ou tabela                      |
| Sombra em toda surface          | cria profundidade falsa                             | superfície plana e hierarquia por cor/espaço           | overlay, conteúdo elevado ou foco transitório            |
| Badge para todo status          | transforma texto em ruído colorido                  | texto, ícone com label ou StatusCluster                | estado curto, escaneável e semanticamente colorido       |
| Ícone decorativo em todo título | aumenta ruído e reduz distinção                     | título tipográfico                                     | ícone acrescenta significado ou reconhecimento           |
| Gradiente sem função            | simula premium por decoração                        | cor/token sólido                                       | CTA ou accent surface canônica e rara                    |
| CTAs concorrentes               | torna a ação principal ambígua                      | hierarquia primary/secondary/tertiary                  | escolhas mutuamente exclusivas e equivalentes            |
| Texto menor para caber          | prejudica legibilidade e máscara problema de layout | reescrever, quebrar, truncar com acesso ou transformar | nunca abaixo do mínimo TES                               |
| Dashboard genérico              | privilegia módulos em vez da tarefa                 | first fold orientado ao objetivo e patterns TES        | primitives neutras dentro de composição TES              |
| Informação crítica decorada     | reduz throughput operacional                        | posição, contraste e copy claros                       | decoração somente após clareza preservada                |
| Componente novo imediato        | cria APIs paralelas e dívida visual                 | pesquisar, compor, criar variante                      | necessidade repetida e contrato estável                  |
| Fallback que parece sucesso     | esconde falha ou dado ausente                       | estado explícito de erro/indisponibilidade             | dados demonstrativos só com ativação server-side visível |

## Sinais de reprovação

- Três ou mais camadas de surface/border para chegar ao conteúdo principal.
- Uma página cuja identidade depende apenas de roxo, radius e cards.
- Badge, ícone e sombra repetidos sem diferença semântica.
- Filtros deslocados para longe do conteúdo que controlam.
- Primeiro/último item encostado em borda ou dividido por linha sobreposta.
- Mobile que apenas empilha desktop e mantém tabela/calendário ilegível.
- Ação destrutiva ou financeira com o mesmo peso de navegação secundária.
