# Métricas & Relatórios do Terapeuta

## Estratégia de produto, dados e recomendações determinísticas da Aura

| Campo                 | Valor                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Data da análise       | 2026-07-28                                                         |
| Estado atual          | `prototyped` no Figma; rota funcional ainda não implementada       |
| Rota executável atual | `/terapeuta/insights`                                              |
| Alias atual           | `/terapeuta/metricas` redireciona para `/terapeuta/insights`       |
| Capability atual      | `advanced_metrics`                                                 |
| Figma                 | arquivo `OSXJi8tknHHCj82MTY2NbG`                                   |
| Frames analisados     | `13366:3628`, `13366:4259`/conteúdo `13366:4363`, `13366:4896`     |
| Fonte financeira      | `session_payments.financial_status`                                |
| Fonte de agenda       | bookings, disponibilidade e slot engine autoritativo               |
| Aura                  | mecanismo determinístico por regras; não é IA generativa           |
| MTR-0                 | fechado por `ADR-011-therapist-metrics-contracts-and-decisions.md` |

## 1. Resumo executivo

O módulo desenhado no Figma é viável como visão de produto, mas não deve ser
implementado integralmente apenas com os dados disponíveis hoje. Há três
situações distintas:

1. Indicadores operacionais já calculáveis com boa procedência, como sessões
   concluídas, cancelamentos, reagendamentos, distribuição por terapia e
   horários ocupados.
2. Indicadores parcialmente calculáveis, mas que exigem uma definição canônica
   antes da UI, como presença, ocupação, retorno, retenção e estados da base de
   pacientes.
3. Indicadores que ainda não possuem coleta produtiva ou taxonomia estruturada,
   como visualizações reais do perfil, início do funil de agendamento, motivos
   categorizados de saída e temas recorrentes da jornada.

`therapist_profile_daily_analytics` e `aura_recommendations` já existem, porém
foram encontrados somente seeds para alimentá-las. Um pipeline produtivo de
telemetria e um processador produtivo de regras da Aura não foram identificados
nos arquivos analisados.

A recomendação é construir o módulo sobre quatro camadas explícitas:

1. autoridades transacionais existentes;
2. eventos de produto validados e idempotentes;
3. agregados versionados com definições auditáveis;
4. read models privados para a UI e para o motor determinístico da Aura.

A Aura deve ser consumidora de sinais agregados, nunca autoridade de métricas e
nunca leitora livre de notas, resumos de sessão ou respostas privadas. Cada
recomendação precisa declarar regra, versão, evidência, período, amostra mínima,
capability e prazo de validade.

As decisões de contrato de MTR-0 foram fechadas pela ADR-011. O LEIAME define a
intenção inviolável de produto; esta estratégia continua registrando a
viabilidade técnica e os bloqueios encontrados no sistema real.

## 2. Resultado esperado para o terapeuta

O módulo deve responder, com clareza, a cinco perguntas:

1. Como as pessoas estão encontrando meu perfil?
2. Em que ponto elas deixam de avançar para um agendamento?
3. Como minha agenda está sendo utilizada?
4. Como está a continuidade dos atendimentos, sem transformar comportamento
   humano em julgamento?
5. Qual ação concreta e responsável posso considerar agora?

O módulo não deve:

- apresentar estimativas como fatos;
- preencher períodos vazios com dados demonstrativos;
- transformar zero em erro ou erro em zero;
- prometer crescimento, renda ou resultados terapêuticos;
- ranquear pacientes individualmente;
- inferir condições pessoais ou clínicas;
- usar conteúdo privado de sessões para gerar recomendações;
- criar uma nova autoridade financeira;
- tratar correlação como causalidade;
- comparar um terapeuta com outros, com média de mercado ou ranking;
- expor tendência agregada de demanda do portal ao terapeuta ou à Aura;
- sugerir que um tema ou horário está “em alta” para incentivar cadastro ou
  abertura oportunista de agenda;
- apresentar número sem copy de direção e próximo passo compatível com a
  tendência observada.

### 2.1 Fala Humana do TES aplicada às métricas

O documento autônomo “Fala Humana do TES”, citado pelo LEIAME, não foi
identificado nos arquivos analisados. Para MTR-0, o contrato de copy fica
formalizado a partir das regras preservadas no LEIAME, no Design System e no
`AGENTS.md`:

- falar de pessoas, não de tráfego, leads ou performance humana;
- usar linguagem direta, acolhedora e sem jargão;
- não culpar o terapeuta nem a pessoa atendida;
- não exagerar, celebrar automaticamente ou prometer resultado;
- comparar somente com o próprio histórico;
- explicar o que o dado ajuda a perceber;
- acompanhar todo número com direção e ação possível;
- variar a copy quando subiu, ficou estável ou caiu;
- usar estado de espera honesto quando a trava de 10 não foi alcançada.

## 3. Fontes auditadas

### 3.1 Produto e navegação

- `AGENTS.md`
- `README.md`
- `docs/product/sitemap.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/product/glossary.md`
- `docs/design-system/design-system.md`
- `docs/design-system/tokens.md`
- `docs/architecture/metricas-tes-LEIAME.md`
- `docs/architecture/adr/ADR-011-therapist-metrics-contracts-and-decisions.md`
- `src/lib/routes.ts`
- `src/lib/permissions.ts`
- `src/domain/tes/permissions.ts`
- `src/domain/tes/plan-definitions.ts`
- `src/features/therapist-shell/therapist-navigation.ts`
- `src/features/therapist-shell/therapist-route-policy.ts`

### 3.2 Dados e contratos

- `supabase/migrations/20260708090000_initial_mvp_domain.sql`
- `supabase/migrations/20260724130000_therapist_dashboard_foundation.sql`
- `supabase/migrations/20260726100000_agenda_a2_transactional_foundation.sql`
- `supabase/migrations/20260726110000_agenda_sessions_read_models.sql`
- `supabase/migrations/20260727130000_agenda_a5_authoritative_slots.sql`
- `supabase/migrations/20260728091000_therapy_service_foundation_phase1.sql`
- `supabase/seed.sql`
- `src/features/therapist-dashboard/*`
- `src/features/therapist-journey-history/*`
- `src/features/therapist-sessions/*`
- `src/features/therapist-services/*`

## 4. Leitura do Figma

Os três frames representam abas de uma mesma experiência:

### 4.1 Visão geral

O Figma propõe:

- visualizações do perfil;
- interessados em agendar;
- sessões realizadas;
- taxa de retorno;
- ocupação da agenda;
- terapia mais procurada;
- funil entre perfil, interesse e agendamento;
- resumo e heatmap de agenda;
- resumo da base de pacientes;
- terapias com maior demanda;
- melhores horários;
- comparação com período anterior;
- demanda por abordagem;
- distribuição de pacientes por status.

### 4.2 Sessões

O Figma propõe:

- sessões realizadas;
- taxa de presença;
- cancelamentos;
- reagendamentos;
- sessões concluídas;
- tempo médio por sessão;
- distribuição por dia e horário;
- sessões por terapia;
- evolução no período;
- presença versus ausência;
- motivos de cancelamento;
- dias e horários de maior presença;
- pacientes novos versus recorrentes por semana.

### 4.3 Interesse

O Figma propõe:

- pacientes ativos;
- novos pacientes;
- pacientes recorrentes;
- taxa de retorno;
- pacientes inativos;
- tempo médio de permanência;
- retenção por coorte;
- distribuição por status;
- evolução da base;
- média de sessões por paciente;
- motivos de saída ou inatividade;
- temas recorrentes na jornada.

### 4.4 Ajustes conscientes necessários

O Figma é referência de hierarquia e intenção, não de fórmula ou autoridade de
dados. A implementação futura deve ajustar:

- posicionamento absoluto e canvas fixo para o grid compartilhado `AppPage*`;
- textos funcionais menores que 14px;
- metadados menores que 11px;
- gráficos sem alternativa tabular ou resumo acessível;
- copy “transformar mais vidas”, que deve ser substituída por linguagem sem
  promessa de resultado;
- ausência de um filtro global de período e indicação de atualização;
- ausência de estados de dados insuficientes, indisponíveis e atrasados;
- ausência de explicação das fórmulas;
- ausência de ação explícita de relatório ou exportação, apesar do nome da
  página;
- distribuição da Visão geral cujos valores exemplificativos somam mais de
  100%, incompatível com um gráfico de partes exclusivas.

### 4.5 Matriz de divergências

| Tema                | Produto/Figma                                       | Documentação                                                | Código/banco                                                 | Decisão para o módulo                                                 |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Namespace           | Figma apresenta uma única página com três abas      | Sitemap separa métricas intermediárias e insights avançados | `/terapeuta/metricas` redireciona para `/terapeuta/insights` | Uma implementação; confirmar e documentar a rota canônica antes da UI |
| Planos              | Frames ainda usam referências históricas a Pro/Plus | Parte do inventário ainda usa Pro/Plus                      | Capabilities usam Premium/Premium Plus                       | Copy nova usa Premium e Premium Plus; enums permanecem técnicos       |
| Aura                | Marca “Aura IA”                                     | Documentos a descrevem como inteligência por plano          | Schema declara regras sem IA generativa                      | Manter marca, mas explicar que as recomendações são determinísticas   |
| Visualizações       | Figma exibe valores e tendências                    | Documentação promete métricas de perfil                     | Tabela existe, mas somente seeds foram identificados         | Bloquear KPI real até existir ingestão produtiva observável           |
| Interesse           | Figma usa “Interessados em agendar”                 | Não há evento canônico definido                             | Não foi identificado evento de intenção no fluxo público     | Medir uma ação objetiva e renomear para “Iniciaram o agendamento”     |
| Sessões             | Figma separa realizadas e concluídas                | Conceitos não estão formalmente separados                   | Booking possui `completed`, mas presença é limitada          | Não duplicar KPIs sem uma diferença verificável                       |
| Financeiro          | Figma não explicita autoridade                      | ADR define pagamento canônico                               | Dashboard legado usa `payments`                              | Toda dimensão financeira usa `session_payments`                       |
| Favoritos           | Figma sugere demanda por terapia                    | Serviço privado exibe favoritos                             | View replica favoritos do terapeuta em cada serviço          | Não usar como interesse por serviço ou terapia                        |
| Status de pacientes | Figma usa ativos, novos, recorrentes e inativos     | Não há taxonomia analítica versionada                       | Relação possui apenas active, paused e closed                | Derivar segmentos exclusivos com precedência e versão                 |
| Distribuição        | Um exemplo da Visão geral soma mais de 100%         | Não há regra de exclusividade                               | Não há read model canônico                                   | Corrigir fórmula; gráfico de partes deve totalizar 100%               |
| Temas               | Figma propõe temas recorrentes                      | Privacidade restringe conteúdo sensível                     | Mapper atual usa regex em resumos livres                     | Não reutilizar; exigir taxonomia agregada e governança                |
| Relatórios          | Nome da página inclui relatórios                    | Inventário menciona analytics                               | Figma não apresenta exportação e rota é scaffold             | Entregar CSV primeiro e homologar PDF depois                          |
| Copy                | Figma usa “transformar mais vidas”                  | AGENTS proíbe promessas de resultado                        | Ainda não há página final                                    | Usar copy operacional, responsável e não causal                       |
| Analytics           | Nomes de eventos não aparecem no Figma              | Estratégia de eventos não está documentada                  | Provider/pipeline produtivo não identificado                 | Criar contrato versionado antes de instrumentar                       |

### 4.6 Estado real por camada

| Camada                                     | `implementation_status`             | `data_source`                   | `qa_status`                               | `known_blockers`                                        |
| ------------------------------------------ | ----------------------------------- | ------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Frames de Visão geral, Sessões e Interesse | `prototyped`                        | dados ilustrativos do Figma     | comparação visual realizada nesta análise | fórmulas e estados de dados não definidos               |
| Rota `/terapeuta/insights`                 | `planned`                           | nenhuma consulta do módulo      | não aplicável nesta análise               | página ainda é scaffold                                 |
| Analytics diário de perfil                 | `mocked` em ambiente local          | seed de Supabase                | constraints e RLS existentes              | ingestão produtiva não identificada                     |
| Métricas operacionais de booking           | `data_integrated` em outros módulos | bookings, agenda e pagamentos   | testes dos módulos de origem              | falta read model específico e dicionário                |
| Recomendações Aura                         | `mocked` em ambiente local          | seeds em `aura_recommendations` | leitura privada existente                 | gerador de regras, versão e evidência não identificados |
| Relatórios exportáveis                     | `planned`                           | não definido                    | não executado                             | formato e política de privacidade pendentes             |

## 5. Diagnóstico do projeto atual

### 5.1 Rota e capability

- `src/lib/routes.ts` define `/terapeuta/insights` como rota canônica executável.
- `/terapeuta/metricas` existe como redirect para essa rota.
- A navegação apresenta “Métricas & Relatórios” e exige `advanced_metrics`.
- `advanced_metrics` está disponível a partir do Premium.
- `aura_full` está disponível no Premium Plus.
- A rota atual renderiza somente `TherapistFeaturePage`, sem read model de
  métricas.

Há divergência documental: o sitemap ainda descreve `/terapeuta/metricas` como
métricas intermediárias e `/terapeuta/insights` como uma segunda superfície de
insights avançados. O código consolidou ambas em uma rota. A recomendação de
menor risco é manter uma única página com abas e capabilities, preservando o
redirect, mas a documentação de rotas deve ser reconciliada na fase de
implementação.

### 5.2 Analytics de perfil

`therapist_profile_daily_analytics` possui:

- `profile_views`;
- `search_impressions`;
- `profile_clicks`;
- `favorites_added`;
- `contact_clicks`.

A tabela tem RLS de leitura pelo terapeuta proprietário e constraint de valores
não negativos. Entretanto:

- a escrita produtiva desses dados não foi identificada nos arquivos
  analisados;
- os registros atuais são criados pelo seed;
- não há evento canônico de início de checkout nessa estrutura;
- não há distinção de bots, reloads, sessões anônimas ou ambiente;
- zero pode significar ausência de eventos ou ausência do pipeline.

Portanto, esses campos não devem ser mostrados como métricas reais até existir
coleta, monitoramento de frescor e reconciliação.

### 5.3 Dashboard existente

`get_therapist_dashboard_v1()` oferece uma base inicial, mas não deve ser
reutilizado como autoridade final do novo módulo porque:

- restringe o acesso ao plano `premium_plus`, enquanto métricas pertencem ao
  Premium e ao Premium Plus;
- usa a tabela legada `payments` para receita, em vez da autoridade
  `session_payments`;
- mistura dados de hoje, semana e mês em um payload de dashboard;
- não distingue zero legítimo de dado indisponível;
- possui rotas legadas no payload;
- não cobre os três read models do Figma;
- não registra versão das definições de métrica.

### 5.4 Sessões, pagamentos e agenda

Há boa base para métricas operacionais:

- bookings com estados transacionais;
- snapshots de serviço, preço e duração;
- `session_payments.financial_status` como autoridade financeira;
- pedidos de reagendamento;
- disponibilidade semanal, exceções e timezone canônico;
- slot engine e calendário autoritativos;
- eventos de booking;
- Video Session para operação online.

Limitações:

- o read model de sessões declara presença como indisponível, exceto projeções
  legadas de no-show;
- “sessão realizada” e “sessão concluída” aparecem como conceitos distintos no
  Figma, mas não há definição de produto que os separe;
- duração real de participação não é uma métrica canônica de sessão;
- `cancellation_reason` é texto, não categoria analítica estável;
- participação no Zoom não deve, isoladamente, confirmar conclusão clínica nem
  pagamento.

### 5.5 Pacientes e continuidade

`therapist_patient_relationships` possui os estados `active`, `paused` e
`closed`. A página de Histórico da Jornada deriva estados e segmentos no
frontend a partir de relações, bookings e resumos.

Isso ainda não é suficiente para uma taxonomia analítica canônica de:

- novo;
- ativo;
- recorrente;
- pausado;
- inativo.

O mapper atual também identifica temas com expressões regulares sobre título de
serviço e `booking_session_summaries`. Essa estratégia não deve alimentar o
módulo de métricas nem a Aura porque pode processar texto livre sensível,
produzir inferências frágeis e tornar resultados difíceis de explicar.

### 5.6 Métricas de serviço

`therapist_service_metrics_v1` fornece bookings por serviço, mas associa
`favorite_therapists` pelo terapeuta. O `favorite_count` resultante é um total
do perfil repetido em cada serviço, não um interesse específico no serviço ou
na terapia.

Isso é um bug confirmado de projeção semântica, não uma escolha visual ainda
aberta. Favorito pertence ao perfil do terapeuta. O sistema atual não possui
favorito por serviço ou técnica, e nenhuma tela, relatório ou regra da Aura
pode interpretar esse total como se pertencesse a uma oferta específica.

Consequências:

- bookings por serviço podem sustentar ranking de terapias agendadas;
- favoritos são métrica do perfil do terapeuta;
- favoritos não podem sustentar ranking por serviço, terapia ou técnica;
- a projeção privada de serviços deve deixar de replicar esse valor por serviço
  quando o módulo for corrigido;
- “terapia mais procurada” deve ser apresentada como “terapia mais agendada”
  até existir telemetria de visualização e intenção por serviço;
- percentuais de variação continuam corretamente `null` quando não calculados.

### 5.7 Aura

`aura_recommendations` já registra:

- regra de origem;
- título e corpo;
- plano mínimo;
- contexto;
- prioridade;
- expiração;
- estado ativo.

O schema documenta que as recomendações são baseadas em regras, sem IA
generativa. Entretanto:

- o gerador produtivo das recomendações não foi identificado nos arquivos
  analisados;
- os exemplos atuais vêm do seed;
- a consulta atual não filtra `plan_required` nem `expires_at`;
- não há versão da regra, amostra, janela analisada ou evidência tipada;
- não há ciclo explícito de exibida, dispensada, aplicada ou expirada;
- não há garantia de deduplicação por regra e período.

## 6. Avaliação de viabilidade

Legenda:

- `pronta`: fontes canônicas suficientes, restando implementar o read model;
- `parcial`: possível após definição, ajuste ou reconciliação;
- `bloqueada`: falta coleta ou taxonomia;
- `restrita`: exige decisão adicional de privacidade e governança.

| Indicador do Figma            | Viabilidade | Fonte recomendada                          | Observação                                                           |
| ----------------------------- | ----------- | ------------------------------------------ | -------------------------------------------------------------------- |
| Pessoas atendidas             | pronta      | pacientes distintos em bookings concluídos | Contador sem trava para Premium e Premium Plus.                      |
| Tempo de atendimento          | pronta      | duração snapshot de bookings concluídos    | Soma em horas; contador sem trava.                                   |
| Visualizações do perfil       | bloqueada   | eventos públicos + agregado diário         | Tabela existe, ingestão produtiva não identificada.                  |
| Interessados em agendar       | bloqueada   | `booking_checkout_started` ou hold válido  | O rótulo precisa corresponder a um evento mensurável.                |
| Sessões realizadas            | pronta      | bookings concluídos                        | Exige fórmula canônica e período por `starts_at`.                    |
| Taxa de retorno               | parcial     | histórico de bookings concluídos           | Precisa de coorte e janela de retorno.                               |
| Ocupação da agenda            | parcial     | disponibilidade + bookings                 | Denominador deve ser a capacidade realmente reservável.              |
| Terapia mais procurada        | bloqueada   | eventos por serviço/terapia                | Hoje é possível somente “mais agendada”.                             |
| Funil de conversão            | bloqueada   | eventos + hold + booking + webhook         | Pagamento nunca pode vir do redirect do Checkout.                    |
| Pacientes ativos              | parcial     | relações + bookings                        | Definições e precedência precisam ser versionadas.                   |
| Novos pacientes               | pronta      | primeiro booking concluído                 | Definir janela de 30 dias ou período selecionado.                    |
| Pacientes recorrentes         | pronta      | dois ou mais bookings concluídos           | Definir janela de atividade.                                         |
| Pacientes inativos            | parcial     | relação + última sessão                    | Definir limiar e tratamento de `closed`.                             |
| Top terapias                  | pronta      | booking -> serviço -> terapia              | Usar snapshots quando o histórico exigir.                            |
| Melhores horários             | pronta      | bookings por timezone                      | Deve indicar volume mínimo e não confundir passado com demanda.      |
| Demanda por abordagem         | parcial     | eventos ou bookings por terapia/categoria  | Não derivar de respostas privadas do Match.                          |
| Sessões concluídas            | pronta      | booking `completed`                        | Não duplicar “realizadas” sem diferença objetiva.                    |
| Taxa de presença              | parcial     | `completed` e no-show                      | Presença direta ainda não é autoridade explícita.                    |
| Cancelamentos                 | pronta      | estados do booking                         | Separar cancelamento de reembolso.                                   |
| Reagendamentos                | pronta      | solicitações aceitas e eventos             | Contar booking único e quantidade de eventos separadamente.          |
| Tempo médio por sessão        | parcial     | snapshot de duração                        | Deve se chamar “duração média reservada” sem duração real confiável. |
| Motivos de cancelamento       | bloqueada   | código estruturado                         | Texto livre não deve virar categoria automaticamente.                |
| Retenção por coorte           | pronta      | bookings concluídos                        | Requer coorte madura e células com amostra mínima.                   |
| Evolução da base              | pronta      | primeira/última sessão + relação           | Necessita definição dos estados.                                     |
| Média de sessões por paciente | pronta      | bookings concluídos/pacientes              | Informar período e denominador.                                      |
| Tempo de permanência          | parcial     | primeira e última sessão                   | Há censura para relações ainda ativas.                               |
| Motivos de saída              | bloqueada   | código estruturado e opcional              | Não inferir de silêncio ou texto clínico.                            |
| Sentimento pós-sessão         | bloqueada   | novo evento consentido e fechado           | Somente positivo/neutro; exige schema e UI novos.                    |
| Temas recorrentes da jornada  | restrita    | sentimento consentido e agregado           | Não usar notas ou resumos livres.                                    |
| Lacuna de agenda              | bloqueada   | procura sem disponibilidade + oferta       | Métrica própria; não é ocupação e exige evento novo.                 |

## 7. Dicionário canônico proposto

As fórmulas abaixo são propostas para a próxima fase. Devem ser aprovadas e
versionadas antes de persistir agregados.

### 7.1 Dimensões comuns

- `therapist_profile_id`: sempre derivado de `auth.uid()`;
- `period_start` e `period_end`: intervalo semiaberto `[início, fim)`;
- `previous_period_start` e `previous_period_end`: período anterior de mesma
  duração;
- `timezone`: `therapist_schedule_settings.timezone`;
- `service_id`: oferta do terapeuta;
- `therapy_id`: terapia canônica da plataforma;
- `event_environment`: produção, preview, desenvolvimento ou teste;
- `metric_definition_version`: versão imutável da fórmula;
- `computed_at`: instante do cálculo;
- `data_fresh_through`: último instante incluído;
- `direction`: `up`, `stable` ou `down`, calculado pela definição versionada;
- `direction_copy_key_up`: copy obrigatória para alta;
- `direction_copy_key_stable`: copy obrigatória para estabilidade;
- `direction_copy_key_down`: copy obrigatória para queda;
- `baseline_copy_key`: copy para o primeiro período comparável, quando ainda
  não existe direção;
- `action_route_key`: ação canônica opcional e compatível com a leitura.

Nenhuma métrica entra no catálogo sem as três chaves de direção. A copy deve
explicar o que o dado ajuda a perceber e indicar uma ação possível, sem
celebração fixa. O valor nunca é renderizado sozinho. Quando não houver período
anterior, usa-se `baseline_copy_key`; não se inventa estabilidade.

A direção compara somente o histórico do próprio terapeuta. Cada definição
declara a sua faixa de estabilidade para evitar que pequenas oscilações sejam
tratadas como mudança relevante.

### 7.2 Contadores fundamentais sem trava

Os três contadores aparecem para Premium e Premium Plus sem trava de acúmulo:

**Pessoas atendidas**

```text
COUNT(DISTINCT patient_profile_id)
```

Considera bookings `completed` cujo `starts_at` pertence ao período no timezone
do terapeuta. Uma pessoa conta uma vez no período.

**Sessões realizadas**

```text
COUNT(booking_id)
```

“Sessão realizada” é a copy operacional para booking concluído. Não existe um
segundo KPI “sessões concluídas” com a mesma fórmula.

**Tempo de atendimento**

```text
SUM(snapshot de duração dos bookings completed)
```

O valor é apresentado em horas, preservando minutos no cálculo. Trata-se do
tempo reservado das sessões realizadas, não de duração clínica monitorada.

### 7.3 Descoberta e conversão

**Impressão na busca**

Card do terapeuta efetivamente renderizado em uma lista pública. Deve excluir
owner, admin, bots conhecidos e ambientes não produtivos. Repetições devem ser
deduplicadas por sessão anônima, terapeuta e conjunto de resultados.

**Visualização do perfil**

Abertura válida de `/terapeutas/:slug`, com perfil publicado. Deve excluir
owner, admin, bots e refresh repetido dentro da janela de deduplicação.

**Início de agendamento**

Evento emitido quando a pessoa inicia o fluxo a partir de um serviço e uma
terapia válidos. O texto recomendado para a UI é “Iniciaram o agendamento”, não
“interessados”, até haver uma definição de interesse separada.

**Hold criado**

Hold autoritativo e não expirado no instante da criação. É uma intenção mais
forte que o início do checkout.

**Agendamento criado**

Booking criado a partir de hold consumido, independentemente de pagamento.

**Agendamento confirmado**

Booking cuja confirmação financeira veio exclusivamente do webhook Stripe e da
autoridade `session_payments`.

**Conversão**

Cada etapa deve usar coorte de origem, não totais independentes:

```text
taxa(etapa A -> etapa B) =
  visitantes únicos da coorte A que alcançaram B
  / visitantes únicos elegíveis da coorte A
```

### 7.4 Sessões e agenda

**Sessões concluídas**

Bookings com status `completed` no período, usando `starts_at` no timezone do
terapeuta. A dimensão financeira é exibida separadamente; não se deve criar um
novo campo de pagamento na métrica.

**Taxa de presença operacional**

```text
completed / (completed + no_show_patient + no_show_therapist)
```

Cancelamentos ficam fora do denominador. O nome “presença operacional” deixa
claro que o cálculo deriva do desfecho do booking, não de monitoramento clínico.

**Taxa de cancelamento**

```text
bookings cancelados com horário no período
/ bookings elegíveis com horário no período
```

A definição deve registrar quais estados são elegíveis e distinguir quem
cancelou.

**Taxa de reagendamento**

```text
bookings distintos com reagendamento aceito
/ bookings elegíveis no período
```

Também pode haver uma contagem separada de eventos de reagendamento.

**Duração média reservada**

Média de `ends_at - starts_at` ou do snapshot canônico de duração para bookings
concluídos. Não chamar de duração real enquanto não existir autoridade
específica para isso.

**Ocupação da agenda**

```text
minutos reservados elegíveis
/ minutos reserváveis oferecidos
```

O denominador deve vir do slot engine e considerar:

- regras semanais;
- bloqueios;
- buffers;
- timezone;
- horizonte aplicável;
- indisponibilidades;
- mudança de configuração ao longo do período, quando houver histórico.

Sem histórico de oferta, a ocupação passada pode ser inexata. Nesse caso, a UI
deve informar a limitação ou restringir o período.

**Lacuna de agenda**

```text
MAX(0, procura sem disponibilidade - oferta reservável)
```

Lacuna e ocupação são métricas diferentes:

- ocupação observa quanto da oferta existente foi reservada;
- lacuna observa procura dirigida ao próprio terapeuta que não encontrou
  oferta equivalente;
- a lacuna é calculada por dia, período e técnica;
- a oferta é recalculada pelo slot engine;
- ao abrir disponibilidade, a oferta aumenta e o sinal se autocorrige;
- demanda agregada do portal não entra no cálculo exibido ao terapeuta;
- janelas e normalização pertencem à definição versionada da métrica e precisam
  ser calibradas antes da ativação.

### 7.5 Continuidade e retenção

Para um gráfico de partes exclusivas, usar precedência explícita:

1. `paused`: relacionamento pausado;
2. `inactive`: relacionamento fechado ou última sessão além do limiar;
3. `new`: primeira sessão concluída dentro da janela de novos e apenas uma
   sessão concluída;
4. `recurring`: duas ou mais sessões concluídas e atividade dentro do limiar;
5. `active`: atividade dentro do limiar sem enquadramento anterior.

Os limiares sugeridos para validação de produto são:

- novo: 30 dias;
- ativo/recorrente: última sessão em até 90 dias;
- inativo: mais de 90 dias sem sessão concluída.

Esses valores não devem ficar espalhados em componentes. Devem pertencer a um
registro versionado de definições.

**Taxa de retorno**

Coorte de pacientes com primeira sessão concluída e janela madura:

```text
pacientes com segunda sessão concluída em até 90 dias
/ pacientes cuja primeira sessão já possui 90 dias de observação
```

Coortes ainda não maduras devem retornar `null`, não zero.

**Retenção mensal**

Percentual de uma coorte de primeira sessão que teve pelo menos uma sessão
concluída em cada mês subsequente. Células com amostra insuficiente devem ser
suprimidas.

**Média de sessões por paciente**

```text
sessões concluídas no período
/ pacientes distintos com sessão concluída no período
```

**Tempo de relacionamento observado**

Diferença entre primeira e última sessão concluída para pacientes com pelo menos
duas sessões. Relações ainda ativas são censuradas; por isso o indicador não
deve ser apresentado como permanência definitiva.

## 8. Arquitetura de dados recomendada

### 8.1 Princípio

Métricas não são campos editáveis. Elas devem ser reproduzíveis a partir de
eventos e autoridades transacionais.

```text
Supabase/Auth + App público + Edge Functions + Webhooks
                    |
                    v
         eventos validados e idempotentes
                    |
                    v
       agregados diários e sinais versionados
                    |
          +---------+---------+
          |                   |
          v                   v
 read model da página   motor de regras Aura
                              |
                              v
                    recomendações auditáveis
```

### 8.2 Fontes por responsabilidade

| Domínio             | Autoridade                                                         |
| ------------------- | ------------------------------------------------------------------ |
| Perfil e publicação | read models públicos do perfil canônico                            |
| Terapia             | `therapies` e categoria canônica                                   |
| Serviço             | `therapist_services`                                               |
| Reserva             | `bookings`, holds e eventos A2                                     |
| Pagamento           | `session_payments.financial_status`                                |
| Disponibilidade     | regras, exceções e slot engine                                     |
| Reagendamento       | requests e eventos de booking                                      |
| Avaliação           | reviews publicados e elegíveis                                     |
| Relacionamento      | `therapist_patient_relationships` + bookings                       |
| Descoberta pública  | eventos de produto ainda a implementar                             |
| Match               | apenas agregados permitidos; respostas individuais permanecem fora |

### 8.3 Eventos públicos propostos

Os nomes abaixo são propostas de contrato, não eventos já implementados:

- `therapist_search_impression`;
- `therapist_profile_view`;
- `therapist_profile_primary_action`;
- `therapist_service_view`;
- `booking_flow_started`;
- `booking_slot_selected`;
- `therapist_unavailable_demand_observed`;
- `booking_hold_created`;
- `booking_created`;
- `favorite_therapist_added`.

Eventos autoritativos não devem depender do navegador:

- `booking_hold_created`;
- `booking_created`;
- `session_payment_confirmed`;
- `booking_status_changed`;
- `booking_rescheduled`;
- `post_session_sentiment_selected`;
- `review_published`.

O evento financeiro deve ser derivado do processamento confirmado do webhook,
nunca do retorno do Checkout.

`therapist_unavailable_demand_observed` registra uma procura que correspondeu ao
próprio terapeuta e a uma técnica, dia e período, mas não encontrou oferta
reservável. Ele não transporta tendência agregada do portal e não representa
promessa de agendamento. É uma dependência nova de schema, ingestão e
reconciliação com o slot engine.

`post_session_sentiment_selected` é uma alternativa segura e consentida ao uso
de texto livre para “temas recorrentes da jornada”. O evento:

- exige nova entidade de schema e nova UI pós-sessão;
- não está parcialmente implementado;
- só pode ser enviado pela pessoa elegível após uma sessão concluída;
- aceita somente chaves de uma lista fechada positiva ou neutra;
- nunca oferece opção negativa;
- registra consentimento e versão da taxonomia;
- não armazena comentário livre;
- só aparece agregado após a trava de 10.

### 8.4 Contrato mínimo de evento

```ts
type ProductAnalyticsEvent = {
  eventId: string;
  eventName: string;
  schemaVersion: number;
  occurredAt: string;
  environment: "production" | "preview" | "development" | "test";
  therapistProfileId: string;
  therapyId?: string;
  serviceId?: string;
  bookingId?: string;
  anonymousSessionId?: string;
  requestedTimeBucket?: string;
  sentimentKey?: string;
  consentVersion?: string;
  attribution?: {
    surface: string;
    referrerCategory?: string;
  };
};
```

Regras:

- `eventId` idempotente;
- payload validado no servidor;
- IDs do terapeuta, serviço e booking validados por relacionamento;
- rate limit e proteção contra replay;
- sem IP bruto persistido;
- sem nome, e-mail, mensagem, nota ou resposta clínica;
- sem query string completa;
- sem secrets;
- `sentimentKey` permitido somente no evento pós-sessão e validado por allowlist;
- `requestedTimeBucket` não pode conter texto livre nem horário individual
  preciso que facilite reidentificação;
- retenção definida antes da produção;
- ambiente de demo nunca misturado com produção.

### 8.5 Agregação

A arquitetura deve preservar `therapist_profile_daily_analytics` por
compatibilidade, mas não precisa transformá-la na única tabela de todo o
módulo. Uma migration futura deve decidir entre:

1. ampliar a projeção diária existente com dimensões seguras; ou
2. criar eventos append-only e read models agregados, mantendo a tabela atual
   como projeção compatível.

A segunda opção é preferível porque permite:

- reprocessar métricas após mudança de fórmula;
- auditar contagens;
- deduplicar;
- segmentar por serviço e terapia;
- reconciliar eventos com bookings;
- sustentar o funil por coorte.

Read models sugeridos, com nomes a validar antes de migration:

- `get_therapist_metrics_overview_v1`;
- `get_therapist_session_metrics_v1`;
- `get_therapist_interest_metrics_v1`;
- `get_therapist_metric_signals_v1`.

Todos devem:

- derivar o terapeuta de `auth.uid()`;
- usar `security invoker` quando possível;
- retornar DTOs, não linhas cruas;
- validar período máximo;
- retornar `null` para amostra insuficiente;
- incluir frescor, versão e timezone;
- não incluir nomes de pacientes;
- não usar service role no Next.js.

### 8.6 Estado do dado

Cada bloco deve carregar estado discriminado:

```ts
type MetricDataState<T> =
  | { status: "ready"; data: T; freshThrough: string }
  | { status: "empty"; data: T; freshThrough: string }
  | {
      status: "insufficient_sample";
      minimumSample: number;
      observedSample: number;
    }
  | { status: "processing"; freshThrough: string }
  | { status: "unavailable"; correlationId?: string };
```

Assim:

- zero continua zero;
- falta de ingestão não vira zero;
- amostra insuficiente não vira percentual;
- erro de banco não vira gráfico demonstrativo;
- processamento atrasado fica visível.

## 9. Aura: recomendações sem IA

### 9.1 Papel

A Aura é uma camada de recomendação determinística baseada em regras
versionadas. O nome comercial “Aura IA” não altera essa natureza técnica.

A interface deve ser transparente, por exemplo:

> Recomendações geradas por regras a partir dos dados operacionais disponíveis
> na plataforma.

### 9.2 Fluxo

```text
métricas validadas
      |
      v
sinais tipados e agregados
      |
      v
regras determinísticas versionadas
      |
      v
recomendação + evidência + ação permitida
```

A Aura não deve:

- consultar tabelas transacionais livremente a cada render;
- ler notas privadas ou resumos de sessão;
- interpretar texto clínico;
- usar respostas individuais do Match;
- gerar copy livre;
- alterar automaticamente perfil, agenda, preço ou serviço;
- enviar mensagens sem confirmação;
- usar dados abaixo da amostra mínima;
- usar tendência agregada de demanda do portal;
- comparar o terapeuta com concorrentes, ranking ou média de mercado;
- recomendar promessa de resultado.

### 9.3 Contrato de regra

Cada regra deve declarar:

- `rule_key`;
- `rule_version`;
- capability exigida;
- métricas de entrada;
- escopo dos sinais;
- entradas proibidas;
- janela;
- amostra mínima;
- condição;
- prioridade;
- cooldown;
- validade;
- template de título e corpo;
- rota canônica da ação;
- riscos e exclusões;
- explicação legível.

Exemplo:

```ts
type AuraRule = {
  key: string;
  version: number;
  requiredCapability: "aura_limited" | "aura_full";
  inputMetrics: string[];
  signalScope: "therapist_self_only";
  forbiddenInputs: Array<
    "portal_aggregate_demand" | "peer_ranking" | "private_session_text"
  >;
  minimumSample: number;
  windowDays: number;
  cooldownDays: number;
  evaluate: "server_only";
  recommendationTemplateKey: string;
  actionRouteKey: string;
};
```

Para regras com leitura qualitativa ou comparação, `minimumSample` nunca pode
ser menor que 10. A Aura só compara o terapeuta com o próprio histórico.
Tendência agregada do portal é dado só-admin e permanece proibida mesmo quando
anonimizada, pois pode produzir efeito manada.

### 9.4 Regras de valor e baixo risco

Exemplos viáveis após a fundação:

| Sinal                                          | Recomendação possível                             | Condições                                                   |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Perfil visto, poucos inícios de agendamento    | Revisar clareza da apresentação e dos serviços    | Telemetria íntegra, amostra mínima e perfil publicado       |
| Holds frequentes, poucas confirmações          | Verificar horários, fluxo e falhas operacionais   | Separar falha financeira de desistência; não atribuir causa |
| Alta ocupação recorrente em faixas específicas | Considerar revisar disponibilidade nessas faixas  | Capacidade histórica confiável                              |
| Cancelamentos acima do padrão próprio          | Revisar antecedência e instruções de reserva      | Categorias estruturadas e comparação com histórico próprio  |
| Avaliações pendentes de resposta               | Responder avaliações publicadas                   | Já suportado pela área de avaliações                        |
| Queda de retorno em coorte madura              | Revisar disponibilidade e clareza de continuidade | Sem apontar pacientes nem inferir condição pessoal          |

As comparações usam exclusivamente o próprio histórico do terapeuta. Benchmark,
ranking e tendência agregada entre terapeutas não são entradas permitidas para
a página nem para a Aura. Uma visão agregada do portal, se criada, pertence
somente à administração e não pode ser reutilizada no shell profissional.

### 9.5 Evolução de `aura_recommendations`

Uma migration futura deve avaliar adicionar ou projetar:

- versão da regra;
- chave de deduplicação;
- início e fim da janela;
- amostra observada;
- snapshot sanitizado da evidência;
- data de avaliação;
- estado `active`, `dismissed`, `applied`, `expired`;
- data da ação;
- correlation ID.

O `context` JSON não deve virar um depósito de dados sem schema. Cada versão de
regra precisa de parser.

Também é necessário aplicar no servidor:

- `plan_required`;
- `expires_at`;
- ownership;
- estado ativo;
- capability atual.

## 10. Privacidade, ética e LGPD

### 10.1 Dados permitidos

- contagens agregadas de bookings;
- estados operacionais;
- terapias e serviços;
- disponibilidade;
- eventos públicos pseudonimizados;
- avaliações publicadas;
- pagamentos somente em agregados autorizados;
- coortes sem identificação individual.

### 10.2 Dados excluídos da Aura e dos agregados

- notas privadas;
- `booking_session_summaries` em texto livre;
- intake livre;
- documentos;
- mensagens;
- tickets de suporte;
- respostas individuais do Match;
- nomes e e-mails;
- diagnóstico ou inferência de saúde;
- conteúdo administrativo privado.

### 10.3 Amostra mínima

Decisão MTR-0:

- suprimir métricas com trava, segmentações e coortes com menos de 10 pessoas;
- favoritos exigem 10 favoritos, não 10 sessões;
- não mostrar percentuais quando o denominador for menor que 10;
- comparações qualitativas podem exigir guarda adicional acima de 10 conforme
  a definição versionada;
- retornar `insufficient_sample`, não zero;
- não permitir drill-down que reidentifique uma pessoa.

Os três contadores fundamentais — pessoas atendidas, sessões realizadas e tempo
de atendimento — não possuem trava de acúmulo. O limiar 10 vem do LEIAME e é
obrigatório para as demais métricas marcadas com trava. A base legal do tracking
público ainda precisa de validação de privacidade antes da produção. Não
identificado nos arquivos analisados.

### 10.4 Retenção

Antes da instrumentação, definir:

- prazo de eventos brutos;
- prazo de agregados;
- exclusão ou anonimização;
- tratamento após encerramento de conta;
- acesso administrativo;
- processo de correção e reprocessamento;
- registro de versão das fórmulas.

## 11. Segurança e RLS

O módulo deve ter superfície privada explícita:

- terapeuta lê apenas seus agregados;
- terapeuta nunca envia `therapist_profile_id` confiável;
- paciente e visitante não acessam read models privados;
- admin usa superfície administrativa específica;
- service role permanece em Edge Functions e operações internas;
- eventos públicos não concedem leitura;
- agregados não ampliam views públicas;
- parâmetros de período têm limite;
- exports são gerados sob autorização e expiram;
- logs não incluem payload clínico ou PII.

Testes pgTAP devem cobrir:

- isolamento entre terapeutas;
- bloqueio para paciente e visitante;
- ausência de dados privados nos DTOs;
- filtros por capability;
- eventos duplicados;
- períodos inválidos;
- recomendações expiradas;
- plano insuficiente;
- RLS das tabelas e projeções propostas.

## 12. Experiência da página

### 12.1 Estrutura

A implementação deve usar:

- `AuthenticatedShell`;
- `AppPageContainer`;
- `AppPageHeader`;
- `AppPageGrid`;
- componentes TES existentes;
- tokens semânticos;
- `TESDialog` para explicações e detalhes.

Composição:

1. título e descrição responsáveis;
2. seletor global de período;
3. indicação de timezone e atualização;
4. abas Visão geral, Sessões e Interesse;
5. risco ou indisponibilidade antes de conteúdo educativo;
6. KPIs;
7. gráficos e tabelas;
8. recomendações determinísticas elegíveis;
9. ação de exportação quando implementada.

### 12.2 URL

Sem criar outra implementação, a aba e o período podem ser refletidos por query
string:

```text
/terapeuta/insights?tab=overview&period=90d
/terapeuta/insights?tab=sessions&period=90d
/terapeuta/insights?tab=interest&period=180d
```

Essa é uma recomendação. Qualquer alteração em `src/lib/routes.ts` continua
sujeita ao gate de confirmação do projeto.

### 12.3 Estados obrigatórios

- loading com skeleton estável;
- dados disponíveis;
- período vazio;
- amostra insuficiente;
- coleta ainda não iniciada;
- processamento em andamento;
- dado desatualizado;
- indisponibilidade com retry;
- sessão expirada;
- capability bloqueada;
- modo de demonstração explicitamente identificado, apenas onde permitido;
- exportação em progresso, concluída e falha.

### 12.4 Gráficos acessíveis

Todo gráfico deve ter:

- título;
- período;
- unidade;
- resumo textual;
- alternativa tabular;
- legenda;
- tooltip acessível por teclado;
- cores com contraste e diferenciação além de cor;
- descrição de amostra insuficiente;
- comportamento previsível com zoom de 200%.

### 12.5 Responsividade

Validar 320, 375, 768, 1024 e 1440 px:

- mobile em uma coluna;
- KPIs em uma ou duas colunas sem reduzir texto;
- heatmaps com agrupamento ou scroll local nomeado, nunca overflow da página;
- tabelas convertidas em lista ou disclosure no mobile;
- touch targets de 44 px;
- texto funcional com no mínimo 14px;
- metadados preferencialmente em 12px;
- gráficos sem depender de hover;
- ordem semântica preservada.

## 13. Planos e capabilities

O plano vem da assinatura e das capabilities derivadas no servidor. O
terapeuta não escolhe o plano no payload e a UI nunca infere acesso pela URL.

### 13.1 Contadores disponíveis nos dois planos

Premium e Premium Plus recebem, sem trava:

- pessoas atendidas;
- sessões realizadas;
- tempo de atendimento.

Free não recebe a página completa; pode receber convite contextual sem dados
privados do módulo.

### 13.2 Catálogo Premium

| Métrica                                    | Trava                     |
| ------------------------------------------ | ------------------------- |
| Pessoas para quem o perfil apareceu        | sem trava                 |
| Pessoas que quiseram conhecer melhor       | sem trava                 |
| Pessoas que seguiram para agendar          | sem trava                 |
| Temas pelos quais o perfil apareceu        | sem trava                 |
| Técnicas que mais apareceram               | sem trava                 |
| Sentimentos pós-sessão positivos e neutros | 10 atendimentos elegíveis |
| Avaliações agregadas                       | 10 avaliações elegíveis   |

### 13.3 Catálogo Premium Plus

Premium Plus inclui o catálogo Premium e acrescenta:

| Métrica                                | Trava                     |
| -------------------------------------- | ------------------------- |
| Pessoas que voltaram                   | 10 atendimentos           |
| Técnicas que mais geram agendamentos   | 10 + guarda de comparação |
| Trajetória temporal                    | 10 atendimentos           |
| Quantas vezes o perfil foi favoritado  | 10 favoritos              |
| Favoritos que viraram encontro         | 10 favoritos              |
| Técnicas em que as pessoas mais voltam | 10 + guarda de comparação |
| Lacuna entre procura própria e agenda  | 10 eventos elegíveis      |

### 13.4 Aura por plano

Premium recebe copy direcional determinística junto às próprias métricas. Isso
é parte do contrato “número nunca aparece sozinho”, não uma recomendação Aura.

Recomendações completas da Aura pertencem ao Premium Plus e exigem
`aura_full`. A capability técnica `aura_limited` permanece no domínio por
compatibilidade, mas não libera um feed, página ou recomendação Aura no Premium
até nova decisão explícita de produto.

## 14. Cache, frescor e performance

### 14.1 Estratégia

- dados operacionais recentes podem combinar agregado diário com uma pequena
  projeção do dia atual;
- gráficos históricos devem usar agregados, não consultas por card;
- uma RPC por aba é preferível a várias consultas N+1;
- filtros locais não devem refazer cálculos pesados desnecessariamente;
- não usar `no-store` global;
- tags devem ser específicas por terapeuta e módulo;
- Aura deve usar o mesmo snapshot de métricas da página.

Tags propostas:

- `therapist-metrics:{profileId}`;
- `therapist-metrics:{profileId}:overview`;
- `therapist-metrics:{profileId}:sessions`;
- `therapist-metrics:{profileId}:interest`;
- `therapist-aura:{profileId}`.

IDs de cache nunca devem ser aceitos diretamente do navegador sem derivação da
sessão.

### 14.2 Frescor

Proposta:

- bookings, cancelamentos e pagamentos: atualização próxima ao evento;
- eventos públicos: agregado com atraso explícito;
- coortes e retenção: processamento diário;
- Aura: reavaliação após fechamento do agregado e eventos críticos permitidos.

A UI deve mostrar “Dados atualizados até …”. O SLA final depende da estratégia
de jobs do Supabase e ainda precisa ser homologado.

### 14.3 Performance

- limitar períodos disponíveis;
- indexar somente após `EXPLAIN`;
- evitar juntar eventos brutos em requests da página;
- pré-agregar por dia, serviço e terapia;
- paginar detalhes;
- não carregar relatório completo acima da dobra;
- processar exportações grandes fora do request interativo.

## 15. Relatórios e exportação

O Figma apresenta o nome “Métricas & Relatórios”, mas não mostra uma ação clara
de relatório. A implementação deve decidir o escopo.

Sequência recomendada:

1. exportação CSV das séries e totais exibidos;
2. visão para impressão com definições e período;
3. PDF server-side somente após homologação visual e de privacidade.

O relatório deve incluir:

- terapeuta;
- período e timezone;
- data de geração;
- versão das métricas;
- frescor;
- valores;
- definições resumidas;
- supressões por amostra;
- aviso de que os dados apoiam decisões e não garantem resultados.

Não incluir nomes de pacientes no relatório agregado.

## 16. Qualidade e observabilidade

### 16.1 Indicadores de qualidade do dado

- atraso do último evento;
- taxa de eventos inválidos;
- taxa de duplicidade;
- divergência booking versus evento;
- divergência webhook versus pagamento;
- quantidade de agregados reprocessados;
- regras Aura avaliadas, suprimidas e emitidas;
- recomendações expiradas não removidas;
- percentual de métricas indisponíveis.

### 16.2 Logs estruturados

Registrar:

- operação;
- ambiente;
- correlation ID;
- versão do contrato;
- categoria sanitizada do erro;
- período;
- terapeuta em identificador interno quando necessário;
- duração do cálculo.

Não registrar:

- secrets;
- tokens;
- notas;
- nomes;
- e-mails;
- respostas do Match;
- payloads financeiros completos.

### 16.3 Reconciliação

Criar verificações periódicas:

- confirmação financeira versus `session_payments`;
- booking concluído versus estado inválido;
- contagens diárias versus eventos brutos;
- soma das categorias exclusivas igual ao total;
- funil monotônico por coorte;
- células de retenção entre 0% e 100%;
- recomendações sem evidência ou versão;
- agregados de demo em produção.

## 17. Estratégia de testes

### 17.1 Banco e pgTAP

- RLS por terapeuta;
- paciente e visitante bloqueados;
- métricas sem campos privados;
- deduplicação de eventos;
- validade de período;
- fórmulas de sessão;
- timezone;
- coortes maduras e imaturas;
- amostra mínima;
- percentuais dentro dos limites;
- pagamento derivado de `session_payments`;
- Aura respeitando plano, expiração e ownership.

### 17.2 Deno

- validação de evento;
- idempotência;
- payload inválido;
- rate limit;
- autenticação;
- evento público permitido;
- evento autoritativo rejeitado quando vindo do navegador;
- regra Aura determinística;
- cooldown;
- evidência insuficiente;
- sanitização de logs.

### 17.3 Vitest

- parsers e mappers;
- estado zero;
- estado indisponível;
- amostra insuficiente;
- fórmula e arredondamento;
- comparação de períodos;
- segmentação exclusiva;
- gráfico com alternativa tabular;
- capabilities;
- filtros de período;
- copy responsável;
- nenhuma recomendação baseada em texto privado.

### 17.4 E2E

1. entrar como terapeuta Premium;
2. abrir a rota canônica;
3. alternar abas;
4. trocar período e recarregar;
5. validar URLs compartilháveis;
6. validar zero legítimo;
7. simular indisponibilidade sem mock;
8. validar capability Free;
9. validar recomendações limitadas;
10. validar Aura completa no Premium Plus;
11. validar mobile e teclado;
12. exportar relatório quando disponível;
13. confirmar ausência de dados de outro terapeuta;
14. confirmar que pagamento só muda após webhook autoritativo.

### 17.5 Testes de dados

- seeds sempre identificados como desenvolvimento;
- produção rejeita ou ignora demo;
- reprocessamento reproduz o mesmo resultado;
- versão nova não altera histórico sem backfill explícito;
- DST e mudança de timezone;
- cancelamento, no-show, refund e reagendamento;
- mudança de serviço sem quebrar snapshots;
- terapia descontinuada preservando histórico.

## 18. Roadmap recomendado

### MTR-0 — Contratos e decisões

Status: `accepted` como decisão arquitetural, fechado pela ADR-011. Esse status
não afirma implementação funcional da página.

- rota canônica e alias reconciliados;
- dicionário, copy de direção e períodos contratados;
- interesse e conversão definidos por eventos objetivos;
- presença operacional definida;
- segmentos e limiar 10 definidos;
- catálogo Premium/Premium Plus fechado;
- LGPD transformada em gate de produção onde falta decisão externa;
- ADR registrada.

### MTR-0.1 — Primeiro corte vertical

Status: `functional` em 2026-07-28.

Antes de telemetria pública ou Aura, a arquitetura foi validada com:

- pessoas atendidas;
- sessões realizadas;
- tempo de atendimento.

O corte usa apenas bookings concluídos e snapshots existentes, funciona para
Premium e Premium Plus, não possui trava de acúmulo e deve validar read model,
RLS, estados discriminados, período anterior, copy de direção e timezone.

Implementação:

- migration `20260728190000_therapist_metrics_foundation.sql`;
- RPC `get_therapist_metrics_foundation_v1()`;
- identidade derivada de `auth.uid()`;
- janela fixa de 30 dias locais completos e período anterior equivalente;
- read model único para pessoas atendidas, sessões realizadas e minutos de
  atendimento;
- resposta versionada com `ready`/`empty`, direção e copy key obrigatória;
- 18 testes pgTAP específicos, além da suíte de regressão do banco.

### MTR-0.2 — Visão geral funcional

Status: `functional` em 2026-07-28 para a aba Visão geral.

- `/terapeuta/insights` deixou de ser scaffold;
- leitura inicial e autorização permanecem server-side;
- hero e hierarquia seguem o Figma `13366:3628` com grid responsivo e tokens
  TES;
- somente os três contadores autorizados são renderizados;
- valores sempre aparecem com direção, contexto e comparação;
- zero legítimo e indisponibilidade têm estados diferentes;
- abas Sessões e Interesse ficam visíveis como `Em breve`, sem dados
  simulados;
- `/terapeuta/metricas` permanece redirect de compatibilidade;
- Aura, gráficos, filtros compartilháveis e telemetria permanecem fora deste
  corte.

### Correção isolada de favoritos

Status: `functional` em 2026-07-28.

- favoritos deixam de ser expostos nos DTOs e cards de serviço;
- ranking de serviços passa a usar somente bookings;
- a coluna legada `favorite_count` permanece compatível e nula nas views de
  serviço;
- `favorite_therapists` continua sendo a autoridade do perfil;
- o KPI de favoritos no módulo de métricas continua `planned` e deverá usar
  trava de 10.

### MTR-1 — Telemetria confiável

Status: `functional`, com ativação produtiva bloqueada pelo gate externo de
privacidade.

- contrato implementado em `therapist_metric_events`;
- busca, perfil e início do booking instrumentados por
  `/api/public/metrics/events`;
- eventos de navegador separados do favorito autoritativo;
- idempotência por `eventId` e contexto, conflito de payload, rate limit e logs
  sanitizados;
- frescor registrado na projeção diária;
- compatibilidade preservada com `therapist_profile_daily_analytics`;
- `therapist_metrics_runtime_config.public_telemetry_enabled` nasce `false` e
  não pode ser alterado pelo navegador.

### MTR-2 — Agregados e read models

Status: `functional`.

- `therapist_metric_daily_aggregates` mantém a projeção diária versionada;
- `get_therapist_metrics_overview_v1` deriva identidade de `auth.uid()`;
- bookings concluídos e snapshots A2 continuam autoritativos, sem criar campo
  financeiro paralelo;
- RLS limita agregados ao terapeuta proprietário e eventos brutos não possuem
  grant autenticado;
- contrato distingue `ready`, `empty`, `insufficient_sample`, `processing` e
  `unavailable`;
- types e mappers TypeScript não usam `any`;
- período limitado a 30 ou 90 dias locais completos.

### MTR-3 — Visão geral

Status: `functional`, respeitando gates de dados.

- KPIs operacionais confiáveis;
- série diária de sessões concluídas;
- funil por coorte pseudônima quando a telemetria estiver autorizada;
- ocupação retorna `unavailable` enquanto a oferta histórica não for
  versionada;
- ranking das próprias terapias com trava de 10;
- favoritos do perfil com trava de 10;
- comparação de períodos de 30/90 dias;
- estados vazios, em processamento, insuficientes e indisponíveis;
- composição responsiva com `AppPageGrid` e equivalente textual para o gráfico.

Detalhes de implementação: `docs/architecture/therapist-metrics-mtr1-mtr3.md`.

### MTR-4 — Sessões

Status: `functional` localmente em 2026-07-28.

- status e evolução;
- presença operacional;
- cancelamento e reagendamento;
- heatmaps;
- categorias de cancelamento permanecem `unavailable` até existir taxonomia;
- duração reservada.

### MTR-5 — Interesse e retenção

Status: `functional` localmente em 2026-07-28 para Premium Plus, sob travas de
amostra. Premium recebe `capability_locked`.

- coortes;
- segmentos exclusivos;
- evolução da base;
- retorno;
- amostra mínima de 10 aplicada no servidor e validada nos parsers;
- excluir temas livres até existir governança.

### MTR-6 — Aura determinística

- registro versionado de regras;
- geração server-side;
- evidência tipada;
- plano e expiração;
- cooldown e deduplicação;
- ações revisáveis;
- observabilidade.

### MTR-7 — Relatórios e homologação

Status: `functional` localmente no corte CSV, segurança e QA automatizado.
Homologação externa permanece pendente.

- CSV agregado autenticado implementado;
- impressão/PDF adiada até homologação;
- testes de componentes, contrato, RLS, exportação e E2E implementados;
- índices das consultas críticas adicionados e protegidos por teste;
- segurança e documentação operacional registradas;
- carga representativa e homologação produtiva da telemetria permanecem
  pendentes.

Detalhes:
`docs/architecture/therapist-metrics-mtr4-mtr5-mtr7.md`.

## 19. Decisões fechadas pela ADR-011

| Decisão                                  | Resposta                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Rota canônica                            | `/terapeuta/insights`; `/terapeuta/metricas` permanece alias de compatibilidade |
| “Interessados em agendar”                | “Pessoas que seguiram para agendar”, derivado de evento explícito               |
| “Sessões realizadas” versus “concluídas” | Um único KPI: sessão realizada equivale a booking `completed`                   |
| Tempo médio                              | Não entra no primeiro corte; quando usado, chama-se duração média reservada     |
| Terapia mais procurada                   | Não inferir; enquanto não houver telemetria, usar somente “mais agendada”       |
| Presença                                 | Presença operacional por `completed` versus no-show, com trava 10               |
| Segmentos                                | Exclusivos, versionados e com precedência definida                              |
| Inatividade                              | Mais de 90 dias sem sessão concluída ou relação fechada                         |
| Temas da jornada                         | Texto livre proibido; sentimento fechado e consentido é a alternativa futura    |
| Aura Premium                             | Premium recebe copy direcional; Aura completa somente no Premium Plus           |
| Exportação                               | CSV primeiro; impressão/PDF após homologação                                    |
| Base legal e retenção                    | Tracking produtivo bloqueado até validação formal de privacidade                |
| Amostra mínima                           | 10; favoritos exigem 10 favoritos                                               |
| Lacuna de agenda                         | Procura própria sem disponibilidade menos oferta; distinta de ocupação          |
| Favoritos                                | Métrica do perfil do terapeuta, nunca do serviço ou técnica                     |
| Tendência do portal                      | Só-admin; proibida no shell e na Aura                                           |

## 20. Riscos

| Risco                                          | Impacto                              | Mitigação                                     |
| ---------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| Seeds parecerem dados reais                    | Decisão errada e perda de confiança  | Estado demo explícito e bloqueio em produção  |
| Zero esconder falha de coleta                  | Métrica enganosa                     | Estado discriminado e monitor de frescor      |
| Fórmulas divergentes entre telas               | Inconsistência sistêmica             | Registro canônico versionado                  |
| Uso da tabela legada `payments`                | Divergência financeira               | Somente `session_payments`                    |
| Inferência por texto de sessão                 | Risco de privacidade e erro          | Proibir no pipeline de métricas/Aura          |
| Coortes abaixo de 10                           | Reidentificação                      | Trava 10 e supressão                          |
| Evento de navegador confirmar conversão        | Fraude e contagem incorreta          | Autoridade server-side e webhook              |
| Bug replica favorito do perfil em cada serviço | Ranking incorreto                    | Corrigir projeção e manter favorito no perfil |
| Mudança de disponibilidade sem histórico       | Ocupação passada imprecisa           | Versionar capacidade ou limitar período       |
| Aura sem versão/evidência                      | Recomendação inexplicável            | Rule registry, snapshots e auditoria          |
| Demanda agregada exposta ao terapeuta          | Efeito manada e cadastro oportunista | Manter sinal agregado somente no admin        |
| Duas rotas conceituais                         | Duplicação e SEO interno incoerente  | Uma implementação e redirect                  |

## 21. Critérios de aceite do módulo futuro

- nenhum número é demonstrativo em produção;
- nenhum número aparece sem copy de direção;
- zero, vazio, indisponível e amostra insuficiente são distintos;
- fórmulas estão versionadas e documentadas;
- trava de acúmulo usa 10 e favoritos usam 10 favoritos;
- pagamento vem exclusivamente de `session_payments`;
- funil usa eventos idempotentes e coortes;
- agenda usa timezone e slot engine autoritativos;
- lacuna de agenda e ocupação permanecem métricas distintas;
- tendência agregada do portal não aparece no shell nem na Aura;
- favoritos permanecem métrica de perfil;
- dados de outro terapeuta não vazam;
- nenhum texto privado alimenta métricas ou Aura;
- Aura é determinística, explicável e auditável;
- recomendações respeitam plano, validade e amostra mínima;
- uma única rota implementa as três abas;
- filtros são compartilháveis;
- gráficos têm alternativa acessível;
- mobile, teclado e zoom de 200% funcionam;
- relatório explicita período, frescor e metodologia;
- testes de banco, Deno, Vitest, E2E e dados passam;
- documentação e skills correspondem à implementação.

## 22. Conclusão

O Figma define uma boa experiência de leitura: começa com visão geral, aprofunda
operação de sessões e termina em continuidade. A maior oportunidade não está em
reproduzir mais gráficos, mas em garantir que cada indicador tenha procedência,
interpretação e uma ação responsável.

Com a fundação proposta, o módulo pode entregar valor real sem inventar
precisão. A Aura passa a transformar métricas validadas em recomendações
determinísticas, explicáveis e limitadas pelo contexto, mantendo o terapeuta no
controle de qualquer ação.

Temas recorrentes, motivos de saída, funil público e presença detalhada não
devem ser simulados para completar o layout. Sentimento pós-sessão fechado,
positivo ou neutro e consentido é a alternativa futura aprovada para leituras
qualitativas; ainda exige schema e UI novos. Os demais itens entram somente
quando houver coleta, taxonomia, privacidade e autoridade suficientes.
