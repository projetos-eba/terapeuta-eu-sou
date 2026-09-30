# Métricas & Relatórios — MTR-1 a MTR-3

Status revisado em 2026-09-27:

| Corte                        | `implementation_status` | `data_source`                       | `qa_status`                                 | `external_homologation`              | `production_readiness`           |
| ---------------------------- | ----------------------- | ----------------------------------- | ------------------------------------------- | ------------------------------------ | -------------------------------- |
| MTR-1 — telemetria           | `functional`            | eventos objetivos deduplicados      | pgTAP, Vitest e contrato HTTP               | HML pendente após deploy aprovado    | desligada até aceite de HML      |
| MTR-2 — agregados/read model | `functional`            | eventos, favoritos e bookings       | pgTAP, Vitest, lint, typecheck e build      | não aplicável aos dados operacionais | pronta com estados discriminados |
| MTR-3 — Visão geral          | `functional`            | `get_therapist_metrics_overview_v1` | componentes e Playwright em cinco viewports | não aplicável à UI local             | pronta com limitações explícitas |

## Autoridades

- Sessões, pessoas atendidas e minutos: `bookings.status = completed`, usando
  `service_duration_minutes_snapshot`.
- Favoritos: `favorite_therapists`, sempre associados ao perfil do terapeuta.
- Impressão na busca, abertura do perfil e início do agendamento:
  `therapist_metric_events`.
- Projeção diária: `therapist_metric_daily_aggregates`.
- Timezone: `therapist_schedule_settings.timezone`.
- Pagamento continua exclusivamente em `session_payments`; o módulo não cria
  campo, evento ou confirmação financeira paralela.

## Eventos MTR-1

Eventos de navegador aceitos:

- `search_impression`: card realmente visível na busca, com posição e
  `resultSetId`;
- `profile_view`: abertura de perfil público válido;
- `booking_flow_started`: clique de agendamento associado a serviço ativo e
  reservável, preservando se partiu da busca ou do perfil.

Evento autoritativo:

- `favorite_therapist_added`: criado por trigger após inserção canônica em
  `favorite_therapists`.

O endpoint fino é `POST /api/public/metrics/events`. Ele valida o payload,
descarta crawlers conhecidos e encaminha para
`record_public_therapist_metric_events_v2`. A versão preserva o contrato de
validação e deduplicação da V1 e acrescenta somente contadores operacionais
agregados de recebimento, repetição, invalidação, limite e falha. O RPC:

- aceita no máximo 20 eventos por request;
- limita uma sessão pseudônima a 100 eventos em 24 horas;
- valida perfil público, serviço e terapia;
- deriva o terapeuta pelo slug público;
- deduplica por evento e por contexto;
- retorna conflito se o mesmo `eventId` for reutilizado com outro payload;
- ignora eventos autenticados de terapeuta ou admin;
- não armazena IP, user agent, query string, nome, e-mail ou texto livre.

`therapist_metrics_runtime_config.public_telemetry_enabled` nasce `false`.
Somente a operação interna auditada
`set_therapist_metrics_runtime_v1`, disponível para `service_role`, pode
alterá-la. Navegadores não recebem essa permissão nem uma configuração pública
equivalente.

Em 2026-09-27, os sócios do TES aprovaram o escopo de descoberta, a retenção
máxima de 120 dias e a ativação em etapas. O aviso público existente permanece
sem alteração por essa decisão. A aprovação não liga telemetria por si só:
HML precisa ser homologada e aceita antes de repetir o procedimento em
produção. Cada mudança de estado registra o ator administrativo verificado, a
justificativa, a retenção e a referência de aprovação na auditoria append-only.

A Auditoria administrativa oferece o controle visual da coleta com somente os
estados **Ativa** e **Desligada**. O Admin autorizado solicita a alteração por
um diálogo com justificativa obrigatória; a rota interna valida
`admin.settings.manage` e a Edge Function deriva o ator da sessão antes de
executar a operação com credencial de serviço. O navegador nunca recebe acesso
direto à configuração ou à credencial de serviço.

## Agregação MTR-2

`therapist_metric_daily_aggregates` é versionada por
`definition_version = 1` e atualizada somente após um evento novo ser aceito.
Ela preserva a projeção compatível `therapist_profile_daily_analytics` sem
transformá-la em nova autoridade.

O RPC privado `get_therapist_metrics_overview_v1(period)`:

- deriva a identidade de `auth.uid()`;
- exige `advanced_metrics` e plano Premium ou Premium Plus;
- aceita somente 30, 60, 90 ou 120 dias locais completos;
- exclui o dia atual;
- compara com o período imediatamente anterior de mesmo tamanho;
- não retorna nome ou ID de paciente;
- inclui versão, timezone, período, frescor e copy key direcional;
- distingue `ready`, `empty`, `insufficient_sample`, `processing` e
  `unavailable`.

`get_therapist_metrics_overview_v2(period)` é aditivo e usado pela interface
atual. Ele aceita somente 30 ou 60 dias locais completos. A V1 mantém os
períodos históricos de compatibilidade para consumidores já existentes.

Read models:

- três contadores operacionais sem trava;
- série diária de sessões concluídas;
- estágios de descoberta;
- conversões por coorte pseudônima;
- comparações e tendências de favoritos do perfil com amostra mínima de 10;
- ranking das próprias terapias com amostra mínima de 10;
- ocupação explicitamente indisponível.

O RPC complementar `get_therapist_metrics_today_v1()` é exclusivo do Premium
Plus e retorna apenas a quantidade agregada de favoritos recebidos no dia local
atual. Essa projeção pequena existe para dar retorno imediato ao terapeuta sem
misturar um dia incompleto às comparações históricas. Ela não retorna
identificadores de pacientes e falha fechada quando o perfil, o plano ou o
timezone não são elegíveis.

## Limitações Honestas

### Ocupação no contrato v1

Ocupação depende de minutos reserváveis oferecidos. As regras de
disponibilidade atuais não preservam histórico suficiente para reproduzir
mudanças de horário, bloqueios e buffers. Por isso o contrato retorna:

```json
{
  "status": "unavailable",
  "reason": "historical_availability_not_versioned"
}
```

Não é usado `0%`, estimativa atual aplicada ao passado ou dado do Figma. Esse
comportamento permanece congelado no contrato `v1`.

### Ocupação e dashboard v2

A migration `20260817044010_therapist_metrics_dashboard_v2.sql` inicia, sem
backfill retroativo, o histórico append-only de regras e exceções da agenda.
Cada inserção, edição ou remoção acrescenta um evento; clientes autenticados não
recebem leitura direta dessas tabelas.

`get_therapist_metrics_dashboard_v2` permanece para compatibilidade.
`get_therapist_metrics_dashboard_v3(30|60)` compõe o overview V2 e acrescenta
ocupação histórica. A capacidade é normalizada em buckets de 15
minutos:

- ofertado: bucket coberto por regra vigente e não bloqueado por exceção;
- ocupado: bucket ofertado sobreposto por reserva confirmada, concluída ou com
  ausência registrada;
- ocupação: minutos ocupados divididos pelos minutos ofertados.

O estado `forming` informa cobertura e período exigido. A leitura de 30 dias é
liberada antes da de 60 dias; alterar a agenda hoje não reescreve métricas de
dias já encerrados. Quando não existe capacidade ofertada sob cobertura
completa, o estado é `empty`, nunca um sucesso fictício.

### Agenda futura compartilhada — dashboard v4

`get_therapist_metrics_dashboard_v4(30|60)` preserva os indicadores
históricos selecionados e adiciona `futureAgenda` como uma leitura operacional
independente dos **próximos 30 dias locais completos, a partir de amanhã à
meia-noite no fuso do terapeuta**. O seletor de 30/60 dias não muda essa
janela futura.

A frequência de sessões concluídas usa exclusivamente `sessions.heatmap` do
período histórico selecionado (30 ou 60 dias completos, sem o dia atual). Ela
não usa nem é afetada por `futureAgenda`.

A capacidade futura é calculada uma única vez por terapeuta, unindo os
intervalos ativos de todas as terapias. Sobreposições não são somadas. Bloqueios
globais removem a capacidade uma vez; um bloqueio de uma terapia remove somente
a parte que não continua coberta por outra terapia. A fórmula é:

- capacidade: união da disponibilidade efetiva com as reservas ainda
  protegidas;
- horas reservadas: união de `occupied_during` das reservas futuras em
  `pending_payment`, `confirmed` ou `completed`, incluindo buffers snapshot;
- horas livres: disponibilidade efetiva menos essas reservas;
- ocupação: horas reservadas ÷ capacidade.

Cancelamentos, falhas, reagendamentos e holds temporários não participam. A
inclusão das reservas protegidas na capacidade evita que uma edição posterior
da agenda esconda um horário já reservado ou produza ocupação acima de 100%.
O heatmap continua sendo histórico e é apresentado como frequência de sessões
concluídas.

### Sessões agendadas e concluídas — MTR-4 V2

`get_therapist_session_metrics_v2(30|60)` é um contrato aditivo usado pela
aba **Sessões**. A V1 continua disponível, sem alteração, para consumidores
compatíveis. A V2 preserva todos os agregados da V1 e acrescenta
`evolution.points[].sessionsScheduled`.

Essa série conta, por data local marcada, os bookings que efetivamente chegaram
à agenda: `confirmed`, `completed`, cancelados pela pessoa, terapeuta,
plataforma ou pagamento, ausências e `refunded`. Rascunhos e tentativas ainda
em pagamento não entram. A série é sempre agregada — não devolve IDs, nomes ou
qualquer dado de paciente.

Na interface, a evolução usa somente o período histórico selecionado, formado
por dias locais completos e sem o dia atual: roxo representa sessões agendadas;
verde representa sessões concluídas. Não há comparação com o período anterior
neste gráfico.

### Descoberta

Com a telemetria desativada, o contrato retorna `unavailable` com
`privacy_activation_pending`. Após ativação:

- sem primeiro evento: `processing`;
- sem eventos em dias completos do período: `empty`;
- com eventos consolidados: `ready`.

### Favoritos e ranking

Valores abaixo de 10 não são expostos em comparações, tendências, percentuais
ou rankings. Na aba Interesse do Premium Plus, a contagem agregada de favoritos
do período é a exceção controlada: ela usa dias locais completos e fica visível
desde o primeiro favorito, sem qualquer identificador ou recorte por serviço,
terapia ou técnica. O contrato separa essa atividade (`empty` ou `ready`) da
comparação protegida (`insufficient_sample` ou `ready`), que continua retornando
somente `minimumSample` e `observedSample` antes da amostra mínima.

Na aba Interesse, a comparação protegida continua terminando no dia anterior.
Quando houver favoritos no dia atual, o card mostra `+N favorito(s) hoje` e
explica que o valor entra no comparativo no dia seguinte. A indisponibilidade
da projeção não é convertida em zero.

## MTR-3 e composição visual MTR-8

`/terapeuta/insights` usa leitura inicial server-side e oferece:

- hero e hierarquia baseados no Figma `13366:3628`;
- períodos compartilháveis de 30 e 60 dias;
- seis indicadores com sparklines responsivas;
- evolução de sessões, rankings, roscas e mapas de calor;
- funil quando a coleta estiver autorizada e houver amostra;
- ranking das próprias terapias;
- favoritos do perfil;
- ocupação pronta ou `Histórico em formação`, conforme cobertura;
- estados de loading, erro, zero, processamento, amostra insuficiente e
  indisponibilidade.

As abas Sessões (`13366:4259`) e Interesse (`13366:4896`) usam seus read models
funcionais MTR-4 e MTR-5. Não são preenchidas com números do Figma. Aura
continua fora deste corte.

O E2E autenticado `tests/e2e/therapist-metrics.spec.ts` valida dados reais,
troca entre 30/60 dias e ausência de overflow horizontal em 320px, 375px,
768px, 1024px e 1440px. O screenshot desktop foi comparado com a hierarquia do
Figma; a composição usa o grid real do shell em vez de coordenadas fixas.

## Segurança E RLS

- eventos brutos não têm grant para `anon` ou `authenticated`;
- agregados privados têm RLS por `is_current_therapist_profile`;
- ingestão pública ocorre somente pelo RPC validado;
- Next.js usa apenas a chave publicável;
- nenhuma service role é usada no navegador ou no app Next;
- logs HTTP contêm somente operação, categoria sanitizada e correlation ID;
- resposta privada não contém dados de paciente.

## Operação controlada de descoberta

Os eventos brutos pseudonimizados, agregados diários e registros operacionais
de saúde expiram após 120 dias. A rotina diária
`check_therapist_metrics_telemetry_health_v1` executa essa retenção e verifica
frescor, coerência entre eventos e agregados e monotonicidade do funil. O painel
administrativo mostra somente o estado e contagens agregadas; não mostra
visitantes, perfis, buscas, IPs ou user agents.

Procedimento após deploy aprovado:

1. Aplicar a migration em HML, confirmando que a chave continua desligada.
2. Executar os testes de busca, perfil e início de agendamento com visitante
   anônimo; conferir remount/recarga, crawler, limite, payload e ausência de
   dados pessoais.
3. Conferir o painel administrativo e a rotina diária. Na Auditoria, usar o
   controle de coleta para ativar a operação com justificativa obrigatória; a
   rota interna e a Edge Function validam o Admin e executam a operação
   auditada no servidor.
4. Observar pelo menos um período completo em HML e registrar o aceite da
   homologação. Em caso de atenção, desligar pelo mesmo procedimento auditado.
5. Somente após esse aceite, repetir preflight e operação auditada em produção.

O navegador pode apenas solicitar a ação autenticada; nenhuma etapa executa a
configuração diretamente no cliente. Esta mudança não executa deploy nem altera
o aviso público de privacidade.

## Próximos Gates

1. Homologar HML com a telemetria inicialmente desligada e obter aceite antes
   de qualquer ativação produtiva.
2. Aguardar cobertura de 30 e 60 dias antes de liberar cada leitura de ocupação.
3. Implementar taxonomias estruturadas antes de novas análises qualitativas.
4. Implementar Aura somente em MTR-6, consumindo métricas validadas.
