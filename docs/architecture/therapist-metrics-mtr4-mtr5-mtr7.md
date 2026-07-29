# Métricas do Terapeuta — MTR-4, MTR-5 e MTR-7

Data: 2026-07-28  
Status: `functional` localmente; homologação externa da telemetria permanece
bloqueada  
ADR: `ADR-011-therapist-metrics-contracts-and-decisions.md`

## Escopo entregue

### MTR-4 — Sessões

O read model privado `get_therapist_session_metrics_v1` oferece períodos de 30
ou 90 dias locais completos e deriva a identidade exclusivamente de
`auth.uid()`.

| Leitura                     | Fonte autoritativa                             | Regra                                        |
| --------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Sessões realizadas          | `bookings.status = completed`                  | sem duplicar “concluídas”                    |
| Presença operacional        | completed / (completed + no-show)              | mínimo de 10 desfechos elegíveis             |
| Cancelamentos               | estados cancelados de `bookings`               | paciente e terapeuta preservados no agregado |
| Reagendamentos aplicados    | `booking_reschedule_requests.status = applied` | contabiliza aplicação, não intenção          |
| Duração média reservada     | `service_duration_minutes_snapshot`            | não representa tempo clínico real            |
| Evolução e mapa de horários | `bookings.starts_at` no timezone canônico      | somente agregados                            |
| Distribuição por terapia    | snapshot/nome canônico relacionado ao booking  | mínimo de 10 sessões                         |
| Motivos de cancelamento     | indisponível                                   | falta taxonomia estruturada e versionada     |

### MTR-5 — Interesse e continuidade

O read model privado `get_therapist_interest_metrics_v1` é exclusivo do
Premium Plus. Premium recebe `capability_locked`, sem dados parcialmente
expostos.

- pessoas que voltaram;
- taxa de retorno;
- sessões por pessoa;
- novos favoritos do perfil;
- segmentos exclusivos de continuidade;
- evolução semanal da base atendida;
- coortes mensais protegidas;
- retorno por terapia.

Segmentos seguem precedência determinística: pausa, inativa, nova, recorrente
e ativa. Coortes, percentuais e segmentações exigem amostra mínima de 10.
Nenhuma resposta contém identificador de paciente.

Continuam honestamente indisponíveis:

- conversão de favorito sem vínculo privado confiável;
- sentimento pós-sessão sem novo schema, consentimento e UI;
- lacuna de agenda sem evento “procura sem disponibilidade”;
- temas de jornada em texto livre;
- motivos de saída sem taxonomia versionada.

## Exportação MTR-7

`GET /api/therapist/metrics/export?tab=<overview|sessions|interest>&period=<30|90>`
gera CSV privado e agregado.

O arquivo inclui:

- visão e período;
- timezone e limites temporais;
- frescor;
- versões de contrato e de definição;
- valores, unidades, estado e contexto disponíveis.

O arquivo não inclui nome, e-mail, identificador de perfil, identificador de
paciente, texto livre ou dados administrativos. A rota exige a sessão do
terapeuta, reaplica os mesmos RPCs/RLS da página, não usa service role e
responde com `private, no-store`.

Impressão/PDF permanece adiada até homologação. Não existe conversão silenciosa
de erro em relatório vazio.

## Segurança e privacidade

- acesso anônimo aos RPCs é revogado;
- terapeuta é derivado de `auth.uid()`;
- Premium/Premium Plus são validados no servidor;
- MTR-5 valida Premium Plus no servidor;
- amostra insuficiente retorna `insufficient_sample`, nunca zero inventado;
- métricas protegidas retornam coleções vazias, sem valores ocultos no payload;
- cancelamentos não expõem texto livre;
- Aura, ranking entre terapeutas e demanda agregada do portal não são
  calculados;
- logs da exportação registram operação, categoria e correlation ID
  sanitizados.

## Índices e desempenho

A migration `20260728210000_therapist_metrics_mtr4_mtr5.sql` adiciona:

- `bookings_therapist_patient_completed_starts_idx`, parcial para bookings
  concluídos por terapeuta, pessoa e início;
- `booking_reschedule_requests_applied_booking_idx`, parcial para
  reagendamentos aplicados.

Os read models retornam uma projeção por aba e evitam consulta por card.
Gráficos são montados a partir da resposta agregada. Carga com volume
representativo de produção permanece parte da homologação.

No seed local, `EXPLAIN (ANALYZE, BUFFERS)` confirmou `Index Only Scan` em
`bookings_therapist_patient_completed_starts_idx`, com execução de 0,622 ms. A
consulta de reagendamentos executou em 0,118 ms, mas o planner preferiu o índice
legado por booking devido ao conjunto pequeno. Esses tempos validam apenas o
ambiente local; não substituem o teste de carga do ambiente de homologação.

## Fidelidade e diferenças do Figma

Foram preservados hero, três abas, KPIs, hierarquia, gráficos, heatmaps,
distribuições, composição principal/aside e comportamento responsivo dos nodes
`13366:4259` e `13366:4896`.

Diferenças intencionais:

- “Sessões realizadas” não é duplicada como “Sessões concluídas”;
- motivos de cancelamento não são simulados;
- temas, motivos de saída e sentimento não usam texto clínico;
- Premium recebe bloqueio explícito da aba Interesse;
- percentuais protegidos não aparecem abaixo de 10;
- exportação inicial é CSV, não PDF;
- MTR-6/Aura permanece fora deste corte.

## Estados

As interfaces distinguem:

- `ready`;
- `empty`;
- `insufficient_sample`;
- `unavailable`;
- `capability_locked`;
- erro de sessão, permissão, payload ou infraestrutura.

Uma base anterior sem amostra suficiente é comunicada como primeira leitura,
não como tendência estável.

## Homologação pendente

- validar base legal, aviso e retenção antes de ativar telemetria pública;
- executar carga com volume semelhante ao ambiente alvo;
- validar CSV com dados homologados;
- decidir e homologar impressão/PDF;
- validar observabilidade e alertas no ambiente de destino;
- executar MTR-6 somente em fase posterior.
