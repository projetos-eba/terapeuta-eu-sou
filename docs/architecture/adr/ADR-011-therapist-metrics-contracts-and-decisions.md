# ADR-011 — Métricas & Relatórios: contratos e decisões MTR-0

Status: aceito em 2026-07-28; primeiro corte vertical implementado na mesma
data.

## Contexto

O Figma de Métricas & Relatórios apresenta uma visão ampla de descoberta,
agenda, sessões, continuidade e recomendações da Aura. A auditoria registrada
em `docs/architecture/therapist-metrics-reports-strategy.md` confirmou que parte
desse desenho já pode ser calculada com autoridades transacionais existentes,
enquanto outra parte depende de telemetria, novas taxonomias ou decisões de
privacidade.

`docs/architecture/metricas-tes-LEIAME.md` preserva a intenção original do
produto:

- número nunca aparece sozinho;
- comparação somente com o próprio histórico;
- trava de acúmulo;
- plano derivado da assinatura;
- Fala Humana do TES;
- catálogo diferente para Premium e Premium Plus;
- lacuna de agenda ancorada no próprio terapeuta;
- dados agregados e protegidos;
- tendência de demanda do portal somente para administração.

MTR-0 fecha os contratos antes de qualquer alteração de schema, migration,
read model, evento ou UI.

## Fontes e precedência

Esta ADR usa:

1. a decisão explícita do usuário de 2026-07-28;
2. `docs/architecture/metricas-tes-LEIAME.md`, como intenção de produto;
3. `docs/architecture/therapist-metrics-reports-strategy.md`, como auditoria de
   viabilidade;
4. o código e o schema atuais, como estado implementado;
5. novas decisões desta ADR somente onde as fontes anteriores não fechavam o
   contrato.

Origem usada nas tabelas:

- `LEIAME`: decisão existente de produto;
- `AUDITORIA`: constatação do código, banco ou estratégia;
- `NOVA`: decisão fechada nesta ADR, acompanhada de justificativa;
- `EXTERNA`: validação que não pode ser inventada pelo desenvolvimento.

## Fala Humana do TES

O LEIAME referencia um documento autônomo “Fala Humana do TES”. Esse arquivo
não foi identificado no repositório analisado. Isso não impede MTR-0 porque o
próprio LEIAME, o Design System e o `AGENTS.md` preservam o contrato operacional
necessário.

Para Métricas & Relatórios, Fala Humana significa:

- falar de pessoas, não de tráfego, leads ou desempenho humano;
- usar termos simples e explicar o que o dado ajuda a perceber;
- não culpar terapeuta ou pessoa atendida;
- não exagerar;
- não prometer cliente, renda, crescimento ou resultado terapêutico;
- não usar ranking ou comparação com outros terapeutas;
- apresentar tendência como observação, não como causa;
- acompanhar o número com direção e próximo passo possível;
- adaptar a copy quando o valor subiu, ficou estável ou caiu;
- apresentar espera honesta quando a amostra ainda não alcançou a trava.

Exemplos de tom, a serem refinados no catálogo de copy:

| Direção | Exemplo                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Subiu   | “Mais pessoas chegaram até seu trabalho neste período. Observe quais caminhos ajudaram nessa aproximação.”                   |
| Estável | “O movimento ficou próximo do período anterior. Você pode acompanhar mais um ciclo antes de mudar algo.”                     |
| Caiu    | “Menos pessoas chegaram até seu perfil neste período. Vale conferir se sua apresentação e sua agenda continuam atualizadas.” |

Esses exemplos não são frases universais. Cada métrica terá seu próprio trio de
copy. “Subiu” não significa automaticamente algo bom: aumento de cancelamentos,
por exemplo, exige uma orientação diferente. Cor e tom não podem ser derivados
apenas da direção numérica.

## Decisão

### 1. Uma rota e uma implementação

**Origem:** `AUDITORIA`.

- A rota canônica permanece `/terapeuta/insights`, conforme
  `src/lib/routes.ts`.
- `/terapeuta/metricas` permanece alias de compatibilidade com redirect.
- As abas Visão geral, Sessões e Interesse pertencem à mesma implementação.
- Não será criada uma segunda página equivalente.
- Sitemap, mapa de rotas, inventário e skill deverão ser reconciliados quando a
  implementação começar.

### 2. Plano vem da assinatura

**Origem:** `LEIAME` + `AUDITORIA`.

- Premium e Premium Plus são derivados no servidor a partir da assinatura e
  das capabilities sincronizadas.
- O navegador não envia um plano confiável.
- A URL não concede acesso.
- O mesmo módulo e os mesmos contratos atendem os dois planos.
- Free pode receber convite contextual, mas não os read models privados da
  página.

### 3. Número nunca aparece sozinho

**Origem:** `LEIAME`.

Toda definição de métrica deve possuir:

- `metric_key`;
- `metric_definition_version`;
- unidade;
- fórmula;
- período atual;
- período anterior equivalente;
- regra de direção;
- `direction_copy_key_up`;
- `direction_copy_key_stable`;
- `direction_copy_key_down`;
- `baseline_copy_key`;
- ação canônica opcional;
- fonte e frescor;
- trava e guarda de amostra.

As três chaves de direção são obrigatórias. Uma métrica sem copy de direção não
entra na UI.

`baseline_copy_key` é usado quando ainda não há período anterior comparável. O
sistema não chama esse estado de estabilidade.

A faixa de estabilidade pertence à definição versionada da métrica. Não existe
um limiar percentual universal.

### 4. Comparação somente com o próprio histórico

**Origem:** `LEIAME`.

- Toda tendência do terapeuta compara o período atual com período anterior
  equivalente do mesmo terapeuta.
- Benchmark, ranking, média do mercado e comparação entre terapeutas são
  proibidos no shell.
- Plano pago não altera ordenação nem permite “pagar para subir”.
- A Aura segue a mesma restrição.

### 5. Trava de acúmulo igual a 10

**Origem:** `LEIAME`, confirmado pelo usuário.

- Métricas marcadas com trava só aparecem a partir de 10 observações elegíveis.
- Favoritos exigem 10 favoritos, não 10 sessões.
- Percentuais com denominador abaixo de 10 não são mostrados.
- Coortes e segmentações abaixo de 10 são suprimidas.
- Comparações qualitativas podem exigir guarda adicional maior que 10.
- A guarda nunca pode reduzir a trava para menos de 10.
- Abaixo do limiar, o estado é `insufficient_sample`.
- A UI informa o limiar, mas não mostra um número parcial que contradiga a
  trava.

Os três contadores fundamentais definidos adiante não possuem trava.

### 6. Catálogo Premium

**Origem:** `LEIAME`.

Premium recebe a fotografia do período:

| Métrica                                    | Trava                     |
| ------------------------------------------ | ------------------------- |
| Pessoas para quem o perfil apareceu        | sem trava                 |
| Pessoas que quiseram conhecer melhor       | sem trava                 |
| Pessoas que seguiram para agendar          | sem trava                 |
| Temas pelos quais o perfil apareceu        | sem trava                 |
| Técnicas que mais apareceram               | sem trava                 |
| Sentimentos pós-sessão positivos e neutros | 10 atendimentos elegíveis |
| Avaliações agregadas                       | 10 avaliações elegíveis   |

O Premium também recebe os três contadores fundamentais sem trava.

### 7. Catálogo Premium Plus

**Origem:** `LEIAME`.

Premium Plus inclui o Premium e acrescenta:

| Métrica                                | Trava                |
| -------------------------------------- | -------------------- |
| Pessoas que voltaram                   | 10 atendimentos      |
| Técnicas que mais geram agendamentos   | 10 + guarda          |
| Trajetória temporal                    | 10 atendimentos      |
| Quantas vezes o perfil foi favoritado  | 10 favoritos         |
| Favoritos que viraram encontro         | 10 favoritos         |
| Técnicas em que as pessoas mais voltam | 10 + guarda          |
| Lacuna entre procura própria e agenda  | 10 eventos elegíveis |

O Premium Plus recebe recomendações completas da Aura quando possuir
`aura_full`.

### 8. “Interessados em agendar”

**Origem:** `LEIAME` + `NOVA`.

O rótulo “Interessados em agendar” é substituído por:

> Pessoas que seguiram para agendar

Ele mede pessoas distintas que acionaram o início do fluxo de agendamento por
um evento explícito, proposto como `booking_flow_started`.

Esse evento:

- não equivale a hold;
- não equivale a booking;
- não equivale a pagamento;
- não confirma intenção subjetiva;
- exige telemetria nova antes de aparecer como dado real.

O funil preserva etapas separadas:

1. aparição;
2. abertura do perfil;
3. início do agendamento;
4. hold;
5. booking;
6. pagamento confirmado pelo webhook.

### 9. Sessão realizada e sessão concluída

**Origem:** `LEIAME` + `AUDITORIA`.

No módulo do terapeuta:

- “Sessões realizadas” é o rótulo operacional;
- a autoridade é booking com status `completed`;
- “Sessões concluídas” não é um segundo KPI;
- no-show, cancelamento e reagendamento são desfechos separados;
- pagamento permanece dimensão separada e canônica em `session_payments`.

Isso elimina a duplicação encontrada no Figma sem renomear o domínio técnico.

### 10. Tempo de atendimento e duração média

**Origem:** `LEIAME` + `AUDITORIA`.

- O contador fundamental é “Tempo de atendimento”.
- Fórmula: soma de `service_duration_minutes_snapshot` dos bookings
  `completed` no período.
- A apresentação converte minutos para horas sem perder precisão no cálculo.
- O sistema não afirma duração clínica real nem usa presença no Zoom como
  autoridade.
- “Tempo médio por sessão” não entra no primeiro corte.
- Quando implementado, o nome será “Duração média reservada”.

### 11. Terapia mais procurada

**Origem:** `LEIAME` + `AUDITORIA`.

- Sem eventos de aparição, abertura e agendamento por técnica, o sistema não
  afirma qual terapia foi mais procurada.
- Com bookings existentes, a copy permitida é “Técnicas com mais sessões
  realizadas” ou “Técnica mais agendada”.
- Premium poderá mostrar técnicas por aparição após telemetria.
- Premium Plus poderá relacionar aparição e agendamento após trava e guarda.
- Match individual e demanda agregada do portal não entram nessa leitura.

### 12. Presença operacional

**Origem:** `AUDITORIA` + `NOVA`.

A definição v1 é:

```text
completed
/
(completed + no_show_patient + no_show_therapist)
```

- Cancelamentos ficam fora do denominador.
- A copy é “Presença operacional”.
- A métrica tem trava 10.
- O cálculo deriva do desfecho do booking.
- Participação no Zoom não confirma, sozinha, presença ou conclusão.
- A definição deve ser versionada para permitir evolução sem reescrever
  silenciosamente o histórico.

### 13. Segmentos de continuidade

**Origem:** `AUDITORIA` + `NOVA`.

Quando implementados, os segmentos serão exclusivos nesta precedência:

1. `paused`: relacionamento pausado;
2. `inactive`: relacionamento fechado ou última sessão além do limiar;
3. `new`: primeira sessão concluída nos últimos 30 dias e apenas uma sessão
   concluída;
4. `recurring`: duas ou mais sessões concluídas e última sessão em até 90 dias;
5. `active`: atividade em até 90 dias sem enquadramento anterior.

Regras:

- a distribuição soma 100%;
- a taxonomia tem versão;
- cada segmento respeita trava 10 quando exibido;
- mudança futura de limiar cria nova versão da definição;
- não se altera silenciosamente um agregado histórico.

### 14. Inatividade

**Origem:** `NOVA`, baseada na auditoria da jornada atual.

Na definição v1, uma relação é inativa quando:

- está `closed`; ou
- não possui sessão concluída há mais de 90 dias.

Uma relação `paused` permanece pausada por precedência e não é reclassificada
como inativa na distribuição.

### 15. Temas da jornada e sentimento pós-sessão

**Origem:** `LEIAME` + `AUDITORIA`.

- Notas, resumos, intake, mensagens e texto de avaliação não serão minerados
  para inferir temas.
- As regex atuais do Histórico da Jornada não podem alimentar métricas ou Aura.
- “Temas recorrentes da jornada” não será implementado a partir de texto livre.

A alternativa aprovada é um novo evento fechado:

`post_session_sentiment_selected`

Contrato:

- item novo de schema e UI;
- nenhuma parte desse fluxo está pronta hoje;
- seleção opcional e consentida;
- somente chaves positivas ou neutras de allowlist;
- nenhuma opção negativa;
- sem texto livre;
- elegibilidade validada pelo booking concluído;
- uma seleção idempotente por pessoa e sessão conforme contrato futuro;
- taxonomia e consentimento versionados;
- exibição somente agregada após 10 atendimentos elegíveis;
- ausência de seleção não significa sentimento negativo.

Avaliações continuam sendo o canal separado que pode receber retorno crítico,
sob suas regras próprias de moderação, privacidade e elegibilidade.

### 16. Ocupação e lacuna de agenda

**Origem:** `LEIAME` + `AUDITORIA`.

As métricas não serão fundidas.

**Ocupação**

```text
minutos reservados elegíveis
/
minutos reserváveis oferecidos
```

Ocupação olha para a utilização da oferta existente e depende de histórico
confiável de disponibilidade.

**Lacuna**

```text
MAX(0, procura sem disponibilidade - oferta reservável)
```

Lacuna olha para procura direcionada ao próprio terapeuta que não encontrou
oferta equivalente.

Novo evento proposto:

`therapist_unavailable_demand_observed`

Contrato:

- item novo de schema e ingestão;
- nenhuma parte desse tracking está pronta hoje;
- registra terapeuta, técnica e bucket de dia/período;
- usa pessoa pseudonimizada e deduplicação;
- não persiste busca livre;
- não expõe horário individual preciso;
- reconcilia oferta com o slot engine;
- recalcula a lacuna quando a disponibilidade muda;
- respeita trava 10;
- não promete cliente.

As janelas de observação e normalização ficam no registro versionado da métrica
e devem ser calibradas antes da ativação. A semântica não muda: ocupação mede
uso da oferta; lacuna mede procura própria não atendida pela oferta.

### 17. Regra anti-efeito-manada

**Origem:** `LEIAME`.

- Tendência de demanda agregada do portal é somente para administração.
- O terapeuta não recebe “temas em alta”, “horários quentes” ou equivalente.
- A Aura não pode consumir `portal_aggregate_demand`.
- O shell não compara demanda entre terapeutas.
- A lacuna usa somente o sinal do próprio terapeuta.
- Se uma visão agregada administrativa for criada, ela terá read model e RLS
  próprios e não poderá ser reutilizada pelo shell.

Toda regra Aura deve declarar:

```text
signal_scope = therapist_self_only
```

E proibir explicitamente:

- `portal_aggregate_demand`;
- `peer_ranking`;
- `private_session_text`.

### 18. Favoritos

**Origem:** `AUDITORIA`, confirmado pelo usuário.

Favorito é métrica do perfil do terapeuta.

- `favorite_therapists` relaciona pessoa e terapeuta;
- não existe favorito por serviço ou técnica no domínio atual;
- `therapist_service_metrics_v1.favorite_count` replica o total do perfil em
  cada serviço;
- essa projeção é um bug semântico confirmado;
- nenhuma UI, relatório ou regra Aura pode usá-la como favorito do serviço;
- o bug deverá ser corrigido em fase própria, preservando favorito no nível do
  perfil;
- “Favoritos que viraram encontro” usa pessoas que favoritaram o perfil e
  depois agendaram com aquele terapeuta;
- a trava é 10 favoritos.

### 19. Aura por plano

**Origem:** `LEIAME` + `AUDITORIA` + `NOVA`.

- Premium recebe copy direcional determinística anexada à métrica.
- Essa copy não é uma recomendação Aura.
- Recomendações completas da Aura pertencem ao Premium Plus com `aura_full`.
- `aura_limited` permanece como capability técnica compatível, mas não libera
  feed, página ou recomendações Aura no Premium.
- Qualquer uso futuro de `aura_limited` exige nova decisão de produto.
- Aura só consome métricas validadas, agregadas e acima da trava aplicável.
- Aura não usa tendência do portal, texto privado ou comparação entre
  terapeutas.

### 20. Exportação

**Origem:** `NOVA`.

- A primeira exportação será CSV dos dados já exibidos e autorizados.
- O CSV inclui período, timezone, frescor, versão e definição resumida.
- Não inclui nomes ou IDs de pacientes.
- Impressão e PDF ficam para etapa posterior de homologação visual e de
  privacidade.
- Exportação não bloqueia o primeiro corte vertical.

Justificativa: CSV valida contrato e rastreabilidade com menor complexidade e
menor risco de criar um relatório visual divergente.

### 21. Base legal e retenção

**Origem:** `LEIAME` + `EXTERNA`.

- Dados operacionais existentes podem sustentar o primeiro corte sob as
  permissões já aplicáveis ao terapeuta proprietário.
- Novos eventos públicos, sentimento e procura sem disponibilidade não entram
  em produção até validação formal de privacidade.
- Base legal, aviso de privacidade e prazo de retenção não serão inventados
  nesta ADR.
- Ausência dessa validação é gate de produção, não autorização implícita.
- Match individual permanece fora do módulo.
- Eventos locais ou de teste devem ser identificados por ambiente e nunca
  misturados com produção.

### 22. Estados discriminados

**Origem:** `AUDITORIA` + `LEIAME`.

O contrato deve distinguir:

- `ready`;
- `empty`;
- `insufficient_sample`;
- `processing`;
- `unavailable`.

Regras:

- zero legítimo não vira indisponibilidade;
- indisponibilidade não vira zero;
- abaixo da trava não mostra parcial;
- ausência de telemetria não vira lista ou gráfico vazio;
- demo nunca aparece silenciosamente em produção.

## Matriz de fechamento da seção 19 da estratégia

| Item antes pendente          | Decisão                                                       | Origem                 |
| ---------------------------- | ------------------------------------------------------------- | ---------------------- |
| Rota canônica                | `/terapeuta/insights`, com alias `/terapeuta/metricas`        | `AUDITORIA`            |
| “Interessados em agendar”    | “Pessoas que seguiram para agendar”, por evento explícito     | `LEIAME` + `NOVA`      |
| Realizadas versus concluídas | Um único KPI baseado em booking `completed`                   | `LEIAME` + `AUDITORIA` |
| Tempo médio                  | Fora do primeiro corte; futuro “Duração média reservada”      | `LEIAME` + `AUDITORIA` |
| Terapia mais procurada       | Não inferir; usar “mais agendada” sem telemetria              | `LEIAME` + `AUDITORIA` |
| Presença                     | Presença operacional, fórmula fechada e trava 10              | `AUDITORIA` + `NOVA`   |
| Segmentos                    | Exclusivos, versionados, com precedência                      | `AUDITORIA` + `NOVA`   |
| Inatividade                  | Relação fechada ou mais de 90 dias sem conclusão              | `NOVA`                 |
| Temas da jornada             | Texto livre proibido; sentimento fechado é alternativa futura | `LEIAME` + `AUDITORIA` |
| Aura Premium                 | Copy direcional no Premium; Aura completa no Premium Plus     | `LEIAME` + `NOVA`      |
| Exportação                   | CSV primeiro, PDF depois                                      | `NOVA`                 |
| Base legal e retenção        | Gate externo antes de novos eventos em produção               | `LEIAME` + `EXTERNA`   |

## Primeiro corte vertical de implementação

O primeiro corte depois desta ADR deve validar a arquitetura com o menor risco,
sem Aura e sem telemetria nova.

### Escopo funcional

Disponível para Premium e Premium Plus, sem trava:

1. pessoas atendidas;
2. sessões realizadas;
3. tempo de atendimento.

### Fonte

Somente bookings existentes:

- `therapist_profile_id` derivado de `auth.uid()`;
- status `completed`;
- período aplicado por `starts_at` no timezone canônico;
- pessoa distinta por `patient_profile_id`;
- duração por `service_duration_minutes_snapshot`;
- sem consulta a notas, Match, mensagens, documentos ou eventos públicos;
- sem nova autoridade financeira.

### Período

Definição v1:

- padrão: últimos 30 dias locais completos;
- dia corrente não entra no comparativo para evitar período parcial;
- período anterior: os 30 dias completos imediatamente anteriores;
- intervalos são semiabertos;
- timezone vem de `therapist_schedule_settings.timezone`;
- fallback de timezone somente conforme autoridade já documentada, nunca por
  valor enviado pelo navegador.

Períodos adicionais podem ser incorporados depois, preservando a mesma
semântica.

### Read model mínimo

Nome conceitual:

`TherapistMetricsFoundationReadModel`

| Bloco                | Campos mínimos                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Metadados            | versão da definição, timezone, início e fim do período atual, início e fim do período anterior, instante de cálculo e frescor |
| Pessoas atendidas    | estado, valor atual, valor anterior, direção, chave de copy e unidade pessoas                                                 |
| Sessões realizadas   | estado, valor atual, valor anterior, direção, chave de copy e unidade sessões                                                 |
| Tempo de atendimento | estado, minutos atuais, minutos anteriores, direção, chave de copy e unidade minutos                                          |
| Indisponibilidade    | estado `unavailable` e correlation ID sanitizado quando existente                                                             |

As direções possíveis são `up`, `stable`, `down` e `baseline`. Os estados com
valor são `ready` e `empty`; falha controlada usa `unavailable`.

Regras:

- o DTO não contém IDs de pacientes;
- o valor pode ser zero sem indicar falha;
- `insufficient_sample` não se aplica aos três contadores;
- `directionCopyKey` é sempre preenchida quando há valor;
- a direção usa valores brutos; arredondamento ocorre apenas na apresentação;
- erro do banco retorna `unavailable`, nunca dados demonstrativos;
- uma única consulta agregada deve calcular período atual e anterior;
- componentes React não recebem linhas cruas do Supabase.

### RLS e autorização

- leitura autenticada;
- role terapeuta;
- capability `advanced_metrics`;
- plano Premium ou Premium Plus derivado no servidor;
- terapeuta lê somente os próprios agregados;
- paciente, visitante e outro terapeuta não acessam o read model;
- `therapist_profile_id` não é argumento confiável;
- Next.js não usa service role.

### Estados a validar

- valores atuais e comparação;
- zero legítimo;
- nenhum booking concluído;
- timezone diferente;
- limite exato de período;
- sessão expirada;
- capability negada;
- banco indisponível;
- dois terapeutas com dados isolados.

### Fora desse corte

- telemetria pública;
- funil;
- KPI de favoritos do perfil;
- sentimento;
- lacuna de agenda;
- ocupação;
- presença;
- segmentos;
- Aura;
- exportação;
- gráficos complexos;
- novas tabelas de telemetria.

## Implementação MTR-0.1 e MTR-0.2

O primeiro corte foi implementado sem telemetria nova:

| Entrega                                   | `implementation_status`    | Fonte de dados                                      | QA                                            |
| ----------------------------------------- | -------------------------- | --------------------------------------------------- | --------------------------------------------- |
| MTR-0.1 — read model                      | `functional`               | `bookings.status = completed` e snapshots A2        | pgTAP, DB lint, parsers Vitest                |
| MTR-0.2 — aba Visão geral                 | `functional`               | `get_therapist_metrics_foundation_v1`               | componentes Vitest, ESLint, typecheck e build |
| MTR-1 — telemetria                        | `functional`, gate externo | eventos objetivos deduplicados                      | pgTAP e Vitest; ativação produtiva bloqueada  |
| MTR-2 — agregados/read model              | `functional`               | eventos, favoritos e bookings                       | pgTAP, RLS, parsers Vitest                    |
| MTR-3 — Visão geral                       | `functional`               | `get_therapist_metrics_overview_v1`                 | componentes, build e E2E em cinco viewports   |
| Abas Sessões e Interesse                  | `planned`                  | contratos MTR-4/MTR-5                               | não aplicável neste corte                     |
| Aura                                      | `planned`                  | depende de MTR-6                                    | bloqueada contra dados simulados              |
| Correção isolada de favoritos por serviço | `functional`               | `favorite_therapists` permanece associada ao perfil | pgTAP e regressão da gestão de serviços       |
| KPI de favoritos no perfil                | `functional`               | `favorite_therapists`, com trava de 10              | pgTAP, mapper e componente                    |

### Autoridade implementada

- RPC privada: `get_therapist_metrics_foundation_v1()`.
- Identidade: derivada de `auth.uid()`.
- Capability: `advanced_metrics`, com defesa adicional para Premium e Premium
  Plus no banco.
- Timezone: `therapist_schedule_settings.timezone`.
- Período: últimos 30 dias locais completos e 30 dias anteriores equivalentes.
- Métricas: pessoas atendidas, sessões realizadas e minutos de atendimento.
- Resposta: contrato versionado, estados `ready`/`empty`, valor anterior,
  direção e `directionCopyKey`.
- Falha: indisponibilidade controlada; nenhum zero, mock ou dado demonstrativo
  substitui erro.

### Correção de favoritos

`therapist_service_metrics_v1.favorite_count` foi preservado somente como
coluna legada compatível e passa a retornar `null`. Os envelopes privados de
serviço não expõem mais `favoriteCount`; cards e ranking de serviços usam
somente agendamentos. A contagem canônica continua em `favorite_therapists`,
associada ao perfil do terapeuta.

Isso corrige a atribuição incorreta. O KPI de perfil implementado em MTR-3
respeita plano, trava de 10 e copy direcional.

## Implementação MTR-1 A MTR-3

Status: `functional` em 2026-07-28, com o gate produtivo de privacidade
preservado.

- eventos objetivos foram implementados em `therapist_metric_events`;
- a projeção diária versionada usa `therapist_metric_daily_aggregates`;
- a ingestão pública passa por
  `record_public_therapist_metric_events_v1(uuid,jsonb)`;
- o read model privado é `get_therapist_metrics_overview_v1(integer)`;
- períodos permitidos são 30 e 90 dias locais completos;
- favoritos entram como evento autoritativo do perfil e continuam protegidos
  pela trava 10;
- funil usa coorte pseudônima e nunca totais independentes;
- ocupação permanece `unavailable` por ausência de histórico reproduzível da
  oferta;
- a UI mostra estados discriminados e não preenche lacunas com números do
  Figma;
- a telemetria pública nasce desativada e não será ativada antes da validação
  formal de base legal, aviso de privacidade e retenção.

Este adendo resolve os nomes físicos antes deixados em aberto sem alterar as
decisões de produto da ADR. A implementação detalhada está em
`docs/architecture/therapist-metrics-mtr1-mtr3.md`.

## Consequências

### Positivas

- O módulo começa com dados já autoritativos.
- A arquitetura é validada antes de adicionar eventos.
- Premium e Premium Plus compartilham contratos.
- Copy e número não podem divergir silenciosamente.
- Travas e privacidade ficam verificáveis.
- Aura nasce como consumidora, não como autoridade.
- Efeito manada é bloqueado por contrato.
- O bug de favoritos fica registrado como defeito real.

### Custos

- Parte relevante do Figma continuará indisponível até existir telemetria.
- Novos eventos exigirão schema, ingestão, consentimento e homologação.
- O catálogo de copy precisa ser mantido junto ao dicionário de métricas.
- Alterar fórmula exige nova versão e possível reprocessamento.
- A validação externa de privacidade continua necessária antes da produção dos
  novos eventos.

## Ainda não decidido

- valores finais das janelas de lacuna;
- taxonomia exata de sentimentos positivos e neutros;
- base legal e retenção dos novos eventos;
- implementação do CSV;
- eventual uso futuro de `aura_limited`.

Esses itens não autorizam fallback, mock ou coleta produtiva. Cada um possui um
gate explícito antes da fase correspondente.

## Validação documental

A implementação futura deve comprovar:

- fórmulas por testes de domínio;
- RLS por pgTAP;
- parsing por Vitest;
- autorização e contratos server-side por Deno;
- ausência de dados privados;
- copy de direção para todas as métricas;
- trava 10;
- timezone;
- estados discriminados;
- nenhuma tendência agregada no shell ou Aura;
- nenhum favorito interpretado por serviço.
