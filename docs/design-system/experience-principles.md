# TES Experience Language

Status: autoridade global de UX e direção visual  
Versão: 2026-08-13

Este documento responde: **o que faz uma interface parecer TES?** Ele orienta
qualquer domínio sem substituir regras de produto, segurança ou negócio.

## Autoridade e decisão

Aplicar nesta ordem:

1. produto, domínio e tarefa real;
2. princípios de experiência TES;
3. Design System TES;
4. skill da página ou feature;
5. Figma e referências;
6. implementação e evidência no navegador.

Se o Figma contrariar o domínio, a acessibilidade ou estes princípios, registrar
o conflito e adaptar a composição. Não copiar um problema visual por fidelidade.

## A assinatura TES

Uma experiência TES combina seis qualidades:

- **clareza serena**: a próxima decisão é evidente sem criar urgência artificial;
- **precisão humana**: estados e dados são exatos, mas explicados em linguagem de produto;
- **calor editorial**: tipografia, ritmo e imagem constroem acolhimento sem infantilização;
- **dignidade operacional**: tarefas densas continuam legíveis, eficientes e visualmente cuidadas;
- **distinção silenciosa**: personalidade vem de composição, voz, tipografia e cor, não de decoração acumulada;
- **profundidade progressiva**: primeiro mostrar o necessário; revelar detalhe, contexto e ações secundárias sob demanda.

Evitar quatro extremos: clínica médica genérica, wellness místico, dashboard B2B
genérico e interface decorativa que compete com a tarefa.

## Hierarquia

- Definir uma única tarefa primária por página e fazê-la aparecer na primeira dobra.
- Limitar a primeira dobra a contexto, orientação, estado crítico e ação primária.
- Usar título para responder “onde estou?” e supporting copy para responder “o que posso fazer aqui?”.
- Exibir prazo, risco, estado e valor antes de ilustração ou insight auxiliar em superfícies operacionais.
- Uma ação secundária não pode ter o mesmo peso visual da ação primária sem motivo de domínio.
- Metadados explicam o conteúdo; não devem competir com título, valor ou estado.
- Não esconder informação crítica em tooltip, accordion fechado ou rail que desaparece no mobile.

## Composição

- Construir agrupamento primeiro com proximidade, alinhamento, tipografia e ritmo.
- Introduzir surface, border ou shadow somente quando comunicarem agrupamento,
  interação, estado ou profundidade.
- Preferir seções com largura e ritmo deliberados a grades simétricas criadas por conveniência.
- Usar assimetria controlada para expressar prioridade: conteúdo principal mais amplo,
  rail contextual mais estreito e ações alinhadas à tarefa.
- Manter linhas de leitura confortáveis: texto narrativo entre aproximadamente 45 e 75 caracteres;
  dados podem usar colunas mais curtas.
- Não encostar rótulos, cabeçalhos ou primeiro item em bordas. Todo container que delimita
  conteúdo precisa de padding explícito e coerente com sua densidade.
- Reservar scroll interno para superfícies que realmente precisam manter contexto, como calendário,
  tabela extensa ou dialog. A página não pode ter scroll horizontal.

## Tipografia

- Usar display para momentos editoriais e identidade: heros, títulos de página e mensagens marcantes.
- Usar sans para operação, leitura longa, formulários, tabelas, navegação e dados.
- Texto funcional deve ter pelo menos `14px`.
- Metadado secundário pode usar `11px` no desktop e `10px` no mobile; nunca menor.
- Não reduzir texto para fazê-lo caber. Reescrever, quebrar linha, truncar com acesso ao valor completo
  ou transformar o layout.
- Usar peso e tamanho antes de cor para criar hierarquia.
- Números comparáveis usam alinhamento consistente e, quando disponível, algarismos tabulares.
- Labels descrevem a relação; metadata descreve origem, tempo ou qualificador; não intercambiar papéis.

## Superfícies

- **Fundo**: estabelece atmosfera e separa grandes regiões, sem simular componente interativo.
- **Seção sem container**: padrão quando spacing e alinhamento bastam para agrupar.
- **Card**: usar para entidade, escolha, resumo autônomo ou bloco interativo.
- **Surface elevada**: usar para conteúdo temporário, sobreposto ou que precisa separar planos.
- **Accent surface**: reservar para orientação, insight ou estado que merece pausa visual.
- **Border**: usar para limite útil, seleção, foco, tabela ou separação sem profundidade.
- **Divider**: usar entre itens equivalentes quando o espaço sozinho reduz a varredura.
- **Shadow**: comunicar elevação ou foco, não decorar todas as superfícies.

## Interação

- Hover antecipa a ação sem deslocar layout; focus é sempre visível e não depende de cor apenas.
- Pressed confirma acionamento com mudança perceptível e breve.
- Loading preserva estrutura e informa o que está acontecendo; não substituir erro por vazio.
- Optimistic UI só é adequada para ação reversível, de baixo risco e com rollback claro.
- Disabled deve ter motivo acessível quando a causa não for óbvia.
- Erro explica impacto e próximo passo sem expor infraestrutura.
- Sucesso confirma o efeito real; retorno de navegador não confirma pagamento ou operação assíncrona.
- Empty state diferencia ausência genuína, filtro sem resultado, falta de permissão e indisponibilidade.

Detalhes estão em [interaction-patterns.md](./interaction-patterns.md).

## Transformação responsiva

Responsividade altera prioridade e interação, não apenas empilha colunas:

- **desktop**: preservar comparação, visão periférica, rails e ações simultâneas úteis;
- **tablet**: reduzir ações concorrentes, mover rails para faixa contextual ou duas colunas e manter comparação essencial;
- **mobile**: converter tabelas e calendários em representações adequadas à tarefa, recolher filtros secundários,
  tornar ações primárias alcançáveis e manter contexto crítico junto do item.

Não reduzir indiscriminadamente tipografia, alvos de toque ou padding. Controles
touch devem ter área operável de pelo menos `44px`.

## Variação por área

| Área      | Expressão TES                                           | Não pode virar                          |
| --------- | ------------------------------------------------------- | --------------------------------------- |
| Público   | editorial, narrativo, confortável, descoberta orientada | landing genérica de wellness            |
| Paciente  | humano, calmo, orientador, balanced                     | app infantil ou clínica impessoal       |
| Terapeuta | profissional, acolhedor, balanced/operational           | health SaaS genérico                    |
| Admin     | direto, denso, comparável, operational                  | ERP cinza ou painel de KPIs decorativos |

Todos compartilham tokens, voz, tipografia, estados e princípios. A diferença
vem da tarefa e densidade, não de quatro identidades visuais independentes.

## Pergunta anti-genérica

Antes de aprovar, responder: **“Existe alguma parte desta interface que poderia
pertencer indistintamente a qualquer SaaS?”**

Se sim, identificar a parte. Ela só é aceitável quando a neutralidade melhora
uma tarefa universal, como um input ou uma tabela. A composição ao redor ainda
deve expressar a hierarquia, voz e ritmo TES.
