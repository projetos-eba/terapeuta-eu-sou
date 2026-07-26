# Preparação arquitetural de Agenda e Sessões

Atualizado em 2026-07-26.

Status: base de leitura implementada; layout final e comandos de produto
permanecem fora deste recorte.

Atualização A3 em 2026-07-26: A3.0/A3.1 adicionaram a configuração canônica de
Horários, o read model `get_therapist_schedule_v1()` e o comando atômico
`save_therapist_schedule_v1()`. A interface final permanece para A3.2.

## Objetivo

Preparar `/terapeuta/agenda`, `/terapeuta/sessoes` e
`/terapeuta/sessoes/:bookingId` para as experiências finais sem criar novas
fontes de booking, pagamento ou reunião. A entrega separa leitura de comandos,
centraliza contratos, preserva A2/F0/Zoom e diferencia erro real de ausência de
dados.

## Estado anterior

- páginas de Sessões montavam URLs PostgREST, joins e regras diretamente;
- falhas podiam virar listas vazias por `catch(() => [])`;
- a UI combinava horário, `bookings.status` e
  `bookings.payment_status` para decidir entrada no Zoom;
- o shell carregava o dashboard Premium Plus inteiro para obter dois
  contadores;
- listas não tinham cursor ou contrato evolutivo de filtros;
- `booking.status` era exibido como se representasse pagamento, realização e
  presença;
- cards do paciente podiam abrir `meeting_url` diretamente;
- documentação Zoom ainda tratava bloqueio de perfil, pagamento canônico e
  cookies simultâneos como pendências.

## Estado novo

- `therapist_session_read_model_v1` compõe reserva, pagamento, realização,
  presença disponível, reagendamento, cancelamento e estado local Zoom;
- RPCs versionadas derivam o terapeuta de `auth.uid()`:
  - `get_therapist_agenda_v1`;
  - `get_therapist_sessions_v1`;
  - `get_therapist_session_detail_v1`;
  - `get_therapist_shell_counters_v1`;
- `get_therapist_sessions_v1` usa cursor `(startsAt, bookingId)` e filtros
  opcionais de período, booking, pagamento, paciente, serviço e modalidade;
- intervalos de Agenda e filtros temporais usam `[start, end)`;
- páginas consomem serviços de aplicação com resultados discriminados
  `success`, `empty` e `error`;
- o mapper puro de apresentação determina rótulo, descrição, prioridade, tom e
  ações disponíveis sem alterar estados transacionais;
- acesso Zoom expõe `allowed`, `reason`, `availableFrom`, `availableUntil` e
  `meetingStatus`; a Edge Function repete a autorização no clique;
- a rota Next exige `actorRole` e seleciona o cookie correspondente;
- contadores do shell usam uma RPC pequena em todos os planos autorizados;
- logs de servidor e Zoom usam campos permitidos e mensagens sanitizadas.

## Fontes canônicas

| Responsabilidade             | Fonte                                              |
| ---------------------------- | -------------------------------------------------- |
| Reserva, horário e snapshots | `bookings`                                         |
| Holds e conflitos            | `booking_holds`, exclusion GiST e RPCs A2          |
| Pagamento de sessão          | `session_payments.financial_status`                |
| Realização                   | `session_payments.service_status`                  |
| Repasse                      | `session_payments.transfer_status` e estruturas F0 |
| Reagendamento                | `booking_reschedule_requests`                      |
| Cancelamento financeiro      | `session_cancellation_decisions`                   |
| Sala local e outbox          | `zoom_meetings`, `zoom_meeting_jobs`               |
| Entrada na sala              | `zoom-meeting-access`                              |
| Presença                     | ainda não há autoridade independente               |

`bookings.payment_status`, `payments` e `booking_payment_receipts` continuam
como projeções de compatibilidade. Nenhuma decisão crítica nova depende deles.

## Classificação de `payment_status`

- `src/`: removido das consultas e decisões de Agenda, Sessões e detalhe do
  paciente.
- `supabase/functions/zoom-jobs-process`: removido da leitura; o job usa
  `session_payments`.
- `supabase/functions/stripe-billing-webhook`: a ocorrência restante é
  `Checkout.Session.payment_status` da API Stripe, não
  `bookings.payment_status`.
- migrations e seed: mantidos para backfill, projeção F0 e compatibilidade
  histórica.
- views públicas antigas: a migration desta entrega redefine os agregados e
  reviews para exigir `session_payments.financial_status = paid`.

## Fluxo de dados

```text
Auth cookie do papel
  -> requireTherapistSession
  -> serviço de aplicação
  -> RPC security invoker
  -> RLS + auth.uid()
  -> therapist_session_read_model_v1
       -> bookings/snapshots
       -> session_payments
       -> reschedule/cancellation
       -> zoom_meetings
  -> parser de contrato
  -> mapper de apresentação
  -> Server Component

Clique em "Entrar"
  -> /api/zoom/meeting-access { actorRole, bookingId, intent }
  -> Edge Function autorizada
  -> ownership + status do terapeuta
  -> session_payments + booking + janela + zoom_meetings
  -> JWT Meeting SDK e ZAK efêmero apenas quando permitido
```

Os comandos de hold, criação, transição e reagendamento continuam nas
primitivas A2. A UI não recria locks, idempotência ou detecção de conflito.

## Contratos

Os tipos centrais estão em `src/features/bookings`:

- `SessionReadModelItem`;
- `TherapistSessionsReadModel`;
- `TherapistSessionDetailReadModel`;
- `TherapistAgendaReadModel`;
- `TherapistShellCounters`;
- `ZoomAccessState`;
- `SessionPresentation`;
- `ReadModelResult<T>`.

O parser valida o JSON em runtime. Payload ausente, payload inválido, RLS,
sessão expirada e indisponibilidade não são convertidos em estado vazio.

## Estado de apresentação

Precedência atual:

1. reembolso;
2. booking encerrado/cancelado;
3. reagendamento pendente;
4. pagamento pendente/processando;
5. falha, disputa ou revisão manual;
6. realização concluída;
7. reunião em andamento;
8. acesso Zoom autorizado;
9. sala em preparação;
10. booking confirmado;
11. revisão operacional.

Estados visíveis:

- Pagamento pendente;
- Confirmada;
- Pronta para iniciar;
- Em andamento;
- Reagendamento solicitado;
- Realizada;
- Cancelada;
- Reembolsada;
- Sala em preparação;
- Requer atenção.

O mapper também produz ação principal, ações secundárias e flags de capacidade.
Cor nunca é a única informação.

## Erros e observabilidade

Erros de leitura são mapeados para códigos seguros:

- `session_expired`;
- `forbidden`;
- `invalid_filter`;
- `invalid_contract`;
- `not_found`;
- `unavailable`.

Logs incluem somente operação, correlation ID, booking ID quando seguro, papel,
código, duração e status externo sanitizado. Tokens, secrets, ZAK, `start_url`,
payload Stripe/Zoom e conteúdo clínico não são registrados.

O shell mantém continuidade com contadores zero quando a RPC de contadores
falha, mas registra a falha estruturada; esse fallback não é interpretado como
lista de domínio vazia.

## Segurança

- as RPCs não aceitam `therapist_profile_id`;
- paciente não invoca read models de terapeuta;
- Rafael recebe `null` ao solicitar booking de Ana;
- terapeuta suspenso/rejeitado é bloqueado;
- a view é `security_invoker` e depende de RLS das tabelas;
- a nova policy permite ler apenas as próprias `availability_exceptions`;
- o detalhe não retorna `_therapistProfileId`, `_meetingReady`, host ID,
  passcode, ZAK ou URL de host;
- credenciais Zoom são geradas sob demanda e não persistidas;
- o Next usa apenas token autenticado e chave publicável;
- dados financeiros permanecem somente leitura no frontend.

## Datas e paginação

- instantes persistidos e transportados em UTC;
- timezone do terapeuta/booking acompanha o read model;
- formatação acontece na borda com `Intl.DateTimeFormat`;
- timezone inválido cai para `America/Sao_Paulo`;
- intervalos de consulta são semiabertos;
- cursor descendente é o par estável `(startsAt, bookingId)`;
- filtros ficam refletidos na URL e são preservados na próxima página.

## Testes

- Vitest: mapper composto, ação principal, pagamento canônico, cancelamento,
  sala em preparação, filtros, cursor, timezone, erro versus vazio e adaptador
  Zoom.
- Deno: pagamento, cancelamento, janela, provisionamento, ownership e perfil
  suspenso no acesso Zoom.
- pgTAP: identidade por `auth.uid()`, dados próprios, bloqueio entre
  terapeutas, paciente bloqueado, suspenso bloqueado, pagamento canônico,
  janela, cursor, filtros, range semiaberto e contadores para plano não Plus.
- A2/F0 existentes continuam cobrindo conflito, operação repetida, booking
  alterado, hold expirado, ledger, RLS e idempotência.

Resultados desta entrega:

| Validação                              | Resultado                             |
| -------------------------------------- | ------------------------------------- |
| `npx supabase db reset`                | passou com migration e seed completos |
| `npx supabase db lint --schema public` | passou, sem erros de schema           |
| `npx supabase test db`                 | 87 testes passaram                    |
| `npm run typecheck`                    | passou                                |
| `npm run lint`                         | passou, sem warnings/erros de lint    |
| `npm run test`                         | 65 testes passaram                    |
| `npm run test:deno`                    | 41 testes passaram                    |
| `npm run test:zoom`                    | 11 Deno + 3 Vitest passaram           |
| `npm run build`                        | passou, 55 rotas geradas/analisadas   |
| Playwright Chromium                    | 3 fluxos passaram                     |

O primeiro `test:deno` encontrou runtime ausente e depois restrição de rede; o
Deno foi instalado fora das dependências do app e os módulos oficiais foram
baixados com autorização. O primeiro Playwright encontrou Chromium ausente e,
depois, Edge Functions não servidas. Ambos os bloqueios de ambiente foram
corrigidos e as suítes finais passaram.

Testes reais Stripe/Zoom contra provedores externos não foram executados porque
exigem secrets e recursos de homologação. As suítes locais de F0, Zoom e
read models foram executadas.

## Arquivos da entrega

Banco e tipos:

- `supabase/migrations/20260726110000_agenda_sessions_read_models.sql`;
- `supabase/tests/004_agenda_sessions_read_models.sql`;
- `src/lib/supabase/database.types.ts`;
- `src/lib/supabase/server-rest.ts`.

Contratos e aplicação:

- `src/domain/tes/booking-contracts.ts`;
- `src/features/bookings/index.ts` e `session-*`;
- `src/features/therapist-agenda/*`;
- `src/features/therapist-sessions/*`;
- `src/features/therapist-shell/therapist-shell-counters.ts`;
- `src/lib/observability/server-operation-log.ts`.

Rotas e shell:

- páginas canônicas de Agenda, Sessões e detalhe em
  `src/app/(therapist)/terapeuta`;
- `src/features/therapist-shell/{index,therapist-area-layout}.tsx`.

Zoom e paciente:

- `/api/zoom/meeting-access`;
- `src/features/zoom/zoom-meeting-adapter*`;
- `supabase/functions/_shared/zoom/{access-policy,booking-authorization,observability,zoom.test}.ts`;
- `supabase/functions/{zoom-meeting-access,zoom-jobs-process}/index.ts`;
- detalhe, encontros e overview autenticados do paciente em
  `src/features/{booking-detail,patient-encounters,patient-overview,patient-session-detail}`.

Testes e documentação:

- `tests/e2e/therapist-agenda-sessions.spec.ts`;
- este relatório, ADRs 002-004, projeto consolidado, relatório arquitetural,
  vocabulário, matriz de schema, docs de pagamentos/Zoom, `AGENTS.md` e skills
  de Agenda/Sessões e Zoom.

## Débitos preservados

- presença ainda não possui tabela/estado canônico independente; no-show é
  projetado de `bookings` com fonte `booking_compatibility`, demais casos usam
  `unavailable`;
- modalidade ainda é derivada de `therapist_services.online_only`, não de um
  snapshot imutável do booking;
- `bookings.meeting_url` permanece para integrações externas legadas e deve
  migrar para um read model autorizado por provedor;
- o dashboard Premium Plus ainda possui agregados de compatibilidade anteriores
  a esta entrega;
- comandos visuais de presença, conclusão, cancelamento e reagendamento ainda
  precisam ser ligados às Edge Functions/RPCs próprias;
- a UI implementada é provisória e não substitui o layout final do Figma.

## Pendências para produção

- homologar ZAK e General App no Zoom Marketplace;
- definir pool/capacidade de hosts licenciados;
- configurar cron e webhook remotos;
- definir retenção legal de eventos Zoom;
- atribuir e deduplicar participações antes de usá-las como presença;
- criar snapshot canônico de modalidade;
- fechar read model autorizado de sessão para paciente/admin;
- executar testes reais Stripe/Zoom no ambiente alvo;
- adicionar telemetria para remoção futura dos aliases de rota e projeções
  financeiras legadas.

## Plano para a implementação visual

1. concluir o calendário visual sobre `TherapistAgendaReadModel`; a aba
   Horários já usa o read model A3 e os insights permitidos da Agenda;
2. concluído em A3.2: alterações de horários usam a Edge Function
   `therapist-schedule-update`;
3. implementar filtros de Sessões controlados pela URL e paginação incremental;
4. conectar ações do mapper aos comandos autorizados;
5. criar estados responsivos de loading, erro, vazio e conflito;
6. validar Figma em desktop, tablet e mobile com Playwright;
7. reutilizar os mesmos contratos permitidos nas superfícies paciente/admin.
