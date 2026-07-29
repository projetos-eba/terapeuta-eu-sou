# Métricas & Relatórios — MTR-1 a MTR-3

Status em 2026-07-28:

| Corte                        | `implementation_status` | `data_source`                       | `qa_status`                                 | `external_homologation`              | `production_readiness`           |
| ---------------------------- | ----------------------- | ----------------------------------- | ------------------------------------------- | ------------------------------------ | -------------------------------- |
| MTR-1 — telemetria           | `functional`            | eventos objetivos deduplicados      | pgTAP, Vitest e contrato HTTP               | privacidade pendente                 | ativação pública bloqueada       |
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
`record_public_therapist_metric_events_v1`. O RPC:

- aceita no máximo 20 eventos por request;
- limita uma sessão pseudônima a 100 eventos em 24 horas;
- valida perfil público, serviço e terapia;
- deriva o terapeuta pelo slug público;
- deduplica por evento e por contexto;
- retorna conflito se o mesmo `eventId` for reutilizado com outro payload;
- ignora eventos autenticados de terapeuta ou admin;
- não armazena IP, user agent, query string, nome, e-mail ou texto livre.

`therapist_metrics_runtime_config.public_telemetry_enabled` nasce `false`.
Somente uma operação interna com service role pode ativá-la. A ativação não
deve ocorrer até a validação formal de base legal, aviso de privacidade e
retenção. Esta entrega não inventa esses requisitos.

## Agregação MTR-2

`therapist_metric_daily_aggregates` é versionada por
`definition_version = 1` e atualizada somente após um evento novo ser aceito.
Ela preserva a projeção compatível `therapist_profile_daily_analytics` sem
transformá-la em nova autoridade.

O RPC privado `get_therapist_metrics_overview_v1(period)`:

- deriva a identidade de `auth.uid()`;
- exige `advanced_metrics` e plano Premium ou Premium Plus;
- aceita somente 30 ou 90 dias locais completos;
- exclui o dia atual;
- compara com o período imediatamente anterior de mesmo tamanho;
- não retorna nome ou ID de paciente;
- inclui versão, timezone, período, frescor e copy key direcional;
- distingue `ready`, `empty`, `insufficient_sample`, `processing` e
  `unavailable`.

Read models:

- três contadores operacionais sem trava;
- série diária de sessões concluídas;
- estágios de descoberta;
- conversões por coorte pseudônima;
- favoritos do perfil com amostra mínima de 10;
- ranking das próprias terapias com amostra mínima de 10;
- ocupação explicitamente indisponível.

## Limitações Honestas

### Ocupação

Ocupação depende de minutos reserváveis oferecidos. As regras de
disponibilidade atuais não preservam histórico suficiente para reproduzir
mudanças de horário, bloqueios e buffers. Por isso o contrato retorna:

```json
{
  "status": "unavailable",
  "reason": "historical_availability_not_versioned"
}
```

Não é usado `0%`, estimativa atual aplicada ao passado ou dado do Figma.

### Descoberta

Com a telemetria desativada, o contrato retorna `unavailable` com
`privacy_activation_pending`. Após ativação:

- sem primeiro evento: `processing`;
- sem eventos em dias completos do período: `empty`;
- com eventos consolidados: `ready`.

### Favoritos e ranking

Valores abaixo de 10 não são expostos. O contrato retorna somente
`minimumSample` e `observedSample`. Favoritos nunca são quebrados por serviço,
terapia ou técnica.

## MTR-3

`/terapeuta/insights` usa leitura inicial server-side e oferece:

- hero e hierarquia baseados no Figma `13366:3628`;
- períodos compartilháveis de 30 e 90 dias;
- três KPIs operacionais;
- ritmo de sessões em barras responsivas;
- funil quando a coleta estiver autorizada e houver amostra;
- ranking das próprias terapias;
- favoritos do perfil;
- explicação explícita para ocupação indisponível;
- estados de loading, erro, zero, processamento, amostra insuficiente e
  indisponibilidade.

As abas Sessões (`13366:4259`) e Interesse (`13366:4896`) permanecem
desabilitadas até MTR-4 e MTR-5. Não são preenchidas com números do Figma.
Aura continua fora deste corte.

O E2E autenticado `tests/e2e/therapist-metrics.spec.ts` valida dados reais,
troca entre 30/90 dias e ausência de overflow horizontal em 320px, 375px,
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

## Próximos Gates

1. Aprovar base legal, aviso e retenção antes de ativar telemetria pública.
2. Versionar a oferta histórica da agenda antes de calcular ocupação.
3. Implementar MTR-4 para sessões.
4. Implementar MTR-5 para continuidade, sentimento fechado e lacuna.
5. Implementar Aura somente em MTR-6, consumindo métricas validadas.
