# Diagnóstico completo da Assessora Aura

## Funcionamento real, dados, recomendações, evolução temporal, inconsistências e melhorias

**Projeto:** Terapeuta Eu Sou  
**Rota auditada:** `/terapeuta/assessor-ia`  
**Data da análise:** 24/08/2026  
**Escopo:** checkout local do projeto e Supabase local em Docker  
**Estado do diagnóstico:** código e base local verificados; HML, remoto e produção não foram homologados nesta análise.

> **Veredito executivo**
>
> A Assessora Aura está implementada como um MVP funcional de recomendações determinísticas. Ela consulta um RPC privado, calcula sinais agregados do próprio terapeuta e aplica cinco regras versionadas. Não existe, neste fluxo, LLM, chat, embeddings, análise de sentimento ou aprendizado automático. Portanto, a Aura pode trazer dados reais e compatíveis com os registros transacionais locais, mas ainda não é possível afirmar que esteja conectada e validada com dados de HML ou produção.
>
> Também existe uma divergência importante: a página dedicada usa o novo contrato RPC + regras server-only, enquanto o card do dashboard ainda lê diretamente a tabela legada `aura_recommendations`. Essa duplicidade pode fazer o terapeuta ver recomendações diferentes em `/terapeuta` e em `/terapeuta/assessor-ia`.

## 1. Resumo das conclusões

1. **O nome público correto é “Assessora Aura”.** O título da página estava como “Aura IA”. O título foi alinhado para “Assessora Aura” e o teste correspondente foi atualizado.
2. **A lógica atual é determinística, não generativa.** As recomendações são produzidas por condições explícitas, com prioridade e versão `1`.
3. **As fontes principais são compatíveis com dados reais.** A Aura usa sessões, cancelamentos, ausências operacionais, continuidade, avaliações publicadas, serviços publicáveis e disponibilidade canônica.
4. **Há proteção de privacidade adequada no read model.** O RPC deriva o terapeuta de `auth.uid()`, exige Premium Plus, não retorna identificadores de pacientes nem texto privado e bloqueia percentuais abaixo da amostra mínima de 10.
5. **O resultado muda com o tempo, mas não aprende.** Cada consulta recalcula o período escolhido. Ações do terapeuta não treinam a Aura; a única retroalimentação explícita é dispensar uma recomendação para aquele período.
6. **O seletor 30/90 não altera todos os dados.** Sessões e continuidade usam o período completo; disponibilidade usa os próximos 14 dias; avaliações pendentes são contadas sem filtro de período.
7. **A UI ainda pode sugerir mais inteligência do que existe.** “Aura IA”, “assistente inteligente”, “insights gerados automaticamente” e barras visuais estáticas podem induzir a expectativa de IA generativa ou de gráficos reais.
8. **A base local não prova produção.** O snapshot local possui registros de teste e recomendações sem validade atual. Não há evidência nesta análise de HML ou produção.

## 2. Como a auditoria foi feita

Foram comparados quatro níveis de evidência:

- **Contrato implementado:** código TypeScript/React, permissões, rota, mapper e regras.
- **Contrato de banco:** migration do RPC Aura, funções de taxa, tabela de recomendações e tabela de dismissals.
- **Execução local:** testes unitários, typecheck, lint e consulta read-only ao Supabase local em Docker.
- **Superfície visível:** código da tela e teste de composição. A navegação autenticada pelo navegador local redirecionou para `/terapeuta/login`; não foram inseridas credenciais nem foi feita homologação autenticada por navegador.

Não foram lidos nem reproduzidos segredos, senhas, tokens ou valores de ambiente no documento.

## 3. O que aparece para o terapeuta hoje

### 3.1 Acesso e identificação

- A navegação autenticada exibe **Assessora Aura**.
- A rota canônica é `/terapeuta/assessor-ia`.
- O acesso é protegido pela capability `aura_full`, liberada para **Premium Plus**.
- Free e Premium não recebem o feed completo da Aura. A tentativa de acesso é tratada como indisponível para a conta sem capability.
- O título principal da tela foi corrigido de **Aura IA** para **Assessora Aura**.

### 3.2 Hero inicial

O terapeuta vê:

- título: **Assessora Aura**;
- selo: **sua assistente inteligente**;
- explicação: a Aura analisa automaticamente os dados da TES e organiza sinais práticos;
- selo secundário: **Insights gerados automaticamente**;
- personagem visual local da Aura.

O conteúdo comunica orientação automatizada, mas não explica, na própria tela, que as recomendações são geradas por regras determinísticas e não por IA generativa.

### 3.3 Período analisado

O controle permite alternar entre:

- **30 dias**: últimos 30 dias completos;
- **90 dias**: últimos 90 dias completos.

A regra de período é baseada no fuso horário configurado pelo terapeuta, com fallback local para `America/Sao_Paulo`. O dia corrente é excluído das métricas históricas: o intervalo termina à meia-noite local do dia atual.

### 3.4 Quatro KPIs apresentados

| KPI visível | Como é calculado hoje | Observação |
|---|---|---|
| Insights do período | Quantidade total de recomendações após juntar regras determinísticas e recomendações persistidas | Não é um KPI de desempenho; é uma contagem de cartões. |
| Oportunidades identificadas | Quantidade de recomendações cujo tom é `opportunity` | Recomendações persistidas recebem esse tom por padrão, mesmo que tenham outra natureza. |
| Ações sugeridas | Quantidade de recomendações com rota de ação | Na prática, todas as recomendações mapeadas possuem rota, então tende a repetir o primeiro KPI. |
| Taxa de retorno | Percentual de pessoas atuais que já tinham uma sessão concluída anterior, quando a amostra atual chega a 10 | Abaixo de 10, aparece “Em formação”; o percentual fica oculto. |

Cada KPI também recebe barras decorativas de referência. Essas barras são fixas e não representam uma série histórica real nem têm escala numérica.

### 3.5 Três leituras contextuais

- **Financeiro:** encaminha ao Financeiro e mostra “Disponível no Financeiro”. Não é um sinal financeiro calculado pela Aura.
- **Crescimento:** muda principalmente conforme existem avaliações publicadas sem resposta. Não apresenta crescimento de perfil, visitas ou conversão.
- **Relacionamento:** usa a taxa de retorno e mostra “Em formação” quando a amostra não é suficiente.

### 3.6 Recomendações

Cada cartão de recomendação pode mostrar:

- ícone conforme a área de ação;
- título;
- texto de orientação;
- evidência resumida;
- botão de ação;
- botão para dispensar.

As ações atuais apontam para Agenda, Avaliações, Sessões, Resultados ou outra rota canônica compatível. Dispensar não executa a ação recomendada; apenas registra a dispensa para a chave daquela recomendação e daquele período.

### 3.7 Estado sem recomendação

Quando nenhuma regra é elegível, a tela mostra:

> Nenhum sinal prioritário agora

e explica que novas leituras aparecerão quando houver sinais elegíveis. Esse é um estado honesto e não deve ser substituído por dados demonstrativos.

### 3.8 Bloco final de resultados

O rodapé da página repete:

- Insights selecionados;
- período analisado;
- avaliações sem resposta;
- retorno acompanhado.

Esse bloco é útil como resumo, mas hoje repete informação dos KPIs e não exibe data/hora de atualização, fonte, fórmula, amostra observada ou frescor de cada indicador.

## 4. Como os dados realmente percorrem o sistema

```text
Sessão autenticada do terapeuta
        |
        v
Rota /terapeuta/assessor-ia
        |
        v
getTherapistAuraPage (server-only)
        |
        v
RPC privado get_therapist_aura_signals_v1(periodDays)
        |
        +--> sinais agregados de bookings, reviews, serviços e slot engine
        +--> recomendações persistidas ativas, não expiradas e sem paciente/booking
        +--> dismissals do terapeuta para o período atual
        |
        v
mapper valida contrato e bloqueia vazamento de percentuais protegidos
        |
        v
motor TypeScript server-only aplica cinco regras versionadas
        |
        v
ordenação por prioridade
        |
        v
cards e estados da página
```

O cliente não consulta diretamente as tabelas do Supabase para montar a página. O token de acesso é usado no servidor para chamar o RPC. O serviço ainda confere se o `profileId` retornado pelo banco corresponde ao perfil autenticado.

## 5. Dicionário dos dados usados pela Aura

| Sinal | Fonte | Regra efetiva | Janela real | Proteção/estado |
|---|---|---|---|---|
| Prontidão de agendamento | `therapist_services`, `therapies`, perfil público e slot engine | Conta terapias ativas, publicáveis, online e com horários futuros | Próximos 14 dias a partir de agora | `empty` se não há serviço publicável; `ready` caso contrário |
| Avaliações sem resposta | `reviews` + `review_replies` | Avaliação publicada, com data publicada, sem resposta publicada do terapeuta | Histórico total; não é limitado a 30/90 dias | `empty` quando zero; `ready` quando existe pendência |
| Taxa de cancelamento | `bookings` | Cancelamentos / (concluídas + ausências + cancelamentos) | Período completo e período anterior equivalente | Amostra mínima de 10 no denominador atual |
| Taxa de ausência operacional | `bookings` | Ausências / (concluídas + ausências) | Período completo e período anterior equivalente | Amostra mínima de 10 no denominador atual |
| Taxa de retorno | `bookings` | Pessoas distintas com sessão concluída no período atual que já tinham sessão concluída antes | Período completo e período anterior equivalente | Amostra mínima de 10 pessoas no período atual |
| Recomendações persistidas | `aura_recommendations` | Ativas, `is_active`, Premium Plus, não expiradas, sem paciente e sem booking, não demonstrativas | Validade da própria recomendação | Evidência e versão vêm da tabela, mas a UI usa uma evidência genérica |
| Dispensas | `aura_recommendation_dismissals` | Chave por terapeuta + recomendação | Período atual | Operação idempotente |

### 5.1 O que não entra na Aura MVP

Não entram no read model da página:

- nomes ou identificadores de pacientes;
- comentários privados, intake, conversa ou resumo de sessão;
- texto clínico;
- dados individuais do Match;
- ranking ou média de outros terapeutas;
- tendência agregada da demanda do portal;
- confirmação de pagamento, repasse ou resultado clínico;
- aprendizado automático a partir do comportamento do terapeuta.

## 6. Regras de recomendação atuais

Todas as regras têm versão `1`, prioridade e chave estável. A recomendação só aparece se a condição for verdadeira e se a chave não tiver sido dispensada no período atual.

| Prioridade | Chave | Quando aparece | Ação |
|---:|---|---|---|
| 95 | `aura.booking_readiness.no_future_slots.v1` | Há pelo menos uma terapia pública agendável, mas nenhuma possui horário nos próximos 14 dias | Revisar agenda |
| 90 | `aura.reviews.pending_reply.v1` | Existe pelo menos uma avaliação publicada sem resposta publicada | Responder avaliações |
| 80 | `aura.sessions.cancellation_increased.v1` | A taxa de cancelamento atual subiu em relação à anterior e ambas as bases necessárias estão prontas | Ver sessões |
| 75 | `aura.sessions.no_show_increased.v1` | A taxa de ausência atual subiu em relação à anterior e a base está pronta | Revisar sessões |
| 70 | `aura.continuity.return_rate_decreased.v1` | A taxa de retorno atual caiu em relação à anterior e a base está pronta | Ver continuidade |

### 6.1 Comportamento das taxas

- O banco calcula percentuais com uma casa decimal.
- Quando a amostra atual é menor que 10, valor, valor anterior e direção ficam nulos.
- O mapper rejeita contrato que tente vazar um percentual parcial em estado `insufficient_sample`.
- Se a amostra atual é suficiente, mas a anterior não é, o valor atual pode aparecer, porém a direção fica neutra e nenhuma recomendação de piora é criada.
- A regra dispara por direção (`up` ou `down`), não por magnitude mínima de mudança. Uma diferença pequena, se arredondada em sentido de piora, pode gerar recomendação.

### 6.2 O que a Aura faz com o resultado

A Aura não altera automaticamente:

- perfil;
- agenda;
- preço;
- terapia;
- mensagem;
- pagamento;
- cadastro do paciente.

Ela apenas apresenta uma orientação e abre uma área para o terapeuta decidir o próximo passo.

## 7. Como a Aura muda com o tempo

### 7.1 O que recalcula

Cada carregamento da rota solicita novamente o RPC com `30` ou `90` dias. O período é recalculado a partir do dia local atual e do fuso do terapeuta. Com isso:

- novos bookings entram quando passam a pertencer ao período completo;
- cancelamentos e ausências alteram os denominadores;
- pessoas que retornam podem fazer a taxa de continuidade sair de “Em formação”;
- a direção pode mudar de estável para alta ou queda;
- uma recomendação pode aparecer, desaparecer ou mudar de texto;
- a disponibilidade dos próximos 14 dias muda em tempo quase real;
- uma avaliação respondida reduz o contador de pendências.

### 7.2 O que não recalcula por aprendizado

Não existe modelo que aprenda com o tempo. A Aura não:

- ajusta pesos automaticamente;
- aprende quais sugestões funcionaram;
- personaliza a linguagem por terapeuta;
- registra conversão de uma recomendação em ação concluída;
- compara a efetividade histórica de regras;
- cria uma recomendação nova fora do conjunto de regras versionadas.

### 7.3 Dismissal e reaparecimento

A chave determinística é formada por:

```text
ruleKey + periodStart + periodEnd
```

Portanto, dispensar uma recomendação a oculta para aquele intervalo. Quando o próximo período for calculado, a chave muda e a mesma condição pode reaparecer. Isso é coerente com uma recomendação recorrente, mas precisa ser explicado ao terapeuta.

### 7.4 Relógios diferentes na mesma tela

Hoje a tela combina dados com frescor diferente:

- sessões e retorno: últimos 30/90 dias completos;
- agenda: próximos 14 dias a partir de agora;
- avaliações sem resposta: todo o histórico publicado;
- recomendações persistidas: dependem de `expires_at`.

Mesmo que a UI mostre “Últimos 30/90 dias completos”, esse rótulo não descreve igualmente todos os cards.

## 8. Os dados são reais e compatíveis?

### 8.1 O que foi comprovado localmente

O Supabase local estava ativo e a migration da Aura estava aplicada. O snapshot local consultado tinha:

| Evidência local | Quantidade |
|---|---:|
| Perfis de terapeuta | 42 |
| Bookings | 69 |
| Avaliações | 16 |
| Recomendações persistidas | 5 |
| Dismissals Aura | 0 |
| Eventos de métricas | 3 |
| Agregados diários de métricas | 3 |

Esses números demonstram que a base local possui dados e que o RPC consegue executar. Eles não são evidência de produção.

Para o perfil Premium Plus de teste da base local, sem reproduzir seu identificador:

| Período | Resultado observado no RPC |
|---|---|
| 30 dias | 7 avaliações pendentes; 1 serviço publicável e 1 com disponibilidade futura; cancelamentos com amostra 9; ausências com amostra 8; retorno com amostra 6; percentuais ocultos; nenhuma recomendação elegível |
| 90 dias | 7 avaliações pendentes; 1 serviço publicável e 1 com disponibilidade futura; cancelamento 8,3% com amostra 12; ausência 9,1% com amostra 11; retorno oculto com amostra 9; nenhuma recomendação elegível |

A leitura local é compatível com a regra implementada: em 30 dias as três taxas ficam abaixo da trava de 10; em 90 dias duas taxas ficam prontas, mas estáveis e sem comparação anterior suficiente, enquanto o retorno continua insuficiente. Como há disponibilidade futura, a regra de agenda sem horário não dispara.

### 8.2 O que não foi comprovado

Não foi possível afirmar, nesta análise, que:

- o ambiente HML possui a mesma migration e os mesmos grants;
- o ambiente HML possui dados transacionais suficientes para as regras;
- o ambiente remoto/produção possui recomendações persistidas coerentes;
- o slot engine em produção retorna exatamente os mesmos resultados;
- o título foi validado em uma sessão autenticada real no navegador;
- a Aura foi homologada por um terapeuta Premium Plus em produção.

## 9. Inconsistências encontradas

| ID | Inconsistência | Impacto | Severidade | Evidência |
|---|---|---|---|---|
| AURA-01 | Título da página estava “Aura IA”, mas o nome público canônico é “Assessora Aura” | Confunde nomenclatura e pode sugerir uma feature diferente | Corrigida | `src/features/therapist-aura/components/therapist-aura-page.tsx:78` |
| AURA-02 | Página dedicada usa RPC + regras; dashboard usa REST direto em `aura_recommendations` | Duas fontes e dois comportamentos para a mesma Aura; cards podem divergir | Alta | `src/features/therapist-aura/therapist-aura.queries.ts:11`; `src/features/therapist-dashboard/therapist-dashboard.queries.ts:19-21` |
| AURA-03 | O filtro de recomendações demonstração depende de `context.source`, mas o seed local não grava esse campo | Em reset local, recomendações seed podem entrar no RPC porque `coalesce(NULL, '') <> 'demo_seed'`; o dashboard aplica outro filtro | Alta | migration `20260731173000...sql:55-75,317-324`; seed `local-test-data.sql:2003-2020` |
| AURA-04 | `aura_recommendations` local possui cinco linhas seed, todas expiradas no snapshot atual | A presença da tabela não prova que haja recomendação produtiva vigente | Alta | consulta local read-only; seed define `now() + 14 days` |
| AURA-05 | A tela chama a Aura de “assistente inteligente” e “insights gerados automaticamente”, mas não explica “regras determinísticas” | Risco de expectativa de IA generativa, aprendizado ou causalidade | Média | página `:81-95`; skill Aura e estratégia de métricas |
| AURA-06 | Barras de referência têm alturas fixas | Podem ser interpretadas como gráfico real, apesar de não representarem dados | Média | `ReferenceBars`, página `:514-535` |
| AURA-07 | “Insights do período”, “Oportunidades” e “Ações” são contagens muito próximas ou redundantes | KPIs parecem desempenho, mas medem quantidade de cartões | Média | página `:123-166` |
| AURA-08 | Avaliações pendentes não usam o filtro 30/90 | O número pode permanecer igual ao trocar o período, embora a tela sugira uma leitura do período | Média | migration `:249-263`; página `:186` |
| AURA-09 | Disponibilidade usa próximos 14 dias, fora do período histórico | Mistura passado e futuro sem explicar o escopo de cada card | Média | migration `:158-159,270-297` |
| AURA-10 | `freshThrough` é único e igual ao fim do período histórico | Não expressa o frescor real de agenda, reviews e recomendações persistidas | Média | migration `:358-364` |
| AURA-11 | Evidência persistida é carregada no contrato, mas a UI exibe texto genérico | O terapeuta não vê a evidência específica que justificou a recomendação | Média | mapper `:136-151`; tipo `AuraPersistedRecommendation` |
| AURA-12 | Estados `processing` e `unavailable` aparecem no tipo geral, mas os sinais efetivos aceitam apenas `empty`/`ready` ou `insufficient_sample`/`ready` | O contrato promete estados que não conseguem ser representados de forma uniforme | Baixa/Média | `therapist-aura.types.ts:1-16,28-46` |
| AURA-13 | Não há evento de “ação recomendada concluída” | Não é possível medir eficácia, abandono ou retorno de cada sugestão | Média | nenhum evento/telemetria identificado no fluxo Aura |

## 10. O que deveria aparecer para o terapeuta

### 10.1 Identidade e transparência

O hero deveria usar:

> Assessora Aura  
> Recomendações baseadas em regras a partir dos seus dados operacionais no TES.

Também deveria haver um link ou ajuda curta explicando:

- quais dados entram;
- quais dados não entram;
- que não é diagnóstico;
- que não há comparação com outros terapeutas;
- que uma recomendação é um próximo passo, não uma promessa de resultado.

### 10.2 Frescor por bloco

Cada card deveria informar, de modo compacto:

- janela analisada;
- última atualização;
- fuso horário;
- amostra observada e mínima, quando aplicável;
- estado: pronto, sem base, amostra insuficiente, processamento ou indisponível.

Exemplo:

> Retorno: em formação  
> 6 pessoas observadas; mínimo de 10  
> Última leitura: 24/08/2026, horário de São Paulo

### 10.3 Recomendações com evidência verificável

Cada recomendação deveria mostrar uma frase de evidência baseada no sinal real, por exemplo:

> 9 sessões consideradas no período atual. A taxa não foi exibida porque a amostra mínima é 10.

Quando houver recomendação:

> Cancelamentos: 18,0% no período atual contra 5,0% no período anterior. 20 sessões consideradas.

O conteúdo persistido deve usar sua própria evidência, e não o texto genérico “registrada por regra determinística”.

### 10.4 Estados sem amostra

O correto é manter “Em formação” e explicar a amostra. Nunca preencher com porcentagem inventada, gráfico decorativo que pareça histórico ou zero que signifique “não medido”.

### 10.5 Separação entre observação e ação

A hierarquia ideal é:

1. **O que foi observado**;
2. **Por que isso é relevante**;
3. **Qual ação pode ser considerada**;
4. **Abrir a área correspondente**;
5. **Dispensar**.

Isso evita que o terapeuta confunda um sinal operacional com uma ordem ou diagnóstico.

## 11. Melhorias recomendadas e priorizadas

### P0 — corrigir antes de considerar o módulo coerente

1. **Unificar o fornecedor de Aura.** Fazer dashboard e página dedicada consumirem o mesmo read model e o mesmo motor de regras. Remover a leitura legada direta ou isolá-la como compatibilidade explicitamente marcada.
2. **Eliminar o filtro frágil de seed.** Preferir uma coluna estruturada `source`/`origin` com enum ou um contrato explícito de recomendação demonstrativa. Enquanto isso, ajustar o seed local para gravar `source: demo_seed` e o RPC para tratar `NULL` como não elegível, nunca como produtivo.
3. **Separar frescor por sinal.** Retornar metadados de atualização para agenda, reviews, sessões e recomendações persistidas.
4. **Publicar a definição da Aura na UI.** Explicar que é determinística, baseada no próprio histórico e sem leitura de conteúdo privado.

### P1 — melhorar confiança e compreensão

5. **Trocar barras fixas por dados reais ou por um estado neutro claramente rotulado.** Se não houver série histórica, usar uma ilustração sem aparência de gráfico ou um texto acessível “sem série disponível”.
6. **Reformular KPIs redundantes.** Substituir contagens de cartões por indicadores úteis: sinais prontos, sinais em formação, recomendações abertas, recomendações dispensadas no período e última atualização.
7. **Exibir evidência real.** Mapear `evidence` persistido para a UI e registrar a fórmula/escopo de cada regra.
8. **Separar o escopo histórico do operacional.** Renomear cards para “Últimos 30/90 dias completos”, “Próximos 14 dias” e “Total pendente” conforme a fonte.
9. **Adicionar tooltips ou detalhes acessíveis.** Explicar denominadores, estados, período anterior e amostra mínima.

### P2 — amadurecer o motor

10. **Adicionar limiar de magnitude e histerese.** Evitar que uma pequena variação arredondada gere alerta recorrente.
11. **Adicionar cooldown e retenção de dismissals.** Evitar repetição excessiva e controlar crescimento histórico da tabela.
12. **Instrumentar resultados da recomendação.** Medir visualização, abertura da área, ação iniciada e ação concluída, sem armazenar conteúdo sensível.
13. **Criar matriz de regras.** Para cada regra: versão, entrada, fórmula, amostra, risco, copy, rota, exclusões, cooldown e teste de regressão.
14. **Distinguir recomendações calculadas de recomendações persistidas.** A UI deve informar se uma recomendação veio de regra ao vivo ou de uma recomendação registrada por pipeline.

### P3 — preparação para homologação

15. **Rodar cenário autenticado completo em HML.** Premium Plus com dados reais de booking, reviews e agenda.
16. **Validar Free/Premium/Premium Plus.** Confirmar que o acesso, bloqueio e mensagens correspondem aos planos atuais.
17. **Testar no mínimo 1440x900, 1024x768, 390x844 e 360x800.** Incluir foco, teclado, zoom 200%, erro, vazio, amostra insuficiente e dismiss.
18. **Reconciliar documentação.** Atualizar mapa de integração e skill local quando dashboard, seed ou contrato de evidência forem corrigidos.

## 12. Plano de validação recomendado

### Banco e segurança

- validar execução do RPC com terapeuta Premium Plus;
- negar Free, Premium, suspenso e rejeitado;
- garantir que o resultado não contenha IDs de paciente, booking individual ou texto privado;
- validar que percentuais abaixo de 10 retornam `null`;
- validar que seed local não aparece como recomendação produtiva;
- validar expiração de recomendação;
- validar idempotência de dismiss com o mesmo request;
- validar isolamento RLS entre dois terapeutas.

### Regras

- amostras 0, 9 e 10;
- direção estável, alta e queda;
- período anterior sem base;
- cancelamento, ausência e retorno simultaneamente elegíveis;
- agenda sem horário nos próximos 14 dias;
- reviews sem resposta e após resposta;
- dispensa no período atual e reaparecimento no próximo período.

### Interface

- alternar 30/90 e confirmar quais números realmente mudam;
- conferir texto de janela de cada bloco;
- garantir que barras sem série não pareçam dados;
- confirmar que o título renderizado é “Assessora Aura”;
- confirmar ação de cada cartão;
- confirmar que erro de RPC não vira zero nem fallback demonstrativo;
- confirmar que a tela funciona sem overflow horizontal.

## 13. Validações executadas nesta análise

| Comando/checagem | Resultado |
|---|---|
| Testes Aura: regras + página | **PASS** — 2 arquivos, 5 testes |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run lint` | **PASS** — política visual, online-only e ESLint sem erros |
| `npx.cmd supabase status` | **PASS** — serviços locais consultáveis; nenhum ambiente remoto foi alterado |
| Consulta read-only ao Postgres local | **PASS** — RPC 30/90 executado para perfil de teste, sem alteração de dados |
| Navegação local autenticada | **LIMITADA** — sem credenciais inseridas; a rota redirecionou para login |
| HML/produção | **NÃO EXECUTADO** |

## 14. Fontes de evidência no projeto

### Produto e nomenclatura

- `AGENTS.md`
- `skills/therapist-aura/SKILL.md`
- `docs/product/routes-map.md`
- `docs/product/integration-map.md`
- `docs/architecture/therapist-metrics-reports-strategy.md`

### Implementação da página

- `src/app/(therapist)/terapeuta/assessor-ia/page.tsx`
- `src/app/(therapist)/terapeuta/assessor-ia/loading.tsx`
- `src/features/therapist-aura/components/therapist-aura-page.tsx`
- `src/features/therapist-aura/therapist-aura.types.ts`
- `src/features/therapist-aura/therapist-aura.mappers.ts`
- `src/features/therapist-aura/therapist-aura.service.ts`
- `src/features/therapist-aura/therapist-aura.queries.ts`
- `src/features/therapist-aura/therapist-aura.rules.ts`
- `src/features/therapist-aura/therapist-aura.actions.ts`

### Banco e fixtures

- `supabase/migrations/20260731173000_aura_mvp_deterministic_signals.sql`
- `supabase/migrations/20260728200000_therapist_metrics_mtr1_mtr2.sql`
- `supabase/seeds/local-test-data.sql`
- `supabase/seed.sql`
- `src/features/therapist-dashboard/therapist-dashboard.queries.ts`
- `src/features/therapist-dashboard/therapist-dashboard.mappers.ts`
- `src/features/therapist-dashboard/therapist-dashboard.service.ts`

### Testes

- `src/features/therapist-aura/therapist-aura.rules.test.ts`
- `src/features/therapist-aura/components/therapist-aura-page.test.tsx`

## 15. Conclusão final

A Assessora Aura tem uma base técnica responsável: usa dados operacionais agregados, protege amostras pequenas, limita o acesso por plano, evita dados clínicos e oferece ações manuais. Isso é suficiente para chamar o módulo de **MVP funcional de recomendações determinísticas**.

Ainda não é suficiente para declarar que a Aura está plenamente pronta, real e homogênea em todos os ambientes. O principal risco não está nas cinco regras em si, mas na coexistência de dois caminhos de recomendação, na fragilidade do marcador de seed, na mistura de janelas de tempo e na falta de evidência visível para o terapeuta.

O próximo marco correto é unificar o contrato, corrigir a origem das recomendações demonstrativas, explicitar frescor e evidência na interface e só então executar a homologação autenticada em HML. Até esse marco, a conclusão deve ser registrada como:

> **Localmente compatível e testada; HML/produção ainda não comprovadas.**
