# Composition Patterns TES

Status: catálogo conceitual; não implica componente React  
Versão: 2026-08-13

Patterns são contratos de composição entre tokens e componentes finais. Só
promover um pattern a componente compartilhado após repetição real e API estável.

## Catálogo

### PageHeader

- **Usar:** orientar página, tarefa e ação primária.
- **Anatomia:** eyebrow opcional, título, supporting copy, estado contextual e ActionCluster.
- **Evitar:** envolver em card automaticamente ou incluir KPIs sem relação com a ação principal.
- **Responsivo:** ações laterais no desktop; abaixo do texto no tablet/mobile, mantendo primary primeiro.
- **Densidade:** amplo em Comfortable, compacto em Operational.
- **Acessibilidade:** um `h1`; ações com nomes inequívocos.

### SectionHeader

- **Usar:** nomear e contextualizar uma região de conteúdo.
- **Anatomia:** título, descrição curta, estado/contagem e ação opcional.
- **Evitar:** ícone ou borda decorativa por padrão.
- **Responsivo:** manter título e estado juntos; mover ação abaixo quando faltar largura.
- **Acessibilidade:** nível de heading coerente com a hierarquia.

### ActionCluster

- **Usar:** agrupar ações que pertencem ao mesmo escopo.
- **Anatomia:** primary, secondary e menu overflow quando necessário.
- **Evitar:** mais de uma primary ou mistura de ações globais e de linha.
- **Responsivo:** barra alinhada no desktop; largura total ou sticky contextual no mobile quando essencial.
- **Acessibilidade:** ordem do DOM segue prioridade; foco previsível.

### FilterBar

- **Usar:** controlar lista, tabela, calendário ou conjunto de entidades.
- **Anatomia:** busca, filtros mais usados, contador, limpar e filtros avançados.
- **Evitar:** filtros depois do conteúdo controlado ou campos dentro de cards independentes.
- **Responsivo:** visível no desktop Operational; recolhida no mobile, com resumo de filtros ativos.
- **Acessibilidade:** labels persistentes, estado expandido e anúncio de resultado quando adequado.

### CommandBar

- **Usar:** reunir navegação de período, modo de visão e comandos operacionais.
- **Anatomia:** contexto atual, comandos primários, navegação e overflow.
- **Evitar:** misturar filtros de conteúdo com ações destrutivas sem agrupamento.
- **Responsivo:** preservar contexto; mover ações raras para menu, nunca ocultar comando crítico.
- **Acessibilidade:** grupos nomeados e atalhos não obrigatórios.

### MetricStrip

- **Usar:** comparar poucos indicadores diretamente relacionados à tarefa.
- **Anatomia:** label, valor, qualificador e estado/tendência apenas se verificável.
- **Evitar:** grid de cards para métricas sem decisão associada.
- **Responsivo:** faixa horizontal com wrap controlado; lista de pares no mobile.
- **Acessibilidade:** valor e qualificador legíveis como texto, não apenas cor/gráfico.

### ContextRail

- **Usar:** exibir agenda do dia, pendências, resumo ou ação contextual sem competir com o main.
- **Anatomia:** SectionHeader, blocos priorizados e ação de aprofundamento.
- **Evitar:** informações críticas exclusivas ou sequência interminável de cards.
- **Responsivo:** lateral no desktop; faixa de duas colunas no tablet; após o contexto crítico no mobile.
- **Acessibilidade:** ordem no DOM preserva prioridade e não depende da posição visual.

### OperationalTable

- **Usar:** comparar múltiplas entidades pelos mesmos atributos.
- **Anatomia:** caption, header, linhas, estado, ações por linha, paginação e empty/error.
- **Evitar:** dados heterogêneos, narrativa ou poucas entidades que não exigem comparação.
- **Responsivo:** selecionar colunas essenciais, usar lista estruturada ou DetailPanel no mobile.
- **Acessibilidade:** markup de tabela, headers associados, caption e foco nas ações.

### EntityList

- **Usar:** varredura de entidades com informação e ações compactas.
- **Anatomia:** identidade, atributos prioritários, status, próxima ação e divider opcional.
- **Evitar:** envolver cada item em card quando uma lista basta.
- **Responsivo:** reordenar atributos por prioridade; ação acompanha a entidade.
- **Acessibilidade:** item tem nome acessível; não tornar toda a linha clicável se houver ações concorrentes.

### EntitySummary

- **Usar:** introduzir uma entidade em detalhe ou fornecer contexto antes da operação.
- **Anatomia:** identidade, estado, atributos-chave e ActionCluster.
- **Evitar:** duplicar todas as informações do detail panel.
- **Responsivo:** identidade e estado primeiro; metadados fluem abaixo.
- **Acessibilidade:** heading próprio e status em texto.

### DetailPanel

- **Usar:** inspecionar ou editar uma entidade preservando contexto da lista.
- **Anatomia:** header, conteúdo por seções, ações persistentes quando necessário e fechamento.
- **Evitar:** tarefas longas ou críticas que merecem rota própria.
- **Responsivo:** side panel no desktop; página ou full-screen dialog no mobile.
- **Acessibilidade:** usar `TESDialog` quando modal; foco confinado e retorno de foco.

### EmptyState

- **Usar:** ausência real, filtro sem resultado ou primeiro uso.
- **Anatomia:** estado explícito, explicação, próxima ação e suporte opcional.
- **Evitar:** ilustração grande antes de dizer o que aconteceu.
- **Responsivo:** manter copy curta e CTA alcançável.
- **Acessibilidade:** distinguir empty de error e permission denied.

### Timeline

- **Usar:** eventos ordenados por tempo, agenda ou histórico.
- **Anatomia:** eixo, marcadores, intervalos, eventos e contexto temporal.
- **Evitar:** faixa fixa que corta disponibilidade ou eventos reais.
- **Responsivo:** grade comparativa no desktop; lista cronológica no mobile quando a grade perder legibilidade.
- **Acessibilidade:** alternativa textual e navegação por item; cor nunca é o único código.

### InsightPanel

- **Usar:** interpretação verificável que ajuda decisão, sem substituir dados-base.
- **Anatomia:** conclusão, evidência, período e ação de aprofundamento.
- **Evitar:** insight decorativo, generativo não rotulado ou promessa de resultado.
- **Responsivo:** texto primeiro; visualização abaixo quando necessário.
- **Acessibilidade:** resumo textual de qualquer gráfico.

### StatusCluster

- **Usar:** dois ou mais estados relacionados que precisam ser compreendidos juntos.
- **Anatomia:** estado principal, qualificadores, prazo e ação.
- **Evitar:** fileira de badges sem relação explícita.
- **Responsivo:** texto compacto e wrap sem cortar labels.
- **Acessibilidade:** estado completo disponível em texto.

### SegmentedNavigation

- **Usar:** alternar visões irmãs do mesmo objeto ou escopo.
- **Anatomia:** conjunto curto de opções, seleção única e conteúdo associado.
- **Evitar:** navegação entre rotas semânticas distantes ou mais de cinco opções longas.
- **Responsivo:** tabs scrolláveis somente com affordance; preferir select/menu quando a leitura simultânea não for necessária.
- **Acessibilidade:** semântica de tabs quando controla painéis; links quando navega rotas.

## Admissão no código

Após a Calibration, consultar também
`docs/design-refactor/calibration-contract.md`: a promoção de um pattern
documentado não autoriza por si só um componente React. Implementar um pattern
compartilhado somente quando:

1. houver três contextos comprovadamente compatíveis, ou uma exceção explícita
   registrada no Calibration Contract;
2. anatomia e estados forem estáveis;
3. a API reduzir divergência sem esconder regras de domínio;
4. tokens e responsividade estiverem definidos;
5. owner e testes estiverem claros.

Caso contrário, documentar a composição e mantê-la local. Isso evita abstração
prematura e permite que novos rollouts confirmem a API correta.
